# Sincronización autorizada de German · 15/11/2026

Referencias remotas originales:

- German: `074539db8bcb2d67058c982dc18845dd32227a31`.
- Alexis: `176bf6b473abae2586f85db429e8c1fb0845990c`.
- main: `a51019bd1abd91c23785619dfdc4c7a857eb3fcb`.

German era ancestro de Alexis y main; no había commits exclusivos ni conflictos que resolver. main contiene todo Alexis y una corrección adicional de compatibilidad de paleta del tráiler V1. Se preparó un avance directo al main original y un commit de higiene sin modificar funcionalidades.

Se conservan todos los commits de las tres referencias. Se retiran del árbol final de German un archivo temporal de Office y `src/code/env.local`, una configuración local que sólo contenía la URL y la clave pública de cliente. Se añaden reglas para no volver a versionarlos. La configuración de ejemplo permanece. No se reescribe ni elimina el historial.

Respaldos etiquetados: `backup/german-sync-20261115/German-074539db`, `backup/german-sync-20261115/Alexis-176bf6b4` y `backup/german-sync-20261115/main-a51019bd`. También se verificó un bundle local de las referencias originales antes de preparar la integración.

Verificación de la copia candidata: las 17 etapas de `npm run qa:local` aprobadas, incluidas pruebas unitarias, TypeScript, build, 106 casos de navegador, PWA, presentación y 18 comprobaciones de seguridad del cliente. Backend PostgreSQL 17 aislado, sin red: tipos date/timestamptz, forma observada y 26 pruebas adicionales de actualización. Tráiler V1 y V2: 5 pruebas aprobadas cada uno y typecheck. Edge Functions send-push y process-matches: deno check --frozen aprobado. Los recursos generados de audio se prepararon según el README antes de probar el tráiler.

Detector de secretos revisado: seis hallazgos del árbol final son huellas SHA256 de SQL conocido, no credenciales. El historial incluye además la clave pública de cliente ya existente; no se incorporan claves privadas. No se publican los valores en este informe.

No se modifican las referencias main ni Alexis. Publicación únicamente de German, mediante push normal, sin force-push, PR, merge a otras ramas ni despliegues. No se aplica SQL ni configuración en Supabase real y no se despliega Firebase.

## QR GitHub de la presentación

La URL canónica es https://github.com/Code7C26/BuscAG. El repositorio es privado: GitHub devuelve 404 a quien no tiene acceso, incluso con el QR correcto. Debe abrirse con una cuenta GitHub propietaria o invitada; la sesión de BuscAG o ChatGPT no concede ese permiso. No se cambia la visibilidad del repositorio. La presentación independiente y sus ZIP conservan su rama de entrega; esta sincronización toma únicamente main y Alexis.
