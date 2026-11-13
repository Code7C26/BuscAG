import { createInterface } from "node:readline";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
const dir =
  process.env.PRESENTATION_DATA_DIR ||
  resolve(dirname(fileURLToPath(import.meta.url)), "../data");
if (!process.stdin.isTTY) {
  console.error(
    "Ejecutar setup en una terminal interactiva. Alternativa: variable de servidor PRESENTATION_ADMIN_PASSWORD.",
  );
  process.exit(1);
}
process.stdout.write(
  "Nueva contraseña de administración (mínimo 12 caracteres, entrada oculta): ",
);
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});
rl._writeToOutput = () => {};
rl.question("", async (password) => {
  rl.close();
  console.log("");
  if (password.length < 12) {
    console.error("La contraseña debe tener al menos 12 caracteres.");
    process.exitCode = 1;
    return;
  }
  const salt = randomBytes(16).toString("hex");
  await mkdir(dir, { recursive: true });
  await writeFile(
    resolve(dir, "auth.json"),
    JSON.stringify({
      salt,
      hash: scryptSync(password, salt, 64).toString("hex"),
    }),
    { mode: 0o600 },
  );
  console.log("Acceso configurado. Reiniciar el servidor.");
});
