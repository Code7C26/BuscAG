# BuscAG-Staging: instalación automática desde la computadora del operador

No se conectó a staging en esta ejecución: el entorno sólo identifica variables del
cliente y no tiene credenciales/referencia autorizadas de BuscAG-Staging. Los dos
bootstrap figuran aplicados por declaración del operador, todavía no por inspección
remota. No se accedió a producción ni se modificó Firebase.

## Qué hace la herramienta

`npm run prepare:staging` utiliza una conexión PostgreSQL privada de **staging**,
exclusivamente BUSCAG_STAGING_DATABASE_URL. No carga .env ni usa claves VITE/producción.
Se ejecuta desde src/code, con Node compatible con el proyecto y `npm ci` instalado.

Rechaza la referencia conocida de producción, localhost, destinos ajenos a Supabase,
un proyecto distinto al indicado, usuario distinto de postgres, parámetros extra y
puerto de transaction pooler (6543). Permite conexión directa db.REF.supabase.co o
pooler de **sesión**, usuario postgres.REF, puerto 5432. Siempre verifica certificado
TLS; sslmode=require en la URL no desactiva esa verificación. Ante un fallo de CA,
configurar el certificado oficial de confianza mediante NODE_EXTRA_CA_CERTS; no usar
sslmode=disable ni NODE_TLS_REJECT_UNAUTHORIZED=0.

Esto reduce equivocaciones, pero no descubre el nombre del proyecto desde PostgreSQL:
el operador debe comprobar que el REF corresponde a BuscAG-Staging en su Dashboard.
No pegar conexión/contraseñas en el chat, comandos guardados ni archivos versionados.

Antes de escribir verifica tipos/columnas, RLS, ocho FK validadas, tres funciones y
triggers bootstrap, bucket item-images, políticas de Storage y publicación Realtime.
No tolera cuerpos personalizados de esas tres funciones sin revisión previa ni
triggers adicionales de aplicación que puedan tener efectos externos. No demuestra
igualdad completa de todos los índices, defaults, políticas o servicios administrados.
Si algo difiere, se detiene; no reinstala silenciosamente los dos bootstrap.

## Orden automático

No ejecuta 20261014000000 ni 20261015000000 de nuevo. Los verifica. Después:

1. migrations/20261016000000_notification_permissions.sql
2. migrations/20261103000000_secure_items_messages.sql
3. migrations/20261103001000_private_profiles_public_directory.sql
4. migrations/20261103002000_secure_notifications.sql
5. migrations/20261103003000_ensure_private_push_subscriptions.sql
6. proposals/20261104000000_message_receipts.sql
7. proposals/20261104001000_trusted_matches.sql
8. proposals/20261104002000_publication_receipts.sql
9. proposals/20261104003000_validate_legacy_compatible_writes.sql

La corrección de octubre sólo se adopta sin ejecutarla si el cuerpo de recuperación
y su ACL ya coinciden; de lo contrario, requiere el cuerpo bootstrap conocido y la
aplica. Las ocho migraciones siguientes se ejecutan una sola vez por esta herramienta.

Crea un registro administrativo privado buscag_staging_admin.applied_sql, fuera del
esquema expuesto public, con posición, nombre, SHA-256 y fecha. RLS activa y sin
permisos para roles API. Cada registro se confirma **en la misma transacción** que
su SQL. Un bloqueo de sesión impide dos instaladores simultáneos. Verifica que los
conteos existentes de usuarios, perfiles, publicaciones, mensajes, avisos y
suscripciones no cambien al instalar. No modifica tipos de fecha ni borra filas.

Una repetición omite los pasos registrados; no reejecuta los SQL para corregir drift.
Un checksum distinto, objetos candidatos sin historial o estado parcial desconocido
exigen revisión. Si un paso falla, los anteriores permanecen confirmados: se puede
reanudar tras resolver la causa, con los mismos archivos. No borrar el registro ni
buscag_private, ni repetir bootstrap para reparar errores.

## PowerShell: conexión privada y ejecución

Primero verificar la rama Alexis y disponer de los archivos de esta revisión en la
computadora. El script y esta guía no se suben automáticamente a GitHub. Respaldar
cualquier dato de prueba valioso en staging antes de aplicar. No usar el dump de
producción para estas pruebas: bastan datos ficticios y servicios staging.

En Supabase Dashboard, seleccionar **BuscAG-Staging**, revisar su project ref y
copiar la URI PostgreSQL directa o del pooler de sesión de ese proyecto. Completar
la contraseña sólo en la entrada oculta local; caracteres especiales deben estar
codificados para una URI. No reutilizar credenciales de producción.

Desde el directorio src/code, el siguiente bloque pide la URI sin mostrarla ni
guardarla en el historial de PowerShell; queda temporalmente en el entorno del
proceso. La referencia no es secreta. No activar transcripciones ni logs de entorno.

```powershell
$stagingRef = Read-Host 'Project ref de BuscAG-Staging (no producción)'
$stagingSecret = Read-Host 'URI PostgreSQL privada de staging' -AsSecureString
try {
  $env:BUSCAG_STAGING_DATABASE_URL = [System.Net.NetworkCredential]::new('', $stagingSecret).Password
  npm run prepare:staging -- --project-ref $stagingRef --plan
  if ($LASTEXITCODE -ne 0) { throw 'Plan detenido; no aplicar.' }
  npm run prepare:staging -- --project-ref $stagingRef --apply
  if ($LASTEXITCODE -ne 0) { throw 'Instalación detenida; revisar pasos confirmados.' }
  npm run prepare:staging -- --project-ref $stagingRef --verify
  if ($LASTEXITCODE -ne 0) { throw 'Verificación pendiente; no activar servicios.' }
  npm run prepare:staging -- --project-ref $stagingRef --smoke
  if ($LASTEXITCODE -ne 0) { throw 'Prueba DB pendiente; no declarar staging listo.' }
} finally {
  Remove-Item Env:BUSCAG_STAGING_DATABASE_URL -ErrorAction SilentlyContinue
  $stagingSecret.Dispose()
}
```

`--plan` sólo consulta catálogo; `--apply` instala y comprueba; `--verify` revisa RLS,
ACL, inventario de políticas, RPC y modo de coincidencias deshabilitado; `--smoke`
prueba datos ficticios con ROLLBACK. Se pueden ejecutar por separado, manteniendo la
misma variable privada temporal. Los errores SQL se informan sin imprimir URI,
contraseña, filas personales ni mensajes del servidor potencialmente sensibles.

## Prueba funcional automatizada y límites

La prueba DB crea tres filas Auth ficticias (sin contraseñas ni login), verifica
creación de perfiles por trigger, dos publicaciones mediante publish_item_once,
reintentos con el mismo ID, coincidencias para ambos propietarios sin duplicados,
mensajes recíprocos idempotentes, contador de contacto, notificaciones, privacidad
frente a tercero, protección de rating, edición y recuperación conservando mensajes.
Activa coincidencias **sólo dentro de esa transacción**, procesa la cola y siempre
hace ROLLBACK, incluso ante errores. Compara los conteos y el indicador después.
No crea cuentas persistentes para entrar desde el navegador ni sube imágenes.

Hacer --smoke en staging sin otros tests/escrituras concurrentes: una variación de
conteos podría ser actividad ajena. No programar todavía worker/webhooks externos:
el chequeo de triggers ayuda, pero no es un sandbox para extensiones arbitrarias.
No se garantiza reversión de efectos externos de una función desconocida.

Para probar realmente frontend y Supabase, en la computadora crear una configuración
**local no versionada**, con URL/clave publicable obtenidas de BuscAG-Staging y
VITE_APP_URL=http://localhost:3000 para desarrollo. Confirmar que Git ignore ese
archivo y que el navegador envíe peticiones sólo al ref staging. Nunca cambiar las
variables Firebase publicadas ni poner la URI PostgreSQL en VITE_*.

Configurar Site URL/redirects de staging para localhost. Ejecutar npm run dev, crear
dos cuentas ficticias mediante Auth real y comprobar confirmación, login, recuperación
y logout. Publicar fotos propias, editar, conversar desde dos navegadores, comprobar
recibos/avisos y reconectar Realtime. El bootstrap crea item-images público, límite
5 MiB y MIME JPG/PNG/WebP; no demuestra por sí solo subida/descarga vía API.

Coincidencias automáticas quedan **deshabilitadas** al finalizar instalación/prueba.
Configurar después Edge Function process-matches, secreto independiente y scheduler;
activar sólo con heartbeat y procedimiento BACKEND_ACTIVATION.md. Push requiere
VAPID, send-push, webhook y navegador: no queda instalado/configurado por estos SQL.

## Evidencia local, no resultados remotos

`npm run test:staging-tools` reproduce exactamente los dos bootstrap y prueba el
instalador en bases descartables: guardas de conexión, nueve pasos, segunda ejecución
sin repetirlos, rechazo de estado parcial/checksum modificado, fallo intermedio y
reanudación, prueba DB con ROLLBACK. Puede repetirse en PostgreSQL nativo mediante
LOCAL_PG_SOCKET y BUSCAG_TEST_CLUSTER=disposable con el adaptador existente.
Esto simula Auth/Storage estructurales; no prueba los servicios Supabase remotos.

Resultados de esta ejecución (sin conexiones remotas):

- Herramienta staging: 4/4 en PGlite y 4/4 en PostgreSQL 17 nativo.
- Aplicación: 102/102; cliente/privacidad: 16/16; TypeScript y build correctos.
- Matriz SQL PGlite: 58/58 DATE, 58/58 timestamptz, 61/61 esquema observado DATE,
  más 1/1 instalación completa en orden. Los escenarios se repiten entre variantes.
- El nuevo instalador se ensayó con el esquema timestamptz de los dos bootstrap
  indicados; las pruebas existentes cubren además DATE. Servicios reales, login,
  correo, Storage y Realtime de BuscAG-Staging siguen pendientes.
