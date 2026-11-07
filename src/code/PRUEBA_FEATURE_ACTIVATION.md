# Activación de funcionalidades — BuscAG Prueba

Rama Alexis; base 06fdff3; candidata 1.0.0-rc.1. Destino exclusivo
`yiarlhpbgkofhhipkfha`. **Preparación local, no activación remota ni autorización.**
No se modificaron Supabase, Firebase, secretos o datos reales; no se repitió el respaldo.

## Conclusión y límites

Existe una ruta acotada para aplicar `secure_recovery` y `community_safety`
sin modificar los seis wrappers administrados. No demuestra que la plataforma
histórica sea segura para cualquier operación. El plan normal sigue bloqueándola.
La alternativa explícita `--preserve-platform` conserva
`official_validation.verified=false` y `platform_preservation.platform_secure=false`.

La evidencia oficial está fijada por commit/blob/SHA-256 en
`supabase/reference/supabase-postgres/provenance.json`. Los dos cuerpos históricos
son identificables, pero no equivalentes a las correcciones actuales del proveedor.
El search_path vacío sigue siendo rechazado por la validación general.

La excepción acotada admite únicamente los seis hashes observados, configuración,
propietarios, ACL, wiring y dependencias revisados. Comprueba el catálogo completo de
BuscAG, service_role, membresías, esquemas protegidos y defaults de funciones.
Sólo admite PostgreSQL 17/18, ensayados realmente. Cualquier diferencia desconocida
bloquea y deja sin candidatos ejecutables. Los dos SQL propios se fijan por SHA-256
(sólo se tolera conversión LF/CRLF); agregar incluso un comentario requiere revisión.

Los cuatro wrappers de extensiones no se disparan porque estos SQL no crean ni
eliminan extensiones. Los watchers PostgREST sí se ejecutan: se probaron con sus
cuerpos exactos. La sesión debe ser postgres, origin, triggers activos, sin objetos
temporales y con defaults revisados. El bundle no crea tablas temporales; conserva
la evidencia en variables PL/pgSQL. Revalida antes y después, aplica ambas migraciones
atómicamente y comprueba preservación de filas. Se ensayaron rollback, deriva entre
plan y aplicación, permisos API, repetición y concurrencia. No se desactiva RLS ni TLS.

**No usar esta ruta para extensiones, cron, otras migraciones o DDL general.**
No corregir wrappers manualmente ni quitar restricciones para lograr compatibilidad.

## Funciones y dependencias exactas

| Función | Dependencia y comportamiento real |
| --- | --- |
| Registro, login, publicaciones/edición, búsqueda/filtros/mapa, chat/perfil | Ya implementados sobre school; QA local aprobada. Auth/SMTP/Storage y sesiones reales requieren verificación en Prueba. |
| Recuperación bilateral | secure_recovery reutiliza recovery_confirmations; propietario inicia, contraparte real de conversación de ese ítem o coincidencia persistida confirma/rechaza. Una sugerencia local no acredita contraparte. El estado no cambia hasta confirmar; PATCH directo queda cerrado. Cada publicación se recupera individualmente. |
| Recuperación individual | Confirmación explícita del propietario cuando corresponda; no completa una entrega pendiente ni genera reputación bilateral. Historial recuperado previo se conserva. |
| Denuncias y bloqueos | community_safety; privados, deduplicados; bloqueo bilateral limita contacto/teléfono. Denunciar no elimina automáticamente publicaciones. |
| Moderación | community_safety y alta deliberada de un usuario existente en buscag_private.moderators. No se crea un administrador automáticamente. Acciones auditadas. |
| Valoraciones | community_safety y recuperación bilateral confirmada; sólo participantes reales, sin autoevaluación ni duplicados. |
| Teléfono | community_safety; consentimiento explícito (false para usuarios existentes), formato válido, mensajes recíprocos y ausencia de bloqueo. El chat no depende de compartirlo. |
| Seguimiento | community_safety; seguir publicaciones ajenas permitidas y notificaciones reales de cambios de estado. |
| Notificaciones internas | Mensajes/recuperación/seguimiento mediante DB; no dependen de push. Coincidencias automáticas necesitan worker. |
| Coincidencias | Motor y cola school existentes; requieren worker habilitado con heartbeat y ejecución periódica. |
| Push | Edge send-push, claves VAPID coincidentes, webhook autenticado, consentimiento y dispositivo real. Independiente de las dos migraciones. |

Las mismas publicaciones en ambas cuentas pueden ser el listado general correcto;
“Mis publicaciones” filtra propietario. QA verifica identidad/propiedad y estados,
no presupone que compartir listado sea duplicación.

## Camino mínimo (Windows, desde src/code)

1. Actualizar Alexis al commit de esta entrega, instalar dependencias del lock si
   hace falta y conservar la URI/CA privadas ya verificadas. No imprimir credenciales.
   Ejecutar sólo planificación de lectura:

   ```powershell
   npm.cmd run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-plan --preserve-platform
   ```

   Revisar `test-results/staging-upgrade/plan.json`: `stage=school`,
   `compatible_catalog=true`, `upgrade_scope=application_only`,
   `platform_preservation.eligible=true` y exactamente estos candidatos:
   `proposals/20261106000000_secure_recovery.sql` y
   `proposals/20261106001000_community_safety.sql`.
   `authorization_to_apply` permanece false. Si cambia cualquier condición, detenerse.
   Un plan de fixture local no sirve para instalar en el proyecto real.

2. Revisar el respaldo YA existente: proyecto, fecha, integridad, cobertura y evidencia
   previa de restauración. No ejecutar otro automáticamente. Si falta esa evidencia,
   completar su revisión; no declarar suficiente un archivo sólo porque exista.
   Un respaldo antiguo tiene un punto de recuperación antiguo. Revisar el bundle
   generado y solicitar autorización explícita para instalar esos dos SQL en Prueba.

3. **Sólo después de esa autorización:** usar una conexión postgres nueva a Prueba,
   TLS verify-full con la CA existente, sin objetos temporales y sin otros cambios
   DDL concurrentes. En psql iniciado con `-X`, ya conectado al proyecto verificado:

   ```sql
   SELECT set_config('buscag.upgrade.backup_verified','<catalog_fingerprint del plan revisado>',false);
   \i 'test-results/staging-upgrade/install.review.sql'
   ```

   Esa declaración exige respaldo revisado y autorización; no es un bypass ni una
   confirmación automática. No usar `--apply`: pertenece al instalador de baseline,
   no a esta actualización. No ejecutar SQL desde un plan viejo. Si falla un guard,
   ROLLBACK y nuevo plan; no modificar el guard ni los permisos para continuar.

4. Nueva sesión y verificación de lectura:

   ```powershell
   npm.cmd run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-verify --preserve-platform
   ```

   Esperar etapa community, cero pendientes, compatibilidad de aplicación y wrappers
   sin cambios. La plataforma histórica seguirá sin aprobación general. Probar con
   dos cuentas de prueba propias y un tercero: propietario solicita, tercero no puede
   confirmar, contraparte rechaza/acepta, recarga conserva estado, solicitudes repetidas
   no duplican notificaciones. Revisar recuperación individual, bloqueo, denuncia,
   teléfono con consentimiento, seguimiento y valoración tras entrega confirmada.
   Esperar la recarga del schema cache antes de diagnosticar una RPC HTTP ausente.

5. Para moderación, designar explícitamente un UUID Auth existente y aprobado;
   revisar el alta en `buscag_private.moderators` antes de autorizarla. No otorgar roles
   DB globales. Sin alta, la moderación permanece restringida correctamente.

## Coincidencias: activación operativa separada

- Configurar/desplegar `process-matches` sólo con autorización, en el ref de Prueba.
  `MATCH_WORKER_SECRET` privado de 32–512 caracteres; SUPABASE_URL y
  SUPABASE_SERVICE_ROLE_KEY del propio proyecto. Nunca VITE ni Git. La función usa
  autenticación propia obligatoria; no retirar ese control.
- Probar `npm.cmd run demo:worker -- --once`, con
  BUSCAG_STAGING_MATCH_WORKER_SECRET privado. Incluso con enabled=false, una llamada
  válida deja heartbeat. Revisar `supabase/activation/enable_trusted_matches.sql`:
  exige heartbeat reciente; su aplicación necesita autorización adicional.
- Activar no encola publicaciones antiguas: el trigger sale temprano cuando estaba
  pausado. Se agrega `supabase/activation/queue_existing_matches_PRUEBA_ONLY.sql`,
  operación manual opcional, probada, hasta 500 ítems válidos activos, sin cambiar
  publicaciones ni reiniciar trabajos/cursores existentes. Ejecutar sólo tras aprobarla
  y con worker habilitado/heartbeat reciente. No repetir en bucle: el worker elimina
  trabajos completados; más de 500 requiere revisar continuación explícita.
- Elegir UN programador periódico: HTTP privado hacia Edge o pg_cron YA instalado.
  `supabase/activation/schedule_school_matching_STAGING_ONLY.sql` falla cerrado si
  pg_cron falta. Instalar extensiones queda fuera de esta ruta: acudir al proveedor.
  `demo:worker --watch` dura 10 minutos; no garantiza servicio permanente.

Comandos de operación futuros, **no ejecutados y sujetos a autorización separada**:

```powershell
supabase secrets set --env-file <archivo-privado-fuera-del-repositorio> --project-ref yiarlhpbgkofhhipkfha
supabase functions deploy process-matches --project-ref yiarlhpbgkofhhipkfha
```

El archivo privado debe contener sólo las variables necesarias revisadas; no guardar
credenciales en Git, consola, informe o historial de argumentos. Luego del heartbeat,
revisar y aplicar `enable_trusted_matches.sql` en la conexión Prueba verificada; la
cola histórica es una segunda operación opcional. Un scheduler requiere su propio
smoke test autenticado y permisos revisados; no habilitar un job sin comprobarlo.

## Push: configuración independiente

Revisar/desplegar send-push únicamente con autorización. Necesita PUSH_WEBHOOK_SECRET
privado 32–512 caracteres, PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY y
PUSH_VAPID_SUBJECT del servidor; no regenerar claves existentes automáticamente.
BUSCAG_STAGING_VAPID_PUBLIC_KEY del build debe coincidir con la pública del servidor.
Webhook INSERT de public.notifications al endpoint send-push, autenticado con
x-push-webhook-secret. Servicio HTTPS, SW registrado y permiso voluntario del usuario;
en iOS, PWA instalada y versión compatible. Verificar entrega real con navegador cerrado.
No prometer entrega exactamente una vez: webhook/push pueden reintentarse.

En este entorno no hay secreto worker ni VAPID público configurados. Eso no prueba
que falten en el servidor: no se inspeccionaron secretos ni despliegues remotos.
La configuración privada y una prueba real son la evidencia mínima pendiente.

Tras revisar la configuración privada, el comando futuro de despliegue es
`supabase functions deploy send-push --project-ref yiarlhpbgkofhhipkfha`.
Requiere la misma autorización separada; no se ejecutó. Crear el webhook también es
un cambio remoto pendiente de autorización, no parte de las dos migraciones.

## Ruta oficial alternativa

Si la validación acotada rechaza el catálogo real o se necesita modificar extensiones,
consultar la guía oficial https://supabase.com/docs/guides/platform/upgrading:
Dashboard → General settings → Upgrade project, si está ofrecido, o Supabase Support
para reconciliar las migraciones de infraestructura/search_path de esos seis objetos.
Una actualización ofrecida no garantiza corregirlos: volver a planificar después.
Revisar downtime y advertencias antes de autorizar; no borrar extensiones/datos ni
pausar/restaurar automáticamente. No reemplazar manualmente funciones administradas.

## Publicación y evidencia pendiente

El cliente RC ya contiene la interfaz nueva; las capacidades aparecen cuando las RPC
reales están disponibles y se recarga la sesión. No se simulan respuestas. Confirmar
que el frontend publicado corresponde a esta candidata; si es antiguo, los cambios
PATCH de recuperación fallarán deliberadamente en lugar de reabrir el bypass.
Firebase sólo tras autorización y QA real posterior a la instalación.

Falta: plan fresco del catálogo real con la nueva opción; revisión del respaldo
existente y autorización para aplicar; validación Auth/API de Prueba con cuentas
controladas; alta de moderador si se desea; configuración/heartbeat/programación del
worker y entrega push real. No son tareas que puedan certificarse con mocks locales.
Los resultados locales exactos se registran en PRUEBA_ACTIVATION_VALIDATION.json.

## Reproducción de pruebas locales

`npm.cmd run qa:local` ejecuta las 17 etapas (fixtures/disposable; no servicios reales).
`npm.cmd run test:application-upgrade` reproduce los seis cuerpos desde evidencia
oficial verificada en PGlite; los ensayos de disparo nativo y operador se omiten allí.
Para esos dos ensayos, usar exclusivamente un clúster PostgreSQL descartable por
socket local, inicializado con un bootstrap distinto de postgres (por ejemplo,
`initdb -U fixture_admin`), y crear allí postgres LOGIN SUPERUSER como operador de
fixture. El test lo despromueve temporalmente y restaura en finally; PostgreSQL no
permite despromover al bootstrap. Ejecutar serialmente, sin compartir el clúster:

```sh
LOCAL_PG_SOCKET=/ruta/socket-local BUSCAG_TEST_CLUSTER=disposable npm run test:backend:postgres
```

Repetir `test:application-upgrade` en PostgreSQL 18 para compatibilidad adicional.
No apuntar estos fixtures a ningún servidor existente. Deno check --frozen se ejecutó
por separado para process-matches y send-push, manteniendo verificación TLS.

## Archivos cambiados

- scripts/staging-application-scope.mjs: contrato inmutable, contexto y límites.
- scripts/staging-upgrade.mjs, staging-equivalence.mjs, prepare-staging.mjs y
  staging-tls.mjs: opción explícita, bundle sin temporales y diagnóstico seguro.
- tests/application-upgrade.test.mjs, platformFixture.mjs y staging-upgrade.test.mjs:
  catálogo observado, ataques, preservación, CRLF y ejecución nativa.
- scripts/test-backend-matrix.mjs y package.json: incorporación a las matrices/QA.
- supabase/activation/queue_existing_matches_PRUEBA_ONLY.sql: cola histórica opcional.
- STAGING_UPGRADE.md, STAGING_CATALOG_VARIANTS.md y README de referencias: enlaces y
  distinción entre bloqueo general y ruta acotada; este informe y JSON de resultados.

No se cambian las dos migraciones propuestas, el frontend, las políticas de seguridad
existentes ni las fuentes oficiales. No apareció un nuevo error crítico del cliente
que justificara modificarlo en esta entrega. Las pruebas con servicios simulados
no sustituyen la aceptación real después de aplicar el backend.

## Resultado final de esta entrega

17/17 etapas QA aprobadas; 133 pruebas de aplicación, 11 de compatibilidad RC,
90 de navegador (escritorio/móvil), TypeScript, build, PWA, presentación y 18 controles
de seguridad del cliente. Herramientas de staging: 23 aprobadas, dos ensayos sólo
nativos omitidos en PGlite y aprobados por separado. Matriz PostgreSQL 17.10: 61/61/64
controles base, grupos school/recuperación/comunidad 17/8/15 por variante, una prueba
de orden y 21 de actualización. PostgreSQL 18.6: nueve pruebas acotadas aprobadas.
Ambos servidores verificaron postgres sin SUPERUSER. Deno 2.9.6: check --frozen
aprobado para ambas Edge Functions. Cero fallos en las ejecuciones finales.
Los clústeres descartables quedaron detenidos; ningún resultado implica aceptación
remota ni autorización de instalación.
