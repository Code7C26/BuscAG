# Corrección de seguridad de BuscAG: propuesta para revisión

Estado: migraciones preparadas; NO aplicadas a Supabase. No se cambiaron componentes,
CSS, rutas visuales ni Edge Functions. Los cambios del cliente se limitan a la capa
`lib/`. Las pruebas SQL usan una base PostgreSQL efímera con datos sintéticos.

## Evidencia y decisiones

El titular confirmó RLS activo en cuatro tablas, INSERT anónimo abierto en items,
comparaciones incorrectas en mensajes, lectura general de perfiles y ausencia de
push_subscriptions. No se presupone que el resto de las políticas o ACL remotas
coincidan con las migraciones. La posibilidad de cambiar rating/contact_count queda
cerrada tanto en INSERT como UPDATE, incluso frente a ACL antiguas por columna.

`App.tsx` devuelve AuthView sin sesión, carga datos únicamente con authUser y exige
currentUser al publicar. No hay un flujo que necesite publicaciones anónimas. Se
elimina escritura y lectura anónima de las tablas de esta propuesta. Supabase Auth
sigue permitiendo registro: registrar una cuenta no requiere permiso INSERT de anon
sobre profiles; el trigger de Auth crea el perfil como función de confianza.

El nombre, avatar, reputación y fecha de alta permanecen en un directorio de usuarios
autenticados. Teléfono y ubicación personal se entregan sólo al titular o a usuarios
que hayan intercambiado mensajes en ambos sentidos sobre el mismo objeto. Un mensaje
sin respuesta no desbloquea contacto. Es una decisión propuesta para revisión: los
botones existentes de teléfono dependen de la disponibilidad del dato y pueden no
aparecer hasta ese intercambio; no hay rediseño ni cambios de JSX/CSS. Las ubicaciones
publicadas en items (incluidas coordenadas) siguen visibles a los autenticados.

No se mueven ni borran datos privados. Se restringe profiles por RLS y se agrega una
vista de proyección controlada public_profiles. Su ejecución con el propietario es
intencional; security_invoker=true dejaría sin nombres a los perfiles de terceros.
Debe pertenecer a postgres o al propietario de migraciones confiable con capacidad
para leer las filas subyacentes, nunca a un rol cliente. La vista comprueba auth.uid(),
filtra teléfono/ubicación y no acepta parámetros ni SELECT dinámico. No añadir p.*.

## Permisos que usa el frontend

| Recurso / uso | Lectura | Escrituras necesarias |
| --- | --- | --- |
| profiles: loadProfile, registro y fallback upsert | Fila propia completa | id, full_name, avatar_url, phone, location; sin rating ni created_at |
| public_profiles: loadItems, autor de tarjetas/detalle/chat | Identidad pública y contacto condicionado | Ninguna |
| items: listado/mapa/matches, publicar/recuperar/eliminar | Autenticados | INSERT de datos del objeto con owner propio; UPDATE de contenido/estado propio; DELETE propio |
| messages: conversaciones y recibos | Sólo participantes | INSERT como remitente real a dueño del objeto o contraparte de ese hilo; UPDATE sólo is_read por destinatario |
| notifications: listado y matches locales | Sólo destinatario | INSERT de match propio; UPDATE sólo is_read; sin DELETE cliente |
| push_subscriptions: lib/push.ts | Sólo titular | Upsert y DELETE propios; servidor lee y elimina endpoints vencidos |

El id de profiles se mantiene en UPDATE para el upsert actual: RLS obliga que continúe
siendo auth.uid(). Los ids/fechas de objetos, mensajes, notificaciones y suscripciones,
rating y contact_count usan defaults o servidores, sin escritura cliente. Los nombres,
avatares y títulos desnormalizados de mensajes son canonizados por un trigger antes
del trigger de notificación para impedir suplantación de identidad visual.

## Aplicación por etapas, sólo tras revisión

1. Ejecutar manualmente `supabase/audit/security_preflight.sql` (sólo lectura) y guardar
   los resultados en un lugar privado, fuera de Git. Exportar también el esquema/ACL
   actual con la herramienta de respaldo habitual, sin filas. Un respaldo de esquema
   puede incluir secretos en argumentos de webhooks: mantenerlo privado y no pegarlo
   en el PR ni en el chat. La consulta preflight omite esos argumentos. Este
   respaldo es necesario para una reversión exacta: los nombres de políticas remotas
   y las ACL reales no se conocen completamente. Conservar la versión del bundle.
2. Comparar columnas, tipos, FK, defaults, checks y triggers con las migraciones
   originales. Verificar especialmente on_auth_user_created, on_message_created y
   on_item_recovered y sus funciones SECURITY DEFINER. Si faltan, reconciliarlos en
   staging antes de producción; esta propuesta no inventa su estado remoto.
   Los nombres public_profiles, can_send_item_message y canonicalize_message_display
   deben estar libres; CREATE falla si existen en lugar de reemplazar objetos ajenos.
   Revisar roles heredados: anon/authenticated no deben tener BYPASSRLS, superusuario
   ni membresías privilegiadas. Si las tienen, detener y preparar esa corrección.
3. Revisar TODAS las políticas personalizadas. Las nuevas migraciones reemplazan el
   conjunto completo de políticas de las tablas objetivo, porque dejar una política
   permisiva antigua puede anular las restricciones. Revocan privilegios de tabla y
   columna a PUBLIC/anon/authenticated y conceden una lista explícita. No modifican
   roles ni revocan permisos directos de otros roles. Revisar éstos si existen.
4. Ensayar con un proyecto staging aislado y usuarios A/B/C; ejecutar la matriz de
   abajo, incluidos REST/PostgREST, registro y suscripciones Realtime. No probar
   escrituras contra producción durante la auditoría.
5. Desplegar primero el cliente de esta rama. Si la vista todavía no existe, usa un
   fallback que solicita sólo id/nombre/avatar/rating/created_at; nunca SELECT * de
   todos los perfiles. Durante esa transición no entrega teléfonos/localidades ajenos.
6. Aplicar manualmente, en orden, las cuatro nuevas migraciones con el propietario de
   confianza. Cada archivo tiene su propia transacción y se revierte si falla dentro
   de ella. Un fallo posterior no revierte archivos ya confirmados. No ejecutar a
   ciegas todos los archivos antiguos para reparar la tabla push ausente. Si se usa
   Supabase CLI, reconciliar primero su historial con el esquema real: los archivos
   antiguos pendientes podrían recrear políticas amplias.
7. Recargar clientes antiguos: su consulta SELECT * a profiles ya sólo devuelve el
   perfil propio. Comprobar todas las funcionalidades y volver a ejecutar la auditoría
   de permisos con anon/authenticated. No basta probar SELECT desde SQL Editor como
   postgres, porque evita RLS. Verificar propietario de la vista/funciones y permisos.
8. Activar entrega push sólo después de revisar los requisitos de servidor siguientes.
   No se incluye despliegue de aplicación, función, webhook ni aplicación SQL en el PR.

## Plan de pruebas y reversión por cambio

| Cambio | Aplicación / pruebas en staging | Reversión |
| --- | --- | --- |
| 20261103000000: items y messages | Confirmar que anon no publica/lee; A publica/edita/borra sólo lo propio; rating/count no se pueden inyectar; primer mensaje al dueño y respuesta funcionan; A no puede usar un hilo previo para dirigirse a C ni cambiar de objeto. Verificar recibos, canonización, notificación y contador. | Si el archivo falla, su transacción no cambia nada. Si ya se confirmó, restaurar las políticas y ACL de ambas tablas desde el respaldo revisado, quitar sólo el nuevo trigger canonicalize_message_display y sus dos funciones nuevas una vez sin referencias. No tocar los triggers de avisos existentes. Restaurar políticas abiertas reintroduce vulnerabilidades: preferir corregir hacia adelante o suspender temporalmente la operación afectada. |
| 20261103001000: perfiles | Desplegar cliente antes; registrar usuario con/sin confirmación, probar fallback upsert y perfil propio; A ve identidad de B, no teléfono/localidad hasta conversación recíproca; C no los ve; ningún cliente modifica rating. Comprobar actualización de datos al recibir mensajes. | Mantener el cliente nuevo, restaurar políticas/ACL de profiles desde el respaldo revisado y retirar la vista sólo si se creó en esta etapa. El fallback del cliente sigue mostrando identidades sin descargar privados. Restaurar lectura amplia de profiles vuelve a exponer datos mediante API y requiere aceptación expresa del riesgo. Si se revierte también el bundle, hacerlo después de restaurar compatibilidad SQL. |
| 20261103002000: notificaciones | A crea match propio; no crea avisos para B ni system/message/recovered; sólo marca leídas las propias. Comprobar que mensajes y recuperación siguen generando avisos mediante triggers. | Restaurar políticas y ACL de notifications desde el respaldo revisado; no borrar filas ni reemplazar triggers. Mantener UPDATE limitado a is_read cuando sea posible; diagnosticar primero permisos del rol servidor. |
| 20261103003000: push | Crear tabla ausente; registrar/upsert propio, leer/borrar propio; B no lee ni roba endpoint de A. Verificar lectura/borrado por service_role y entrega real sólo en staging. | Desactivar webhook/entrega push si se activaron, mantener la tabla y sus datos, revocar acceso cliente a ella si hace falta y restaurar su ACL/políticas previas si ya existía. No usar DROP TABLE como rollback: perdería suscripciones nuevas. El cliente sigue funcionando sin push; las notificaciones internas son independientes. |
| Cliente lib/database.ts, lib/supabase.ts, lib/push.ts | TypeScript/build; listado con vista presente y fallback sin vista; estado push devuelve false si falta tabla, otros errores se conservan. Recargar página tras migrar para descartar bundle anterior. | Conservar la capa nueva durante cualquier reversión SQL. Para volver al bundle anterior, restaurar primero un contrato de perfiles compatible; no ampliar permisos automáticamente para acomodar un bundle viejo. |

## Push y limitaciones

Sí, Web Push depende de push_subscriptions: lib/push.ts registra/consulta/borra y
supabase/functions/send-push/index.ts obtiene endpoint/p256dh/auth para enviar. El
service worker sólo recibe el aviso. Crear la tabla repara esa dependencia, pero no
configura VAPID, PUSH_WEBHOOK_SECRET, despliegue de send-push, webhook INSERT sobre
notifications, HTTPS ni permiso del navegador. No agregar claves privadas al frontend.
El estado de push devuelve false si la tabla falta; habilitarlo sigue informando un
error de infraestructura, sin fingir que hubo entrega.

La migración nueva de push sirve tanto para instalaciones nuevas (donde ya corrió
la antigua) como para el entorno informado (tabla ausente). No asumir que CREATE
TABLE IF NOT EXISTS corrige una tabla preexistente con tipos/constraints diferentes;
compararla en preflight. La migración no actualiza datos ni migra suscripciones.

No se cambia el bucket público item-images ni se retiran imágenes ya públicas. No se
implementan límites de frecuencia/antispam, revisión de endpoints push (posible abuso
de solicitudes salientes), consentimiento explícito para compartir contacto o
validación de contenido de publicaciones. Son trabajos posteriores; RLS no los
resuelve. Una conversación recíproca histórica cuenta como autorización de contacto:
revisar esta decisión si hubo abuso previo; los datos ya descargados no se revocan.
La seguridad de un proyecto real depende además de los roles/funciones heredados y
webhooks que no existen en el modelo local.

## Reproducir pruebas locales sin Supabase

Desde src/code, con Node y las dependencias normales del proyecto instaladas:

```sh
npm run lint
npm test
npm run build
node tests/client-security.mjs
npm install --prefix /tmp/buscag-security-tests --no-save --package-lock=false --no-audit --no-fund @electric-sql/pglite@0.5.15
PGLITE_MODULE=file:///tmp/buscag-security-tests/node_modules/@electric-sql/pglite/dist/index.js node tests/security.mjs
```

PGlite se instala fuera del repositorio y no modifica sus manifests ni lockfiles. El
runner crea PostgreSQL en memoria, roles/servicios mínimos de Auth/Storage, instala las
migraciones con datos sintéticos y destruye la instancia al finalizar. No usa variables
VITE, claves, DATABASE_URL ni acceso a Supabase. Sólo omite CREATE EXTENSION pgcrypto
porque gen_random_uuid ya existe en PostgreSQL embebido. Esto valida SQL/RLS/ACL y
triggers, no el servidor Auth real, la caché PostgREST, Realtime, Storage o el envío Web
Push. Las pruebas de esos servicios quedan explícitamente en staging antes de aplicar.

## Validación de esta rama

- `npm run lint`: correcto (TypeScript sin emitir archivos).
- `npm run build`: correcto; Vite advierte un bundle mayor de 500 kB, sin error.
- `node tests/client-security.mjs`: 9 comprobaciones correctas con cliente simulado.
- PostgreSQL embebido 18.6 / PGlite 0.5.15: 26 comprobaciones correctas.
- `git diff --check`: correcto; ningún archivo de componentes/estilos cambió.

El modelo de la política original de mensajes también produjo recursión RLS durante
INSERT. La función de comprobación nueva evita autoexpandir esa política, además de
corregir las referencias de objeto y destinatario. Es evidencia local del SQL del
repositorio, no una prueba de escritura sobre la configuración remota.

## Integración sobre Alexis

La rama de revisión `security/alexis-rls-hardening` parte de `Alexis` y aplica mediante
cherry-pick el commit a839a64 del PR #22. Conserva el historial previo completo,
incluidos los cambios de matcheo y sus pruebas. El único conflicto ocurrió en
lib/database.ts: se mantiene la carga secuencial de items de Alexis, la consulta de
perfiles limitada a los ownerIds únicos y los retornos tempranos para listas vacías
o publicaciones antiguas sin dueño. Esa consulta ahora usa public_profiles, y el
fallback previo a la migración también filtra ownerIds sin solicitar campos privados.

Validación adicional: las 5 pruebas originales de matcheo de Alexis pasan. Las pruebas
del cliente comprueban el filtro de propietarios, el caso vacío y el caso sin dueño.
No hay diferencias respecto de Alexis en componentes, estilos, matcher ni package.json.
La integración se entrega mediante PR hacia Alexis; no modifica main ni aplica SQL
remoto. Las restricciones de privacidad y el plan de staging de este documento siguen
vigentes.
