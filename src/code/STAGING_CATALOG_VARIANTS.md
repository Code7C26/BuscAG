# Variantes reales del catálogo de BuscAG Prueba

Trabajo directo en `Alexis`. No se contactó ni modificó Supabase remoto, Firebase,
datos, secretos o seguridad del proyecto. No se ejecutaron migraciones remotas.
Los tests usan exclusivamente bases locales descartables y metadatos sintéticos.

## Resultado y límite actual

El diagnóstico 3 funcionó en Windows: seis consultas correctas, 11 referencias
CRLF reconocidas, referencia `school`, 52 restricciones esperadas/reales y 79
equivalencias NOT NULL. El problema de conexión/planificación ya no es el bloqueo.

Los permisos recibidos tienen explicación oficial comprobada. Se corrigió el
validador para esas variantes exactas. **El catálogo real todavía no puede
declararse compatible:** las dos definiciones restantes tienen correspondencia
histórica, pero son variantes superadas. La configuración vacía de los seis wrappers
está rechazada explícitamente por la prueba oficial de seguridad.
`authorization_to_apply` sigue siendo false. No se genera bundle para ese catálogo
ni se autoriza instalarlo.

## Fuentes y verificación

Se contrastó el árbol completo de `supabase/postgres` en el commit
[`c6226c631d3f9048586005f0bca8c9fc10a72940`](https://github.com/supabase/postgres/tree/c6226c631d3f9048586005f0bca8c9fc10a72940),
incluidas migraciones, dumps de schema y scripts. La recepción posterior de los
dos cuerpos completos permitió encontrar correspondencias exactas en revisiones
históricas. **Procedencia identificable no significa variante segura/admitida.**

Se agregaron seis archivos estáticos, verificando blob Git contra el árbol de su
commit oficial y SHA-256. Las rutas/commits/hashes completos están en provenance.json:

| Archivo local nuevo | Commit oficial | Evidencia |
| --- | --- | --- |
| 20220321174452_fix-postgrest-alter-type-event-trigger.sql | c6226c631d3f9048586005f0bca8c9fc10a72940 | Dos cuerpos PostgREST históricos |
| 20230224042246_grant_extensions_perms_for_postgres.sql | c6226c631d3f9048586005f0bca8c9fc10a72940 | postgres EXECUTE WITH GRANT OPTION en extensions |
| 20230529180330_alter_api_roles_for_inherit.sql | c6226c631d3f9048586005f0bca8c9fc10a72940 | service_role INHERIT |
| cron-pre-cascade.sql | 78299525c30f99047184dc30a3b36d029d70076b | Cuerpo exacto de cron sin CASCADE |
| pr2410-intermediate.sql | a458f16fb7bb7742067507559c591d9c54c52878 | Placeholder exacto con GUC vacío anidado, revisión intermedia |
| event_trigger_search_path.sql | c6226c631d3f9048586005f0bca8c9fc10a72940 | Prueba oficial: el GUC vacío no protege contra pg_temp |

El registro verifica 17 archivos; un nuevo checkout CRLF puede informar
`reference_crlf_files: 17`. No se modificaron las fuentes oficiales anteriores.
Los SQL se leen como texto; no se ejecutan como instalador. Se conservan incluso
líneas vacías finales del upstream para mantener identidad exacta de hashes.

## Cuerpos y search_path: controles separados

| Evento | SHA-256 reportado (prefijo) | Correspondencia oficial del cuerpo |
| --- | --- | --- |
| issue_graphql_placeholder | 80e0c97f0a47 | PR #2410 intermedio (a458f16...), con SET search_path anidado; superado |
| issue_pg_cron_access | 00db212b76ce | Revisión 78299525..., anterior a añadir CASCADE; superada |
| issue_pg_graphql_access | 03de03bb70da | 20261016000001_search_path_for_supa_functions.sql y schema-17.sql |
| issue_pg_net_access | 754e58111dbe | 20261016000001_search_path_for_supa_functions.sql y schema-17.sql |
| pgrst_ddl_watch | de987df746eb | 20220321174452_fix-postgrest-alter-type-event-trigger.sql |
| pgrst_drop_watch | 791b41f0632f | 20220321174452_fix-postgrest-alter-type-event-trigger.sql |

Los seis valores completos quedan reproducidos en las regresiones, **no** en una
allowlist de producción. Reconocer el cuerpo histórico no dispensa verificar la
configuración. El parser del registro conserva sólo las configuraciones ya revisadas
para aceptación; las fuentes históricas se usan únicamente para explicar el cuerpo.

El valor literal recibido es `["search_path=\"\""]`: un search_path explícitamente
vacío. No es null, ni `pg_catalog, pg_temp`. Las fuentes endurecidas fijadas exigen
`pg_catalog, pg_temp`; las migraciones históricas PostgREST no fijan un GUC vacío.
Se encontró la configuración vacía en revisiones intermedias del PR #2410, pero
fue reemplazada antes de la versión integrada precisamente para proteger pg_temp.

**Hay evidencia oficial contraria a esa equivalencia de seguridad.** En PostgreSQL 17 y 18 se creó
una tabla temporal inofensiva llamada pg_extension: con search_path vacío resuelve
primero pg_temp.pg_extension; con pg_catalog, pg_temp resuelve pg_catalog.pg_extension.
Algunos cuerpos incluyen búsquedas de relaciones y no se puede extrapolar igualdad
desde el nombre o desde que pg_catalog se agregue implícitamente. No se alteró
ninguna función remota para forzar coincidencia ni se aceptó cualquier camino vacío.

El [commit d3b65e590da44e2d01b980c97ebc524f22e001cd](https://github.com/supabase/postgres/commit/d3b65e590da44e2d01b980c97ebc524f22e001cd)
(`chore: protect against pg_temp`) cambia explícitamente los seis GUC vacíos por
pg_catalog, pg_temp y explica esa vulnerabilidad en el test oficial, conservado
como event_trigger_search_path.sql. No es una suposición del planificador.

El [commit b201fc120e6e082cba325605dcf21574eb9efa1e](https://github.com/supabase/postgres/commit/b201fc120e6e082cba325605dcf21574eb9efa1e)
(`fix: don't modify search_path grapql`) retira el SET search_path anidado que
explica exactamente el SHA-256 80e0... recibido. Esa revisión intermedia no puede
tratarse como la versión final integrada. Su cuerpo queda identificado y rechazado
como `graphql_nested_empty_search_path`.

En cron, el cuerpo recibido coincide exactamente con la revisión oficial anterior
a [4486cced0ead19f82b4cf7e95b6b02161ba228d1](https://github.com/supabase/postgres/commit/4486cced0ead19f82b4cf7e95b6b02161ba228d1),
que agrega CASCADE a REVOKE TRIGGER: sin él puede fallar si postgres reconcedió
ese permiso a otro rol. La omisión no es un cambio de formato. Se identifica como
`cron_revoke_without_cascade`, sin incorporarla a las variantes aprobadas.

La salida reemplaza official_body_or_search_path por causas separadas: official_body
si no existe fuente, search_path si el GUC no está admitido, superseded_body para
los dos cuerpos superados y official_body_configuration_pair para mezclas no revisadas.
Agrega body_sources/body_provenance (incluido commit y motivo de supersesión),
accepted_configs, acl_profile y acl_source. Los seis hashes recibidos ahora tienen
una explicación exacta; ninguno se acepta solamente por ser reconocible.
No se imprimen cuerpos, SQL sensible ni datos privados.

## Permisos acreditados

El perfil recibido para issue_graphql_placeholder coincide con la migración
oficial de 20230224: PUBLIC y supabase_admin con EXECUTE sin GRANT OPTION, más
postgres con EXECUTE WITH GRANT OPTION, los tres otorgados por supabase_admin.
El validador reconoce exactamente ese perfil y el default anterior. Otros grantees,
grantors o grant options siguen bloqueados. Cada uno de los seis eventos verifica
su propia ACL; no se supone que coincidan por compartir nombre de schema.

La migración oficial de 20230529 cambia service_role a INHERIT. Exigir siempre
NOINHERIT producía un falso negativo frente a una variante oficial. Se admiten
ambos estados explícitos, manteniendo NOLOGIN, NOSUPERUSER, BYPASSRLS y prohibición
de membresía desde anon/authenticated. La comparación estricta del catálogo sigue
verificando cuerpos, owners, configuración y permisos efectivos de la aplicación.

Las funciones can_send_item_message y canonicalize_message_display son **propias
de BuscAG**, no funciones administradas de Supabase. Los default privileges oficiales
del bootstrap explican el EXECUTE adicional de service_role al crear funciones en
public. La migración propia 20261103000000_secure_items_messages.sql revoca PUBLIC/
anon/authenticated donde corresponde, pero no service_role. Las dos ACL literales
recibidas coinciden con esa combinación, sin grants adicionales ni GRANT OPTION.
El plan expone `service_acl_validation` para hacer visible esta comprobación.

Community sigue revocando service_role EXECUTE en can_send_item_message; el bundle
exige ese resultado y conserva el grant verificado de canonicalize. No se modificó
ninguna migración de BuscAG para ampliar privilegios.

## Archivos modificados

- scripts/staging-official-evidence.mjs: perfiles de permisos acreditados,
  reconocimiento informativo de cuerpos históricos y causas separadas.
- scripts/staging-upgrade.mjs: resultado visible de validación de ACL de servicio.
- tests/staging-upgrade.test.mjs: casos reales reportados, rechazos de alteraciones,
  resolución de temporales, ambos estados oficiales del rol y referencias CRLF.
- supabase/reference/supabase-postgres/provenance.json y README.md: procedencia,
  hashes, alcance y límites de las variantes; más las seis fuentes estáticas nuevas
  enumeradas arriba. No son migraciones pendientes de ejecutar.
- STAGING_OFFICIAL_EVIDENCE.md y este STAGING_CATALOG_VARIANTS.md: evidencia vigente,
  resultados, bloqueos y procedimiento siguiente.

## Regresiones y validación

- `npm run qa:local`: 16 etapas correctas, incluidas 133 pruebas de aplicación,
  TypeScript, compilación, 84 E2E, PWA/presentación, seguridad backend y los 18
  controles del cliente. Los servicios de navegador fueron simulados.
- `npm run test:staging-tools`: 16 pruebas correctas con la ampliación final de
  INHERIT/NOINHERIT. La regresión de combinaciones cuerpo/configuración se volvió
  a ejecutar después del último ajuste del diagnóstico y pasó.
- PostgreSQL nativo 17.10 y 18.6: 12 pruebas finales del planificador correctas por
  versión, incluidos ambos estados INHERIT/NOINHERIT. Se verifica
  el grant option recolectado y la diferencia de resolución de objetos temporales.
- Matriz nativa de seguridad en PostgreSQL 17: 61 controles date/repository,
  61 timestamptz/repository y 64 date/observed; también integración escolar,
  recuperación, comunidad, activación y guardas del bundle. Todo en bases descartables.
- Se conserva la regresión de checkout CRLF para los 17 archivos fijados y se
  rechazan cambios de contenido, hashes, grants, grantor, atributos/membresías,
  configuración, propietarios y objetos desconocidos.

No hubo validación del nuevo comando en el PC Windows ni contra Supabase remoto
desde este ejecutor. Los resultados locales no certifican compatibilidad del catálogo
real: la prueba de sus metadatos debe continuar bloqueada y efectivamente lo hace.

La regresión con los seis hashes y GUC vacíos reproduce el bloqueo real y los
dos motivos de supersesión, además del rechazo explícito de search_path. La ACL
literal de placeholder y los atributos/ACL de service_role fueron proporcionados;
las ACL de los otros eventos en esa prueba son stand-ins sintéticos explícitos,
no una afirmación de haber recibido sus seis JSON completos.

También se prueba el caso acreditado: seis cuerpos/configuraciones oficiales,
perfil de grant oficial e INHERIT generan las dos propuestas, sin ejecutarlas:

1. proposals/20261106000000_secure_recovery.sql
2. proposals/20261106001000_community_safety.sql

## Próximo paso más corto

Actualizar Alexis y volver a ejecutar desde src/code:

```powershell
npm.cmd run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-plan
```

La salida nueva permite separar los bloqueos ya acreditados de los pendientes.
**No se espera que ese comando por sí solo quite los bloqueos de cuerpo/search_path.**
Para continuar con seguridad se necesita que el proveedor confirme o reconcilie
la instalación de sus wrappers con una revisión soportada que pase su propia
prueba de search_path y resuelva las variantes superadas de cron/GraphQL. La evidencia
pendiente es **el catálogo fresco después de esa conciliación autorizada por su
titular/proveedor**: hashes/configuración/owners/ACL/dependencias de los seis eventos.
Ya no faltan los dos cuerpos recibidos; no hace falta volver a pedirlos.

Esta tarea no autoriza modificar ni reemplazar funciones administradas. No se
preparó una migración paralela de reparación de Supabase ni se propone borrar
triggers/restricciones/permisos. Tampoco se sabe quién o qué proceso instaló esa
combinación de revisiones; la coincidencia de cuerpos no demuestra esa historia.

Hasta esa conciliación, las dos migraciones propias siguen pendientes y bloqueadas.
Después deberá repetirse --upgrade-plan, revisar las dos propuestas, verificar
respaldo/restauración y obtener la autorización correspondiente antes de cualquier
instalación. No se declara resuelta la compatibilidad ni realizada la actualización.
