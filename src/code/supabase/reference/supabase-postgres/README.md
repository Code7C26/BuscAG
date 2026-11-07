# Referencias oficiales: no ejecutar

Fuentes de **supabase/postgres**, commit inmutable
`c6226c631d3f9048586005f0bca8c9fc10a72940`, obtenidas mediante GitHub de sólo lectura.
`provenance.json` registra ruta original, Git blob y SHA-256. Los bytes se verificaron
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
- Un schema dump por sí solo no acredita ACL históricas. La política local exige
  sólo la ACL default PostgreSQL (owner/PUBLIC EXECUTE, sin grant options) junto
  con propiedades INVOKER/event_trigger verificadas. Los clientes no pueden invocar
  estas funciones como RPC; esa restricción se prueba en PostgreSQL real.
- Bootstrap, migrate.sh y migraciones de propietarios documentan los roles y los
  default privileges; no deben utilizarse como instalador de BuscAG.

Fuente: https://github.com/supabase/postgres/tree/c6226c631d3f9048586005f0bca8c9fc10a72940

La igualdad demuestra igualdad de código/configuración revisados, no quién instaló
históricamente el objeto ni la versión completa de la plataforma. No se admiten
otras versiones por parecido; ampliar el registro exige fuente fijada y pruebas.
