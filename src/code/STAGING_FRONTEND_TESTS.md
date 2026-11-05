# Frontend local conectado exclusivamente a BuscAG-Staging

Destino confirmado por el operador: `yiarlhpbgkofhhipkfha`. El operador informa las
nueve migraciones aplicadas, verify correcto y smoke revertido. No se repitieron
migraciones ni se inspeccionó remotamente ese estado en esta revisión.

## Arranque mínimo en Windows PowerShell

Desde `C:\Users\Valen M\BuscAG\src\code`, con Alexis actualizada:

```powershell
git pull --ff-only origin Alexis
npm ci
$env:BUSCAG_STAGING_PUBLISHABLE_KEY = Read-Host 'Clave PUBLICABLE de BuscAG-Staging (no service_role)'
npm run dev:staging
```

Usar únicamente la clave publicable de Dashboard de **BuscAG-Staging**. No introducir
URI PostgreSQL, contraseña de DB, service_role ni claves privadas. Esta clave está
diseñada para el navegador; Read-Host evita guardarla en el historial de comandos.
No hace falta crear, modificar o sobrescribir ningún .env de producción.

Abrir **http://127.0.0.1:3001**. No sustituir por localhost: cambia el origen de Auth.
Detener con Ctrl+C y limpiar la variable al terminar:

```powershell
Remove-Item Env:BUSCAG_STAGING_PUBLISHABLE_KEY -ErrorAction SilentlyContinue
```

El comando fija URL y ref de staging, escucha sólo en loopback y exige puerto 3001
libre. Su proceso hijo elimina variables VITE_* heredadas, ignora .env/.env.local y
elimina la URI PostgreSQL de staging del entorno del servidor Vite. El proceso padre
y los archivos originales conservan su configuración. Las sesiones de Auth usan un
storageKey específico de staging y un origen distinto al Hosting publicado.

Hay guardas adicionales en Vite y en el cliente, y una CSP del servidor local que
limita HTTP/WebSocket de Supabase al ref de staging. No se permiten orígenes Supabase
comodín ni el proyecto de producción. La CSP conserva los servicios existentes de
mapa, fotos de muestra y avatares; otros proveedores de fotos pueden ser bloqueados
intencionalmente en este modo. No altera la interfaz ni la configuración normal.

Un JWT anon antiguo debe pertenecer al ref staging. Una clave sb_publishable_ es
opaca: su proyecto se verifica contra Auth de staging, nunca consultando producción.
Si la clave es incorrecta o la red impide el preflight, Vite no arranca. No hay
fallback a variables o conexiones de producción. No iniciar con npm run dev para
esta prueba; ese comando conserva su configuración habitual.

## Comprobaciones automáticas sin credenciales privadas

El arranque realiza únicamente GET a:

- `/auth/v1/settings`: acceso con la clave publicable y flags públicos de registro.
- `/rest/v1/{tabla}?select=id&limit=0` para las cinco tablas: exige denegación anónima
  401/403 con código 42501; no solicita filas, escribe ni prueba contraseñas.

Se puede ejecutar ese chequeo sin arrancar Vite:

```powershell
npm run check:staging-public
```

Sólo contacta el URL de staging fijo, con timeout y sin seguir redirecciones. No
imprime la clave ni el cuerpo completo de Auth. Muestra email habilitado, registro
bloqueado/autoconfirmación y pruebas pendientes; eso no demuestra entrega de correo.
Un error no se resuelve abriendo permisos a anon: revisar proyecto, clave y catálogo.

Las publicaciones y mensajes de este modo requieren sus RPC. PGRST202 se presenta
como error sin INSERT directo alternativo; un timeout conserva la intención para
reintentar. El modo normal mantiene su fallback previo a migraciones. Las propuestas
revocan INSERT directo y permiten UPDATE de edición, recuperación e is_read según
RLS. Esos UPDATE siguen siendo intencionales y no necesitan una RPC nueva.

Pruebas locales sin red Supabase ni usuarios privados:

```powershell
npm run test:staging-frontend
npm test
npm run lint
npm run build
npm run build:staging
node tests/client-security.mjs
```

`build:staging` necesita la misma clave publicable pero no hace peticiones remotas;
produce **dist-staging**, ignorado por Git. No toca dist ni Firebase. Ese artefacto es
para revisión local, no una instrucción de despliegue. Las guardas CSP se prueban en
el servidor dev; no asumir que acompañan al artefacto si se sirve con otro servidor.
`test:staging-frontend` prueba con transportes simulados y un Vite real efímero sólo
en loopback. No certifica navegador/servicios Supabase reales.

## Preparación manual única en el proyecto correcto

En **BuscAG-Staging**, Auth > URL Configuration, permitir:

- `http://127.0.0.1:3001/`
- `http://127.0.0.1:3001/?auth=recovery`

No editar las URLs de producción. Verificar email provider, confirmación requerida,
SMTP/entrega y límites de correo del proyecto. Si hay CAPTCHA obligatorio, el
formulario actual no integra su token: será un bloqueo a resolver antes de dar por
probado el registro. No deshabilitar protecciones de producción para probar staging.

Preparar dos direcciones de prueba con buzones accesibles, por ejemplo alias propios.
Elegir contraseñas nuevas exclusivamente en el navegador, sin reutilizar contraseñas
personales y sin compartirlas ni guardarlas en scripts/Git. Usar dos perfiles de
navegador aislados (A y B); una sesión privada y otra normal también sirve. Abrir los
links de correo en el perfil correspondiente. No importar usuarios ni datos reales.

## Un único recorrido con dos cuentas

Con DevTools > Network abierto, comprobar que las peticiones de Supabase apuntan
únicamente a yiarlhpbgkofhhipkfha.supabase.co. No exportar HAR: contiene sesiones y
cabeceras. Registrar sólo resultado y código de error sanitizado.

| Paso | Acción mínima | Resultado esperado |
| --- | --- | --- |
| 1. Registro y correo | Registrar A y B con datos ficticios; confirmar desde sus buzones y entrar. | Perfiles creados y sesión por cuenta; si hay autoconfirmación, registrar correo como no probado. |
| 2. Foto y publicación | A publica objeto perdido con foto JPG/PNG/WebP ficticia, fecha y ubicación confirmada en mapa. | POST a publish_item_once, una publicación, imagen visible desde item-images de staging. Sin INSERT directo de items. |
| 3. Validaciones | En un borrador, omitir foto/ubicación o exceder título de 200 caracteres. | No publica, explica el error y conserva borrador; confirmar después con datos válidos. |
| 4. Edición y mapa | A edita título/ubicación; B verifica tarjeta, filtros y mapa. | Mismo ID/propietario; sin volver a subir foto si no cambió; actualización visible en B por Realtime. |
| 5. Conversación | B contacta la publicación de A; A abre y responde. | POST a send_message_once; un mensaje por envío, aviso interno al destinatario y contacto privado sólo tras intercambio mutuo. |
| 6. Recibos | A abre mensajes no leídos; luego B hace lo mismo. Abrir avisos internos. | UPDATE sólo is_read; el historial se conserva y contadores/avisos se sincronizan. |
| 7. Reconexión y fallo | En B activar Offline de DevTools; escribir/enviar, restaurar Online y reintentar el mismo borrador. A envía otro mientras B está desconectado. | B conserva borrador al fallar; al reconectar recupera mensajes/avisos perdidos y no duplica el envío. No garantiza deduplicación tras recargar la página: intención actual en memoria. |
| 8. Recuperación | A marca el objeto recuperado y confirma; B observa. | Estado actualizado, aviso recovered y conversación conservada. |
| 9. Sesiones y recuperación Auth | Cerrar sesión; solicitar recuperación por email de la cuenta de prueba, abrir enlace, cambiar contraseña y entrar. Cambiar entre A/B en un perfil. | No muestra datos/borradores de la cuenta previa; enlace vuelve al origen local correcto. |

No borrar publicaciones ni archivos al finalizar: dejar los fixtures identificados
como pruebas para revisión posterior. No probar eliminación durante este recorrido:
el CASCADE existente elimina conversaciones asociadas. No hace falta tocar datos
reales para comprobar las funcionalidades listadas.

Para verificar privacidad frente a tercero, usar una tercera cuenta ficticia opcional:
no debe poder ver chats/avisos ajenos ni contactos privados de A/B. Las pruebas SQL
previas y las pruebas locales ya cubren ese caso con datos simulados, pero no prueban
Auth/PostgREST del servicio real. No inspeccionar datos de otros usuarios reales.

## Coincidencias y push: expectativas correctas

Con matches_enabled=false, publicar dos objetos compatibles no demuestra el worker:
el frontend conserva el modo transitorio de aviso propio. No esperar avisos del
backend para ambos propietarios ni marcar ese flujo como aprobado. Activar el
worker requiere Edge Function, scheduler y procedimiento separado con heartbeat.
No se activó nada en esta revisión.

La notificación interna de mensaje/recuperación sí debe funcionar sin push. Push
requiere VAPID, Edge Function, webhook y permiso del navegador. Mantenerlo pendiente
hasta configurarlo en staging, nunca con secretos de producción. Las claves privadas
no van en VITE_*. El launcher no hereda VITE_VAPID_PUBLIC_KEY: se omite push en esta
primera batería para no mezclar configuraciones de proyectos.

## Cobertura y resultados

| Área | Automatización existente/local | Verificación real pendiente |
| --- | --- | --- |
| Auth/registro/sesiones | production.test.mjs: formulario, recuperación, limpieza y respuestas tardías | Buzones, GoTrue, redirects y login real |
| Publicación/edición/imágenes | production.test.mjs, publicationDelivery.test.ts, client-security.mjs | Storage API, RLS y bytes visibles desde otro navegador |
| Mensajes/idempotencia/recibos | messageDelivery.test.ts, readReceipts.test.ts, pruebas DOM | Dos clientes conectados a RPC/PostgREST reales |
| Notificaciones/Realtime | reconnectSync.test.ts y pruebas DOM de reconexión | Canal WebSocket real y recuperación de eventos perdidos |
| Aislamiento staging | staging-frontend.test.ts: configuración, CSP, Vite real, chequeos GET simulados | Ejecutar dev:staging con la clave publicable correcta |

El estado de las nueve migraciones proviene del resultado confirmado por el operador.
No se ejecutaron SQL/migraciones de nuevo ni se crearon usuarios o imágenes remotos.

Resultados locales de esta revisión: **104/104** pruebas de aplicación, **5/5** de
staging frontend, **16/16** de cliente/privacidad; TypeScript y ambas compilaciones
correctos. La compilación staging usó una clave ficticia, sin llamadas remotas.
La prueba Vite usó un puerto efímero de loopback; el arranque del operador exige 3001.
No se dispone aquí de una clave publicable staging ni se accedió a sus APIs.
