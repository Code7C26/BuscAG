// Explicit staging-backed school artifact. Never deploys or modifies remote services.
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {inventoryCandidate} from '../lib/candidateArtifact.mjs';
import {
  presentationEnvironment,
  validatePresentationEnvironment,
  PRESENTATION_APP_URL,
} from "../lib/presentationEnvironment.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
try {
  const candidate=process.argv.length===3&&process.argv[2]==='--rc';
  if (process.argv.length !== 2&&!candidate)
    throw Error(
      "build:presentation no admite argumentos ni destinos alternativos.",
    );
  const env = presentationEnvironment(process.env);
  const error = validatePresentationEnvironment(env);
  if (error) throw Error(error);
  const git = (args) =>
    spawnSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  const sha = git(["rev-parse", "HEAD"]);
  const status = git(["status", "--porcelain"]);
  const branch=git(['branch','--show-current']);
  if(candidate&&(branch.status!==0||branch.stdout.trim()!=='Alexis'))throw Error('La candidata requiere Alexis.');
  if (sha.status !== 0 || status.status !== 0 || status.stdout.trim())
    throw Error(
      "La presentación requiere checkout limpio y commit identificable.",
    );
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/vite/bin/vite.js", import.meta.url),
      ),
      "build",
      "--mode",
      "presentation",
    ],
    { cwd: root, env: {...env,BUSCAG_BUILD_COMMIT:sha.stdout.trim()}, stdio: "inherit" },
  );
  if (result.status !== 0) throw Error("No se pudo compilar la presentación.");
  const files=await inventoryCandidate(fileURLToPath(new URL('../dist-presentation/',import.meta.url)));
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  await writeFile(
    new URL("../dist-presentation/presentation-manifest.json", import.meta.url),
    JSON.stringify(
      {
        commit: sha.stdout.trim(),
        mode: "presentation",
        version:pkg.version,
        release_candidate:candidate,
        backend: "BuscAG-Staging",
        project_ref: "yiarlhpbgkofhhipkfha",
        app_origin: PRESENTATION_APP_URL,
        approval: "REQUIRES_LIVE_REHEARSAL_AND_DEPLOY_AUTHORIZATION",
        files: files.sort((a, b) => a.path.localeCompare(b.path)),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Presentación compilada en dist-presentation, aislada de dist de producción. NO se desplegó Firebase ni se modificó Supabase.",
  );
} catch {
  console.error(
    "No se pudo preparar el artefacto. Revisar clave PUBLICABLE de staging, checkout limpio y build. No se imprimen credenciales.",
  );
  process.exitCode = 1;
}
