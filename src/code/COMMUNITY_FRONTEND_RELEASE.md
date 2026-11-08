# Frontend de comunidad: candidata para Firebase Prueba

Destino exclusivo: https://buscag-prueba.web.app con Supabase
**yiarlhpbgkofhhipkfha**. Alexis. No hay migraciones adicionales ni despliegue en esta
entrega. No se modificó Firebase/Supabase Producción.

## Diagnóstico y evidencia

El operador confirmó stage=community, installed_final_catalog=true y cero pendientes.
Eso actualiza la base, pero NO instala un nuevo frontend en Firebase o en una PWA ya
abierta. La identidad del frontend servido sigue pendiente: el proxy de este entorno
rechaza web.app con CONNECT 403 y no se pudo descargar su manifest.

El historial agrega RecoveryPanel en 127fa70 y controles comunitarios en 1e8e0e5.
Las fechas de Git son posteriores a la hora informada para d14560; esto es una pista,
NO prueba de qué bytes tenía ese despliegue ni de que siga activo. No se atribuye el
problema definitivamente a caché o release vieja sin comparar el artefacto servido.

Se hicieron únicamente GET anónimos a estas RPC de lectura de Prueba:
my_community_settings, list_my_blocks, received_ratings, my_item_follow y
recovery_context. Todas respondieron HTTP401/SQLSTATE42501, no PGRST202. Confirma el
rechazo anónimo observado y es consistente con rutas presentes/protegidas; no
certifica operaciones autenticadas, efectos de escritura o todas las políticas reales.
No se crearon usuarios ni publicaciones ni se copiaron datos de Auth.

## Inventario de interfaces existentes (no faltaban seis pantallas nuevas)

| Función | Dónde está | Integración y condiciones |
| --- | --- | --- |
| Recuperación bilateral | Detalle del objeto → Recuperación segura | recovery_context, request_item_recovery y resolve_item_recovery. Propietario solicita; contraparte real acepta/rechaza. Chat de ese objeto o coincidencia persistida acredita vínculo. Una sugerencia local no basta. |
| Denuncias | Detalle ajeno / perfil público → Denunciar | submit_report, motivos/descripcion y estado en configuración mediante list_reports. No elimina automáticamente objetos. |
| Bloqueos | Detalle/perfil ajeno; lista en configuración | set_user_block/list_my_blocks. No aparece para bloquearte a vos mismo. El servidor decide acceso; se conserva historial. |
| Privacidad del teléfono | Perfil → Configuración → Teléfono privado y consentimiento | my_community_settings/save_my_profile; can_share_contact y public_profiles limitan exposición. Privado hasta consentimiento + condiciones de contacto recíproco, sin bloqueo. |
| Seguimientos | Detalle de publicación ajena → Seguir publicación | my_item_follow/set_item_follow y preferencia de avisos. No se sigue una publicación propia. |
| Valoraciones | Recuperación → Historial, valoración y problemas | rate_recovery/received_ratings. Sólo participantes de bilateral confirmada; una por autor/recuperación. No se muestra como operación válida antes de confirmar. |

Moderación ya tiene interfaz para usuarios inscritos expresamente; no se crea un
moderador automáticamente. No habilitar privilegios extra para que aparezcan botones.
Las funciones ausentes/errores de permisos nunca hacen fallback a recuperar por
PATCH ni a escribir campos de consentimiento/reputación directamente.

## Correcciones de esta entrega

- ProfileSettings permite volver a cargar perfil y funciones después de pasar de
  school a community sin cerrar sesión. Conserva fallback básico sólo para RPC
  ausente; errores de permiso/red no eluden el servicio. La recarga explícita indica
  que descarta cambios sin guardar y se bloquea durante una operación.
- RecoveryPanel muestra carga y permite reconsultar cuando el servicio no estaba
  disponible. Conserva un único botón de actualización/reintento, controles por
  propietario/participante y el cese de polling cuando la RPC falta. No simula estados.
- SafetyActions evita operaciones simultáneas antes del siguiente render, muestra
  estado de guardado y refleja el booleano confirmado por el servidor al bloquear.
- Se agregan aria-busy y estados accesibles, sin datos privados en mensajes de error.
  Los campos comunitarios móviles usan al menos 16px para evitar zoom de foco en
  iPhone y los botones/summary tienen blancos táctiles de al menos 44px.
- La franja de Prueba muestra el commit corto incorporado por build:rc/presentation.
  Permite cotejar la versión visible en iPhone con presentation-manifest.json.
- El registro de SW usa updateViaCache=none. No fuerza recargas ni borra borradores,
  sesiones u outbox: el SW conserva sólo offline.html y usa red para navegación.
- Nuevas regresiones de navegador comprueban transición RPC ausente→instalada para
  perfil y recuperación, sin logout, escrituras directas de perfil ni PATCH de estado.
- Config WebKit separada para comprobar Safari sin sustituirlo silenciosamente por
  Chromium cuando falte el navegador.

Archivos: ProfileSettings.tsx, RecoveryPanel.tsx, SafetyActions.tsx,
PresentationNotice.tsx, main.tsx, index.css, vite-env.d.ts, vite.config.ts,
scripts/build-presentation.mjs, tests/presentation-browser.mjs, tests/e2e/v1-school-compatibility.spec.ts,
playwright.webkit.config.ts y el alias correspondiente de package.json; este informe.
No se modifican SQL/RLS, clientes de producción ni la config Hosting de producción.

## iPhone/PWA: límites de validación

Las pruebas mobile habituales usan viewport/dispositivo iPhone 13 con Chromium.
Eso verifica tamaño, interacción y layout, **NO equivale a Safari real**. Se intentó
instalar WebKit 26.0 de Playwright, pero la red negó sus descargas con 403 Domain
forbidden. No se marca WebKit ni un iPhone físico como aprobados.

En un entorno con esas descargas permitidas:

```sh
npx playwright install webkit
npm run test:e2e:webkit
```

La configuración nueva usa WebKit real de Playwright y las mismas APIs simuladas;
no prueba servicios reales de Supabase ni reemplaza aceptación física de PWA.

## Artefacto y separación de destinos

build:rc/presentation ignora las VITE_* ambientales de producción y construye con:
BUSCAG_STAGING_PUBLISHABLE_KEY, URL de Supabase Prueba y origen buscag-prueba.web.app.
La clave es pública y se incorpora al cliente; nunca se incorporan URI PostgreSQL,
service_role o secretos de worker/VAPID. La franja del build no es autorización para
publicar. El manifest fija SHA de código, proyecto, origen y hashes de archivos.

firebase.presentation.json fija site=buscag-prueba, public=dist-presentation y CSP con
connect-src sólo al Supabase de Prueba (además de recursos públicos previstos).
El proyecto Firebase compartido se llama buscag-2677c, pero el site destino de este
config es buscag-prueba. No usar firebase.json genérico/dist/default para esta entrega.
No clonar d14560 directamente a producción ni publicar HEAD en el sitio estable.

## Preparación y publicación futura

Tras el commit final, con Alexis limpio y la clave pública de Prueba en el entorno:

```powershell
npm.cmd run build:rc
npm.cmd run verify:rc
```

Debe indicar project_ref=yiarlhpbgkofhhipkfha, app_origin=https://buscag-prueba.web.app,
commit del checkout y todos los hashes correctos. El build no despliega. Conservar
el directorio completo; no editar dist-presentation después de verificar.

**Sólo después de autorización explícita para publicar esta candidata en Prueba**:

```powershell
firebase deploy --only hosting --project buscag-2677c --config firebase.presentation.json
```

No ejecutado. El comando es sólo Hosting del site explícito de ese config, no el
Hosting de producción ni Functions/Storage/Firestore/Supabase. Registrar la nueva
release y conservar referencia de la release previa de PRUEBA para rollback Hosting.
No ejecutar rollback de DB ni volver a aplicar las migraciones.

## Aceptación real posterior en iPhone y dos cuentas de prueba

1. Leer https://buscag-prueba.web.app/presentation-manifest.json y cotejar commit/ref/
   origen con el artefacto local. Revisar que las llamadas de datos vayan únicamente
   a yiarlhpbgkofhhipkfha.supabase.co. La versión visible debe coincidir con ese SHA.
2. Recargar la página o cerrar/reabrir Safari y la PWA. Una app abierta puede seguir
   ejecutando JS anterior. No borrar datos de Safari por defecto: puede perder borradores
   y mensajes pendientes. Si cambió la sesión aislada del build, volver a iniciar sesión.
3. A crea publicación activa. B inicia conversación REAL en ese objeto. A solicita
   confirmación a B. Ver pendiente, rechazo durable y una nueva aceptación válida;
   C no puede decidir. Recargar y reintentar no duplica evidencias/notificaciones.
   Sólo se recupera la publicación de la solicitud, no automáticamente otra de B.
4. Probar declaración individual explícita sin atribuir contraparte ni reputación
   bilateral. El historial recuperado anterior no implica una nueva entrega confirmada.
5. Tras bilateral confirmada, ambos participantes pueden valorar al otro una vez.
   Antes de eso no tiene que aparecer una valoración como si fuera válida.
6. B sigue objeto ajeno y elige avisos; verificar persistencia y aviso de cambio de
   estado. Notificaciones de seguimiento y de recuperación son tipos distintos;
   reintentos no deben duplicar el mismo evento, pero pueden existir avisos distintos.
7. Denunciar con un motivo real de prueba, revisar el listado propio y su privacidad.
   Bloquear A/B, comprobar rechazo de mensajes nuevos en ambos sentidos y ocultación
   del teléfono, manteniendo la conversación histórica.
8. Teléfono privado por defecto; consentimiento explícito y reciprocidad de mensajes
   antes de mostrarlo al otro usuario. Validar el enlace sin hacer llamadas/SMS reales.
9. Probar pantalla angosta, teclado, scroll completo del detalle, selects, botones y
   recuperación al volver del segundo plano. Verificar PWA instalada y Safari normal.

Los cambios de base ya confirmados no activan push/worker/scheduler. Esas operaciones
requieren su propia configuración y prueba; no se anuncian como disponibles sin ella.

## Estado de entrega

Interfaz de las seis funciones: implementada previamente y revalidada; mejoras de
recarga, estados, confirmación y diagnóstico de versión implementadas aquí. Backend
community: confirmado por el operador. Lecturas anónimas protegidas: verificadas por GET.
Frontend servido y sesiones reales autenticadas: pendientes. Safari/WebKit: bloqueado
por red en este entorno; iPhone físico pendiente.

Candidata local puede prepararse para un despliegue CONTROLADO de Prueba; no se declara
la incidencia remota resuelta ni producción lista. Falta autorización de publicación y
aceptación real posterior. Los resultados de QA y del artefacto se informan al cerrar
la entrega; el script verify:rc no sustituye aceptación ni autoriza despliegues.

## Resultados locales de esta entrega

- `npm run qa:local`: código 0, sus 17 etapas aprobadas. Incluye TypeScript,
  build, suites de frontend/backend, herramientas TLS/staging, seguridad del cliente,
  navegador, PWA y presentación. No se ejecutó SQL remoto.
- `npm test`: 145 pruebas aprobadas, cero fallos.
- `test:e2e`: 94 pruebas aprobadas en Chromium desktop/mobile con RPC simuladas.
- Regresiones finales de disponibilidad: 4/4 aprobadas sobre un nuevo build local,
  incluyendo tamaño de fuente y botón táctil en viewport móvil.
- PWA: fallback offline y ausencia de caché de callback/datos privados aprobados.
- Presentación desktop/mobile: CSP, destino exclusivo de Prueba, franja con SHA y
  sesiones aisladas aprobados con backend simulado.
- Seguridad cliente: 18 comprobaciones aprobadas. Las pruebas SQL existentes de
  recuperación y comunidad pasaron en bases sintéticas locales; no equivalen a
  usuarios reales del proyecto ni a una réplica de su catálogo completo.
- WebKit: descarga bloqueada por política de red (403); no ejecutado. Safari físico
  y operaciones autenticadas reales siguen pendientes de aceptación.

`build:rc` y `verify:rc` deben realizarse con el commit limpio de esta entrega; sus
resultados y el SHA del artefacto se comunican al finalizar. Los outputs son ignorados
por Git, no se suben datos de usuarios ni credenciales. Esta preparación no publica.
