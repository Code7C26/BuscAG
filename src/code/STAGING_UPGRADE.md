# Instalación revisable del backend de BuscAG Prueba

Actualización de activación: [ruta acotada de aplicación](PRUEBA_FEATURE_ACTIVATION.md).
El bloqueo general descrito abajo se conserva. Existe ahora una opción explícita,
probada sólo para los dos SQL propios fijados por hash, que preserva los seis wrappers
sin declararlos seguros ni equivalentes. No autoriza ni ejecuta cambios remotos.

Fecha: 2026-11-06. Rama: **Alexis**. Destino único:
**`yiarlhpbgkofhhipkfha`**, frontend **`https://buscag-prueba.web.app/`**.

**Esta entrega prepara la operación; no la ejecuta ni la autoriza.** No se consultó
Supabase remoto, no se instalaron migraciones, no se cambiaron secretos/datos reales
ni Firebase. Los comandos de escritura de esta guía requieren aprobación explícita
posterior. No utilizar `main`, `German`, Producción ni otro project ref.

## 1. Estado conocido y evidencia faltante

El [procedimiento de evidencia oficial](STAGING_OFFICIAL_EVIDENCE.md) amplía ahora
el plan con recolección automática de sólo lectura y equivalencias estrechas
verificadas. No habilita instalaciones ni acepta eventos sólo por nombre.

Actualización 2026-11-07: [análisis del plan remoto aportado](STAGING_PLAN_REVIEW.md).
Explica las diferencias concretas frente a school y la evidencia que aún impide
aceptarlas. Las clasificaciones nuevas son informativas; no autorizan instalación.

Los siguientes son resultados manuales aportados por el operador, no consultas
realizadas por Codex en esta misión:

| Evidencia aportada | Qué permite concluir | Qué no demuestra |
| --- | --- | --- |
| Existen nueve tablas privadas escolares y las cinco tablas públicas | Hay una instalación previa que se debe preservar | Que coincidan cuerpos, restricciones, índices, triggers y grants |
| `recovery_confirmations` tiene siete columnas; participantes nullable | Hay historial anterior a la evidencia `mode` | Que FK, índices y trigger de anonimización sean los revisados |
| `request` y `resolution` existen; contexto seguro y `mode` no | La recuperación segura aún no está completa | Que las funciones previas sean compatibles o estén protegidas |
| Cinco indicadores comunitarios falsos | No está instalada la interfaz RPC comunitaria esperada | Que no haya una instalación parcial de otras columnas/tablas |
| 14 tablas con RLS; nueve privadas sin grants directos API | Hay controles importantes ya activos | Que las políticas, roles heredados, vistas y funciones no los eludan |
| Permisos por columna, incluido UPDATE de `profiles.id` | El baseline permite el `upsert` de compatibilidad | Una escalada: USING y WITH CHECK deben fijar siempre `id=auth.uid()` |
| `42P01` para `supabase_migrations.schema_migrations` | No está disponible ese historial | Que falten migraciones. **No crear ni rellenar esa tabla** |

Una política INSERT de mensajes no demuestra permiso efectivo de inserción: hay
que comprobar también ACL de tabla/columnas y EXECUTE de la RPC.

El estado probable es **school**, con recuperación segura y comunidad pendientes;
todavía **no es una compatibilidad certificada**. El catálogo completo podría
detener el plan. No inferir que se debe reaplicar el baseline o `school_features`.

Falta contrastar: firmas, cuerpo, propietario, SECURITY DEFINER, search_path y
EXECUTE de funciones; triggers habilitados y funciones asociadas; columnas/defaults,
FK/acciones de borrado/checks/índices; todas las políticas permisivas y restrictivas;
privilegios efectivos de tablas/columnas/vistas, roles y membresías; bucket,
políticas/RLS de Storage y publicación Realtime. También falta verificar respaldos,
servicios administrados y comportamiento con Auth/API reales.

## 2. Herramienta reutilizada y límites

`prepare:staging` incorpora **`--upgrade-plan`** y **`--upgrade-verify`**. Ambos:

- Están fijados al ref de Prueba; reutilizan la validación de host/usuario/puerto,
  TLS con CA y hostname verificados, errores sanitizados y URI privada del
  instalador existente. No leen `.env` ni credenciales VITE.
- Consultan catálogo en una transacción **READ ONLY / REPEATABLE READ**, que termina
  con ROLLBACK. No insertan usuarios de prueba, registros administrativos ni datos.
- Construyen referencias vacías con PGlite, desde los SQL de este commit, para
  `items.date` DATE o timestamptz. Comparan las etapas baseline, school,
  secure_recovery y community, sin consultar historial de Supabase CLI ni exigir
  `buscag_staging_admin.applied_sql`.
- Sólo reconocen una coincidencia completa del catálogo revisado. Una función
  personalizada, firma adicional, política, índice o estado parcial produce
  `unknown_or_drifted`, código de salida no cero y **ningún SQL ejecutable**.
- Devuelven hashes de definiciones; no vuelcan cuerpos, teléfonos, chats, URLs de
  suscripción ni filas personales al informe. Los MD5 de catálogo son comparadores
  de cambios, no firmas criptográficas de confianza. Los archivos fuente y el
  fingerprint del plan usan SHA-256.

Esto es deliberadamente conservador: versiones de PostgreSQL, funciones locales,
políticas de otros buckets o triggers administrados pueden requerir revisión aunque
sean legítimos. No quitar objetos ni relajar comparaciones para conseguir un verde.
Examinar las diferencias privadamente, corregir sólo tras revisar dependencias y
agregar fixtures/pruebas del caso antes de aceptar un nuevo contrato.

La referencia usa sustitutos de Auth y Storage para tests. No certifica funciones
internas de Supabase, acceso HTTP a Storage, Realtime, SMTP, cron ni push reales.
No ejecuta funciones arbitrarias remotas para descubrir su comportamiento.

## 3. Tres pasos operativos

### Paso 1 — Destino, diagnóstico y plan, sin escrituras

Verificar en Dashboard el project ref en General/Connect y la URL API del mismo
proyecto. Ambos deben identificar **`yiarlhpbgkofhhipkfha`**. La URI debe ser directa
`db.yiarlhpbgkofhhipkfha.supabase.co`, usuario `postgres`, o pooler **de sesión**,
usuario `postgres.yiarlhpbgkofhhipkfha`, puerto 5432. No usar 6543 ni otra base.
El servidor PostgreSQL no ofrece una identidad universal del proyecto: la
comprobación Dashboard + URI/TLS es obligatoria; no confiar sólo en el nombre del tab.

En una copia actualizada de `Alexis`, desde `src/code`, con `npm ci`, Node y la CA
oficial descargada por el canal de confianza descrito en [STAGING_SETUP.md](STAGING_SETUP.md):

```powershell
$env:BUSCAG_STAGING_CA_FILE = Join-Path $env:USERPROFILE 'Downloads\prod-ca-2021.crt'
$stagingSecret = Read-Host 'URI PostgreSQL PRIVADA de BuscAG Prueba' -AsSecureString
try {
  $env:BUSCAG_STAGING_DATABASE_URL = [System.Net.NetworkCredential]::new('', $stagingSecret).Password
  npm run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-plan
  if ($LASTEXITCODE -ne 0) { throw 'Plan bloqueado: revisar diferencias, no instalar.' }
} finally {
  Remove-Item Env:BUSCAG_STAGING_DATABASE_URL -ErrorAction SilentlyContinue
  $stagingSecret.Dispose()
}
```

No activar transcripciones ni imprimir variables privadas. La salida identifica
la etapa, candidatos, fingerprint y rutas locales ignoradas por Git:

- `test-results/staging-upgrade/plan.json`: catálogo, diferencias, SHA de fuentes;
  declara `backup=not_checked`, `remote_behaviour=not_tested` y autorización falsa.
- `test-results/staging-upgrade/install.review.sql`: bundle **sólo para revisión**,
  o un comentario inerte si el catálogo no coincide o ya está instalado. Cada
  planificación reemplaza el archivo anterior para evitar usar SQL obsoleto.

Alternativa de diagnóstico sin conexión local: ejecutar en SQL Editor del proyecto
verificado `supabase/audit/upgrade_catalog.sql` (un resultado JSON), además de los
diagnósticos `recovery_readiness.sql` y `community_readiness.sql`. El JSON solo es
evidencia para revisar; no genera automáticamente una autorización ni un bundle.
Los dos diagnósticos antiguos incluyen definiciones: revisarlas privadamente, no
pegar cuerpos desconocidos que puedan contener secretos en Git o en informes.

**Orden según el catálogo reconocido:**

| Etapa verificada | SQL pendiente, en este orden |
| --- | --- |
| school (esperada según los datos aportados) | `proposals/20261106000000_secure_recovery.sql`, después `proposals/20261106001000_community_safety.sql` |
| secure_recovery | Sólo `proposals/20261106001000_community_safety.sql` |
| community | Ninguno; verificar y ensayar, no reaplicar propuestas anteriores |
| baseline de nueve migraciones, sin funciones escolares | `proposals/20261105000000_school_features.sql`, después las dos anteriores |
| unknown_or_drifted | Ninguno hasta resolver y probar la diferencia |

La presencia de tablas escolares suministrada excluye reinstalar automáticamente
los nueve SQL del baseline. `--apply` antiguo ahora rechaza esa situación. No crear
tablas nuevas de historial para simular que los SQL históricos fueron ejecutados.

### Paso 2 — Respaldo recuperable, revisión y autorización

**No hay evidencia de un respaldo recuperable de Prueba en esta entrega.** Antes
de instalar, el responsable debe producir y registrar, fuera de Git:

1. Respaldo reciente del **proyecto de Prueba**, origen/ref, fecha UTC, versiones de
   herramientas, checksum, cifrado/ubicación privada, responsable y ventana cubierta.
   Debe cubrir esquema, RLS/ACL, funciones/triggers, datos públicos y privados,
   Auth y configuración necesaria para su restauración según el método autorizado.
2. Copia de los objetos de Storage y su manifiesto. Un dump SQL no incluye sus
   bytes: reutilizar `backup:storage` y las guías de [SECURITY_ROLLOUT.md](SECURITY_ROLLOUT.md).
   No usar datos o credenciales de Producción. No guardar dumps en el repositorio.
3. **Restauración efectivamente completada en un entorno aislado**, con conteos,
   referencias, lecturas de objetos y ausencia de webhooks/cron/red saliente. Un
   archivo existente, un hash o `pg_restore --list` solos no prueban recuperación.
   `test:restore:postgres` prueba el mecanismo con datos sintéticos y sus guardas;
   no certifica la restauración de un backup real de Prueba.
4. Revisión del `plan.json`, diff del SQL, commit usado y SHA-256 de
   `install.review.sql`. Registrar el fingerprint aprobado y evidencia del ensayo.
   Archivar copias del plan y bundle revisados en el registro privado de la operación:
   las próximas ejecuciones reemplazan los artefactos locales, incluso al verificar.
   Solicitar aprobación explícita para **este** bundle y destino. Si el catálogo o
   fuentes cambian, planificar y aprobar de nuevo.

En una ventana breve, detener escritores y workers mediante controles operativos
autorizados. No borrar colas ni suscripciones. No cambiar secretos para instalar
estas tablas. Los bloqueos del bundle caducan a los 5 s si no obtiene acceso:
detenerse y reprogramar, no elevar el timeout sin investigar.

### Paso 3 — Sólo tras aprobación: instalar y verificar

El planificador **no tiene un modo nuevo de apply remoto**. El bundle usa SQL
estándar, excepto la directiva inicial `\set ON_ERROR_STOP on` de psql. Aplicarlo
con psql y TLS verificado, desde la misma máquina y origen revisados; no pegarlo
en otra consola con destino incierto. Instalar cliente PostgreSQL compatible.

El siguiente bloque es una operación de escritura **futura**, no ejecutada por
Codex. Requiere la URI privada, CA oficial, fingerprint aprobado y SHA del bundle
registrados en el paso 2. No reemplazar estos datos con un plan nuevo sin revisión.
El password queda sólo en el entorno temporal del proceso; nunca en argumentos.

```powershell
$approvedFingerprint = Read-Host 'Fingerprint del plan APROBADO y con restore verificado'
$approvedSqlHash = Read-Host 'SHA256 del install.review.sql APROBADO'
if ($approvedFingerprint -notmatch '^[0-9a-f]{64}$' -or $approvedSqlHash -notmatch '^[0-9a-fA-F]{64}$') { throw 'Evidencia inválida' }
$stagingSecret = Read-Host 'URI PostgreSQL PRIVADA del MISMO proyecto Prueba' -AsSecureString
try {
  $env:BUSCAG_STAGING_DATABASE_URL = [System.Net.NetworkCredential]::new('', $stagingSecret).Password
  # Reutiliza la guarda de destino/TLS y comprueba drift inmediatamente antes.
  npm run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-plan
  if ($LASTEXITCODE -ne 0) { throw 'Plan bloqueado' }
  $plan = Get-Content 'test-results/staging-upgrade/plan.json' -Raw | ConvertFrom-Json
  if ($plan.catalog_fingerprint -ne $approvedFingerprint -or $plan.candidates.Count -eq 0) { throw 'Plan cambió o no hay SQL pendiente' }
  $sqlFile = (Resolve-Path 'test-results/staging-upgrade/install.review.sql').Path
  if ((Get-FileHash $sqlFile -Algorithm SHA256).Hash -ne $approvedSqlHash) { throw 'Bundle distinto al aprobado' }
  if (-not (Test-Path $env:BUSCAG_STAGING_CA_FILE)) { throw 'Falta CA oficial' }
  $uri = [uri]$env:BUSCAG_STAGING_DATABASE_URL
  $parts = $uri.UserInfo.Split(':', 2)
  $env:PGHOST = $uri.DnsSafeHost
  $env:PGPORT = '5432'
  $env:PGDATABASE = 'postgres'
  $env:PGUSER = [uri]::UnescapeDataString($parts[0])
  $env:PGPASSWORD = [uri]::UnescapeDataString($parts[1])
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = (Resolve-Path $env:BUSCAG_STAGING_CA_FILE).Path
  if ($env:PGSERVICE -or $env:PGSERVICEFILE -or $env:PGOPTIONS -or $env:PGHOSTADDR) { throw 'Usar una terminal dedicada sin overrides PG heredados' }
  psql -X --host="$env:PGHOST" --port=5432 --username="$env:PGUSER" --dbname=postgres --set=ON_ERROR_STOP=1 --command="SET buscag.upgrade.backup_verified = '$approvedFingerprint'" --file="$sqlFile"
  if ($LASTEXITCODE -ne 0) { throw 'Instalación detenida: revisar, no repetir a ciegas' }
  npm run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-verify
  if ($LASTEXITCODE -ne 0) { throw 'Verificación final no aprobada' }
} finally {
  'BUSCAG_STAGING_DATABASE_URL','PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSSLMODE','PGSSLROOTCERT' | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
  $stagingSecret.Dispose()
}
```

La variable de sesión `backup_verified` es una **declaración del operador**, no una
validación automática de respaldo ni un control de acceso. No establecerla hasta
tener evidencia y aprobación. No habilitar TLS inseguro si la conexión falla.

El bundle adquiere el bloqueo del instalador, bloquea escritores, verifica de nuevo
el catálogo aprobado, toma conteos y huellas de las filas existentes y ejecuta sólo
las etapas pendientes en **una transacción**. Antes de COMMIT exige el catálogo
final esperado y la conservación de datos. Excluye de la huella sólo las columnas
nuevas previstas de perfiles/recuperación; las demás columnas existentes deben
seguir idénticas. Auth se cuenta, no se exporta. No crea registro de Supabase CLI.

Si falla antes de COMMIT, psql se detiene y cerrar la conexión revierte la transacción.
Ante pérdida de conexión en COMMIT, el resultado puede ser ambiguo: ejecutar
`--upgrade-plan`/`--upgrade-verify` en una sesión nueva antes de decidir. Si ya es
community, **no repetir SQL**. Si aparece estado desconocido, detenerse y revisar.
No revertir ejecutando las propuestas antiguas: reabrirían funciones inseguras.
Un fallo posterior requiere corrección hacia adelante o restauración aprobada del
respaldo ensayado, considerando las escrituras posteriores; no una restauración
ciega. Conservar RLS, protección del teléfono y guardas de recuperación al revertir
el frontend. La ausencia de evento/trigger desconocido no garantiza que un servicio
externo no tenga efectos: por eso se revisa y aísla la ventana operativa.

## 4. Verificación posterior y QA real

`--upgrade-verify` debe terminar con código cero y `stage=community`,
`installed_final_catalog=true`, sin candidatos. Compara de nuevo ACL de vistas y
columnas, políticas, SECURITY DEFINER/search_path/EXECUTE, cuerpos, triggers,
restricciones/índices, RLS, Storage y Realtime. **No significa QA funcional remota**.
Ejecutar también los diagnósticos de recuperación y comunidad y:

```sql
-- Catálogo/ACL, no contenido personal.
select to_regprocedure('public.recovery_context(uuid)') is not null as secure_context,
       to_regprocedure('public.declare_independent_recovery(uuid,text)') is not null as independent,
       to_regprocedure('public.rate_recovery(uuid,integer)') is not null as ratings;
select attname,format_type(atttypid,atttypmod) type,attnotnull
from pg_attribute where attrelid=to_regclass('buscag_private.recovery_confirmations')
and attname in('mode','owner_statement','resolved_by') and not attisdropped;
select has_table_privilege('anon','public.public_profiles','SELECT') as anon_directory,
       has_table_privilege('authenticated','public.public_profiles','SELECT') as auth_directory,
       has_column_privilege('authenticated','public.profiles','phone_shared','UPDATE') as direct_consent,
       has_column_privilege('authenticated','public.profiles','rating_count','UPDATE') as direct_rating;
-- Esperado: false, true, false, false. UPDATE(id) puede seguir true:
-- las políticas verificadas impiden cambiar la identidad y permiten upsert propio.
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename='profiles';
```

Después, mediante cuentas **dedicadas de Prueba** y con autorización para crearlas o
usarlas, verificar A/B/C en sesiones distintas:

- Teléfono antiguo privado por defecto; consentimiento explícito, mensajes
  recíprocos y ausencia de bloqueo necesarios. Tercero sin acceso; localidad privada.
- Cambiar `profiles.id` por otro UUID y escribir reputación/consentimiento directo
  debe fallar. `upsert` propio válido debe funcionar. RPC y llamadas REST directas.
- Solicitud bilateral: pendiente hasta que confirma la contraparte correcta;
  rechazo conserva estado activo. Tercero, identidad fingida y replay no completan
  recuperaciones ni duplican avisos. Individual exige confirmación/explicación
  según el caso y no otorga valoración bilateral; no saltea una bilateral pendiente.
- Bloqueo en ambos sentidos, denuncias idempotentes/rate limit, moderación sólo
  para moderadores designados y auditoría. Ninguna cuenta se promovió en esta misión.
- Valoración sólo tras bilateral confirmada, una por participante; historial y
  recuperaciones anteriores no reciben automáticamente actor o nuevas valoraciones.
- Mensajes idempotentes, concurrencia, lectura real, reconexión/recarga y separación
  entre cuentas. Ninguna conversación nueva para recuperados; conservar las previas.
- Mismas publicaciones en listado general puede ser correcto: revisar IDs y dueño,
  filtro propio y ausencia de duplicados. Alertas/matches existentes y preferencias
  deben conservarse; heartbeat y servicios externos se comprueban aparte.

No probar estas operaciones sobre publicaciones/cuentas existentes de usuarios.
No ejecutar el `--smoke` histórico tras el upgrade: sus expectativas son del baseline.

## 5. Firebase Prueba e iPhone: otra operación pendiente

Antes de publicar: cerrar auditoría, respaldo y upgrade; verificar roles de
moderación, SMTP/redirects, VAPID público/privado, webhook y scheduler por las guías
existentes, sin secretos en cliente. No es necesario rotar secretos para instalar SQL.
Compilar presentación para el backend de Prueba y revisar el manifiesto público;
confirmar proyecto Firebase y propiedad del site `buscag-prueba`. Usar únicamente
la configuración separada `firebase.presentation.json`, después de nueva aprobación
de despliegue. No ejecutar el deploy normal ni cambiar configuración de Producción.

Una vez publicado, comprobar el marcador rojo al seleccionar y listar, mapa y
teclado/viewport en iPhone, permisos, offline/reconexión, QR/Auth y chat entre dos
dispositivos. Push real requiere iOS 16.4+, PWA instalada, HTTPS, consentimiento y
servicios configurados. Probar entrega con app cerrada, rotación/revocación y ausencia
de avisos duplicados. Chromium móvil simulado no sustituye Safari ni esta validación.

## 6. Cambios y resultados de esta preparación

- `scripts/prepare-staging.mjs`: modos de diagnóstico de actualización y rechazo
  explícito del instalador antiguo ante una instalación escolar.
- `scripts/staging-upgrade.mjs`: reconocimiento por catálogo, fuentes con SHA,
  diferencias, artefactos locales y bundle transaccional con guardas/preservación.
- `scripts/staging-reference.mjs`: fixture vacío compartido con los tests existentes.
- `supabase/audit/upgrade_catalog.sql`: consulta única de metadatos, sin filas ni
  cuerpos/argumentos secretos de triggers personalizados.
- `tests/staging-upgrade.test.mjs`, tests de preparación y matriz backend: casos de
  instalación sin historial, conservación, rollback, drift, grants, upsert e identidad.
- `STAGING_SETUP.md`, esta guía y scripts npm: ruta de operación actualizada.

No se modificaron las propuestas SQL ni el frontend; no se cambiaron sus hashes ni
se debilitó su seguridad para aceptar el catálogo remoto desconocido.

Validación final de esta misión, con servicios exclusivamente locales:

| Comando | Resultado |
| --- | --- |
| `npm test` | **133** aprobadas, cero fallos |
| `npm run lint` | TypeScript correcto |
| `npm run build` | Compilación Vite correcta |
| `node tests/client-security.mjs` | **18** controles aprobados |
| `npm run test:staging-tools` | **11** aprobadas: cuatro existentes y siete de actualización |
| `npm run test:staging-tls` | **3** aprobadas, incluido handshake TLS local con hostname/CA |
| `npm run test:backend` | Matriz PGlite completa aprobada, más siete casos de actualización |
| `LOCAL_PG_SOCKET=/tmp/buscag-install-pg/socket BUSCAG_TEST_CLUSTER=disposable npm run test:backend:postgres` | Matriz PostgreSQL nativo completa aprobada, más siete casos de actualización |
| `git diff --check` | Sin errores |

Matrices: DATE y timestamptz de repositorio, más DATE con contrato estructural
observado y funciones sustitutas del repositorio; todos los datos sintéticos.
En cada variante nativa: **61/61/64** controles base respectivamente, **17** grupos
escolares, **8** de recuperación y **15** de comunidad. En PGlite: **58/58/61**, **16**,
**7** y **13**, respectivamente; las pruebas que requieren conexiones concurrentes
se verifican en PostgreSQL nativo. Orden de activación aprobado en ambos motores.

La suite comprueba consentimiento y privacidad, bloqueos/denuncias, recuperación
bilateral aceptada/rechazada e individual, autorización, reputación, replay,
notificaciones, concurrencia real en nativo, reaplicación de propuestas y retención.
Los siete casos nuevos prueban instalaciones sin historial con ambas fechas,
transacciones READ ONLY, selección de etapas, preservación de publicaciones/chats,
avisos/suscripciones, historial confirmado y pendiente, QR, preferencias y estado del
worker; fallo intermedio y alteración de datos hacen ROLLBACK; drift y cambios entre
plan e instalación bloquean el bundle; `mode` preexistente se incluye en su huella;
upsert propio funciona y cambio de identidad falla; cuerpos/defaults/argumentos
personalizados no se exportan; artefactos bloqueados quedan inertes.

No se repitió el navegador en esta preparación: no hubo cambios de UI. No se ejecutó
un restore de un backup real de Prueba ni pruebas Auth/API/Storage/Realtime remotas.
Resumen verificable: [STAGING_UPGRADE_VALIDATION.json](STAGING_UPGRADE_VALIDATION.json).

Commit funcional en `Alexis`: **`8d4bf5d`**, `feat(staging): prepare catalog-verified
atomic backend upgrades for Prueba`. El commit de documentación registra esta guía,
el aviso en STAGING_SETUP y los resultados. No se crearon ramas ni Pull Requests.

**Faltantes para instalar:** catálogo real completo compatible o diferencia revisada,
respaldo restaurado y evidencia, ventana operativa, aprobación explícita del SQL.
**Faltantes para publicar:** instalación y QA remota, configuración de servicios y
aprobación de Firebase Prueba. No declarar listo ni resuelto el entorno publicado.
