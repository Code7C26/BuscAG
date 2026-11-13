# Evidencia oficial y actualización segura de BuscAG Prueba

Estado más reciente y comparación con los hashes recibidos de Windows:
[Variantes reales y bloqueos pendientes](STAGING_CATALOG_VARIANTS.md).

Rama exclusiva `Alexis`, destino `yiarlhpbgkofhhipkfha`. **No se ejecutan ni autorizan
instalaciones.** No se modificaron Supabase remoto, Firebase, datos ni secretos.
Las fuentes oficiales se leen como texto, nunca se ejecutan. Los tests trabajan con
bases descartables locales.

## Evidencia oficial comprobada

Se consultó **supabase/postgres** mediante GitHub, fijando el commit inmutable
`c6226c631d3f9048586005f0bca8c9fc10a72940`. Diecisiete archivos se verificaron contra sus
Git blobs originales y sus SHA-256 quedaron en
`supabase/reference/supabase-postgres/provenance.json`. Se conserva la licencia.
Dos referencias históricas fijan commits propios en ese manifiesto; se usan
únicamente para identificar variantes superadas, no para aceptarlas.

La migración oficial `20261016000001_search_path_for_supa_functions.sql` y el dump
`migrations/schema-17.sql` corroboran los mismos seis cuerpos y configuración
`search_path=pg_catalog, pg_temp`. La prueba oficial `nix/tests/expected/evtrigs.out`
registra **supabase_admin** como owner tanto del evento como de su función.

Un dump por sí solo **no acredita las ACL históricas**. La migración oficial
`20230224042246_grant_extensions_perms_for_postgres.sql` acredita el perfil
owner/PUBLIC EXECUTE más postgres EXECUTE WITH GRANT OPTION, grantor supabase_admin.
Se admite ese perfil exacto y el default PostgreSQL, sin otros grants. Son funciones
PL/pgSQL, SECURITY INVOKER, RETURNS event_trigger sin argumentos, VOLATILE,
PARALLEL UNSAFE, no STRICT/leakproof. El tipo event_trigger impide invocarlas como
RPC ordinarias, pero no reemplaza la verificación de cuerpos/configuración/contexto.

Las fuentes de inicialización, scripts de ejecución y migraciones de owners
documentan el contexto. Una coincidencia demuestra igualdad con código oficial
revisado; no acredita la historia de instalación ni toda la versión de la plataforma.

**La evidencia fresca de Windows ya fue recibida.** Confirma conexión y consultas,
referencia school, NOT NULL y los grants documentados. Sigue bloqueada por
search_path vacío en seis wrappers y dos cuerpos históricos superados.
Los valores proporcionados no se reemplazan por supuestos; el informe nuevo detalla
qué se probó y qué falta. Esta revisión no contactó Supabase remoto.

## Un comando recoge y valida todo

`prepare:staging --upgrade-plan` ejecuta ahora `upgrade_evidence.sql` junto al catálogo,
en la **misma transacción READ ONLY / REPEATABLE READ**, terminada con ROLLBACK.
Conserva la guarda de destino, host, usuario, puerto y TLS; no pide copiar cuerpos
ni ejecutar consultas manuales adicionales.

El recolector obtiene versión PostgreSQL, owners, conexiones/tags/estado, firma y
propiedades de funciones, ACL/grantor/grant options, dependencias de extensiones,
contexto protegido del schema y membresías hacia service_role/supabase_admin.
Calcula SHA-256 **en PostgreSQL**, normalizando sólo CRLF a LF; no elimina comentarios
ni reescribe SQL. No exporta cuerpos reales ni filas personales.

`plan.json` incorpora `evidence`, `official_validation`, `service_acl_validation` y `equivalences`. Los hashes
y propiedades se comparan con referencias locales verificadas, sin descargar código
elegido por el operador. Incluso si pasa, `authorization_to_apply=false`.

## Equivalencias permitidas y límites

- **NOT NULL:** sólo con versión fresca 15/16/17 se omiten de la referencia local
  las entradas identificadas positivamente como NOT NULL. No se filtra el catálogo
  remoto. Las columnas conservan comparación estricta de `attnotnull=true`; todas
  las FK, PK, UNIQUE, CHECK y entradas desconocidas siguen comparándose. En PG18 no
  se aplica esta regla. El archivo antiguo sin versión no obtiene esa equivalencia.
  La referencia final conserva la representación de la versión de destino.
- **service_role:** sólo se admite el grant extra en las firmas conocidas de
  can_send_item_message/canonicalize_message_display, con todo lo demás idéntico.
  Se exige service_role NOLOGIN, NOSUPERUSER, BYPASSRLS, con INHERIT o NOINHERIT
  documentados por las migraciones oficiales y sin membresía de
  clientes, ACL exacta, grantor postgres y sin grant options ni grantees desconocidos.
  Los default privileges oficiales respaldan la variante de servidor. No se agregan
  derechos a anon/authenticated ni se cambian permisos reales para forzar igualdad.
- **Estado final:** community revoca service EXECUTE en can_send_item_message, y la
  referencia final exige esa revocación. canonicalize conserva su grant verificado.
  No se extiende la equivalencia a otras funciones ni a cuerpos/configuraciones distintos.
- **Eventos:** se exige el conjunto exacto de seis, wiring/tags/estado, ambos owners
  oficiales, SHA-256/configuración, propiedades y ACL exactas. Los wrappers de las
  fuentes revisadas no tienen membresía formal de extensión; otra dependencia exige
  revisión. extensions debe pertenecer a postgres y no ser escribible por clientes;
  los clientes tampoco pueden adquirir supabase_admin. No hay whitelist sólo por
  nombre ni flag de bypass. Versiones oficiales anteriores con cuerpo o search_path
  distinto necesitan otra referencia explícita revisada; no se aceptan por semejanza.

Un metadato ausente, ACL adicional, owner distinto, cuerpo desconocido o evento nuevo
bloquea el conjunto. No se eliminaron, deshabilitaron ni alteraron objetos remotos.

## Procedimiento preparado

Se reutiliza [STAGING_UPGRADE.md](STAGING_UPGRADE.md), sin instalador paralelo ni
apply nuevo: destino inequívoco, respaldo restaurado, revisión del plan y aprobación
explícita futura. Si school coincide con evidencia completa, propone recuperación
segura y después comunidad; no reinstala school ni el baseline. Los archivos son
`proposals/20261106000000_secure_recovery.sql` y
`proposals/20261106001000_community_safety.sql`, en ese orden.

El bundle sigue siendo revisable. Ahora verifica **catálogo y evidencia ampliada**
antes y después, incluidos hashes/owners/ACL de los eventos. Mantener sólo un nombre
no permite sustituir un cuerpo entre diagnóstico e instalación. La evidencia final
refleja la revocación de can_send_item_message. Se conservan transacción única,
bloqueos, comprobación de datos existentes y rollback. No se agrega DDL administrado,
tráfico HTTP ni cambios de secretos al SQL de instalación.

## Registro anterior de pruebas y archivos

Validación local aprobada:

- `npm run qa:local`: **15 etapas** correctas, incluidos **133** tests de aplicación,
  TypeScript, build, **84** tests E2E escritorio/móvil, PWA compilada, presentación,
  herramientas, seguridad WASM y **18** controles del cliente.
- `npm run test:staging-tools`: **13** aprobadas con las últimas comprobaciones.
- `npm run test:staging-tls`: **3** aprobadas, incluido handshake local con CA/hostname.
- `LOCAL_PG_SOCKET=/tmp/buscag-install-pg/socket BUSCAG_TEST_CLUSTER=disposable npm run test:backend:postgres`:
  matriz nativa completa aprobada en DATE/timestamptz de repositorio y DATE observado;
  **61/61/64** controles base, **17** grupos escolares, **8** de recuperación y **15**
  de comunidad por variante, activación y **9** casos de actualización.
- La matriz completa también pasó en **PostgreSQL 17.10 real**, además de 18.6.
  La prueba de actualización verifica físicamente que service_role conserva EXECUTE
  en canonicalize y lo pierde en can_send al instalar community, en ambos majors.
  Sólo se modifican roles de clusters descartables; el flag de herencia se restaura.
- Las regresiones finales se repitieron en ambos motores: **13** casos de herramientas
  WASM y **9** de actualización nativa. Comprueban integridad Git/SHA, cálculo SHA
  preservando whitespace y normalizando CRLF, rechazo de llamada directa de
  authenticated y **21** mutaciones peligrosas que deben bloquear el plan.
- También se comprueban metadatos perdidos entre diagnóstico/aplicación, guardas
  finales, preservación de datos, replay, privacidad, recuperación e idempotencia.
- Comprobación de whitespace del código propio: correcta. Las copias oficiales
  conservan espacios finales y líneas vacías del upstream para mantener identidad
  exacta de blobs/SHA; no se reformatearon para silenciar advertencias. Resumen: [STAGING_OFFICIAL_VALIDATION.json](STAGING_OFFICIAL_VALIDATION.json).

Los navegadores simulan Supabase; Chromium móvil no certifica iPhone real. La matriz
WASM utiliza 58/58/61 controles base, 16 grupos escolares, 7 de recuperación y 13 de
comunidad por variante; la concurrencia real se verifica con PostgreSQL nativo.

Archivos principales: `scripts/staging-official-evidence.mjs`,
`scripts/staging-equivalence.mjs`, `supabase/audit/upgrade_evidence.sql`,
`scripts/staging-upgrade.mjs`, `scripts/prepare-staging.mjs`, diagnóstico por objetos,
referencias oficiales y `tests/staging-upgrade.test.mjs`. Las propuestas de migración
y el frontend no cambiaron. El caso positivo de metadatos es **sintético**, no evidencia
de que Prueba tenga esos valores. El cálculo SHA se verifica con una función de
evento inocua en una base local; los cuerpos oficiales nunca se ejecutan.

## Evidencia concreta faltante y paso más corto

La evidencia de Windows ya llegó. Los permisos documentados se reconocen; se requiere conciliar
con el proveedor los cuerpos superados de set_graphql_placeholder/grant_pg_cron_access
y el search_path vacío de los seis wrappers, rechazado por su prueba oficial. El [informe vigente](STAGING_CATALOG_VARIANTS.md)
identifica las fuentes contrastadas, las regresiones y la evidencia concreta pendiente.
No hacen falta contraseñas ni datos de usuarios.

En la máquina donde ya funcionaban la URI privada y la CA, actualizar `Alexis` y,
desde `src/code` con esa configuración privada existente, ejecutar una sola vez:

```powershell
npm run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-plan
```

Ese comando recopila y valida sin instalar. Con los metadatos actualmente recibidos
seguirá bloqueado por cuerpo/configuración; no se pretende forzar compatibilidad.
Una vez acreditadas las diferencias, si pasa, debería reconocer school y
proponer sólo las dos etapas pendientes; todavía no autoriza ejecutarlas. Si falla,
`official_validation.checks[].failures`, `comparisons` y `evidence` indican qué falta
o difiere. No modificar objetos para conseguir verde; conservar el plan generado
para revisar la diferencia contra la fuente oficial correspondiente.

Luego siguen pendientes respaldo recuperable, aprobación e instalación, QA real del
backend, servicios y aprobación separada de Firebase Prueba y comprobación de iPhone.
Ninguna de esas etapas se declara realizada.
