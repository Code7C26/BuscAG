// Offline build only. No deployment, migration or service access.
import { spawnSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateReleaseEnvironment, PRODUCTION_REF } from '../lib/releaseEnvironment.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const fail = message => { console.error(message); process.exit(1); };
if (process.argv.length !== 2) fail('build:release no admite argumentos. Configurar únicamente variables públicas de producción.');
const error = validateReleaseEnvironment(process.env);
if (error) fail(error);
const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const sha = git(['rev-parse', 'HEAD']);
const status = git(['status', '--porcelain']);
if (sha.status !== 0 || status.status !== 0 || status.stdout.trim()) fail('Release requiere un checkout Git limpio y un commit identificable.');
const env = { ...process.env };
// Vite release mode sets envDir=false; no dotenv can override the reviewed inputs.
const build = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), 'build', '--mode', 'release'], { cwd: root, env, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);
const files = [];
async function inventory(relative = '') {
  const dir = new URL(`../dist/${relative}`, import.meta.url);
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = relative + entry.name;
    if (entry.isDirectory()) await inventory(name + '/');
    else if (entry.isFile()) {
      const bytes = await readFile(new URL(`../dist/${name}`, import.meta.url));
      files.push({ path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    } else fail('Artefacto inesperado: release sólo admite archivos y directorios.');
  }
}
await inventory();
await writeFile(new URL('../dist/release-manifest.json', import.meta.url), JSON.stringify({
  commit: sha.stdout.trim(), project_ref: PRODUCTION_REF, app_origin: new URL(env.VITE_APP_URL).origin,
  key_binding: env.VITE_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_') ? 'opaque_public_key_requires_dashboard_confirmation' : 'anon_jwt_ref_checked_not_signature',
  approval: 'NOT_APPROVED_BY_BUILD', files: files.sort((a,b) => a.path.localeCompare(b.path)),
}, null, 2) + '\n');
console.log('Build de release e inventario SHA-256 listos en dist. NO autoriza ni ejecuta despliegue, migraciones o integración a main.');
