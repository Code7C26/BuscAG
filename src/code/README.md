> Extensión escolar opcional: [SCHOOL_FEATURES.md](SCHOOL_FEATURES.md) documenta
> vigilancia por zona, QR, devolución bilateral y estadísticas. Código preparado;
> migración y scheduler **no aplicados remotamente** por esta ejecución.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# BuscAG

**Objetivo actual: visitantes reales en la presentación escolar**, con registro por
su propio correo y confirmación activa, usando exclusivamente staging. Ver
[VISITOR_REGISTRATION.md](VISITOR_REGISTRATION.md) para SMTP gratuito sin dominio,
callbacks públicos y pruebas pendientes. SCHOOL_PRESENTATION.md conserva el build
separado; las cuentas preconfirmadas ahora son contingencia, no aceptación del alta.

Aplicación comunitaria de objetos perdidos y encontrados. La app usa Supabase para autenticación, perfiles, publicaciones, mensajes, notificaciones, fotos y actualizaciones en tiempo real.

## Estado de preparación para producción

Consulta [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) para cambios locales,
pruebas y bloqueos, y [SUPABASE_MIGRATION_PLAN.md](./SUPABASE_MIGRATION_PLAN.md) para el
diagnóstico único de sólo lectura, respaldo y aplicación condicionada al esquema real.
Los cambios de código no aplican migraciones ni despliegan Firebase automáticamente.

## Preparar Supabase

Antes de aplicar la corrección de seguridad de noviembre, revisa
[SECURITY_ROLLOUT.md](./SECURITY_ROLLOUT.md). Incluye el orden de despliegue,
las cuatro migraciones nuevas, pruebas locales y reversión. En proyectos existentes,
compara primero el esquema y el historial; no vuelvas a ejecutar migraciones antiguas
sin revisar sus políticas.

1. Crea un proyecto en Supabase.
2. En **SQL Editor**, ejecuta en orden los archivos de `supabase/migrations`: [`20261014000000_dynamic_database.sql`](./supabase/migrations/20261014000000_dynamic_database.sql), [`20261015000000_push_notifications.sql`](./supabase/migrations/20261015000000_push_notifications.sql) y [`20261016000000_notification_permissions.sql`](./supabase/migrations/20261016000000_notification_permissions.sql).
3. En **Authentication > URL Configuration**, agrega la URL exacta de la app a **Redirect URLs** (por ejemplo, `http://localhost:3000/**` para pruebas locales y `https://tu-dominio/**` para producción). Configura también el **Site URL** con el dominio principal publicado.
4. En **Authentication > Providers > Email**, decide si exigirás confirmación de correo. Si está activada, las cuentas nuevas deberán confirmar el mensaje recibido antes de iniciar sesión.

La migración crea perfiles ligados a Auth, publicaciones, conversaciones, notificaciones, almacenamiento de fotos, políticas RLS y canales Realtime. Las políticas permiten leer publicaciones a usuarios autenticados y restringen las escrituras a los propietarios y participantes correspondientes.

### Notificaciones push (también con la app cerrada)

Las notificaciones internas se guardan en Supabase. Para enviarlas al navegador incluso cuando la app está cerrada, también hay que configurar Web Push en el servidor:

1. Genera un par de claves VAPID, por ejemplo con `npx web-push generate-vapid-keys`. Configura la clave pública como `VITE_VAPID_PUBLIC_KEY` en el entorno de compilación de la app y en `.env.local`.
2. Instala y autentica Supabase CLI. Despliega la Edge Function desde la raíz del proyecto: `supabase functions deploy send-push --no-verify-jwt`.
3. Guarda los secretos solo en Supabase: `supabase secrets set PUSH_VAPID_PUBLIC_KEY="<clave pública>" PUSH_VAPID_PRIVATE_KEY="<clave privada>" PUSH_VAPID_SUBJECT="mailto:admin@tu-dominio.com" PUSH_WEBHOOK_SECRET="<secreto aleatorio largo>"`.
4. En **Database > Webhooks**, crea un webhook para `public.notifications`, evento **INSERT**, método **POST**, con URL `https://<project-ref>.supabase.co/functions/v1/send-push` y encabezado `x-push-webhook-secret` cuyo valor sea el mismo `PUSH_WEBHOOK_SECRET`.
5. Publica la app con HTTPS. Cada usuario debe iniciar sesión y activar **Notificaciones push** desde su perfil; el navegador solicitará permiso.

La clave privada VAPID y `service_role` nunca deben incluirse en el frontend. Geolocalización y Web Push requieren HTTPS en producción (localhost está permitido durante el desarrollo). Si no se concede el permiso de ubicación, el mapa no mostrará una posición GPS inventada: seguirá en la vista general y explicará el error.

## Ejecutar localmente

1. Copia `.env.example` a `.env.local`.
2. Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con los valores de **Project Settings > API Keys** de Supabase, `VITE_VAPID_PUBLIC_KEY` con la clave pública generada y `VITE_APP_URL` con la URL pública de la app. Si no defines `VITE_APP_URL`, la confirmación vuelve al origen actual del navegador.
3. Instala dependencias con `npm install`.
4. Inicia la app con `npm run dev`.

No incluyas claves `service_role` en el frontend. La app solo debe usar la clave publicable; la seguridad de los datos se aplica con RLS en la base.
