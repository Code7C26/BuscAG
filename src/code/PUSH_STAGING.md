# Web Push de BuscAG — implementación y activación pendiente

**Sólo Alexis / yiarlhpbgkofhhipkfha / buscag-prueba.web.app.** No se aplicó SQL,
no se configuraron secretos y no se desplegó Supabase ni Firebase. No se envió ningún
push real ni se verificó recepción en dispositivos. Las pruebas locales no demuestran
entrega remota. Producción queda fuera de este procedimiento.

## Auditoría y cambios

Ya existían: avisos internos en `notifications`, RLS de suscripciones por propietario,
interruptor explícito en Perfil/Configuración, VAPID público en el build aislado,
service worker con Web Push, tag estable por aviso y click con destino del mismo
origen; Edge `send-push` con secreto independiente, allowlist de proveedores y
limpieza 404/410. Mensajes, coincidencias, recuperación y cambios de publicaciones
ya tenían productores de avisos internos. El worker de coincidencias es independiente.

Faltaban: entregas persistentes/reintentos concurrentes, seguimiento de **personas**
(el existente seguía publicaciones), avisos de moderación y mejor reconciliación
entre cuenta/dispositivo. Se implementan:

- Propuesta `20261108000000_web_push_delivery.sql`: dos tablas privadas con RLS,
  RPC de seguimiento de personas, aviso por publicación nueva de una persona seguida,
  aviso al denunciante por cambio real de estado de su denuncia, cola por aviso y
  suscripción, token de reclamo y lease de dos minutos. No publica detalles del
  reporte al denunciado, no asigna moderadores y no cambia decisiones de moderación.
- Entrega sólo a dispositivos suscriptos al insertar el aviso; sin reproducción del
  historial antiguo. Se omiten autor, bloqueos en ambos sentidos, avisos ya leídos,
  mayores a 24 horas y seguimientos/avisos desactivados. Se revalida al reclamar.
- Máximo cinco intentos, espera exponencial desde 30s; 404/410 eliminan sólo la
  suscripción vencida, no publicaciones/usuarios/avisos. Un token viejo no completa
  un reclamo nuevo. Cuota de 20 suscripciones por cuenta, sin borrar las existentes.
- `send-push`: admite el webhook INSERT existente y `DRAIN` de programador. Ambos
  pasan por el mismo reclamo SQL. Máximo 20 dispositivos por invocación, concurrencia
  cuatro, timeout de envío 10s y TTL 300s. Topic del proveedor y tag del SW por ID.
- Pantalla bloqueada: texto genérico; no nombres, números, contenido de mensajes,
  objetos ni denuncias. Al tocar, se abre el aviso persistido; sólo la cuenta con
  acceso al aviso puede abrir su conversación/publicación. Un aviso de moderación
  sin publicación abre Notificaciones; el texto interno lleva a Mis denuncias.
- Cliente: estado ocupado y protección contra doble acción; permisos sólo desde
  una acción explícita; revocación del navegador al cambiar sesión y reconciliación
  de suscripciones ajenas sin borrar registros de otra cuenta. Una renovación no
  registrada se reactiva autenticado, no se guardan credenciales en el SW. Si no se
  puede verificar la cuenta por un fallo de red/permisos, se revoca localmente por
  privacidad: será necesario reactivar al recuperar la conexión.
- «Seguir a esta persona» es independiente de «Seguir publicación». Si la nueva RPC
  todavía no existe se explica la activación pendiente; las funciones instaladas
  de community no se ocultan ni se simula éxito.
- Generador local de claves fuera del repositorio, runner de prueba/externo con URL
  fija de staging, SQL revisable de activación y de programación opcional.

No hay garantía de exactamente una entrega entre proveedor y DB: si el proveedor
aceptó pero se perdió la respuesta/confirmación, puede existir reintento. Token,
ledger, topic y tag reducen duplicados; no se prometen imposibles ni envío offline
sin conectividad. Un envío ya en tránsito no se puede retirar tras un bloqueo/baja;
el payload genérico limita exposición. La autorización se vuelve a comprobar en la
app al abrir. El ledger conserva estados de entrega para diagnóstico y requerirá
una política de retención si el uso crece; no contiene cuerpos ni claves.

## Eventos y dependencias

| Evento | Productor del aviso interno | Requisito adicional |
|---|---|---|
| Mensaje nuevo | Trigger de mensajes / send_message_once existente | Cola + Edge + programador + dispositivo habilitado |
| Coincidencia | process-matches / process_match_jobs existentes | Matching de servidor habilitado y programado, además del envío push |
| Solicitud, aceptación, rechazo | RPC de recuperación instaladas | Cola + Edge + programador |
| Publicación nueva de persona seguida | Nuevo notify_user_followers | Nueva propuesta SQL y seguimiento explícito |
| Estado de publicación seguida | notify_item_followers instalado | Preferencia de avisos activa; revalidada antes de enviar |
| Moderación relevante | Nuevo notify_report_state | Cambio real de denuncia por moderador autorizado; avisa al denunciante |

Este trabajo no inventa un canal de alertas administrativas genéricas ni un sistema
de moderación nuevo. No manda push al denunciado revelando quién lo denunció.
Activar push no activa automáticamente matching ni crea un cron de coincidencias.

## Autorizaciones pendientes, separadas

1. Aplicar **una nueva propuesta de aplicación** exclusivamente en Prueba.
2. Configurar secretos y desplegar la nueva versión de `send-push` en Prueba.
3. Programar el drenaje en infraestructura de servidor (cron existente o runner).
4. Compilar con el VAPID **público** correcto y publicar sólo Firebase Prueba.
5. Generar eventos con cuentas de prueba y verificar dispositivos reales.

Los comandos siguientes son para el operador **después de autorizar cada paso**.
No reutilizar `install.review.sql` de las dos migraciones ya instaladas ni volver a
aplicarlas. La nueva propuesta está fuera del catálogo school/community aprobado;
el planificador anterior podrá informar drift tras agregar estos objetos nuevos.
Eso no autoriza ignorar diferencias ni debilitar sus controles. Esta entrega trae
un audit específico; no declara reconocimiento de una nueva etapa canónica por el
planificador anterior.

## 1. Claves y secreto independientes de staging

Si ya hay un par VAPID configurado, reutilizarlo: no regenerarlo por actualizar el
código. Rotar claves requiere renovar dispositivos y coordinar frontend/Edge.
Si todavía no hay claves, desde `src/code` en PowerShell:

```powershell
$privateDir = Join-Path $env:LOCALAPPDATA 'BuscAG-private'
New-Item -ItemType Directory -Force $privateDir | Out-Null
$secretFile = Join-Path $privateDir 'push-staging.env'
$subject = 'mailto:' + (Read-Host 'Email real del responsable de push')
node scripts/create-staging-push-keys.mjs "$secretFile" "$subject"
```

El generador no sobrescribe archivos y rechaza directorios dentro del repositorio;
no imprime las claves. En Windows, restringir acceso al archivo a tu cuenta mediante
sus propiedades de Seguridad. No subirlo a Git, artefactos o chat. En Linux se crea
con modo 0600. Guardar el par en un gestor privado, separado de producción.

**Sólo autorizado el cambio de secretos y despliegue Edge**, después de instalar
y auditar el SQL del paso 2 (la Edge nueva depende de esas RPC):

```powershell
supabase secrets set --project-ref yiarlhpbgkofhhipkfha --env-file "$secretFile"
supabase functions deploy send-push --project-ref yiarlhpbgkofhhipkfha
```

Contiene PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY, PUSH_VAPID_SUBJECT y
PUSH_WEBHOOK_SECRET (>=32 caracteres aleatorios). SUPABASE_URL y
SUPABASE_SERVICE_ROLE_KEY son variables automáticas de la Edge, nunca del cliente.
La función rechaza cualquier URL Supabase distinta de Prueba. `verify_jwt=false`
permite al gateway entregar la solicitud al handler; éste exige el secreto privado
x-push-webhook-secret antes de consultar datos. Un JWT de usuario no lo reemplaza.
No configurar VITE_* con secretos ni claves service_role.

## 2. SQL de aplicación, sin borrar/restablecer datos

Antes de instalar, ejecutar el diagnóstico de sólo lectura con la configuración TLS
ya usada para staging y confirmar todavía community, catálogo compatible y ningún
bloqueo desconocido:

```powershell
npm.cmd run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-plan --preserve-platform --disposable-staging
```

Esto no instala la nueva propuesta. No continuar ante drift desconocido ni ejecutar
el instalador antiguo que pueda generar. Revisar el archivo del commit publicado y
su SHA-256:

```powershell
Get-FileHash supabase/proposals/20261108000000_web_push_delivery.sql -Algorithm SHA256
```

SHA esperado (bytes LF del repositorio):
`459d54aacd8bb8d9af5660eaece7c93e6bb36876d100069b25f5dd5ae9058ded`.
Un checkout con CRLF cambia el hash; comprobar los bytes de Git, no aceptar cambios
SQL desconocidos. No modifica wrappers, extensiones, Auth, Storage ni funciones
administradas. Crea/reemplaza sólo helpers propios enumerados en el archivo y sus
triggers; no reduce RLS ni amplía permisos de clientes sobre tablas existentes.
La transacción completa revierte ante error. lock_timeout=5s y statement_timeout=60s;
DDL toma locks breves y puede abortar bajo carga. Reaplicación probada en la base
sintética; inspeccionar cualquier conflicto con objetos del mismo nombre antes.

**Sólo con autorización de aplicación en staging descartable**, `psql` instalado,
CA oficial ya verificada y credencial de postgres de Prueba:

```powershell
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = (Resolve-Path (Read-Host 'Ruta a la CA verificada de Supabase')).Path
$stagingConnection = 'host=aws-0-us-east-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.yiarlhpbgkofhhipkfha sslmode=verify-full connect_timeout=10'
$env:BUSCAG_PUSH_STAGING_AUTHORIZATION = 'APPLY_WEB_PUSH_TO_DISPOSABLE_STAGING'
psql -X -W "$stagingConnection" -v ON_ERROR_STOP=1 -f supabase/activation/install_push_staging.review.psql
if ($LASTEXITCODE -ne 0) { throw 'Instalación push detenida; no continuar.' }
Remove-Item Env:BUSCAG_PUSH_STAGING_AUTHORIZATION
psql -X -W "$stagingConnection" -v ON_ERROR_STOP=1 -f supabase/audit/push_readiness.sql
```

La contraseña se solicita interactivamente; no va en URI, argumentos ni archivos
commiteados. No usar SQL Editor: el wrapper psql verifica host, puerto, usuario tenant,
rol, base y PGSSLMODE=verify-full con CA antes de incluir SQL. El comando fija
sslmode=verify-full en la conexión además del guard del entorno. No cambiar ese destino a producción. No desactivar
TLS ante un fallo de CA.

Auditoría esperada: cola/seguimientos true, cuatro triggers nuevos, server RPC
execute=false para anon/authenticated y true para service_role; RPC de seguimientos
execute=true sólo para authenticated. Totales por estado sin registros personales.
Este audit no prueba envío ni compara el catálogo completo de plataforma.

## 3. Programador de servidor

Un cliente abierto no es un programador. El drenaje debe continuar aunque todas las
PWA estén cerradas. Elegir **una** ruta; no hace falta modificar wrappers internos.

### Opción A: Cron/pg_net/Vault ya instalados en Supabase

Crear en Vault desde la interfaz privada un secreto llamado
`buscag_staging_push_webhook_secret`, con el MISMO valor de PUSH_WEBHOOK_SECRET de
la Edge (del archivo privado). No ponerlo en SQL Editor, historial o comandos con
el valor literal. Este paso también necesita autorización de configuración.

Revisar `supabase/activation/schedule_push_staging.review.sql`. No crea extensiones;
se detiene si falta pg_cron, pg_net o Vault, si están expuestas las tablas con el
secreto/headers a anon/authenticated o si el nombre de job pertenece a otra cuenta.
No altera funciones administradas. Usa el secreto de Vault en tiempo de ejecución,
con URL fija de Prueba y sin guardarlo en cron.job.command.

**Sólo autorizado el programador**, en la misma sesión PowerShell con CA/conexión:

```powershell
$env:BUSCAG_PUSH_SCHEDULER_AUTHORIZATION = 'SCHEDULE_WEB_PUSH_ON_STAGING'
psql -X -W "$stagingConnection" -v ON_ERROR_STOP=1 -f supabase/activation/schedule_push_staging.review.psql
if ($LASTEXITCODE -ne 0) { throw 'Programador no instalado.' }
Remove-Item Env:BUSCAG_PUSH_SCHEDULER_AUTHORIZATION
```

Job: buscag-staging-push-minute, cada minuto. Hasta 20 dispositivos por invocación;
varios ciclos pueden ser necesarios. Inspeccionar estado del job y respuestas HTTP
agregadas en el dashboard, sin exportar headers/colas/Vault. pg_net encola la llamada;
un ID HTTP no significa que la Edge respondió bien ni que el dispositivo recibió.
El SQL de programador es revisable y NO se ejecutó aquí: depende de extensiones y
ACL reales que no están en las bases sintéticas. Si falla un prerrequisito, no
crear/reparar extensiones automáticamente; usar la opción B o revisión autorizada.

### Opción B: proceso/cron externo privado

Configurar BUSCAG_STAGING_PUSH_WEBHOOK_SECRET en el gestor de secretos del servidor
con el mismo secreto de la Edge. Node 24, copia de Alexis y sin secretos VITE_*:

```sh
npm run push:staging -- --once
```

Programar ese comando cada minuto en un servidor permanente con el secreto
inyectado en el entorno. No incluir el valor en la línea de cron ni depender de una
PC apagada. El runner no permite cambiar la URL/ref y rechaza redirects; muestra
sólo contadores. Un HTTP502 deja reintentos en la cola para el próximo ciclo.

Para cargar el secreto del runner local desde el archivo privado sin imprimirlo:

```powershell
$webhookLine = Get-Content "$secretFile" | Where-Object { $_.StartsWith('PUSH_WEBHOOK_SECRET=') }
$env:BUSCAG_STAGING_PUSH_WEBHOOK_SECRET = ($webhookLine -split '=',2)[1]
```

Para una prueba temporal autorizada: `npm run push:staging -- --watch` dura diez
minutos. **No es el programador permanente.** Un 200/sent indica aceptación del
proveedor, no recepción en pantalla. Si hace falta menor latencia, el webhook
oficial INSERT de public.notifications puede apuntar a la misma Edge con el header
privado; es opcional y requiere autorización aparte. DRAIN sigue siendo necesario
para recuperación de errores. Ambos caminos comparten el reclamo y no duplican una
entrega ya finalizada.

Para coincidencias: revisar `public.match_backend_enabled()` y el programador
existente de process-matches. `npm run demo:worker -- --once` es una operación real
de Prueba y necesita autorización; no activa matching si está deshabilitado. No
habilitar flags ni programar nuevas llamadas implícitamente al activar push.

## 4. Frontend exclusivo de Prueba

Cargar SOLO la clave pública para el build, sin imprimirla. Con archivo privado
existente (no guardar claves en .env del repositorio):

```powershell
$publicLine = Get-Content "$secretFile" | Where-Object { $_.StartsWith('PUSH_VAPID_PUBLIC_KEY=') }
$env:BUSCAG_STAGING_VAPID_PUBLIC_KEY = ($publicLine -split '=',2)[1]
npm.cmd run build:rc
npm.cmd run verify:rc
```

Además debe estar configurada BUSCAG_STAGING_PUBLISHABLE_KEY pública de Prueba.
El build aislado ignora VITE_* de producción y expone sólo VAPID público, origen y
cliente Supabase Prueba. Verificar manifest commit/ref/origen/hashes antes de usarlo.
**Sólo autorizado Firebase Prueba**:

```powershell
firebase deploy --only hosting --project buscag-2677c --config firebase.presentation.json
```

El proyecto Firebase es compartido, el config fija **site buscag-prueba**, no el
sitio de producción. No ejecutar firebase.json genérico, hosting clone ni --only
functions. Supabase CLI y Firebase son despliegues separados, ninguno automático.

## Aceptación real: pendiente en iPhone y Android

1. Verificar commit visible/manifest y que todas las API sean yiarlhpbgkofhhipkfha.
2. iPhone/iPad con iOS/iPadOS >=16.4: Safari → Compartir → Agregar a inicio. Abrir
   desde ese icono, entrar con A y activar el switch desde Configuración. No pedir
   permisos al cargar. Android: navegador compatible/PWA, permiso explícito igual.
3. Tener A y B en dispositivos distintos. Salir de primer plano/cerrar la PWA de A,
   sin cerrar su sesión. B envía mensaje: observar aviso del sistema y tocarlo;
   debe llevar a la conversación correcta tras autenticar si hiciera falta.
4. Publicar perdido/encontrado compatibles desde usuarios diferentes. Verificar
   primero aviso interno/worker, luego push y destino. Publicaciones no equivalen
   automáticamente a coincidencia: deben satisfacer el algoritmo real.
5. A/B prueban solicitud, rechazo y nueva aceptación bilateral. Un aviso por evento,
   nunca al actor. No duplicar al recargar ni repetir resolución.
6. A sigue PERSONA B. B publica: A recibe aviso. A deja de seguir antes de enviar un
   aviso pendiente: no llega. Seguir PUBLICACIÓN por separado: cambios reales de
   estado generan aviso; preferencia desactivada o bloqueo lo suprime.
7. Reportar un contenido de prueba; moderador explícitamente autorizado cambia
   estado. Sólo el denunciante recibe novedades, sin notas privadas/identidad del
   denunciante en pantalla bloqueada. No asignarse permisos para completar la prueba.
8. Repetir envío/webhook, reiniciar worker o simular 503: comprobar ledger, backoff y
   deduplicación visible. No usar número de aceptación como prueba de recepción.
9. Desactivar switch: próximos avisos sólo internos. Cerrar sesión y entrar con otra
   cuenta en ese dispositivo: no llegan avisos de la anterior. Probar otro dispositivo
   aún habilitado; la baja de un navegador no desactiva todos los demás.
10. Revocar permiso del sistema y volver a abrir: switch desactivado. Si caduca la
    suscripción, activar nuevamente autenticado; no renovar usando credenciales en
    el service worker. Revisar 404/410 en contadores y limpieza del endpoint.
11. Probar Focus/No molestar, permisos del sistema, red, ahorro de batería y equipo
    apagado. El sistema puede demorar/suprimir avisos; no prometer entrega inmediata
    ni recepción cuando no hay conectividad. No es un canal para emergencias.

Registrar únicamente resultado/OS/versión/evento/hora/contador; no adjuntar endpoints,
claves, teléfonos, mensajes ni tokens. No marcar verificado hasta completar estos
pasos con dispositivos reales. Las notificaciones internas deben seguir accesibles.

Referencias oficiales: [WebKit: Web Push iOS 16.4](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/),
[Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API),
[Supabase Edge secrets](https://supabase.com/docs/guides/functions/secrets),
[Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions).

## Resultados de validación local

- `npm test`: 160 casos aprobados; incluye handler, cliente, generación de claves,
  runner y cambio/revocación de sesión y permisos. APIs/proveedores simulados.
- TypeScript (`npm run lint`) y `npm run build`: aprobados.
- Navegador: 96/96 aprobados en Chromium escritorio y viewport iPhone; backend
  simulado. El primer intento detectó dos selectores de estado ambiguos al coexistir
  seguimiento y denuncia; se acotó la prueba al aviso correspondiente y la segunda
  ejecución completa aprobó. No se eliminó ningún control ni regla para conseguirlo.
- PWA y presentación: aprobadas, incluyendo caché offline pública, protección de
  datos privados, CSP y destino exclusivo de Supabase Prueba.
- Seguridad de cliente: 18 comprobaciones aprobadas.
- `deno check --frozen` de send-push: aprobado; sin dependencias nuevas ni lock alterado.
- Propuesta SQL: aplicada dos veces en bases descartables. Matriz sintética PGlite:
  DATE, timestamptz y forma observada; conserva datos y las funcionalidades previas.
- PostgreSQL nativo 17 local aislado: DATE y timestamptz aprobados, con dos conexiones
  concurrentes para el reclamo. Cada variante conserva los 61 controles anteriores,
  escuela, recuperación y comunidad, más los nuevos casos de push, cuotas, bloqueos,
  follows, moderación, backoff, expiración y tokens viejos.
- El SQL de programador no se ejecutó: faltan verificación/autorización de sus
  extensiones, Vault y ACL reales. Tampoco se ejecutaron los wrappers con psql en
  este entorno (cliente ausente); el SQL interno sí se probó en PostgreSQL nativo.
- Ningún push real, iPhone físico ni Android real aprobado. No hay secretos VAPID
  de Prueba configurados por esta entrega ni artefacto con claves generadas ficticias.

Archivos: `lib/push.ts`, `lib/community.ts`, `lib/supabase.ts`, `src/App.tsx`,
`ProfileView.tsx`, `SafetyActions.tsx`, `UserFollowButton.tsx`, Edge send-push,
los dos scripts de keys/runner, propuesta SQL, wrappers de activación/programador,
audit de push, tests de cliente/handler/herramientas/interfaz/seguridad y package.json.
`public/sw.js` se reutiliza sin cambiar su caché, navegación o deduplicación.
