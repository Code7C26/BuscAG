# Evolución integral de BuscAG

Fecha: 6 de noviembre de 2026. Desarrollo exclusivamente en `Alexis`.

**Estado:** código implementado y validación local con bases descartables y
navegadores simulados. La instalación SQL, los secretos/servicios y la validación
con cuentas reales de Prueba siguen pendientes. Este informe no certifica el sitio
publicado ni autoriza un despliegue. No se modificó Producción ni se borraron datos
reales. No se reconstruyó la aplicación.

## Auditoría y decisiones

| Área | Hallazgo confirmado en el repositorio | Resultado |
| --- | --- | --- |
| Teléfono | `public_profiles` revelaba teléfono y localidad tras un intercambio recíproco, sin consentimiento | Consentimiento nuevo, privado por defecto; vista protegida; localidad personal privada; edición validada |
| Perfiles | RLS propia y ACL de columnas ya existían | Se conservan; políticas restrictivas adicionales impiden ampliar acceso por una política permisiva heredada |
| Calificación | El valor inicial 5.0 no representaba votos reales | Se conserva el dato histórico, pero no se presenta como reputación; promedio y cantidad reales al recibir valoraciones |
| Mensajes | Ya había RPC idempotente y recibos de lectura | Se reutilizan; bandeja visible, borradores, cola persistente y reintentos con la misma clave |
| Reconexión | Una lectura iniciada antes de enviar podía borrar de la pantalla el mensaje recién confirmado | Revisiones de datos descartan respuestas anteriores a una escritura y vuelven a consultar |
| Recuperación | El commit anterior ya unificó el panel y preparó el guard SQL | Integrado al chat, con nombres, historial, actor de resolución, problemas y valoraciones |
| Recuperación individual | Impedir toda recuperación individual por existir un chat bloqueaba casos legítimos | Declaración explícita con explicación, en la misma tabla de evidencia; nunca confirma una solicitud pendiente ni concede valoración bilateral |
| Recuperados | El cliente y `can_send_item_message` permitían iniciar una conversación nueva | Se impide en UI y servidor; se conservan chats anteriores; bloqueo de fila serializa cierre contra primer mensaje |
| Notificaciones | La apertura ya intentaba marcar lectura; el destino inexistente no daba respuesta visible | Marcado individual explícito, navegación de devoluciones y aviso de destino ausente; sin controles anidados |
| Push | El cliente requería VAPID y los launchers descartaban variables ambientales | Entrada pública explícita/validada, rotación y errores claros; clave privada nunca en cliente |
| Sitio de pruebas | El artefacto de presentación y el plan de callbacks seguían señalando el dominio principal | Preparados para `buscag-prueba.web.app`; configuración Hosting separada con site explícito, sin deploy |
| Mapa | Altura mínima de 500 px, controles y ayuda flotante competían en pantallas cortas | Altura según viewport visible, gestos contenidos, ayuda separada y zonas seguras |
| Alertas | Ya existía radio que filtra el motor de coincidencias | Estado, radio, centro y fecha visibles; desactivar sólo cuando está activa |
| Proximidad | No hay aviso de proximidad separado ni GPS en segundo plano | No se inventó otro motor ni se declara esa función verificada en remoto |
| QR | Rotación/revocación y endpoint público mínimo ya existían | Identidad BuscAG, errores diferenciados y contexto QR conservado al registrarse |
| Moderación/bloqueos/seguimiento | No había infraestructura reutilizable equivalente | Nuevas tablas privadas, RPC autorizadas y herramientas contextuales |
| Offline | El SW guarda sólo un fallback público; una pestaña abierta puede conservar datos en memoria | Indicador de conexión, reconexión y reintentos; no se afirma funcionamiento offline completo |

La auditoría cubrió las migraciones y propuestas del repositorio, los clientes de
datos, vistas, RPC, triggers, Storage y los handlers de las Edge Functions. No se
inspeccionó el catálogo remoto en esta ejecución: diferencias reales de políticas,
grants, funciones o triggers deben revisarse antes de instalar. Ver ambos SQL de
diagnóstico de recuperación y comunidad.

## Implementado

### Privacidad y seguridad

- `phone_shared=false` para perfiles existentes y nuevos. Una conversación previa
  no implica consentimiento. No se borran ni se publican números históricos.
- Teléfono compartido únicamente tras consentimiento, mensajes recíprocos y ausencia
  de bloqueo. El chat consulta la autorización del servidor; un número legado en
  memoria no basta para mostrar el botón de llamada. El detalle prioriza el chat.
- Validación internacional del teléfono, nombre, URL de avatar y longitud de zona.
  Campos de reputación y consentimiento no se conceden a escrituras directas.
- Bloqueo/desbloqueo y lista propia; bloqueos ajenos no se revelan. Nuevos mensajes
  quedan prohibidos en ambos sentidos, pero el historial anterior permanece legible.
- El envío se protege también con trigger y serialización por pareja/publicación,
  incluso si compite con un bloqueo o una recuperación.
- Tablas nuevas con RLS y sin acceso directo del cliente. RPC con `search_path`
  vacío y grants explícitos por namespace; no hay inscripción pública de moderadores.

### Comunidad, devolución y reputación

- Denuncias de publicaciones, usuarios, valoraciones recibidas y problemas de
  devolución. Motivos: estafa, spam, publicación falsa, inapropiado, acoso y otro;
  descripción opcional, deduplicación y máximo de diez denuncias nuevas por hora.
- Estados pendiente/en revisión/resuelta/desestimada; cola privada para moderadores
  y auditoría de acciones con nota obligatoria. Denunciar no elimina contenido.
- Seguimiento por publicación, baja idempotente y preferencia de avisos. Los cambios
  reales de estado generan avisos; actualizaciones sin cambio no los duplican.
  Un bloqueo suprime esos avisos y no impide dejar de seguir.
- Panel de recuperación en detalle y conversación. Solicitante/contraparte con nombre,
  fechas y actor de resolución. Problemas se tramitan por el sistema de denuncias,
  sin cambiar retrospectivamente la evidencia de una entrega confirmada.
- Recuperación individual diferenciada: si hubo conversación o un rechazo anterior,
  requiere explicación de 20–500 caracteres y aceptación explícita del propietario.
  Una solicitud bilateral pendiente debe resolverse/cancelarse primero. El historial
  anterior se conserva y nunca se convierte en una confirmación de la contraparte.
- Valoraciones de 1–5 estrellas sólo entre participantes de una devolución bilateral
  confirmada; una por participante y devolución. Contraparte calculada en servidor,
  reintento idempotente, promedio/cantidad calculados y denuncia de valoración abusiva.
  Una declaración individual no habilita votos. Borrar una publicación no borra la
  reputación recibida; una baja de cuenta anonimiza atribuciones de resolución.

La plataforma registra declaraciones y confirmaciones de sus participantes. No
certifica físicamente una entrega ni elimina el riesgo de colusión entre cuentas.
Resolver una denuncia no borra publicaciones, usuarios o valoraciones automáticamente.

### Chat, navegación y notificaciones

- Mensajes accesibles desde navegación y encabezado, conversaciones por actividad
  y contadores basados en recibos reales. Conversaciones distintas del mismo objeto
  no se mezclan.
- Pendiente, fallido, enviado al servidor y leído; no se inventa entrega al dispositivo.
  El chat oculto no marca automáticamente mensajes como vistos.
- Borradores por cuenta/conversación en `sessionStorage`, con límite de 50 y caducidad
  tras 24 horas sin cambios. Los pendientes conservan su clave durante desconexiones
  prolongadas; no caducan por ese plazo. Ambos se eliminan al salir o cambiar de cuenta.
- Cola hasta 50 pendientes, reintento al reconectar, comprobación periódica mientras
  la aplicación está abierta y reintento/descartado manual. No hay envío autónomo con
  la aplicación cerrada. No se hace fallback a INSERT sin idempotencia.
- Credenciales, permisos inválidos, cuota y RPC ausente no entran en un bucle de
  reintentos automáticos. Descartar un pendiente no borra un mensaje ya recibido.
- Lecturas superpuestas se deduplican por ID, nunca por texto o título. Los recibos
  más recientes prevalecen; mensajes legítimos con igual texto siguen separados.
- Avisos individuales se marcan leídos con confirmación del servidor; las devoluciones
  abren su publicación/panel. Destinos eliminados, inaccesibles o ausentes dan feedback.

### Experiencia, imágenes y rendimiento

- Filtros combinables por categoría/estado, zona, fecha local, autoría y orden; recientes
  primero por defecto. Limpiar filtros y estado vacío con salida visible. Cerca de mí
  se prioriza dentro del mapa.
- Perfil más equilibrado en escritorio, formulario de privacidad y controles accesibles.
  Se preservan la identidad, los filtros existentes y las pantallas conocidas.
- Mapa adaptado a `visualViewport`, navegación inferior y áreas seguras; `touch-action`
  y overscroll contenidos. Se conservan Leaflet, marcadores, GPS y acceso a publicaciones.
- Fotos JPG/PNG/WebP de hasta 5 MB; decodificación real y re-encodificación local a JPEG,
  máximo 1600 px, sin metadatos originales. Archivos inválidos se rechazan y se informa
  preparación. Storage mantiene además sus límites MIME/tamaño y control por propietario.
- Se conserva la foto obligatoria para nuevas publicaciones: hacerla opcional requiere
  revisar el contrato de publicación/Storage y la calidad del catálogo; no se introdujo
  una imagen externa automática ni se modificaron publicaciones antiguas sin foto.
- Estadísticas comunitarias identificadas, actualización explícita y botón cerrar.
  Totales incluyen recuperados; si hay estados legados no clasificados, se informa el
  resto. Los indicadores personales se calculan sólo con publicaciones propias.
- QR se carga dinámicamente al generarlo. El detalle pasó de unos 48.16 kB a unos
  20 kB sin comprimir; el generador queda en un chunk aparte de unos 25.78 kB.
  Leaflet sigue separado y diferido. No se añadieron dependencias al proyecto.

## SQL y orden de instalación pendiente

**Nada de esta sección se ejecutó en un proyecto remoto.**

1. Revisar el destino `yiarlhpbgkofhhipkfha` y respaldos según las guías existentes.
   Ejecutar los diagnósticos de sólo lectura:
   `supabase/audit/recovery_readiness.sql` y
   `supabase/audit/community_readiness.sql`. Comparar catálogo, ACL, RLS y funciones.
2. Verificar el baseline de `STAGING_SETUP.md`. No reaplicar migraciones históricas
   para igualar hashes ni asumir instalación por la existencia de archivos en Git.
3. Si faltan, instalar mediante una operación futura autorizada, en este orden:
   - `20261105000000_school_features.sql` y sus prerrequisitos revisados.
   - `20261106000000_secure_recovery.sql`.
   - **`20261106001000_community_safety.sql`** (nueva propuesta de esta misión).
4. La propuesta nueva es transaccional y repetible en los esquemas probados. Rechaza
   RLS deshabilitada y ACL incompatibles antes de instalar. Preserva consentimientos,
   historial y votos al reaplicarse. Una estructura desconocida necesita revisión.
5. No reaplicar después las propuestas antiguas: reemplazarían vistas/RPC protegidas.
   Conservar la nueva protección aunque se revierta el frontend; una reversión no debe
   reabrir teléfonos ni escrituras directas inseguras.
6. Designar moderadores desde una sesión administrativa autorizada mediante la tabla
   privada `buscag_private.moderators`, usando UUID verificados. No se agregó ni promovió
   ninguna cuenta real. Sin esa configuración, se reciben denuncias pero no hay operador
   de revisión designado.

## Variables y acciones manuales

| Variable/acción | Dónde corresponde | Estado |
| --- | --- | --- |
| `BUSCAG_STAGING_PUBLISHABLE_KEY` | Build local de staging/presentación | Reutilizar la clave pública del proyecto correcto |
| `BUSCAG_STAGING_VAPID_PUBLIC_KEY` | Entrada explícita del build de Prueba | Pendiente de proveer un par público real existente |
| `VITE_VAPID_PUBLIC_KEY` | Sólo clave pública en cliente; derivada por los launchers anteriores | Formato validado antes de compilar |
| `PUSH_VAPID_PUBLIC_KEY` | Edge Function `send-push` | Debe coincidir con la del frontend |
| `PUSH_VAPID_PRIVATE_KEY` | Sólo secreto de Edge Function | Nunca `VITE_*`, Git ni navegador |
| `PUSH_VAPID_SUBJECT` | Edge Function, contacto del responsable | Configurar privadamente |
| `PUSH_WEBHOOK_SECRET` | Webhook de INSERT de notificaciones y Edge Function | Secreto compartido fuerte, sólo servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | Sólo entorno servidor de la función | No se usa para iniciar sesión en el cliente |
| Scheduler/worker de coincidencias | Supabase Prueba según la guía escolar existente | Verificar ejecución y heartbeat reales |
| SMTP y URLs permitidas de Auth | Dashboard de Supabase Prueba | Verificar recepción real y cuotas |

No se generaron claves VAPID. Los valores sintéticos de tests sólo prueban contratos
y nunca se emplean como configuración de un sitio ni para enviar push.

La configuración preparada de presentación usa `https://buscag-prueba.web.app` y
`firebase.presentation.json` fija `site=buscag-prueba`. Antes de un futuro despliegue
autorizado, comprobar que ese site pertenece al proyecto Firebase esperado y que el
artefacto tiene backend de Prueba. `firebase.json`, el destino normal y la configuración
de Producción no se cambiaron. El plan de Auth es sólo un documento revisable, no un
payload ejecutado: contempla ese origen, recuperación y el contexto QR; el guard de
ensayo verifica el manifiesto público antes de permitir probar correos allí.

En iPhone, probar desde la PWA instalada en pantalla de inicio, iOS 16.4 o posterior,
HTTPS y permiso dado mediante acción del usuario. Verificar suscripción, webhook,
entrega con app cerrada, revocación y rotación con dispositivos reales. El SW usa un
tag estable por ID para reemplazar duplicados visibles, pero eso no certifica entrega
exactamente una vez del proveedor. Cerrar/reabrir la PWA tras actualizar su SW.

## Validación y límites

Resultado final: `npm run qa:local` completó sus **15 etapas** sin fallos.
Resumen legible por máquina: `INTEGRAL_VALIDATION.json`.

- `npm test`: **133 pruebas** aprobadas.
- `npm run lint`: TypeScript sin errores.
- `npm run build`: compilación Vite correcta, sin despliegue.
- `npm run test:e2e`: **84 pruebas**, escritorio y móvil Chromium, backend simulado.
- `node tests/client-security.mjs`: **18 controles** aprobados.
- `npm run test:backend`: matriz PGlite aprobada; **58/58/61** controles base
  (DATE de repositorio / timestamptz de repositorio / DATE observado), más **16**
  grupos escolares, **7** de recuperación y **13** de comunidad por variante.
- `LOCAL_PG_SOCKET=/tmp/buscag-integral-pg BUSCAG_TEST_CLUSTER=disposable npm run
  test:backend:postgres`: PostgreSQL nativo aislado aprobado; **61/61/64** controles
  base, más **17** grupos escolares, **8** de recuperación y **15** de comunidad
  por variante. Incluye conexiones concurrentes reales, replay de migraciones,
  anonimización y protección de grants/RLS. El socket y los datos fueron locales.
- Orden de activación comprobado. Diagnóstico de comunidad ejecutado localmente.
- PWA compilada: **1** prueba de navegador aprobada. Presentación compilada:
  escritorio y móvil aprobados, destino de Prueba y backend simulado.
- Herramientas de release, staging, visitantes, worker, configuración de frontend,
  presentación y handlers: etapas aprobadas dentro de `qa:local`.
- `git diff --check`: sin errores de whitespace.

No se agregaron dependencias de producción. QR carga a demanda: el chunk de detalle
bajó de aproximadamente 48 KB a 20 KB; la biblioteca QR queda en un chunk separado.
Los tamaños son de compilación, no una medición de velocidad en red móvil real.

Toda base de test fue descartable, con usuarios sintéticos. Los navegadores simulan
Supabase; la emulación móvil en Chromium no sustituye Safari/WebKit ni un iPhone real.
La suite del SW prueba fallback público y ausencia de caché de datos privados/callbacks.
Las Edge Functions no se modificaron: se revisaron sus controles de secretos, origen,
límites y endpoints push permitidos, cubiertos por las pruebas existentes de handlers.

Quedan pendientes en staging: catálogo y permisos reales, instalación SQL, usuarios
de moderación, SMTP, VAPID/webhook/scheduler, Realtime entre dispositivos, entrega de
proximidad/coincidencias y gestos/push en iPhone real. No se certificó entrega de emails
ni push. Storage no incorpora antivirus ni moderación automática de imágenes; sus URLs
públicas deben contener sólo fotos destinadas a publicarse. Los borradores/cola no se
sincronizan a otros dispositivos: sí lo hacen los mensajes confirmados mediante el
backend y el mecanismo de reconexión existente.

## Archivos principales y commits

- Backend: nueva propuesta de comunidad, nuevo diagnóstico, `tests/communityChecks.mjs`
  y su incorporación a la matriz de seguridad existente.
- Contratos: `lib/community.ts`, `lib/chatStorage.ts`, `lib/database.ts`, `lib/supabase.ts`,
  `lib/schoolFeatures.ts`, `lib/authFlow.ts`, validadores de entorno y `lib/vapid.mjs`.
- Interfaz: `App`, `ProfileSettings`, `SafetyActions`, `RecoveryPanel`, `MessagesView`,
  `ContactModal`, `AdvancedSearch`, `ConnectionStatus`, notificaciones, mapa, perfil,
  tarjetas/detalle, estadísticas, formularios y QR; navegación y CSS existentes.
- Pruebas: contratos de almacenamiento/filtros/bandeja, regresiones DOM, suites E2E de
  comunidad/experiencia/QR, seguridad del cliente y del SW; configuración de build.
- Configuración preparada: launcher de staging, presentación, site de pruebas y plan
  de callbacks. No cambia el servicio remoto hasta una operación autorizada.
- El informe anterior `RECOVERY_AUDIT.md` conserva su contexto y remite a la excepción
  individual posterior. La lista exacta de cambios está en los commits de esta misión.

Commits funcionales realizados directamente en `Alexis`:

- `1e8e0e5` — privacidad, consentimiento y base de seguridad comunitaria.
- `262c7a8` — chat confiable, historial de recuperación, búsquedas y experiencia móvil.
- `1640001` — validación push y configuración aislada de Prueba.

El commit de documentación agrega este informe y el resumen de validación. Los
cambios anteriores de esta conversación siguen en `5bc98a5` (marcador rojo compilable)
y `127fa70` (flujo seguro de recuperación y auditoría). No se crearon ramas ni PR.

Antes de lanzar a usuarios reales: cerrar los pendientes administrativos, ensayar con
cuentas dedicadas de Prueba, revisar el catálogo efectivo y obtener autorización para
cualquier aplicación SQL/despliegue. Conservar los controles del servidor durante el
rollout y observar errores/cuotas antes de ampliar el público.
