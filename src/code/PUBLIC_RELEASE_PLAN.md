# Lanzamiento público: decisión y procedimiento reproducible

**Cambio de alcance:** el objetivo vigente es una presentación escolar, no este
lanzamiento masivo. Consultar SCHOOL_PRESENTATION.md: ruta con staging real, cuentas
confirmadas y sin exigir SMTP comercial. Este documento conserva el plan de
producción para cuando se decida activarlo.

Revisión del 5 de noviembre de 2026. Actualización: dominio confirmado por el titular
https://buscag-2677c.web.app; SMTP predeterminado sigue bloqueando el registro público.
Ver [SMTP_LAUNCH.md](SMTP_LAUNCH.md) y [STAGING_LIVE_QA.md](STAGING_LIVE_QA.md).
 **NO GO: no integrar a main ni desplegar aún.**
La autorización del usuario para fast-forward es condicional a aprobar requisitos
críticos. Las pruebas aisladas no certifican los servicios de Supabase reales.
Este documento actualiza la decisión operativa; las auditorías anteriores son históricas.

## Evidencia de Git y alcance revisado

- Base main: `ef964b4d901fbc923d98bf2b46e4d76fceb7cb1a`.
- Candidato inicial Alexis: `f786be8b9daa519fa43424fae62a6388835a4d69`.
- Comparación remota: main es ancestro; 0 commits exclusivos de main y 45 de Alexis.
  141 archivos, 13767 inserciones y 2876 eliminaciones antes de esta preparación.
- GitHub Actions de ese candidato: ejecución **42036156887**, evento push,
  completed/success, comprobada por API, no inferida de un estado local.
  https://github.com/Code7C26/BuscAG/actions/runs/42036156887
- Revisados contratos frontend/RPC, carga de perfiles, fallback de transición,
  idempotencia, guardas de sesión, configuración Vite/Firebase y orden SQL. Las
  diferencias incluyen seguridad RLS, recibos, matching/worker, Auth, perfil/UI,
  PWA, pruebas y documentación. No son sólo cambios visuales.
- Se preservó un bundle Git de ambas refs y se verificó con git bundle verify,
  fuera del repo. **No es un respaldo de Supabase ni del Hosting publicado.**
- El escaneo de archivos versionados no encontró claves privadas reales en los
  patrones revisados: los candidatos de URI privada son fixtures con contraseña
  literal synthetic. env.local contiene configuración pública y no lo carga el
  modo release. Esto no certifica ausencia de secretos arbitrarios en todo el historial.

## Verificaciones reales de sólo lectura realizadas

Con las variables públicas de producción del entorno, sin descargar filas:

| Comprobación | Resultado | Límite |
| --- | --- | --- |
| GET Auth /settings | 200, email habilitado, signup permitido, autoconfirm false | No prueba entrega SMTP, redirect ni recuperación. |
| GET public_profiles?select=id&limit=0 | 404/PGRST205 | No disponible en caché REST; cotejar catálogo, exposición y caché. |
| GET push_subscriptions?select=id&limit=0 | 404/PGRST205 | Igual; no deducir un DROP o ausencia física sólo con REST. |
| GET OpenAPI REST | 401 | No se pudo inventariar RPC con clave anónima. |

No se ejecutaron RPC, INSERT, SQL remoto, migraciones ni lecturas de datos personales.
No hay credenciales de operador, cuenta ficticia autorizada ni conexión segura a
staging configuradas aquí. No se utilizó producción como sustituto para probar escrituras.

## Bloqueos para aprobar integración y lanzamiento

| Prioridad | Pendiente real | Evidencia necesaria |
| --- | --- | --- |
| Crítica | Políticas permisivas y grants del diagnóstico de producción anterior; instalación nueva no demostrada | Nuevo production_diagnostic.sql, revisión de RLS/grants/firmas y funciones reales; no asumir que el export histórico sigue vigente. |
| Alta | Confirmación, reenvío y recuperación | Correo recibido, enlace al origen aprobado, confirmación/login y cambio de contraseña real en staging. HTTP 200 no demuestra entrega. Cuenta ya confirmada puede no recibir reenvío. Revisar SMTP/cuotas/logs sin divulgar tokens. |
| Alta | Storage y privacidad | storage_configuration.sql, upload/download real de imagen ficticia, MIME/tamaño/prefijo propios, rechazo de escrituras ajenas. No borrar mochila existente. |
| Alta | Chat/RPC/Realtime | Dos usuarios ficticios: mensaje/reintento mismo ID, tercero sin acceso, lectura y recibos, notificación propia, reconexión y resync sin duplicados. SQL smoke no cubre APIs. |
| Alta | Funciones existentes | Revisión privada de handle_new_auth_user, notify_message_recipient, notify_item_recovered; sus hashes diferían y faltaban cuerpos en el export. No reemplazar a ciegas. |
| Alta | Recuperación coherente | Backup fresco DB/Auth y bytes Storage, verificación de contenido y ensayo admitido por Supabase en destino separado. La restauración de cuatro tablas/conteos/FK no demuestra Auth/MFA/servicios completos. |
| Alta | Origen público y build | Confirmar dominio canónico Firebase, Redirect URLs/Site URL y clave publicable del proyecto correcto. La configuración local no demuestra el bundle servido. |
| Media | Cascadas existentes | Borrar publicación conserva el comportamiento previo de borrar chat asociado; confirmación lo informa. No se cambiaron FK. Acordar esta conducta antes de lanzar, sin pruebas destructivas sobre filas reales. |
| Opcional | Matching backend y push | Pueden permanecer apagados. No anunciar avisos automáticos para ambos dueños ni push real hasta probar worker/heartbeat/scheduler o VAPID/webhook/dispositivo respectivamente. |

La aplicación usa una proyección pública de perfiles y un fallback de transición que
no selecciona teléfono/ubicación ajenos. Ello no protege una API cuya RLS siga abierta.
Los RPC de mensajes/publicaciones conservan claves de reintento en memoria por cuenta;
el fallback antiguo ocurre sólo ante PGRST202, nunca timeout o permisos. Antes de RPC
no tiene idempotencia de servidor: no reabrir escrituras durante esa transición.

## Preparación automatizada añadida

`npm run build:release` (PowerShell: `npm.cmd run build:release`) es un build offline:

1. Exige checkout limpio, commit identificable, VITE_APP_ENV=production y URL exacta
   https://hczcqtodcnurdrroczle.supabase.co.
2. Exige VITE_APP_URL con el origen HTTPS público confirmado, y clave publicable o
   JWT anon de producción. Rechaza secretos, JWT de staging y VITE_* no autorizadas.
3. No carga .env; usa sólo las variables explícitas del proceso, sin imprimir claves.
4. Ejecuta Vite en modo release, con guarda también en el cliente; genera dist y
   release-manifest.json con commit, origen y SHA-256/tamaño de cada archivo.
5. No hace llamadas remotas, deploy, SQL ni merge. El manifiesto declara
   NOT_APPROVED_BY_BUILD y no contiene la clave.

Una clave sb_publishable opaca no contiene el ref: su asociación necesita confirmación
en Dashboard y API del proyecto. Un JWT se inspecciona pero no se verifica su firma
localmente. Ni el prefijo ni el build prueban autorización de la clave en el backend.
El build genérico y QA siguen admitiendo fixtures; **no son el comando de publicación**.

Variables a seleccionar desde la configuración pública revisada, sin copiarlas a Git:
VITE_APP_ENV=production, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
VITE_APP_URL; VITE_VAPID_PUBLIC_KEY sólo si push se certificó. Ninguna service_role,
clave privada VAPID, contraseña o secreto worker lleva prefijo VITE_.
CI cubre Alexis y main; no hay workflow de despliegue automático añadido.

## Secuencia de activación (todavía NO ejecutar operaciones remotas)

1. Completar los bloqueos anteriores en staging y obtener diagnóstico fresco de
   producción. Registrar evidencia, refs y estado de cada servicio. Probar contra
   staging el mismo código, compilado con su launcher separado, no una URL cambiada
   dentro de un artefacto de producción.
2. Revisar backups de BACKEND_ACTIVATION.md y RECOVERY_REHEARSAL.md. Antes de la ventana,
   guardar release/version ID actual de Firebase, artefacto servido si está disponible,
   configuración externa y catálogo de funciones/políticas fuera de Git, cifrados.
3. Sólo con requisitos críticos aprobados, sincronizar ambas refs, checkout limpio,
   comprobar main ancestro de Alexis y CI verde para el **SHA final**, no uno anterior.
   Integración prevista: git switch main; git merge --ff-only origin/Alexis;
   git push origin refs/heads/main:refs/heads/main; volver a Alexis. Si hay divergencia,
   protección o cambio remoto: detenerse. Sin merge commit, reset ni force.
4. Obtener autorización específica para SQL de producción y Hosting. Integrar Git no
   autoriza ninguna de esas operaciones. Acordar ventana sin escrituras y drenar
   solicitudes de clientes viejos; un cartel local no bloquea por sí solo la API.
5. Tomar backup/conteos frescos sin sobrescribir respaldos previos. Conservar baseline
   de filas, FK y ACL. No reutilizar los conteos antiguos como referencia actual.
6. Mantener disponible un cliente de transición compatible. Si es necesario publicarlo
   antes del SQL, requiere autorización Hosting separada y las mismas guardas de
   producción. Si no se puede impedir escritura de clientes viejos, no iniciar SQL.
7. Aplicar manualmente, sólo tras revisión del catálogo y autorización, los ocho SQL
   siguientes. Cada archivo confirma su transacción; repetir conteos, catálogo y
   criterios de ACTIVATION_CHECKLIST.md tras cada paso. No aplicar bootstrap de octubre.

| Orden producción | Ruta relativa a supabase/ |
| --- | --- |
| 1 | migrations/20261103000000_secure_items_messages.sql |
| 2 | migrations/20261103001000_private_profiles_public_directory.sql |
| 3 | migrations/20261103002000_secure_notifications.sql |
| 4 | migrations/20261103003000_ensure_private_push_subscriptions.sql |
| 5 | proposals/20261104000000_message_receipts.sql |
| 6 | proposals/20261104001000_trusted_matches.sql |
| 7 | proposals/20261104002000_publication_receipts.sql |
| 8 | proposals/20261104003000_validate_legacy_compatible_writes.sql |

El instalador de staging aplica nueve pendientes porque incluye primero el permiso
histórico 20261016000000 sobre sus dos bootstrap de octubre. **No copiar ese plan a
producción**: allí la base existe, no hay historial completo demostrado y ese archivo
puede reintroducir permisos transitorios. Nunca apuntar prepare-staging a producción.
No convertir items.date (DATE), ni completar NULL históricos ni modificar cascadas.
Ante objetos existentes, fallo o diferencias de filas: parar y preparar delta específico.

8. Verificar RPC por PostgREST, permisos y backend_readiness.sql, capacidad matching
   false, Storage y publicación Realtime; resolver caché de esquema antes de continuar.
   No probar escrituras en producción sin autorización expresa para datos de prueba.
9. Desde checkout limpio y variables revisadas ejecutar npm ci, npm run qa:local y
   npm run build:release. QA usa fixtures y genera otros builds; por eso release va
   **al final**. Archivar dist y su manifiesto juntos fuera de Git; calcular SHA-256
   del archivo comprimido antes de transferirlo. Cotejar destino Firebase con
   .firebaserc (buscag-2677c) y la consola: el nombre guardado no es aprobación.
10. Sólo con autorización Hosting desplegar desde src/code el dist revisado usando
    firebase deploy --only hosting --project buscag-2677c. Verificar previamente que
    ese es el proyecto autorizado; jamás confiar sólo en el alias default.
11. Verificar HTTPS, rutas/recarga, release-manifest servido/commit, origen Auth,
    destino Supabase en Network sin copiar tokens, imágenes y acceso. Reabrir
    escrituras sólo con cliente/RPC compatibles. Monitorizar errores y latencia con
    logs sanitizados. Configurar matching/push en ventanas posteriores si se desean.

## Recuperación sin pérdida silenciosa

- Fallo antes de SQL/deploy: no hay nada remoto que revertir; conservar main y datos.
- Fallo de un SQL: su transacción revierte sólo ese archivo. Mantener ventana y
  comparar conteos; corregir hacia adelante en staging. No ejecutar los siguientes
  para ocultar el fallo ni devolver políticas abiertas.
- Fallo del cliente: recuperar en Firebase la versión previamente conservada **si
  funciona con los RPC/grants ya instalados**. El main viejo puede requerir INSERT
  revocado. Si no es compatible, mantener ventana y usar cliente de transición
  comprobado; no ampliar ACL para restaurar una UI vieja.
- Matching: pausar con script revisado en ventana drenada, conservando cola/ledger.
  Push: desactivar el mecanismo de entrega, sin borrar notificaciones ni suscripciones.
- Restaurar un dump antiguo no es rollback rutinario: puede perder nuevas escrituras
  y desacoplar Auth/Storage. Restaurar primero a otro destino admitido por Supabase,
  comparar y decidir recuperación con el operador. Nunca DROP/clean sobre producción.
- No retroceder main con force/reset. Si ya se integró, cualquier reversión futura
  se prepara como commits nuevos y necesita volver a pasar las condiciones de release.

## Intervenciones humanas indispensables

1. Dominio Firebase confirmado: revisar entrega SMTP y destinos exactos de correo;
   Site URL/allowlist fueron informados por el titular, no leídos por API de operador.
2. Facilitar acceso seguro separado a staging o aportar evidencia de los flujos reales
   pendientes (incluida recepción de email); no enviar contraseñas ni tokens en chat.
3. Ejecutar/entregar el diagnóstico de sólo lectura actualizado y revisar privadamente
   los cuerpos de funciones; comprobar cobertura/recuperación real del respaldo.
4. Tras la aprobación técnica, autorizar explícitamente la ventana SQL y el despliegue
   Hosting. Hasta entonces sólo se publican preparativos en Alexis.

## Resultados de esta preparación

`npm run qa:local` terminó correctamente: 112 aplicación, 5 entorno staging,
3 guardas release, TypeScript, build, 28 Playwright desktop/móvil, 1 PWA offline,
16 seguridad cliente; PGlite 58 DATE, 58 timestamptz y 61 esquema observado,
más 1 ensayo del orden completo. Las variantes SQL comparten escenarios, no son
177 flujos reales independientes. Se ejecutaron adicionalmente 4 pruebas del
instalador staging y 3 TLS (handshake real en loopback con certificados ficticios).
`npm audit --omit=dev` informó cero vulnerabilidades conocidas de ejecución.
No se repitió en esta entrega PostgreSQL nativo ni Deno: no se modificaron SQL/Edge.

El launcher release y su resolución Vite se probaron sin credenciales privadas.
El origen público ya fue confirmado por el titular y ahora está fijado en el launcher;
un artefacto compilado no constituye aprobación de producción.
La asociación de la clave pública disponible con el proyecto de producción sí pudo
usarse para consultar Auth /settings, sin que ello pruebe los flujos de correo.
El informe local de QA indica production:not_contacted porque esa batería no contacta
producción; las cuatro consultas de sólo lectura de esta auditoría se registran arriba.
El estado CI del nuevo commit de preparación debe verificarse por su SHA después
del push; el éxito del candidato inicial no se hereda automáticamente.
