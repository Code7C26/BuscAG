# ACL de cron/net: causa y corrección acotada

Destino: BuscAG Prueba `yiarlhpbgkofhhipkfha`, rama Alexis. No se realizaron
conexiones/migraciones remotas, cambios de wrappers, Firebase ni cambios de datos.

## Causa concreta

El operador aportó la ACL literal de ambos wrappers. Es idéntica en cron y net:

| Grantee | Grantor | Privilegio | Grantable |
| --- | --- | --- | --- |
| PUBLIC | supabase_admin | EXECUTE | false |
| supabase_admin | supabase_admin | EXECUTE | true |
| dashboard_user | supabase_admin | EXECUTE | false |

El validador sólo admitía owner/PUBLIC con grantable=false, opcionalmente con una
entrada postgres EXECUTE WITH GRANT OPTION. Por eso rechazaba estas dos ACL: la
entrada del propietario tiene grantable=true y existe dashboard_user; no hay entrada
separada para postgres. Las 52 restricciones y las dos ACL propias de BuscAG no son
el problema y no se modifican.

## Evidencia oficial verificable

Fuentes de supabase/postgres en el commit inmutable
[c6226c631d3f9048586005f0bca8c9fc10a72940](https://github.com/supabase/postgres/tree/c6226c631d3f9048586005f0bca8c9fc10a72940):

- [Post-setup, línea 114](https://github.com/supabase/postgres/blob/c6226c631d3f9048586005f0bca8c9fc10a72940/migrations/db/init-scripts/00000000000003-post-setup.sql#L114):
  `GRANT ALL ON ALL ROUTINES IN SCHEMA extensions TO dashboard_user;`.
  En funciones, ALL corresponde a EXECUTE, sin WITH GRANT OPTION.
- [Grant del 2023-02-24](https://github.com/supabase/postgres/blob/c6226c631d3f9048586005f0bca8c9fc10a72940/migrations/db/migrations/20230224042246_grant_extensions_perms_for_postgres.sql):
  EXECUTE WITH GRANT OPTION para postgres sobre rutinas de extensions.
- [Transferencia cron del 2023-10-20](https://github.com/supabase/postgres/blob/c6226c631d3f9048586005f0bca8c9fc10a72940/migrations/db/migrations/20231020085357_revoke_writes_on_cron_job_from_postgres.sql):
  propietario supabase_admin.
- [Transferencia net del 2025-04-02](https://github.com/supabase/postgres/blob/c6226c631d3f9048586005f0bca8c9fc10a72940/migrations/db/migrations/20250402065937_alter_internal_event_triggers_owner_to_supabase_admin.sql):
  propietario supabase_admin.

Estos cuatro archivos YA estaban fijados por SHA-256 y Git blob en
`supabase/reference/supabase-postgres/provenance.json`. No se agregaron fuentes
variables, no se cambiaron hashes y no se ejecutaron las migraciones upstream.
El parser comprueba además las instrucciones específicas de transferencia y grants.

Se reprodujo en bases descartables la secuencia de GRANT y ALTER OWNER: PostgreSQL
reescribe grantor/grantee del propietario anterior y conserva la opción de grant del
self-grant. Con el grant histórico a dashboard_user produce exactamente las tres
entradas aportadas. Los ensayos aplican los dos SQL propios completos, conservando
las ACL finales sin cambios. Esto demuestra una procedencia compatible y un contrato
seguro para este alcance, no el historial exacto de instalaciones de ese servidor.

## Alcance del reconocimiento

Perfil `supabase_owner_transfer_dashboard_execute`, exclusivo de
`issue_pg_cron_access` y `issue_pg_net_access`, y usado sólo por application_only.
No se acepta simplemente un rol o un nombre conocido: deben coincidir las TRES
entradas completas, sin extras, con grantor/grantee/privilege/grantable exactos.

La opción de grant del propietario ya es una facultad inherente del propietario;
el EXECUTE de dashboard_user está expresamente documentado y además es redundante
con el EXECUTE de PUBLIC que ya existe en ese perfil. No se otorga ni amplía ningún
permiso remoto. La autoridad inherente del propietario también está documentada en
[GRANT de PostgreSQL](https://www.postgresql.org/docs/17/sql-grant.html). Se mantienen los requisitos de propietario supabase_admin,
SECURITY INVOKER, cuerpo/hash, configuración, tags, habilitación, dependencias,
contexto protegido y ausencia de membresías peligrosas.

El validador general conserva su rechazo; `official_validation.verified=false` y
`platform_secure=false`. application_only admite este fallo ACL concreto sólo cuando
el perfil estricto está probado. Los cuerpos históricos/search_path vacío conservan
los límites de la ruta acotada: sólo los dos SQL propios inmutables, sesión postgres
sin temporales, triggers habilitados, transacción atómica y preservación de datos.

Se rechazan dashboard_user WITH GRANT OPTION, grantor diferente, otro privilegio,
otros grantees, entradas duplicadas/faltantes, aplicación del perfil a los otros
cuatro wrappers y todo cambio desconocido de catálogo. No hay normalización genérica
ni regla de “ignorar ACL”.

## Archivos cambiados y diagnóstico

- scripts/staging-official-evidence.mjs: procedencia y perfil exclusivo de aplicación;
  diferencias ACL indican entradas esperadas faltantes e índices inesperados.
- scripts/staging-application-scope.mjs: consumo del perfil sin aprobar plataforma;
  `failure_details` identifica el control que siga fallando.
- tests/application-upgrade.test.mjs: ACL literal, replay de ownership, aplicación
  completa/preservación, pruebas negativas y consulta de evidencia.
- supabase/audit/upgrade_managed_acl_review.sql: consulta READ ONLY opcional de
  únicamente las dos ACL, sin cuerpos ni datos privados. No hace falta ejecutarla si
  el catálogo no cambió: los valores literales ya fueron aportados en esta misión.
- Este informe y STAGING_CRON_NET_ACL_VALIDATION.json: alcance y resultados.

## Próximo paso mínimo

Actualizar Alexis al commit de esta entrega y ejecutar desde src/code, con la misma
URI y CA privadas que ya funcionan:

```powershell
npm.cmd run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-plan --preserve-platform
```

Si el resto del catálogo coincide con la evidencia previamente confirmada, esperar
`stage=school`, `compatible_catalog=true`, `platform_preservation.eligible=true`,
`upgrade_scope=application_only`, y exactamente estas dos candidatas:

1. proposals/20261106000000_secure_recovery.sql
2. proposals/20261106001000_community_safety.sql

La aprobación general de plataforma y `authorization_to_apply` siguen false.
Todavía NO se generó aquí un plan nuevo contra Supabase remoto ni se autoriza aplicar
SQL. Revisar el resultado real antes de seguir el procedimiento existente en
[PRUEBA_FEATURE_ACTIVATION.md](PRUEBA_FEATURE_ACTIVATION.md). No repetir respaldos
ni instalaciones automáticamente.

Si todavía se rechaza, consultar únicamente
`platform_preservation.failure_details` y `official_validation.checks` de cron/net;
si la ACL cambió, ejecutar el SQL de auditoría de sólo lectura y aportar esas dos filas.
No quitar grants ni editar wrappers para forzar coincidencia.

## Resultados de pruebas

QA integral: 17/17 etapas aprobadas, 133 pruebas de aplicación, 90 de navegador,
TypeScript, build, PWA/presentación y 18 controles de cliente. Tras recibir las ACL
literales se revalidó el código final de herramientas: 24 aprobadas, dos ensayos
sólo nativos omitidos en PGlite y aprobados por separado. PostgreSQL 17.10: matriz
61/61/64 controles base, grupos school/recuperación/comunidad 17/8/15 por variante,
una prueba de orden y 22 de planificación/actualización. PostgreSQL 18.6: 10 pruebas
de aplicación aprobadas. Las dos migraciones se ejecutaron con preservación del
perfil ACL literal en DATE y timestamptz; ningún fallo en las ejecuciones finales.
Los clústeres locales descartables quedaron detenidos. La validación real pendiente
es volver a generar el plan remoto con este commit; no hay autorización de instalación.
