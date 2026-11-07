# Análisis del plan de BuscAG Prueba — 2026-11-07

Destino declarado por el plan: `yiarlhpbgkofhhipkfha`. Rama exclusiva: `Alexis`.
Fingerprint del catálogo adjunto:
`536f8f2268a44689f693a56e94e52f6f0861df99411d85c96564ff3958924708`.
Se recalculó y coincide. No se consultó ni modificó Supabase remoto, Firebase,
secretos ni datos. Los SQL de instalación sólo se usan en fixtures locales de tests.

**Conclusión: school es la referencia más cercana, pero no se puede autorizar su
reconocimiento definitivo ni generar un bundle con esta evidencia.** El catálogo v1
no contiene las definiciones y propietarios de los event triggers ni de sus funciones.
Reconocer nombres familiares no demuestra que sus cuerpos sean los administrados.
`unknown_or_drifted`, `compatible_catalog=false` y candidatos vacíos se conservan.

## Diferencias exactas

### Funciones propias de BuscAG: dos grants efectivos de servidor

| Índice anterior | Función | Referencia | Prueba |
| --- | --- | --- | --- |
| 7 | `public.can_send_item_message(p_item_id uuid, p_recipient_id uuid)` | service_execute=false | service_execute=true |
| 8 | `public.canonicalize_message_display()` | service_execute=false | service_execute=true |

Son funciones **propias**, definidas en
`migrations/20261103000000_secure_items_messages.sql`, no funciones administradas de
Supabase. Sus hashes de cuerpo son respectivamente
`2ede6ee8df5fa17f866d26b43a18fc94` y `8648246f336b278b00cc2b74fa3d7940`.
Coinciden todos sus otros metadatos: propietario postgres, SECURITY DEFINER,
search_path vacío, firmas, lenguaje, volatilidad y privilegios efectivos de clientes.
La primera tiene EXECUTE authenticated; la función trigger no; anon no tiene ninguno.

El bootstrap local no reproduce todos los default privileges de un proyecto alojado.
El SQL original revoca PUBLIC/anon/authenticated, pero no revoca explícitamente
service_role en esas dos funciones: un grant de servicio previo/default puede
subsistir. **Es una explicación posible, no una procedencia histórica probada.**
El booleano efectivo no identifica grantor ni ACL heredada; el nuevo diagnóstico
consulta ACL, default ACL, rol y membresías. No indica por sí mismo exposición a los
clientes ni justifica revocar permisos de servidor para igualar el fixture.
Tampoco se permite usar esta explicación para aceptar otra función, cuerpo, firma,
search_path o un grant nuevo a anon/authenticated. No se cambia ningún grant.

### Restricciones: representación NOT NULL, sin pérdida detectada

La referencia tiene **131** entradas; el catálogo aportado, **52**. Las 52 comunes
coinciden exactamente por esquema, tabla, nombre, `validated` y hash. No hay entradas
adicionales ni definiciones comunes modificadas. Las **79** ausentes corresponden
a las entradas NOT NULL de la referencia PostgreSQL 18:

| Tabla | Entradas NOT NULL sólo en la referencia |
| --- | ---: |
| public.items | 12 |
| public.messages | 11 |
| public.notifications | 7 |
| public.profiles | 7 |
| public.push_subscriptions | 7 |
| buscag_private.item_watches | 7 |
| buscag_private.message_receipts | 5 |
| buscag_private.match_jobs | 4 |
| buscag_private.publication_receipts | 4 |
| buscag_private.recovery_confirmations | 4 |
| buscag_private.match_control | 3 |
| buscag_private.match_notices | 3 |
| buscag_private.object_tags | 3 |
| buscag_private.alert_preferences | 2 |

Cada hash ausente corresponde a `NOT NULL <columna>` y esa columna conserva
`attnotnull=true` en el plan remoto. No se concluyó esto sólo por el sufijo del nombre.
La representación de NOT NULL en pg_constraint cambió en PostgreSQL 18; antes se
comprobaba principalmente en pg_attribute. El archivo es coherente con esa diferencia
de versión, **pero no registra server_version**, por lo que no prueba una versión
remota exacta. El nuevo SQL la consulta.

No hay evidencia de una FK, PK, UNIQUE o CHECK faltante frente a school. La lista
completa por objeto queda en `review.constraints.missing` del próximo plan y el
fixture de reproducción conserva las 52 entradas observadas. No se elimina ni crea
ninguna restricción para cambiar el resultado. El reconocimiento estricto permanece;
esta clasificación es explicativa, no una exclusión general de restricciones.

### Seis event triggers compatibles en apariencia con Supabase/PostgREST

Todos están habilitados (`O`):

| Nombre | Evento / tags | Función conectada |
| --- | --- | --- |
| issue_graphql_placeholder | sql_drop / DROP EXTENSION | extensions.set_graphql_placeholder() |
| issue_pg_cron_access | ddl_command_end / CREATE EXTENSION | extensions.grant_pg_cron_access() |
| issue_pg_graphql_access | ddl_command_end / CREATE EXTENSION | extensions.grant_pg_graphql_access() |
| issue_pg_net_access | ddl_command_end / CREATE EXTENSION | extensions.grant_pg_net_access() |
| pgrst_ddl_watch | ddl_command_end / sin filtro de tags | extensions.pgrst_ddl_watch() |
| pgrst_drop_watch | sql_drop / sin filtro de tags | extensions.pgrst_drop_watch() |

No están definidos en las migraciones de BuscAG ni presentes en el fixture vacío.
Sus nombres/conexiones corresponden al tipo de infraestructura de GraphQL,
extensiones y recarga de esquema de PostgREST que administra Supabase. Se clasifican
como **candidatos de infraestructura administrada, aún sin verificar**.

Falta conocer propietario del event trigger, propietario/cuerpo/configuración/ACL de
la función, versión/procedencia y dependencias. La ausencia de dependencia formal a
una extensión tampoco prueba que sea de BuscAG: Supabase puede crear estos wrappers
mediante sus migraciones administrativas. Su propietario puede diferir del de una
función propia; no debe cambiarse para igualar el fixture.

Un atacante con privilegios suficientes podría conservar nombre, evento y firma y
reemplazar el cuerpo. Además, estos triggers pueden ejecutarse durante DDL. Por eso
**no se implementó una whitelist de nombres ni se vació event_triggers para comparar**.
No se eliminaron, deshabilitaron ni alteraron objetos del catálogo real.

## Cambios realizados

- `scripts/staging-catalog-review.mjs`: desglosa objetos faltantes, adicionales y
  cambiados por identidad; identifica representación NOT NULL, las dos variantes
  concretas de EXECUTE y conexiones candidatas de infraestructura. Ninguna
  clasificación concede compatibilidad ni omite controles.
- `scripts/staging-upgrade.mjs`: agrega `review` a los planes bloqueados, referido
  a la referencia más cercana. Mantiene comparación estricta y bloqueo de bundle.
- `scripts/prepare-staging.mjs`: muestra resumen legible y nombres de objetos;
  el detalle completo se guarda en plan.json, sin cuerpos ni datos personales.
- `supabase/audit/upgrade_event_trigger_review.sql`: diagnóstico de sólo lectura
  para completar la evidencia, incluidos versión, ACL y definiciones para revisión
  privada. No se ejecutó remotamente. No contiene credenciales ni cuerpos reales.
- `tests/fixtures/prueba-school-drift.json`: delta de metadatos del archivo aportado;
  sin filas, usuarios, endpoints ni secretos. Aplicada a la referencia reproduce
  exactamente el fingerprint original; no es una simulación aproximada del hallazgo.
- `tests/staging-upgrade.test.mjs`: prueba de reproducción y regresiones de seguridad.

## Pruebas

Resultados locales de esta revisión:

- `npm test`: **133** aprobadas, cero fallos.
- `npm run lint`: TypeScript sin errores.
- `npm run build`: compilación Vite correcta.
- `node tests/client-security.mjs`: **18** controles aprobados.
- `npm run test:staging-tools`: **12** aprobadas en WASM PostgreSQL.
- `LOCAL_PG_SOCKET=/tmp/buscag-install-pg/socket BUSCAG_TEST_CLUSTER=disposable npm run test:backend:postgres`:
  matriz completa aprobada, DATE y timestamptz de repositorio y DATE observado;
  **61/61/64** controles base, **17** grupos escolares, **8** de recuperación y
  **15** de comunidad por variante, activación y **8** casos de actualización.
- El caso nuevo reconstruye exactamente el catálogo aportado mediante su delta,
  verifica el fingerprint, los dos grants, las 79 entradas NOT NULL, las 52
  restricciones comunes y las seis conexiones de eventos sin aceptarlas.
- `git diff --check`: sin errores de whitespace.

Las mutaciones peligrosas se prueban también sobre una referencia limpia para que
el bloqueo previo de los eventos no oculte un control roto: grants a clientes,
cuerpo alterado, pérdida de FK/CHECK y pérdida de NOT NULL. También se bloquean
eventos adicionales, conexión falsificada y supuestas pruebas de cuerpo no revisadas.
La consulta complementaria se ejecuta dentro de READ ONLY en bases locales.
No se cambiaron UI ni propuestas de migración; no se repitieron pruebas de navegador.

## Próximo paso, sin instalar nada

1. Actualizar la copia de `Alexis` y ejecutar `npm ci` si corresponde. Con la URI
   privada y CA configuradas como en [STAGING_UPGRADE.md](STAGING_UPGRADE.md), ejecutar:

   ```powershell
   npm run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-plan
   ```

   Se espera que siga bloqueado con la evidencia actual, pero que plan.json incluya
   `review` con los objetos y explicaciones anteriores. Un error es una parada de
   seguridad; no ejecutar el apply histórico ni modificar objetos para conseguir verde.
2. En SQL Editor del proyecto Prueba verificado, ejecutar **sólo lectura**:
   `supabase/audit/upgrade_event_trigger_review.sql`. Revisar las definiciones finales
   privadamente contra la versión oficial de Supabase/PostgREST correspondiente.
   No publicar cuerpos desconocidos que puedan contener literales sensibles. Conservar
   metadatos, hashes, procedencia y conclusión de revisión en el registro privado.
3. Con esa evidencia, revisar si corresponde una variante explícita del contrato:
   representación NOT NULL, grants de servicio y eventos verificados, sin ignorar
   cuerpos, propietarios ni objetos desconocidos. Debe preservar las guardas del
   bundle antes/después y probar las variantes de versión y ACL. **Esa aceptación
   todavía no se agregó porque este archivo no aporta las definiciones necesarias.**

No existe aprobación de instalación. Respaldo restaurado, revisión final, instalación
de recuperación segura/comunidad, servicios, Firebase Prueba e iPhone siguen siendo
etapas posteriores con sus autorizaciones y evidencias propias.
