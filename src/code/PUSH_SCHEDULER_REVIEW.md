# Bloqueo del programador Web Push y ruta elegida

**Alexis / Supabase Prueba yiarlhpbgkofhhipkfha. Sin cambios remotos ni despliegues.**
No se modifica `buscag-staging-match-worker`, producción, Vault, VAPID ni ACL de extensiones.
La migración Push, VAPID, send-push y Vault ya están instalados según el operador:
no se repiten. Resolver este bloqueo no requiere migraciones ni despliegues nuevos
en Supabase/Firebase.

## Causa y evidencia

El instalador existente se detiene si anon/authenticated tienen SELECT efectivo
sobre Vault o `net.http_request_queue`. PUBLIC incluye esos roles. Ser propietario
`supabase_admin` no elimina permisos concedidos a PUBLIC. Vault cifra en reposo,
pero `net.http_post` inserta URL, headers y body en la cola: un header con el secreto
permanente quedaría fuera de Vault. `_http_response` también merece revisar acceso,
aunque el bloqueo actual se produce por Vault o la cola de solicitudes.

Se contrastó la fuente oficial **supabase/pg_net v0.20.4**, commit
`698fb055f666366a78c112b0578b0a5652ddbcfa`:

- [sql/pg_net.sql, líneas 355–357](https://github.com/supabase/pg_net/blob/698fb055f666366a78c112b0578b0a5652ddbcfa/sql/pg_net.sql#L355)
  concede USAGE del esquema, privilegios de secuencias y ALL sobre tablas a PUBLIC.
- Ese archivo define headers y body en la cola y los usa al encolar `http_post`.
- [Upgrade 0.20.3→0.20.4](https://github.com/supabase/pg_net/blob/698fb055f666366a78c112b0578b0a5652ddbcfa/sql/pg_net--0.20.3--0.20.4.sql)
  declara que no cambia SQL.
- SHA-256 del archivo oficial pg_net.sql descargado:
  `a2854f625cfaed3119d05a9ff11a769d7e904615244ac2bfa74647d16ba1db19`.

Los grants observados son compatibles con defaults oficiales; **no justifican
relajar la comprobación ni revocar permisos de una extensión administrada**.
SELECT efectivo y USAGE no demuestran por sí solos acceso desde Internet: también
importan schemas expuestos por PostgREST, RLS y RPC disponibles. No se declara una
filtración ni que Vault esté expuesto basándose sólo en este error combinado.

Se agrega `supabase/audit/push_scheduler_exposure.sql`: lectura de versiones,
propietarios, RLS, grants efectivos y PUBLIC, configuración disponible de schemas y
estado/schedule de los dos jobs conocidos. Nunca lee headers/body, texto descifrado,
respuestas HTTP ni cron.job.command. Una configuración PostgREST nula significa
**desconocida**, no ausencia de exposición; revisar los schemas expuestos en los
ajustes de API de Supabase si hace falta confirmar esa vía. Puede ejecutarla el operador como
consulta de sólo lectura; no es necesaria para la ruta externa ni modifica jobs.

El fallo del instalador ocurre dentro de BEGIN antes de definir el dispatcher y
cron.schedule. Con ON_ERROR_STOP y sin COMMIT, esa ejecución no instaló el cron de
push. Si hubo otras ejecuciones/configuraciones, comprobar la fila del job con el
audit; no asumir que todo job de push es inexistente ni eliminarlo automáticamente.

La tarea de coincidencias existente podría usar una cola similar: no se leyó su
comando ni se afirma que su secreto esté filtrado. Conviene una revisión privada
separada de su mecanismo de autenticación si se confirma exposición efectiva. No
se desactiva, reconfigura ni rota ese secreto como parte de esta entrega.

## Solución elegida

**Cloud Scheduler → OIDC → servicio privado Cloud Run → send-push de Prueba.**
Secret Manager entrega al runtime sólo el secreto PUSH_WEBHOOK_SECRET ya vigente.
Scheduler no almacena ese secreto: emite un token OIDC de corta duración y sólo
puede invocar ese servicio. No se usa pg_net, no hay claves de cuenta de servicio,
no se publican VAPID privadas y no hace falta mantener una PC encendida.

Se usa un **proyecto Google Cloud dedicado** `buscag-push-staging-SUFIJO`, separado
del proyecto Firebase compartido buscag-2677c. Cada comando fija el destino. El
preparador rechaza ambos proyectos Supabase de producción/incorrectos y cualquier
proyecto Cloud fuera de ese prefijo. El runner mantiene la URL Supabase fija.

Se eligió servicio HTTP con mínimo cero instancias y facturación por solicitud,
en lugar de arrancar un Cloud Run Job cada minuto. Tiene concurrencia/instancias
máximas uno y timeout 75s. No se garantiza coste cero: requiere Billing, revisión de
precios/cuotas y un presupuesto/alerta antes de autorizar. Cloud Scheduler, Run,
Secret Manager, Build, Registry y almacenamiento pueden generar cargos.

GitHub Actions no es la opción principal: sus cron tienen intervalo mínimo de
cinco minutos, pueden demorarse y sólo se programan desde la rama por defecto.
No se modifica main ni se crea un workflow con efectos remotos al hacer push.

## Implementación local

- `scripts/push-cloud-service.mjs`: adaptador HTTP mínimo que reutiliza `drain`;
  GET /health, POST /drain, cuerpo máximo 1024 bytes, exclusión mutua y errores sin
  detalles privados. El cuerpo no elige destino/usuario/aviso. La autenticación
  OIDC se aplica en el ingress IAM de Cloud Run, no se simula dentro del adaptador.
  **No desplegar sin IAM ni con --allow-unauthenticated.**
- `scripts/prepare-push-cloud.mjs`: sólo prepara archivos locales. No ejecuta gcloud,
  Docker, HTTP ni SQL; genera un plan `authorization_to_deploy=false`, hashes y config
  Build. Usa directorio nuevo fuera del repo y copia sólo cinco archivos permitidos.
- `deployment/push-cloud/Dockerfile`: imagen oficial Node 24 por digest, linux/amd64,
  usuario node, sin npm ni dependencias adicionales, sin COPY amplio ni build secrets.
- `.gcloudignore`/`.dockerignore` generados impiden enviar .env, Git, frontend o datos.
- Tests y audit de metadatos; el instalador SQL que bloqueó queda intacto.

## Pasos concretos pendientes — todos los remotos requieren autorización

Se recomienda **Google Cloud Shell** en el navegador: incluye gcloud, usa acceso
oficial de tu cuenta y permite construir en Cloud Build. No requiere Docker Desktop
en Windows ni dejar Cloud Shell abierto después de configurar el programador.
Este entorno de Codex no tiene gcloud ni credenciales GCP: se probó el contenedor
local, no IAM/OIDC ni servicios reales de Google Cloud.

### 1. Preparar y revisar, sin desplegar

En un checkout limpio de Alexis actualizado, desde src/code (Cloud Shell/bash):

```bash
set -euo pipefail
read -r -p 'ID nuevo dedicado (buscag-push-staging-SUFIJO): ' PUSH_CLOUD_PROJECT
[[ "$PUSH_CLOUD_PROJECT" =~ ^buscag-push-staging-[a-z0-9]([a-z0-9-]*[a-z0-9])?$ && ${#PUSH_CLOUD_PROJECT} -le 30 ]] || exit 1
PUSH_REGION=us-east1
PUSH_PLAN="/tmp/buscag-push-cloud-$RANDOM"
node scripts/prepare-push-cloud.mjs --project-ref yiarlhpbgkofhhipkfha --cloud-project "$PUSH_CLOUD_PROJECT" --output "$PUSH_PLAN" --secret-version 1
PUSH_IMAGE=$(node -e 'console.log(require(process.argv[1]).image)' "$PUSH_PLAN/deployment-plan.json")
PUSH_WORKER_SA="push-worker@$PUSH_CLOUD_PROJECT.iam.gserviceaccount.com"
PUSH_SCHEDULER_SA="push-scheduler@$PUSH_CLOUD_PROJECT.iam.gserviceaccount.com"
PUSH_BUILD_SA="push-build@$PUSH_CLOUD_PROJECT.iam.gserviceaccount.com"
PUSH_SECRET=buscag-staging-push-webhook
PUSH_SOURCE_BUCKET="gs://$PUSH_CLOUD_PROJECT-push-build-source"
```

Revisar plan, fuentes/hash, Dockerfile y cloudbuild.review.json. No editar/agregar
archivos al contexto. Si cambia código, regenerar un contexto nuevo. Si el repo no
está en Cloud Shell, clonarlo con tu acceso habitual a GitHub y --branch Alexis
--single-branch; no compartir tokens ni copiar respaldos/usuarios de Supabase.

### 2. Autorizar proyecto dedicado, facturación y recursos base

Los siguientes comandos crean recursos y permisos **sólo en el nuevo proyecto**;
no ejecutarlos todavía. Se detienen ante cualquier error con set -e. Un recurso ya
existente requiere inspección, no borrarlo ni reasignarlo automáticamente.

```bash
read -r -p 'Billing Account autorizado: ' PUSH_BILLING_ACCOUNT
gcloud projects create "$PUSH_CLOUD_PROJECT" --name='BuscAG Push Staging'
gcloud billing projects link "$PUSH_CLOUD_PROJECT" --billing-account="$PUSH_BILLING_ACCOUNT"
gcloud services enable run.googleapis.com cloudscheduler.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iam.googleapis.com logging.googleapis.com storage.googleapis.com --project="$PUSH_CLOUD_PROJECT"
gcloud artifacts repositories create buscag-push --repository-format=docker --location="$PUSH_REGION" --project="$PUSH_CLOUD_PROJECT"
gcloud storage buckets create "$PUSH_SOURCE_BUCKET" --location="$PUSH_REGION" --uniform-bucket-level-access --public-access-prevention --project="$PUSH_CLOUD_PROJECT"
for role in worker scheduler build; do
  gcloud iam service-accounts create "push-$role" --project="$PUSH_CLOUD_PROJECT"
done
gcloud secrets create "$PUSH_SECRET" --replication-policy=automatic --project="$PUSH_CLOUD_PROJECT"
```

Crear presupuesto/alerta en Billing. El operador debe tener permisos para habilitar
APIs, facturar, construir y asignar las tres cuentas. No otorgar Owner/Editor a esas
cuentas. Los service agents administrados de Run/Build/Scheduler conservan sus
roles oficiales; no reemplazar políticas de organización para forzar la instalación.

### 3. Autorizar una copia del secreto de envío, no de VAPID

Usar el PUSH_WEBHOOK_SECRET ya configurado en send-push; obtenerlo de su fuente
privada o de Vault por su interfaz administrativa, no desde net/cron ni mediante
consultas que lo impriman. **No generar otro valor ni rotar VAPID.** Guardar como
versión 1 del secreto recién creado. Este bloque evita argumentos, archivos,
historial y exportación del valor; copiar sólo el valor de una línea:

```bash
(
  set +x
  IFS= read -r -s -p 'PUSH_WEBHOOK_SECRET vigente de Prueba: ' PUSH_HOOK_SECRET
  printf '\n' >&2
  [[ ${#PUSH_HOOK_SECRET} -ge 32 && ${#PUSH_HOOK_SECRET} -le 512 && "$PUSH_HOOK_SECRET" != *$'\r'* ]] || exit 1
  printf '%s' "$PUSH_HOOK_SECRET" | gcloud secrets versions add "$PUSH_SECRET" --data-file=- --project="$PUSH_CLOUD_PROJECT"
)
gcloud secrets add-iam-policy-binding "$PUSH_SECRET" --member="serviceAccount:$PUSH_WORKER_SA" --role=roles/secretmanager.secretAccessor --project="$PUSH_CLOUD_PROJECT"
```

Sólo worker obtiene lectura de **ese** secreto. Build y Scheduler no la reciben.
La versión se fija numéricamente; no usar latest sin coordinar una rotación.

### 4. Autorizar construcción y despliegue privado

Build sólo puede leer el bucket de fuentes, escribir en el repositorio de imágenes y
escribir logs de este proyecto. Ningún secreto entra al build/contexto:

```bash
gcloud storage buckets add-iam-policy-binding "$PUSH_SOURCE_BUCKET" --member="serviceAccount:$PUSH_BUILD_SA" --role=roles/storage.objectViewer --project="$PUSH_CLOUD_PROJECT"
gcloud artifacts repositories add-iam-policy-binding buscag-push --location="$PUSH_REGION" --member="serviceAccount:$PUSH_BUILD_SA" --role=roles/artifactregistry.writer --project="$PUSH_CLOUD_PROJECT"
gcloud projects add-iam-policy-binding "$PUSH_CLOUD_PROJECT" --member="serviceAccount:$PUSH_BUILD_SA" --role=roles/logging.logWriter
gcloud builds submit "$PUSH_PLAN/context" --config="$PUSH_PLAN/cloudbuild.review.json" --gcs-source-staging-dir="$PUSH_SOURCE_BUCKET/source" --region="$PUSH_REGION" --project="$PUSH_CLOUD_PROJECT"
PUSH_DIGEST=$(gcloud artifacts docker images describe "$PUSH_IMAGE" --format='value(image_summary.digest)' --project="$PUSH_CLOUD_PROJECT")
[[ "$PUSH_DIGEST" =~ ^sha256:[a-f0-9]{64}$ ]] || exit 1
gcloud run deploy buscag-staging-push --image="${PUSH_IMAGE%:*}@$PUSH_DIGEST" --region="$PUSH_REGION" --project="$PUSH_CLOUD_PROJECT" --service-account="$PUSH_WORKER_SA" --set-secrets="BUSCAG_STAGING_PUSH_WEBHOOK_SECRET=$PUSH_SECRET:1" --no-allow-unauthenticated --invoker-iam-check --ingress=all --port=8080 --cpu=1 --memory=256Mi --concurrency=1 --max-instances=1 --min-instances=0 --cpu-throttling --timeout=75s
gcloud run services add-iam-policy-binding buscag-staging-push --member="serviceAccount:$PUSH_SCHEDULER_SA" --role=roles/run.invoker --region="$PUSH_REGION" --project="$PUSH_CLOUD_PROJECT"
PUSH_RUN_URL=$(gcloud run services describe buscag-staging-push --format='value(status.url)' --region="$PUSH_REGION" --project="$PUSH_CLOUD_PROJECT")
[[ "$PUSH_RUN_URL" =~ ^https://[a-z0-9.-]+\.run\.app$ ]] || exit 1
```

Ingress all permite que el servicio de Scheduler llegue a la URL; **no es acceso
anónimo**. IAM debe seguir habilitado. Leer de vuelta la política y revisar también
permisos heredados si el proyecto pertenece a una organización:

```bash
gcloud run services get-iam-policy buscag-staging-push --region="$PUSH_REGION" --project="$PUSH_CLOUD_PROJECT"
```

No debe haber allUsers/allAuthenticatedUsers como invoker. Verificar un POST sin
autenticación: debe rechazarlo el ingress (401/403), nunca devolver contadores 200.
No cambiar a --allow-unauthenticated para depurar OIDC. El código confía en IAM;
no es un servidor para publicar directamente en un host sin autenticación.

### 5. Autorizar activación del programador (empieza a enviar push reales)

```bash
gcloud scheduler jobs create http buscag-staging-push-minute --location="$PUSH_REGION" --project="$PUSH_CLOUD_PROJECT" --schedule='* * * * *' --time-zone='Etc/UTC' --uri="$PUSH_RUN_URL/drain" --http-method=POST --headers='Content-Type=application/json' --message-body='{}' --oidc-service-account-email="$PUSH_SCHEDULER_SA" --oidc-token-audience="$PUSH_RUN_URL" --attempt-deadline=90s --max-retry-attempts=0 --max-retry-duration=0s
```

La audiencia es la URL del servicio **sin /drain**. El job guarda sólo identidad
OIDC y URL, no el secreto Supabase. Si falta el service agent oficial de Scheduler
o permisos actAs del operador, detenerse y revisar; no dar Secret Accessor ni
Token Creator indiscriminados. No hay cron de GitHub ni SQL de Scheduler nuevo.
El nuevo recurso es Google Cloud Scheduler, distinto de cron.job en Supabase.

La cola ya instalada controla duplicados/reintentos; Scheduler no repite errores
inmediatamente, vuelve en el minuto siguiente. Cada llamada procesa hasta 20
entregas. Escala/latencia bajo volumen alto requiere medir, no ampliar permisos.

## Verificación posterior y parada

Con autorización para una ejecución real:

```bash
gcloud scheduler jobs run buscag-staging-push-minute --location="$PUSH_REGION" --project="$PUSH_CLOUD_PROJECT"
gcloud scheduler jobs describe buscag-staging-push-minute --location="$PUSH_REGION" --project="$PUSH_CLOUD_PROJECT"
```

Verificar invocación autenticada, estado HTTP 200, contadores/ledger de entrega y
luego recepción física en iPhone/PWA y Android. Crear mensaje con dos cuentas de
Prueba, cerrar/poner en segundo plano la PWA receptora, cerrar Cloud Shell y probar
otro aviso después: el programador debe continuar sin PC ni sesión de Shell.
Probar también coincidencias, recuperación, publicaciones/personas seguidas y
moderación según PUSH_STAGING.md. Aceptación del proveedor no prueba recepción.
No extraer headers, Vault, tokens OIDC o cuerpos privados para adjuntar al informe.

Para pausar **sólo este nuevo recurso**, después de autorizar:

```bash
gcloud scheduler jobs pause buscag-staging-push-minute --location="$PUSH_REGION" --project="$PUSH_CLOUD_PROJECT"
```

Pausar no retira avisos ya en tránsito. No hay rollback de base ni necesidad de
borrar datos: la cola permanece. No ejecutar cron.unschedule ni cambiar la tarea
`buscag-staging-match-worker`. El job SQL de push bloqueado no debe volver a
intentarse con el secreto en pg_net. Si existe otro programador push activo,
inspeccionarlo antes de activar otro; el ledger evita envíos ya completados pero
no justifica una configuración duplicada.

## Estado de entrega y límites

El diseño/código son locales; no se creó un proyecto, vínculo Billing, secreto,
IAM, imagen remota, servicio o programador. No se tocó Supabase ni Firebase.
Faltan autorización de costes y recursos dedicados, acceso oficial GCP, copia
privada del secreto existente y la verificación de IAM/OIDC/entrega real.

Los comandos Cloud API son un procedimiento revisable, no fueron ejecutados contra
Google Cloud. Validar políticas de la organización y disponibilidad del ID elegido
antes de provisionar. No se garantiza cuota gratuita. El preparador sólo genera
archivos y marca authorization_to_deploy=false.

## Pruebas de esta entrega

- `npm test`: 165 pruebas aprobadas; incluye validación de destino, rechazo de
  producción/proyecto Firebase compartido, contextos mínimos sin secretos, rutas,
  entradas grandes, exclusión mutua y errores seguros del adaptador.
- TypeScript, build y las 18 comprobaciones de seguridad del cliente: aprobados.
- Imagen oficial Node por digest descargada y contenedor de servicio compilado
  localmente para linux/amd64. Ejecutado sin red, sin root y con filesystem de sólo
  lectura: HTTP local y transporte Supabase simulado, tanto éxito como fallo 502
  traducido a 503 sin revelar contenido privado. No se envió ningún push real.
- Seguridad SQL en PostgreSQL 17 local aislado, DATE y timestamptz: aprobada,
  incluidas las regresiones previas de comunidad/recuperación/push y reclamos
  concurrentes. El nuevo audit se probó con relaciones sintéticas que reproducen
  grants PUBLIC y secretos centinela: exporta sólo metadatos y conserva el job.
  No se instalaron pg_net/pg_cron reales en esas bases ni se cambió una extensión.
- No se modificó frontend, service worker, Edge ni instalador de Scheduler; no se
  repiten pruebas de navegador como si verificaran OIDC o recepción en dispositivos.
  IAM, Cloud Build remoto, OIDC y recepción real permanecen pendientes.
