# Referencias oficiales: no ejecutar

Fuentes de **supabase/postgres**, commit inmutable
`c6226c631d3f9048586005f0bca8c9fc10a72940`, obtenidas mediante GitHub de sólo lectura.
Las referencias históricas de cron y del PR #2410 fijan sus commits propios en
`provenance.json`: 78299525c30f99047184dc30a3b36d029d70076b y
a458f16fb7bb7742067507559c591d9c54c52878. Se usan sólo para explicar variantes
superadas, nunca para autorizarlas. El manifiesto registra ruta original, Git blob y SHA-256. Los bytes se verificaron
contra los blobs originales. Se conserva la licencia PostgreSQL/Supabase en LICENSE.

Para un checkout Windows, se permite CRLF→LF en memoria únicamente si se recuperan
exactamente los dos hashes oficiales fijados. No se recortan espacios ni se aceptan
BOM, comentarios o contenido alterado. No se modifican archivos ni hashes del
manifiesto; el parser consume sólo los bytes canónicos ya verificados.

**No ejecutar estos SQL ni migrate.sh.** Son evidencia estática, no propuestas de
BuscAG. El instalador no las incluye; el validador sólo lee texto y hashes.
No contienen credenciales reales: el script upstream usa variables, no valores.

- `20261016000001_search_path_for_supa_functions.sql` y `schema-17.sql` corroboran
  los mismos seis cuerpos y search_path endurecido.
- `evtrigs.out` prueba los propietarios de eventos y funciones.
- Un schema dump por sí solo no acredita ACL históricas. Se admiten dos perfiles
  exactos: default PostgreSQL (owner/PUBLIC EXECUTE, sin grant options), o ese mismo
  perfil más postgres/EXECUTE WITH GRANT OPTION, otorgado por supabase_admin.
  `20230224042246_grant_extensions_perms_for_postgres.sql` acredita el segundo.
  Ninguno dispensa verificar cuerpo, configuración, propiedades y contexto.
- `20230529180330_alter_api_roles_for_inherit.sql` documenta service_role INHERIT;
  el bootstrap documenta NOINHERIT. Ambos requieren NOLOGIN/NOSUPERUSER/BYPASSRLS,
  clientes sin membresía y ACL exactas para las dos funciones propias de BuscAG.
- `20220321174452_fix-postgrest-alter-type-event-trigger.sql` acredita los dos
  cuerpos PostgREST históricos reportados. Se reconocen sólo como procedencia de
  cuerpo: no se aceptan configuraciones ausentes/vacías o distintas de la revisada.
  PostgreSQL prueba que search_path vacío puede anteponer relaciones temporales;
  no es una equivalencia automática de pg_catalog, pg_temp.
- `cron-pre-cascade.sql` y `pr2410-intermediate.sql` explican los otros dos hashes
  recibidos. No se aceptan: la variante cron carece del CASCADE añadido después;
  el placeholder conserva un SET search_path anidado retirado durante la revisión.
- `event_trigger_search_path.sql` es la prueba oficial que exige pg_catalog, pg_temp
  y explica explícitamente por qué el GUC vacío no protege de objetos temporales.
  Identificar una revisión intermedia no demuestra equivalencia con el resultado
  final revisado. Se mantienen los bloqueos y no se ejecuta este SQL.
- Bootstrap, migrate.sh y migraciones de propietarios documentan los roles y los
  default privileges; no deben utilizarse como instalador de BuscAG.

Fuente: https://github.com/supabase/postgres/tree/c6226c631d3f9048586005f0bca8c9fc10a72940

La igualdad demuestra igualdad de código/configuración revisados, no quién instaló
históricamente el objeto ni la versión completa de la plataforma. No se admiten
otras versiones por parecido; ampliar el registro exige fuente fijada y pruebas.

## Ensayo acotado de aplicación

La validación general anterior sigue vigente. tests/platformFixture.mjs extrae sólo
los seis cuerpos exactos, tras verificar los bytes oficiales, y los instala en bases
locales descartables para ensayar los dos SQL propios de BuscAG. No ejecuta las
migraciones upstream completas. La opción --preserve-platform no certifica estos
wrappers ni los incluye en un bundle; conserva sus bytes y metadatos. Consultar
[el procedimiento acotado](../../../PRUEBA_FEATURE_ACTIVATION.md).
