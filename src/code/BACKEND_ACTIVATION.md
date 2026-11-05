# Backend: preparación y activación segura

**Correo público:** [SMTP_LAUNCH.md](SMTP_LAUNCH.md). **Pruebas reales automatizadas:** [STAGING_LIVE_QA.md](STAGING_LIVE_QA.md).

**Decisión de lanzamiento actual:** [PUBLIC_RELEASE_PLAN.md](PUBLIC_RELEASE_PLAN.md),
con evidencia real de sólo lectura, guardas de release y bloqueos de integración.

**Revisión Auth/UI/QA actual:** [LAUNCH_PROGRESS.md](LAUNCH_PROGRESS.md), con automatización de navegador y límites reales de entrega de correo/PWA/nativo.

**Proyecto de pruebas separado:** [STAGING_SETUP.md](STAGING_SETUP.md) automatiza la instalación pendiente en BuscAG-Staging, con guardas de destino y pruebas ficticias revertidas. No usar esa herramienta para producción.

**Ensayo adicional de recuperación:** [RECOVERY_REHEARSAL.md](RECOVERY_REHEARSAL.md), con pg_dump/pg_restore nativos y verificación reforzada del respaldo de imágenes.

Lista operativa actual: [ACTIVATION_CHECKLIST.md](ACTIVATION_CHECKLIST.md), con criterios por migración, publicación manual del cliente y bloqueos de servicios reales.

Estado: código en Alexis; **ningún cambio aplicado a Supabase/Firebase reales**.
El diagnóstico real ya fue recibido y analizado. Ver
[REAL_SUPABASE_RECONCILIATION.md](REAL_SUPABASE_RECONCILIATION.md): hay reproducción
estructural de las cuatro tablas, con datos ficticios. Los cuerpos de triggers y
algunos defaults no están en el JSON, por lo que sigue pendiente su revisión privada.

Esta guía reemplaza los pasos antiguos de activación inmediata de coincidencias.
Se mantiene la organización de AGENTS.md: sólo Alexis, sin ramas ni PR nuevos.

## 1. Lo que debes hacer ahora: obtener el catálogo

En SQL Editor del proyecto correcto, ejecutar **sólo**
`supabase/audit/production_diagnostic.sql`. Descargar el resultado como JSON o CSV.
No contiene filas personales, cuerpos/argumentos de triggers ni claves. Guardarlo
fuera de Git y ejecutar localmente:

```
npm run check:diagnostic -- /ruta/privada/diagnostic.json
```

El analizador no accede a red, no genera ni ejecuta SQL. Comprueba tablas, RLS, tipos,
columnas obligatorias sin default, roles privilegiados, ACL, firmas/contexto de RPC y
señales de políticas amplias. Distingue permisos potenciales de explotación probada.
`production_approved` siempre es false: salida sin errores significa ausencia de
ciertos bloqueos de contrato, **no autorización de producción**. Funciones/triggers
pueden diferir aunque sus firmas coincidan; cotejar definiciones de forma privada.
No pegar dumps ni secretos en el chat. Compartir sólo el diagnóstico de metadatos.

Este análisis ya se realizó para el export recibido. Repetir el SELECT antes de aplicar para detectar cambios concurrentes; completar revisión de funciones y Storage. No ejecutar todos
los archivos históricos para crear un historial de migraciones ausente.

## 2. Respaldo antes de aplicar cualquier SQL

1. Confirmar proyecto, región y base. Verificar disponibilidad/fecha/retención de
   backup administrado o PITR y comprobar que puede restaurarse a un destino aislado.
   Confirmar su cobertura concreta con el proveedor; no asumir que incluye bytes de Storage.
2. Acordar una ventana sin escrituras y esperar operaciones en curso. Ejecutar
   `supabase/audit/backup_counts.sql` como operador confiable: sólo devuelve conteos
   de perfiles, objetos, mensajes, avisos, auth.users/auth.identities y Storage.
3. Hacer dump lógico completo con una conexión privada autorizada y herramienta
   compatible con la versión del servidor. Ejemplo **a ejecutar por el operador**, con
   PGSERVICE ya configurado de forma segura; las rutas deben estar fuera de Git:

   ```
   PGSERVICE=buscag_backup pg_dump --format=custom --no-owner --file=/ruta/privada/buscag.dump
   PGSERVICE=buscag_backup pg_dump --schema-only --no-owner --file=/ruta/privada/schema.sql
   pg_restore --list /ruta/privada/buscag.dump > /ruta/privada/dump-inventory.txt
   ```

   Verificar que el inventario incluye datos/definiciones de public, auth y storage,
   además de buscag_private si existe. Comprobar **todo auth**, no sólo un CSV de
   usuarios: identidades, MFA y tablas asociadas cuando existan. Un fallo de permisos
   invalida el respaldo; no excluir tablas silenciosamente. Verificar grants/roles,
   propietarios confiables y configuración externa por separado. El dump puede
   contener hashes de contraseñas, sesiones y secretos de funciones/webhooks: cifrarlo,
   restringir permisos y no compartirlo ni subirlo al repositorio.
4. Exportar los bytes de imágenes por separado. El comando preparado usa sólo APIs
   getBucket/list/download. En una máquina privada, proporcionar SUPABASE_URL y
   SUPABASE_SERVICE_ROLE_KEY exclusivamente como variables de servidor, nunca VITE,
   navegador, argumentos de comando ni archivos del repositorio. Después:

   ```
   npm run backup:storage -- --out /ruta/privada/storage-nuevo --bucket item-images
   npm run backup:storage -- --verify /ruta/privada/storage-nuevo
   ```

   El directorio debe ser nuevo y su padre debe existir. Añadir otro `--bucket NOMBRE`
   por cada bucket adicional existente: la cobertura es **sólo los seleccionados**.
   El script rechaza destinos dentro de Git, credenciales cliente y orígenes ajenos al
   proyecto oficial Supabase. Usa carpetas 0700/archivos 0600 y nunca sobrescribe ni
   borra objetos. Un fallo no genera manifiesto completo. No admite archivos >50 MiB
   o tamaño desconocido: en ese caso usar otro exportador revisado y verificarlo.
   Comparar conteos con storage.objects para los buckets respaldados y cifrar los
   archivos/manifiesto. Las rutas del manifiesto pueden identificar usuarios: son privadas.
5. El manifiesto/checksum demuestra integridad del archivo descargado, no un snapshot
   global ni cobertura completa. Mantener la ventana coherente entre DB y Storage;
   actividad concurrente puede omitir objetos o cambiar contenido durante el listado.
6. Probar restauración **en otro proyecto/base descartable**, jamás sobre producción.
   Usar la vía de restauración admitida por Supabase para esquemas administrados: no
   aplicar DROP/clean indiscriminado sobre auth/storage de un proyecto existente.
   Comparar conteos, FK, RLS y ACL; restaurar imágenes allí con bucket/ruta y MIME
   originales del manifiesto y abrir muestras. Probar cuentas ficticias nuevas en
   staging. No dar por probado Auth sólo porque auth.users tenga el mismo conteo.

## 3. Esquema aislado y matriz ya preparada

`npm ci` instala las dependencias de pruebas fijadas en los lockfiles. Después:

```
npm run test:backend
```

Ejecuta DATE y timestamptz del repositorio, más la estructura observada con DATE, en PGlite; añade un ensayo del orden completo de instalación. Para
PostgreSQL nativo usar un clúster **descartable**, sin red/puertos ni secretos/datos
reales, configurar LOCAL_PG_SOCKET a su directorio Unix y BUSCAG_TEST_CLUSTER=disposable:

```
npm run test:backend:postgres
```

El adaptador crea/elimina sólo bases de prueba con nombre aleatorio, pero también
crea roles API si faltan: nunca apuntarlo a una instancia de producción. La prueba
incluye política residual permisiva, Auth simulado por triggers, cuotas, reintentos,
conexiones concurrentes, avisos de ambos propietarios, contacto recíproco, tercero
sin acceso, recibos y recuperación que conserva mensajes. No prueba los servicios
remotos Auth/PostgREST/Storage/Realtime ni correo ni entrega push.

El diagnóstico recibido ya se usa para reproducir columnas, constraints, índices,
políticas y grants de las cuatro tablas. Para clonar funciones/servicios completos
se necesita exportación de esquema revisada. No generar DDL a partir de expresiones no confiables ni restaurar
triggers/cron/webhooks que apunten a producción. Aislar red y no montar credenciales.
Los sustitutos de funciones/Auth/Storage no equivalen a una restauración completa ni a pruebas de servicios remotos.

## 4. Orden de instalación manual, después de revisión y respaldo probado

| Archivos | Decisión y dependencia |
| --- | --- |
| 20261014000000, 20261015000000, 20261016000000 | Bootstrap histórico. No volver a ejecutarlos sobre el proyecto real: pueden recrear políticas amplias y su esquema usa timestamptz. |
| 20261103000000_secure_items_messages.sql | Owner autenticado, campos protegidos, participantes y canonización. Conservar owner NULL histórico. |
| 20261103001000_private_profiles_public_directory.sql | Perfil privado y directorio con contacto condicionado; verificar nombres/tipos y propietario confiable. |
| 20261103002000_secure_notifications.sql | Sólo avisos propios, match propio de transición, is_read protegido. |
| 20261103003000_ensure_private_push_subscriptions.sql | Crear tabla ausente o cotejar una existente; no configura entrega push. |
| proposals/20261104000000_message_receipts.sql | RPC de mensajes, recibos y cuota 120/min; revoca INSERT directo. |
| proposals/20261104001000_trusted_matches.sql | Cola, ledger, restricciones adicionales y control **deshabilitado por defecto**. No interrumpe el modo de avisos propios de clientes actualizados. |
| proposals/20261104002000_publication_receipts.sql | RPC de publicaciones, recibos y cuota 30/h; revoca INSERT directo de items. |
| proposals/20261104003000_validate_legacy_compatible_writes.sql | Validar nuevas/alteradas columnas sin reescribir datos antiguos; proteger texto de avisos recovered para título NULL. |

Los cuatro primeros archivos de seguridad están en supabase/migrations; los cuatro
últimos en supabase/proposals. Cada archivo tiene su propia transacción: un fallo
posterior no revierte archivos ya confirmados. No reejecutar baseline después de las
propuestas: reemplaza políticas completas. Guardar el orden y SHA en registro privado,
sin inventar supabase_migrations.schema_migrations ni marcar archivos como aplicados
sin comprobarlos. Si ya existe algún objeto candidato, detener: CREATE falla de forma
segura; se requiere una actualización específica, no sobreescritura genérica.

Antes de revocar INSERT de mensajes/items, **confirmar que el frontend publicado ya
usa ambos RPC** y la capacidad de coincidencias con false explícito. Estar en Alexis
no significa estar desplegado. Clientes antiguos abiertos necesitan actualización o
ventana controlada. Esta ejecución no despliega Firebase. Los cuatro baseline también
reemplazan políticas personalizadas: revisar su intención antes de descartarlas.

## 5. Worker y activación de coincidencias

1. Después de instalar propuestas, configurar en Edge Functions un secreto aleatorio
   independiente MATCH_WORKER_SECRET (32–512 caracteres), guardado también en el gestor
   del planificador. Confirmar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de servidor.
2. Desplegar manualmente process-matches desde esta revisión con su deno.json/lock y
   config.toml: verify_jwt=false, porque el handler autentica su propio secreto. No
   hacer público el secreto; no usar la clave del cliente como sustituto.
3. Configurar un planificador confiable para POST periódico, por ejemplo cada minuto:
   URL del proyecto `/functions/v1/process-matches`, cabecera Authorization Bearer
   del secreto independiente y cuerpo `{}`. Usar Vault/gestor privado, no secreto
   literal en SQL versionado, URL o registros. No se instaló ningún cron automáticamente.
4. Ejecutar una llamada HTTP real desde ese planificador. Debe devolver 200 y
   enabled:false, batches:0, notifications:0, failures:0, busy:false. El SQL registra
   heartbeat aun estando deshabilitado. Un heartbeat aislado sólo prueba la llamada
   RPC, no la programación futura: verificar también la configuración del planificador.
5. Ejecutar `supabase/audit/backend_readiness.sql` en SQL Editor: SELECT de estado y
   conteos, sin IDs, textos ni endpoints. Confirmar worker_recent:true y sin fallos.
6. En ventana controlada, detener temporalmente nuevas publicaciones y **drenar las
   peticiones en curso**. Luego ejecutar manualmente
   `supabase/activation/enable_trusted_matches.sql`. Rechaza heartbeat ausente o de
   más de cinco minutos. No hay backfill ni borrado de publicaciones anteriores.
   El drenaje evita que una publicación atraviese el cambio entre modos.
7. Comprobar capacidad true y dos publicaciones ficticias compatibles en staging:
   un aviso por propietario; reintentos/ediciones no duplican. Repetir monitor de cola,
   failures y heartbeat. Las pruebas con usuarios ficticios de esta ejecución fueron
   en PostgreSQL local, no en tu proyecto real.

Si hace falta pausar, `pause_trusted_matches.sql` cambia sólo el indicador y conserva
trabajos, ledger y avisos; los clientes actualizados vuelven a match propio. Hacerlo
con el mismo drenaje. Reanudar requiere planificar otra transición: el historial
legado no identifica siempre el par completo y no se deduplica retrospectivamente.
Para revertir RPC de mensajes/publicaciones, conservar recibos y datos y revisar los
INSERT por columna del baseline; no ampliar permisos a anon ni restaurar grants de
tabla completa. Restaurar un backup antiguo puede perder operaciones nuevas y no
es el mecanismo inicial de reversión para estas propuestas aditivas.

## 6. Push, por separado y opcional

La notificación interna en DB no depende de entregar push. Configurar VAPID y
PUSH_WEBHOOK_SECRET independiente (32–512 caracteres), y desplegar send-push con su
configuración/lock. El config local fija verify_jwt=false y el handler exige el
secreto de webhook antes de procesar datos. El webhook INSERT de public.notifications
lleva x-push-webhook-secret; el contenido/destinatario se recuperan de DB por ID.
VITE_VAPID_PUBLIC_KEY del frontend debe coincidir con PUSH_VAPID_PUBLIC_KEY del
servidor; PUSH_VAPID_PRIVATE_KEY sólo queda en servidor, junto con PUSH_VAPID_SUBJECT.
Probar suscripción/entrega en staging y navegadores reales. No se configuró VAPID,
webhook ni cron real. No hay garantía exactamente una vez en proveedores push: los
reintentos de webhooks pueden volver a entregar una misma notificación.

## Resultado local de esta revisión

- 102/102 pruebas de aplicación/herramientas (revisión de compatibilidad actual); 16/16 de cliente/privacidad/Storage simulado.
- PostgreSQL 17: 61/61 con DATE del repositorio, 61/61 con timestamptz y 64/64 con la estructura observada; ensayo adicional del orden completo: correcto.
- PGlite: 58/58, 58/58 y 61/61 respectivamente; ensayo del orden completo correcto. Las tres multiconexión sólo corren en PostgreSQL.
- TypeScript, build Vite, Deno check --frozen de ambas funciones y lockfile Bun correctos.
- npm audit: cero vulnerabilidades detectadas.
- Exportador probado con archivos ficticios; no se descargaron imágenes reales ni se
  ejecutó backup, restauración o SQL contra Supabase real. La revisión completa de cuerpos de triggers y servicios sigue pendiente; el diagnóstico de metadatos sí fue analizado. Estas comprobaciones no equivalen a aprobación
  de producción, pruebas de correo, PostgREST/Realtime remoto o entrega push real.
