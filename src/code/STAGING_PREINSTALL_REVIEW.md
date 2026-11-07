# Preparación de instalación: secure_recovery + community_safety

Continuación con TOC real PG17.11/Auth/Vault: [restauración aislada en Windows](SUPABASE_RESTORE_WINDOWS.md).

Rama exclusiva Alexis; revisión sobre c516059. Proyecto autorizado para una futura
instalación: **yiarlhpbgkofhhipkfha**. Producción excluida:
**hczcqtodcnurdrroczle**. Esta entrega NO autoriza ni ejecuta instalación.

**Estado: NO listo para instalar todavía.** Las fuentes y el generador están
revisados; faltan el artefacto exacto de Windows y evidencia de restauración real del
respaldo existente. No se creó otro respaldo ni se estableció backup_verified.

## Evidencia accesible y límites

El operador confirma que su plan remoto reconoce school, compatible_catalog=true,
platform_preservation.eligible=true, blockers=[] y exactamente dos candidatas.
Eso resuelve compatibilidad de catálogo, pero no demuestra integridad del dump,
restauración, autorización o comportamiento Auth/API posterior.

En este entorno NO existe `src/code/test-results/staging-upgrade/install.review.sql`
ni el plan.json correspondiente. Tampoco está montado el disco C: de Windows ni
aparece el dump en los directorios de adjuntos del workspace. Por tanto:

- No se auditó el archivo SQL exacto generado en Windows ni se conoce su SHA-256.
- No se abrió, listó, descomprimió ni restauró BuscAG_Staging_backup.dump.
- Su tamaño, fecha, formato, versiones, cobertura, propietarios y extensiones son
  desconocidos aquí. El nombre/extensión .dump no acredita formato ni contenido.
- Hay Docker CLI local, pero no psql/pg_restore en PATH. Los binarios PG17/18 usados
  antes para fixtures no convierten un archivo inaccesible en una restauración.
- Los ensayos sintéticos anteriores NO son la restauración de este respaldo.

## Integridad de fuentes aprobada

SHA-256 de los bytes normalizados únicamente CRLF→LF, contrastados con el contrato
inmutable de scripts/staging-application-scope.mjs:

| Fuente | SHA-256 LF |
| --- | --- |
| proposals/20261106000000_secure_recovery.sql | db4c8f76aebf8a77f4f4c563d2c2fedb58a0c68bf745cdab079e914b2130262e |
| proposals/20261106001000_community_safety.sql | 24568b8415834492f8257b6403d0c27bae3ae125646647e1a0794cccc0dee903 |

No se modificaron fuentes, hashes, políticas, funciones, wrappers ni generador.
El generador verifica también el hash de bytes de cada candidata registrado en el
plan, que puede diferir del LF canónico en un checkout CRLF. El fingerprint SHA-256
representa el catálogo esperado; NO es el hash del archivo instalador.

Para comprobar las fuentes en Windows, desde src/code:

```powershell
node --input-type=module -e "import('./scripts/staging-application-scope.mjs').then(m=>m.verifyApplicationSources()).then(()=>console.log('Fuentes fijadas: OK'))"
Get-FileHash -Algorithm SHA256 -LiteralPath '.\test-results\staging-upgrade\install.review.sql'
Get-FileHash -Algorithm SHA256 -LiteralPath '.\test-results\staging-upgrade\plan.json'
```

Los dos últimos hashes identifican artefactos para revisión; calcularlos no prueba
que su contenido sea correcto. Para completar la auditoría exacta hacen falta esos
dos archivos (sin credenciales). No sustituirlos por un bundle generado con fixtures.
Un plan nuevo invalida/reemplaza los artefactos anteriores: revisar siempre el par
plan/SQL final y registrar sus hashes antes de autorizar.

## Auditoría de las dos migraciones originales

### secure_recovery

- Añade mode NOT NULL DEFAULT bilateral con CHECK a recovery_confirmations. El default
  se aplica a registros anteriores de esa tabla; no crea confirmaciones a partir de
  publicaciones recuperadas ni reescribe el estado de publicaciones existentes.
- Define/reemplaza cinco funciones SECURITY DEFINER, search_path vacío y referencias
  de relaciones calificadas: recovery_partners, recovery_context,
  require_recovery_evidence, request_item_recovery y resolve_item_recovery.
- Revoca EXECUTE a PUBLIC/anon/authenticated/service_role y concede únicamente las
  RPC públicas explícitas a authenticated. El helper y el trigger no se exponen.
- Crea el trigger BEFORE INSERT/UPDATE de status en items, cerrando el cambio directo
  a recuperado sin evidencia confirmada persistida.
- El DML está dentro de funciones para llamadas futuras: inserta evidencia/noticias,
  actualiza solicitudes y estado. Propietario y contraparte se comprueban con auth.uid,
  conversaciones/coincidencias persistidas, serialización e idempotencia.

### community_safety

- Añade profiles.phone_shared=false y rating_count=0, y owner_statement/resolved_by a
  recovery_confirmations. No interpreta un teléfono histórico como consentimiento.
- Conserva el valor antiguo de rating; la vista muestra 0 hasta tener rating_count>0.
  Es un cambio visible de presentación, no eliminación de la calificación almacenada.
- Crea seis tablas privadas, sus PK/FK/CHECK/UNIQUE e índices: user_blocks, moderators,
  reports, moderation_actions, item_followers y recovery_ratings. ENABLE RLS y
  REVOKE ALL para los roles API; no crea políticas de acceso directo a esas tablas.
- Crea/reemplaza tres políticas RESTRICTIVE propias sobre profiles, combinadas con
  las permisivas del baseline. Revoca escritura directa de campos de reputación y
  consentimiento; no deshabilita RLS ni amplía acceso anónimo.
- Reemplaza public_profiles con security_barrier y una proyección explícita: teléfono
  sólo según consentimiento, reciprocidad y bloqueo; ubicación propia. La vista no
  usa security_invoker: su exposición depende deliberadamente de la proyección y las
  comprobaciones de auth.uid. SELECT sólo para authenticated.
- Define/reemplaza 22 funciones: 20 SECURITY DEFINER y dos triggers SECURITY INVOKER
  (record_recovery_decision y validate_phone_update), todas con search_path vacío.
  Las RPC validan identidad, destino, formato, cuotas y condición de moderador o
  participante. La allowlist final revoca EXECUTE público/API y sólo concede las
  funciones públicas previstas a authenticated. anonymize_recovery_participant
  conserva sus ACL privadas previas, verificadas por el contrato school.
- Crea cinco triggers propios: decisión de recuperación, validación de teléfono,
  acceso a mensajes, notificaciones de seguimiento y evidencia (este último en el
  SQL anterior). Reemplaza además el cuerpo de anonimización usado por el trigger
  escolar existente; no crea otro trigger sobre Auth ni escribe en auth.users.
- El DML futuro incluye bloquear/desbloquear, seguir/dejar de seguir, denunciar,
  moderar con auditoría, valorar, actualizar perfil/reputación y recuperar. Hay DELETE
  dentro de RPC de desbloqueo/dejar de seguir y FK ON DELETE para operaciones futuras;
  no hay DELETE masivo ni eliminación de usuarios/publicaciones durante instalación.
- No inscribe moderadores, no habilita worker/scheduler, no configura push, no envía
  notificaciones por backfill ni simula aceptación bilateral.

Ambos SQL usan CREATE OR REPLACE/IF NOT EXISTS y DROP/CREATE de triggers/políticas
propios. Su uso requiere el catálogo exacto revisado; IF NOT EXISTS por sí solo no
valida una instalación parcial. El guard del bundle sí bloquea esa deriva.

## Alcance y condiciones del generador revisado

scripts/staging-upgrade.mjs sólo incluye esos dos archivos fijados y en ese orden
para school/application_only. No incluye migraciones upstream, CREATE/DROP EXTENSION,
ALTER EVENT TRIGGER, cambios de roles o de configuraciones globales. Los seis wrappers
se leen y se comparan antes/después; nunca se reemplazan. Los dos watchers PostgREST
existentes se disparan por el DDL; los cuatro de extensiones no se disparan.

Los cambios de configuración son SET LOCAL de sesión/transacción (timeouts y
search_path), no ALTER SYSTEM ni configuración persistente de plataforma. El bundle
requiere psql (`\set ON_ERROR_STOP on`): **NO pegarlo en SQL Editor**.

- Una transacción para ambos SQL; sesión postgres, origin, eventos habilitados,
  defaults revisados y sin objetos temporales. No crea tablas temporales.
- lock_timeout=5s; statement_timeout inicial=120s. Los SQL internos establecen 60s;
  no interpretar eso como un límite fiable de 60s para el DO ya iniciado ni como
  límite total de la transacción. Los límites son por sentencia, no por instalación.
- Advisory lock (214726,926), luego SHARE ROW EXCLUSIVE sobre auth.users y las tablas
  existentes de aplicación. Permite lecturas ordinarias, bloquea escritores. DDL y
  ALTER TABLE pueden tomar ACCESS EXCLUSIVE brevemente. Requiere ventana corta sin
  otros escritores/DDL; el timeout puede abortar y exigir replanificar.
- Compara catálogo y evidencia exactos antes y después, y conteos/digests de filas
  de aplicación excluyendo sólo columnas nuevas. Guarda conteo de auth.users, no
  una huella de todos los atributos de Auth/identities/Storage. No sustituye respaldo.
- Los MD5 de filas/catálogos son detectores operativos, no prueba criptográfica de
  integridad frente a un administrador malicioso. Los hashes SHA-256 de fuentes sí
  fijan los SQL revisados. El escaneo/agregado de filas cuesta CPU/memoria/disco y
  tiempo: duración real y tamaño de datos aún deben medirse sobre el respaldo.
- backup_verified debe igualar catalog_fingerprint. Es una declaración manual del
  operador postgres, NO una validación automática del dump ni una autorización
  independiente. Nadie lo estableció en remoto en esta misión.
- El comentario del project ref no ata por sí solo psql al proyecto. El destino debe
  fijarse explícitamente en la conexión; un esquema parecido no prueba identidad.

## Respaldo: comprobaciones mínimas en Windows (sólo locales)

No generar otro dump antes de determinar si el existente es suficiente. En una
terminal privada, sin publicar logs/TOC que puedan contener metadatos sensibles:

```powershell
$ErrorActionPreference = 'Stop'
$backup = 'C:\Users\Valen M\Downloads\BuscAG_Staging_backup.dump'
Get-Item -LiteralPath $backup | Select-Object Length,LastWriteTimeUtc
Get-FileHash -Algorithm SHA256 -LiteralPath $backup
Get-Command pg_restore,psql,docker -ErrorAction SilentlyContinue
pg_restore --version
pg_restore --list -- $backup > "$env:TEMP\BuscAG-backup-toc.private.txt"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo leer el archivo: revisar formato/version, no restaurar todavía.' }
pg_restore --file=NUL -- $backup
if ($LASTEXITCODE -ne 0) { throw 'Falló lectura/descompresión completa; respaldo no verificado.' }
```

Esto NO restaura nada. --list sólo lee el índice; la conversión a NUL recorre el
contenido sin ejecutarlo. SHA-256 sin un hash original de referencia identifica el
archivo pero no prueba su procedencia. Si pg_restore indica dump de texto, no es
prueba de corrupción: revisar formato localmente, sin ejecutar el texto todavía.
No abrir/pegar públicamente el SQL del respaldo (puede incluir datos Auth y secretos).

Revisar en privado cabecera/TOC: versión del servidor origen y de pg_dump, formato,
fecha, base origen, cobertura de tablas/datos/ACL/políticas/funciones/secuencias,
propietarios, extensiones requeridas y objetos excluidos. Debe cubrir al menos los
esquemas/datos de aplicación y Auth necesarios para una recuperación coherente.
Storage metadata no contiene los binarios del bucket; un dump SQL tampoco garantiza
configuración Edge/SMTP/push. Un dump de una sola DB no incluye automáticamente roles
globales. Si faltan esas piezas, identificar cobertura antes de declarar suficiencia.

### Restauración real: destino nuevo y aislado

Como no se conoce la cabecera/TOC, **todavía no puede fijarse honestamente la imagen,
versión, bootstrap de roles ni extensiones compatibles**. No usar a ciegas postgres:18
ni un stack remoto. Hace falta PostgreSQL de versión compatible (cliente pg_restore
capaz de leer el formato; servidor igual al origen es la opción conservadora) y los
binarios de extensiones/roles que exige el archivo. No actualizar el proyecto remoto.

Una vez seleccionada esa imagen/instancia local compatible, usar un contenedor
exclusivamente descartable: network=none, sin puertos publicados ni Docker socket,
PGDATA en tmpfs/volumen nuevo exclusivo, dump montado sólo lectura, sin credenciales
reales en variables y sin carpetas personales adicionales. No ejecutar un dump
potencialmente activo en una instancia que contenga otras bases valiosas.

Los siguientes comandos son el tramo de restauración, una vez revisado ese entorno;
los valores entre <...> requieren la cabecera y el bootstrap real, NO son valores
supuestos. El administrador es sólo del contenedor local, nunca Supabase:

```powershell
$container = '<contenedor-local-descartable-verificado>'
$localAdmin = '<administrador-local-del-bootstrap>'
$database = 'buscag_restore_' + [guid]::NewGuid().ToString('N')
docker inspect $container
# Comprobar aislamiento, versión, roles originales y extensiones ANTES de continuar.
docker exec $container createdb --host=/var/run/postgresql --username=$localAdmin --template=template0 --owner=postgres $database
if ($LASTEXITCODE -ne 0) { throw 'No se creó una base NUEVA; detener sin sobrescribir.' }
docker exec $container pg_restore --host=/var/run/postgresql --username=$localAdmin --dbname=$database --exit-on-error --single-transaction /review/backup.dump
if ($LASTEXITCODE -ne 0) { throw 'Restauración fallida; respaldo NO verificado.' }
```

La creación de roles requeridos debe proceder de un bootstrap revisado, no de crear
roles arbitrarios según mensajes de error. No usar --clean, --create, --no-owner,
--no-privileges, --disable-triggers ni ignorar errores para lograr un verde. Preservar
owners/ACL/RLS es parte del ensayo. Si template0 ya contiene objetos que chocan o una
extensión no está disponible, detenerse y revisar compatibilidad, no borrar objetos
para forzar restauración. Ningún comando apunta a red ni usa una URI remota.

Exit code 0 es necesario, pero no suficiente: validar tablas, conteos esperados,
secuencias, constraints validadas, índices, owners, grants, políticas y triggers.
Sin un inventario original/controles de contenido, registrar esa limitación; no
inventar igualdad con el origen actual. Un respaldo antiguo tiene un RPO antiguo.
Conservar hash del dump, versiones, log privado, base/contenedor y controles/resultados
como evidencia de restauración. No incluir filas personales en el informe.

### Ensayo de migraciones sobre la restauración

Sólo después de lo anterior: capturar metadatos y conteos/digests privados locales,
clasificar la etapa de ese respaldo y generar un bundle para ESA base local.
**No usar sin más el install.review.sql del remoto:** contiene fingerprint/evidencia
que pueden diferir de un respaldo anterior. No cambiar sus guards ni falsificarlo.
Si el respaldo no es school, identificar qué falta y revisar el ensayo correspondiente.

El CLI de Prueba está fijado a hosts remotos; no modificarlo ni usar una URI remota
para ensayar. La API planUpgrade/upgradeBundle ya probada puede operar con un cliente
pg local por socket sobre esa base, validando el mismo contrato. El backup_verified
local sólo se declara tras su restauración real y revisión del ensayo. Esa sesión
local debe ser postgres, con permisos originales y TLS innecesario sólo para ese
socket aislado. Después de aplicar el bundle local con psql, comparar snapshots y
catálogo final. No ejecutar tests/fixtures sobre el dump con usuarios reales: algunos
crean/borran datos sintéticos. El arnés actual no certifica por sí solo este archivo.

Este tramo necesita una base restaurada accesible para terminar su preparación
específica; no hay un ensayo real del dump ejecutado ni un comando local validado para
su catálogo desconocido. Los tests sintéticos previos de concurrencia, autorización,
RLS y conservación se conservan como evidencia adicional, no como sustituto.

## Instalación futura: sólo tras autorización explícita

Prerequisitos: auditoría del par plan/SQL exacto completada; restauración real y
ensayo aprobados; respaldo suficiente/revisado; hashes de artefactos registrados;
ventana acordada; frontend compatible y usuarios de prueba controlados.

Regenerar sólo el plan de lectura si el catálogo cambió, y volver a revisar artefactos:

```powershell
npm.cmd run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-plan --preserve-platform
```

Tras autorización específica de instalación, abrir terminal privada nueva con psql
compatible. No imprimir URI ni reutilizar configuración libpq desconocida:

```powershell
Remove-Item Env:PGSERVICE,Env:PGSERVICEFILE,Env:PGOPTIONS,Env:PGHOSTADDR -ErrorAction SilentlyContinue
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = '<ruta-a-la-CA-ya-verificada>'
# Sin PGSERVICE/PGOPTIONS heredados ni archivo .psqlrc ejecutado.
psql -X --host=aws-0-us-east-1.pooler.supabase.com --port=5432 --username=postgres.yiarlhpbgkofhhipkfha --dbname=postgres --password --set=ON_ERROR_STOP=1
```

El host/puerto session pooler es el confirmado por el operador; comprobarlo de nuevo
en Connect del ref de Prueba. -W/--password pide contraseña sin ponerla en argumentos.
No usar sslmode=require como sustituto de verify-full, ni desactivar hostname/CA.
Conexión nueva, sin temporales. Verificar privadamente \conninfo, current_user y
session_user=postgres (`SELECT current_user,session_user,current_database();`, los tres
valores deben ser postgres). Ejecutar psql desde src/code para que el \i relativo
apunte al archivo revisado. El usuario del pooler contiene explícitamente el ref Prueba;
no usar las credenciales/ref de producción. Esta conexión es un paso FUTURO.

ÚNICAMENTE después de autorización y restauración acreditada, en esa misma sesión:

```sql
SELECT set_config('buscag.upgrade.backup_verified','<catalog_fingerprint EXACTO del plan final revisado>',false);
\i 'test-results/staging-upgrade/install.review.sql'
```

No se ejecutó ni se autoriza hoy este bloque. El fingerprint no es la SHA del dump.
No usar --single-transaction adicional (el bundle ya tiene BEGIN/COMMIT), SQL Editor,
--apply del instalador baseline ni supabase db push. Si hay error, no continuar ni
editar guards: ROLLBACK/cerrar sesión y analizar/replanificar. Si COMMIT confirmó,
no reaplicar para “asegurarse”: pasar a verificación.

## Verificación posterior, separada de instalación

En una NUEVA sesión/proceso, lectura únicamente:

```powershell
npm.cmd run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-verify --preserve-platform
```

Esperar community, installed_final_catalog=true, compatible_catalog=true, cero
candidatas y wrappers sin cambios. official_validation.verified=false y
platform_secure=false siguen esperados: no son aprobación de la plataforma heredada.
Comparar conteos y preservar publicaciones/chats/consentimientos anteriores. Verificar
schema cache/API y logs de errores sin exportar tokens ni datos privados.

Con dos cuentas reales de prueba propias y un tercero controlado: login y lectura/
edición propia; publicación nueva; chat recíproco; propietario solicita recuperación,
tercero no puede decidir, contraparte rechaza y luego acepta una solicitud válida;
reintentos y recarga no duplican evidencia/notificaciones; individual explícita no
simula bilateral; bloqueo corta contacto/teléfono; denuncia privada no borra objetos;
seguimiento avisa cambios; valoración sólo tras bilateral confirmada; teléfono sigue
privado hasta consentimiento y condiciones de reciprocidad. Moderación sólo tras
alta separada autorizada del moderador. No borrar publicaciones/usuarios existentes
para probar. Worker, scheduler y push siguen siendo operaciones separadas.

## Decisión

Fuentes y diseño del instalador: revisados, sin cambios necesarios en esta entrega.
Compatibilidad remota: confirmada por el operador. Archivo SQL exacto: pendiente.
Respaldo/restauración: **NO VERIFICADOS**. Ensayo sobre el respaldo real: pendiente.
Instalación: **BLOQUEADA por esas evidencias**, no por los wrappers ni por las ACL.

Acción mínima ahora: identificar el dump con SHA-256/cabecera/TOC privados y disponer
del par plan.json/install.review.sql para su auditoría exacta. Con la versión y las
dependencias del archivo se puede fijar el entorno descartable y completar la
restauración/ensayo. No se necesita una credencial remota para resolver este bloqueo.

## Validaciones locales de esta entrega

Se ejecutaron npm test, npm run lint (TypeScript), npm run build y los 18 controles
de tests/client-security.mjs: todos con exit code 0. Se verificaron los SHA-256 LF
de ambas fuentes contra el contrato fijado. El inventario está en
STAGING_PREINSTALL_VALIDATION.json. No se cambiaron SQL ni lógica de aplicación.

Se reutiliza, sin repetir, la evidencia comprometida en c516059:
STAGING_CRON_NET_ACL_VALIDATION.json (matrices nativas PG17 DATE/timestamptz y PG18,
aplicación atómica, permisos/RLS, rollback, concurrencia y preservación con las ACL
observadas). Esa evidencia usa datos sintéticos: **no prueba restauración de este
dump**. No se ejecutó una nueva migración ni test con usuarios reales en esta entrega.
