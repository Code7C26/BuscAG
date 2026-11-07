# BuscAG-Staging: instalación automática desde la computadora del operador

**Conexión bloqueada o error UNKNOWN:** consultar
[diagnóstico seguro por etapa](STAGING_CONNECTION_DIAGNOSTICS.md). En Windows usar
`npm.cmd run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-plan`;
debe mostrar el banner **diagnóstico 2** y nunca requiere desactivar TLS.

## Actualización de una instalación existente

**Para BuscAG Prueba `yiarlhpbgkofhhipkfha`, que ya tiene las funciones escolares,
usar [STAGING_UPGRADE.md](STAGING_UPGRADE.md).** Los modos nuevos `--upgrade-plan` y
`--upgrade-verify` son de sólo lectura remota y no necesitan historial de migraciones.
No ejecutar el `--apply` del baseline para actualizar esa instalación. El instalador
lo rechaza si encuentra `recovery_confirmations`, incluso sin su registro propio.

El procedimiento histórico que sigue sirve para un baseline verificado sin las
funciones escolares. No es la secuencia de actualización de Prueba.

**Frontend tras instalar:** ver [STAGING_FRONTEND_TESTS.md](STAGING_FRONTEND_TESTS.md). El operador confirmó las nueve migraciones, verify y smoke correctos; no repetir instalación para empezar esas pruebas.

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
configurar el certificado oficial mediante BUSCAG_STAGING_CA_FILE, como se explica
abajo; no usar
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

## Resolver SELF_SIGNED_CERT_IN_CHAIN en Windows

Este error corresponde a TLS, antes de autenticar o consultar el esquema. Si la
cadena termina en Supabase Root 2021 CA y esa raíz no está en el almacén utilizado
por Node, ni tener un puerto abierto ni una contraseña correcta soluciona el fallo.
`--use-system-ca` sólo ayuda si el almacén del sistema ya confía en esa raíz.

La documentación oficial indica descargar el certificado de Database Settings y
usarlo para verificación completa de CA y nombre:

- https://supabase.com/docs/guides/database/psql
- https://supabase.com/docs/guides/platform/ssl-enforcement

El código oficial del Dashboard publica la URL en:
https://github.com/supabase/supabase/blob/f1b8af12b8019069245266f3546600b37ce06651/apps/studio/hooks/custom-content/custom-content.json

La plantilla para la plataforma alojada resuelve a:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

`prod` en ese nombre identifica la infraestructura alojada de Supabase, no una
conexión a la base de producción de BuscAG. El archivo es un certificado público,
no una contraseña. **Descargarlo desde el Dashboard HTTPS autenticado de
BuscAG-Staging, Database Settings > SSL Configuration > Download certificate.**
No exportar la raíz presentada por una conexión con validación desactivada para
convertirla automáticamente en confiable. No instalar raíces globales en Windows
para resolver sólo esta herramienta.

Se verificó la procedencia de la URL mediante el repositorio oficial, pero la
política de red de este entorno bloqueó descargar el archivo CA. Por eso no se
certifica aquí la huella del archivo oficial. La huella informada por el operador:

```
80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
```

es un dato para comparar, **no una prueba independiente de autenticidad**. La fuente
confiable es la descarga oficial por HTTPS. Si el certificado descargado allí no
coincide, detenerse y consultar a Supabase; no aceptar el recibido del servidor sólo
porque tenga un nombre familiar. Para ver la huella del archivo descargado en
PowerShell (huella del certificado DER, no hash de los bytes del archivo PEM):

```powershell
$env:BUSCAG_STAGING_CA_FILE = Join-Path $env:USERPROFILE 'Downloads\prod-ca-2021.crt'
node --input-type=module -e "import{readFileSync}from'node:fs';import{X509Certificate}from'node:crypto';console.log(new X509Certificate(readFileSync(process.env.BUSCAG_STAGING_CA_FILE)).fingerprint256)"
```

Cambiar sólo la ruta si el Dashboard lo guardó con otro nombre. La herramienta
comprueba que sea un único PEM de hasta 64 KiB, CA raíz autofirmada y vigente;
rechaza archivos con claves privadas o contenido adicional. La confianza en su
procedencia se establece al descargarlo por el canal oficial, no por su autofirma.
Opcionalmente BUSCAG_STAGING_CA_SHA256 fija una huella contrastada por ese canal;
una discrepancia detiene la ejecución. No copiar como pin una huella obtenida sólo
con TLS desactivado.

Con la URI temporal y `$stagingRef` configurados mediante la entrada oculta del bloque
siguiente, ejecutar **sólo diagnóstico, sin migraciones**:

```powershell
npm run prepare:staging -- --project-ref $stagingRef --plan
```

No ejecutar --apply para probar TLS. Sólo continuar con la instalación en una operación posterior autorizada, cuando
el plan termine correctamente. El bloque siguiente también ejecuta sólo --plan.
`rejectUnauthorized:true`, SNI con el host real del pooler, verificación estándar de
hostname y TLS mínimo 1.2 permanecen activos. La URL no puede sobreescribir esas
opciones con sslmode, sslrootcert o parámetros extra. La CA explícita se usa sólo en
el cliente PostgreSQL del instalador, sin modificar la confianza del navegador o
Firebase. Sin BUSCAG_STAGING_CA_FILE se conserva el almacén de confianza de Node.

Los errores muestran categoría y código: TLS (incluido SELF_SIGNED_CERT_IN_CHAIN),
autenticación (28P01), conexión/DNS, permisos (42501) o estructura/SQL. No imprimen
URI, contraseña, host privado, mensajes crudos del servidor ni stack. La huella de
la CA configurada sí es pública y se muestra para revisión.

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
$env:BUSCAG_STAGING_CA_FILE = Join-Path $env:USERPROFILE 'Downloads\prod-ca-2021.crt'
$stagingRef = Read-Host 'Project ref de BuscAG-Staging (no producción)'
$stagingSecret = Read-Host 'URI PostgreSQL privada de staging' -AsSecureString
try {
  $env:BUSCAG_STAGING_DATABASE_URL = [System.Net.NetworkCredential]::new('', $stagingSecret).Password
  npm run prepare:staging -- --project-ref $stagingRef --plan
  if ($LASTEXITCODE -ne 0) { throw 'Plan detenido; no aplicar.' }
} finally {
  Remove-Item Env:BUSCAG_STAGING_DATABASE_URL -ErrorAction SilentlyContinue
  $stagingSecret.Dispose()
}
```

**El bloque anterior no aplica migraciones ni hace pruebas con escrituras.**
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


Corrección TLS (esta revisión, sin ejecutar migraciones):

- Node.js v24.22.1, igual a la versión informada por el operador.
- `npm run test:staging-tls`: 3/3 correctas; prueba CA/huella/vigencia, handshake real sólo en
  127.0.0.1, rechazo de CA desconocida y hostname incorrecto, opciones efectivas de
  node-postgres y diagnóstico sin secretos. Usa certificados ficticios temporales.
- Requiere OpenSSL para generar las identidades ficticias del test; el instalador
  real no depende de OpenSSL ni requiere claves privadas.
- No se ejecuta test:staging-tools en esta revisión porque instala SQL en sus bases
  descartables. No se probó el TLS real de la computadora Windows ni de staging.

Pruebas adicionales de esta revisión: aplicación 102/102, cliente 16/16, TypeScript
y build correctos. No se ejecutaron migraciones ni conexiones a bases reales.
