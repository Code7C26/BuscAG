# Instalación preparada para BuscAG Prueba descartable

Destino único: **yiarlhpbgkofhhipkfha**. Producción excluida:
**hczcqtodcnurdrroczle**. Rama Alexis. Este documento prepara la operación;
**no ejecuta ni autoriza por sí solo una instalación remota**.

## Cambio de condición autorizado por el titular

El titular confirmó que todos los usuarios/publicaciones/mensajes/datos de Prueba
son inventados y descartables y que no necesita conservarlos. Para ese proyecto se
agrega el modo explícito --disposable-staging, sin exigir restauración del respaldo.
No se declara el respaldo verificado ni se establece backup_verified para simularlo.
La ruta normal, sin esa opción, conserva su requisito de restauración verificada.
La excepción no se aplica a producción, otros proyectos, baseline ni DDL genérico.

**No hace falta borrar ni reiniciar la base.** La instalación sigue preservando las
filas existentes mediante conteos/digests. No hay DROP DATABASE/SCHEMA/TABLE ni
TRUNCATE. Los DROP/CREATE son exclusivamente de triggers/políticas propios revisados
para reemplazarlos atómicamente. No se eliminan usuarios, publicaciones ni mensajes.
Si aparece una necesidad destructiva nueva, detenerse y explicarla antes de pedir
su autorización; no usar el carácter descartable como permiso para resetear.

## Dependencias y revisión SQL/RLS

Se reutiliza la infraestructura existente:

1. Etapa school y su baseline exacto: recovery_confirmations, match_notices,
   conversaciones, funciones/roles/grants y el resto del catálogo revisado.
2. proposals/20261106000000_secure_recovery.sql: evidencia de recuperación,
   propietario inicia y contraparte real confirma/rechaza; trigger contra PATCH
   directo; individual explícita cuando corresponde. No crea un sistema paralelo.
3. proposals/20261106001000_community_safety.sql, después de secure_recovery:
   tablas privadas de bloqueos/denuncias/moderación/seguimiento/valoraciones,
   consentimiento de teléfono, RLS y proyección de perfiles, RPC allowlist y triggers.

Los dos originales NO se modifican. SHA-256 LF fijados:

- secure_recovery: db4c8f76aebf8a77f4f4c563d2c2fedb58a0c68bf745cdab079e914b2130262e
- community_safety: 24568b8415834492f8257b6403d0c27bae3ae125646647e1a0794cccc0dee903

La revisión detallada de DDL/DML, SECURITY DEFINER, columnas y permisos permanece en
[STAGING_PREINSTALL_REVIEW.md](STAGING_PREINSTALL_REVIEW.md). Su bloqueo de respaldo
queda sustituido SÓLO para este modo explícito de Prueba descartable. No se desactiva
RLS, no se amplían permisos, no se reemplazan wrappers ni se instalan extensiones.
Los cuerpos/ACL exactos y dependencias oficiales conservan los controles de
[PRUEBA_FEATURE_ACTIVATION.md](PRUEBA_FEATURE_ACTIVATION.md).

Las funciones nuevas son SECURITY DEFINER con tablas calificadas, comprobaciones de
identidad/propiedad y EXECUTE explícito; las tablas privadas no quedan accesibles por
API. La instalación es transaccional, compara catálogo/evidencia antes y después y
retiene los guards de datos. Los DML de recuperar, valorar, bloquear, etc. son acciones
posteriores por RPC, no un backfill durante instalación.

## Diagnóstico real disponible

El plan del titular había reconocido school, 52 restricciones, ACL propias correctas,
los seis wrappers y dos candidatas. Esa es evidencia aportada, no una lectura nueva.

Se intentó AHORA el nuevo plan, únicamente de lectura. En Codex Cloud la variable
BUSCAG_STAGING_DATABASE_URL no es una URI interpretable y connectionConfig detuvo el
proceso con BUSCAG_PREFLIGHT, etapa configuración, ANTES de conectar. No se enviaron
migraciones ni consultas SQL remotas. La URI de Windows que ya te funcionó puede estar
bien; no la pegues en chat ni la imprimas. Usar esa configuración privada y CA.

El código y los SQL están preparados y probados localmente. Falta generar/revisar
el plan REAL con el nuevo modo en el entorno donde la conexión ya funciona. No se
entrega un plan/SQL de fixtures como si fuera el del proyecto remoto.

## Paso 1 — Generar plan de lectura (permitido ahora)

Actualizar Alexis a esta entrega. Desde src/code, con las mismas variables privadas
y CA de la planificación exitosa en Windows:

```powershell
npm.cmd run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-plan --preserve-platform --disposable-staging
```

No instala nada. La conexión existente valida host/usuario/ref/puerto, certificado,
CA/hostname, rol postgres y contexto sin temporales. No se usa VITE_* ni fallback a
producción. --disposable-staging sólo se acepta con upgrade + preserve-platform.

Revisar test-results/staging-upgrade/plan.json:

- project_ref=yiarlhpbgkofhhipkfha, stage=school.
- compatible_catalog=true, platform_preservation.eligible=true, blockers=[].
- upgrade_scope=application_only, data_policy=disposable_staging.
- restore_required=false, backup=not_required_operator_declared_disposable_staging.
- authorization_to_apply=false (la planificación NO es aprobación).
- Exactamente las dos candidatas anteriores, con sus hashes y orden.

Si ya está secure_recovery, sólo puede proponer community_safety. Si está community,
verificar sin reinstalar. Una deriva, política extra, ACL desconocida o baseline no
se acepta por ser descartable: no habrá autorización ejecutable.

Se generan tres archivos locales ignorados por Git:
plan.json, install.review.sql y authorize-disposable.review.psql. El último es sólo
un archivo de revisión hasta que el operador EJECUTE explícitamente el comando del
paso 2. Ante planificación fallida se invalidan los scripts; no usar un artefacto
anterior después de un error. Revisar el plan y ambos archivos finales juntos.

## Paso 2 — Comando exacto de autorización e instalación FUTURA

**No se ejecutó y no debe ejecutarse hasta autorizar la instalación de ese plan.**
EJECUTAR el siguiente psql constituye la autorización explícita para el proyecto y
fingerprint incrustados en el archivo revisado. No es un comando para leer el plan.
Requiere psql 15+; el 18.6 que ya tenés es válido. No usar SQL Editor: el archivo usa
variables/\getenv/\if/\ir de psql.

Desde src/code, una terminal privada y con tu CA ya comprobada:

```powershell
$ErrorActionPreference = 'Stop'
Remove-Item Env:PGSERVICE,Env:PGSERVICEFILE,Env:PGOPTIONS,Env:PGHOSTADDR -ErrorAction SilentlyContinue
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = $env:BUSCAG_STAGING_CA_FILE
if (-not $env:PGSSLROOTCERT -or -not (Test-Path -LiteralPath $env:PGSSLROOTCERT)) { throw 'Falta la CA ya verificada. No conectar sin ella.' }
psql -X --host=aws-0-us-east-1.pooler.supabase.com --port=5432 --username=postgres.yiarlhpbgkofhhipkfha --dbname=postgres --password --set=ON_ERROR_STOP=1 --file=./test-results/staging-upgrade/authorize-disposable.review.psql
if ($LASTEXITCODE -ne 0) { throw 'Instalación no confirmada. Revisar el error, no continuar automáticamente.' }
```

Si psql no está en PATH, invocar su ejecutable 18.6 mediante & y ruta local correcta;
no inventar otro servidor ni contraseña. --password solicita la contraseña sin
incluirla en argumentos/URL. El host session pooler es el que el operador ya verificó;
si Connect muestra otro, revisar el host correcto del mismo proyecto antes de usarlo.

El archivo de autorización comprueba los valores de conexión de psql HOST/USER/PORT/
DBNAME: acepta únicamente db.yiarlhpbgkofhhipkfha.supabase.co con usuario postgres, o
un pooler supabase.com con usuario postgres.yiarlhpbgkofhhipkfha, base postgres y
puerto 5432. Exige PGSSLMODE=verify-full. Un host directo de producción, usuario de
otro tenant, transaction pooler o modo TLS diferente abortan ANTES del GUC y del DDL.
No pasar un DSN ni argumentos adicionales que cambien las condiciones indicadas.
La comprobación de conexión evita errores operativos; no es una barrera frente a un
administrador que edite deliberadamente los archivos o fuerce variables de psql.

Después establece ÚNICAMENTE en esa sesión:

buscag.upgrade.disposable_staging_authorized = yiarlhpbgkofhhipkfha:<catalog_fingerprint>

Ese reconocimiento es distinto de backup_verified y no dice que exista un respaldo.
El instalador exige coincidencia exacta de proyecto+fingerprint; no acepta true ni
un fingerprint viejo/de otro proyecto. La variable por sí sola no prueba identidad
del servidor: por eso se agregó la validación HOST/USER previa. Los guards de fuente,
catálogo, permisos, contexto y evidencia siguen siendo obligatorios.

Todo queda en una transacción para ambas migraciones, lock_timeout 5s,
statement_timeout inicial 120s y settings internos originales. Toma locks de tablas
para impedir escritores; requiere una ventana breve sin publicaciones/chats/DDL
concurrentes. Timeout/error implica rollback, no permiso para quitar guards.
Si el catálogo cambió, nuevo plan y revisión. No ejecutar --apply del instalador
baseline, supabase db push, reset ni las migraciones antiguas.

## Paso 3 — Verificación después de COMMIT

En un proceso/sesión nuevo, sólo lectura:

```powershell
npm.cmd run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-verify --preserve-platform --disposable-staging
```

Esperar community, compatible_catalog=true, installed_final_catalog=true y cero
candidatas. El archivo de autorización queda inerte sin pendientes.
official_validation.verified=false y platform_secure=false siguen siendo esperados:
la ruta NO aprueba ni cambia la infraestructura histórica de Supabase.

## Paso 4 — Pruebas reales de las funciones nuevas (siguiente fase)

Con cuentas sintéticas A/B/C de staging, sin copiar Auth de producción:

1. Login/perfil/publicaciones/edición, búsqueda/filtros/mapa y chat siguen funcionando.
2. A propietario solicita recuperación con B vinculado; C no puede decidir. Estado
   pendiente, rechazo durable y aceptación válida; repetir solicitudes/respuestas
   y recargar no duplica evidencias/notificaciones. PATCH directo no recupera.
3. Individual requiere confirmación explícita; con contraparte/pending no debe
   saltarse la entrega ni generar valoración bilateral ficticia.
4. Denuncias privadas/deduplicadas no borran publicaciones; bloqueo limita ambos
   sentidos de contacto/teléfono. Consentimiento telefónico empieza false.
5. Seguimiento real de publicación ajena y notificaciones de cambios; valoración
   sólo de participantes de bilateral confirmada, sin duplicados ni autoevaluación.
6. Moderación queda inaccesible sin inscripción explícita; el alta de un moderador
   sintético y su prueba deben revisarse aparte, sin conceder roles DB globales.
7. Dos sesiones concurrentes y reconexión conservan estado, privacidad e idempotencia.

Worker/coincidencias automáticas, scheduler, push/VAPID/webhook no se activan con estos
SQL. Revisar sus dependencias separadamente; no anunciar éxito simulado. Mantener
mejoras sólo en Prueba; no preparar una migración equivalente para producción.

## Evidencia local y límites

La matriz nativa PostgreSQL 17 se ejecuta con DATE/timestamptz y el esquema observado;
PostgreSQL 18 prueba el modo descartable. Se conservan las pruebas existentes de RLS,
recuperación, comunidad, concurrencia, datos y wrappers. Las nuevas regresiones
comprueban: sin autorización aborta; reconocimiento de otro proyecto/fingerprint
aborta; producción/--apply/baseline/scope implícito no pasan; archivo obsoleto queda
inerto; el SQL del target gate se ejecuta en PostgreSQL contra destinos válidos y
producción/TLS/puertos incorrectos. Ambos SQL se aplican sólo en bases descartables.

El control SQL de conexión se probó sustituyendo variables psql por valores en bases
locales. El archivo completo de metacomandos no se ejecutó con psql aquí (cliente no
instalado); su primera ejecución real corresponde al paso autorizado en Windows.
No se hizo QA mutante remota ni se declara instalado el backend. Los resultados
exactos se registran en DISPOSABLE_STAGING_VALIDATION.json.
