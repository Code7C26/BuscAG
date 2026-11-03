# Desarrollo de BuscAG

La única rama de desarrollo activo es `Alexis`. Trabajar y hacer commits directamente
allí; no crear ramas ni Pull Requests nuevos. Sincronizar y revisar cambios remotos
antes de cada push normal. Nunca force-push ni sobrescribir historial.

Conservar `main` y `German` intactas. No modificar ni borrar ramas de compañeros.
Sólo retirar ramas temporales explícitamente autorizadas tras comprobar que sus
avances están en Alexis y que no contienen trabajo ajeno pendiente.

No rediseñar la interfaz ni cambiar estilos. No eliminar funcionalidades ni datos.
No ejecutar SQL de escritura/migraciones en Supabase real, ni desplegar Firebase.
Preparar y probar SQL exclusivamente en bases aisladas; cualquier aplicación en
producción requiere autorización específica. No introducir secretos en Git.

Antes de cada push ejecutar desde `src/code`: `npm test`, `npm run lint`,
`npm run build` y `node tests/client-security.mjs`. `lint` verifica TypeScript.
Si se toca SQL, ejecutar `tests/security.mjs` en PostgreSQL aislado con ambos tipos
admitidos de items.date: `date` y `timestamptz`; nunca usar una conexión de producción.
Las Edge Functions tienen deno.json/lock propios: comprobar con `deno check --frozen`.

Los informes de los PR #23–#26 conservan su contexto histórico; las instrucciones
actuales de rama son las de este archivo y `src/code/ALEXIS_DEVELOPMENT.md`.
