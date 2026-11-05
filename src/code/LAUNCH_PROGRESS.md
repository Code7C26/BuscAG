# Avances de lanzamiento: Auth, rediseño y QA automatizado

Rama de trabajo: Alexis. Sin despliegues, cambios remotos de SQL ni borrado de datos.
La autorización nueva del usuario permite rediseñar; AGENTS.md refleja esa decisión.

## Implementado

- Sistema visual verde profundo, papel claro y acento cálido. Nueva entrada de Auth
  con historia de producto, portada comunitaria, jerarquía, tarjetas, navegación
  flotante, formularios/modal, perfil y mapa consistentes. Safe areas, tamaños de
  entrada que evitan zoom en iOS, movimiento reducido, foco visible y avatares/fotos
  fallidas con reemplazo accesible. No hay dependencia de fuentes remotas.
- Leaflet CSS empaquetado localmente: se retira la dependencia de un CDN en index.
- Registro, reenvío y recuperación ya no prometen entrega de correo por una respuesta
  200. El reenvío explica que una cuenta ya confirmada debe iniciar sesión. Bloqueo
  local de 60 s tras éxito para la misma operación/email; no sustituye cuotas GoTrue.
- Redirect explícito para los tres flujos de correo; se rechaza configuración de otro
  origen en vez de enviar un enlace a otra aplicación. Login y cambio de contraseña
  no dependen de una redirección de correo. Tokens callback siguen limpiándose tras
  consumirlos por SDK. No se consulta estado de cuentas ajenas ni se enumera email.
- Playwright con Chromium real, Supabase HTTP y WebSocket simulados y fixtures
  sintéticos. Capturas desktop/móvil, login, registro, reenvío, recuperación,
  navegación, mapa, publicación y subida simulada vía Storage/RPC, chat entre dos
  contextos aislados, notificaciones y recibos de lectura simulados. Pruebas de axe
  WCAG de Auth y viewport sin overflow. El proyecto mobile emula iPhone en Chromium;
  **no es una prueba de Safari/iPhone físico**.
- Manifiesto PWA, iconos 192/512, metadatos y fallback sin conexión. Worker intercepta
  sólo navegación de mismo origen; guarda **únicamente offline.html**, nunca API,
  publicaciones, imágenes, conversaciones, documentos privados o URLs callback.
  La sesión Auth local del SDK conserva su comportamiento y se elimina al salir.
  Una prueba adicional en Chromium verifica el worker de un build de producción con
  clave ficticia, fallback offline y ausencia de URLs callback en caché. No se ofrece
  edición ni chat offline. Registro del worker automático sólo en build.
- Configuración inicial Capacitor JSON con webDir dist, sin servidor remoto ni HTTP
  inseguro. Es un scaffold, no un proyecto Android/iOS compilado.

## Un comando de QA y CI

Windows PowerShell usa npm.cmd para evitar el bloqueo npm.ps1, sin cambiar políticas:

```
npm.cmd ci
npm.cmd run qa:browser:install
npm.cmd run qa:local
```

La instalación de Chromium se hace una vez por versión. En este entorno se usó
Chromium del sistema. QA instala ninguna migración remota: tests de aplicación,
TypeScript, guardas staging, matriz PostgreSQL WASM descartable, build, Playwright y
privacidad. Genera test-results/local-qa-summary.json, capturas y reporte HTML sin
trazas/HAR ni vídeo. Todos los usuarios, claves y fotos del E2E son ficticios.

.github/workflows/qa.yml ejecuta esa batería al hacer push a Alexis, sin secretos,
con permisos de lectura y artefactos de siete días. Su resultado remoto debe revisarse
en Actions; el resultado local no demuestra que GitHub Actions ya haya terminado.
**Los builds de QA usan claves ficticias y no son artefactos de despliegue.**

Para comprobar staging real se conserva dev:staging, con clave publicable local y
GET de preflight. Esta ejecución no tiene esa clave ni una sesión Auth autorizada:
no se automatizaron escrituras contra staging ni se tocó la mochila de prueba.

## Investigación de confirmación y reenvío

Hechos reportados por el operador: primer email recibido, destino localhost erróneo,
configuración de Site URL/Redirect URLs corregida, POST /resend 200 sin nuevo correo,
cuenta posteriormente confirmada y login correcto. Esto demuestra que la cuenta quedó
confirmada; no demuestra que el segundo correo se haya generado, aceptado por SMTP
ni entregado al buzón. El primer enlace puede haber confirmado la cuenta **antes** de
redirigir al destino incorrecto. Es una explicación compatible, no una causa probada.

Verificar en staging, sin secretos en informes:

1. Site URL y ambas Redirect URLs exactas de STAGING_FRONTEND_TESTS.md. Usar siempre
   127.0.0.1:3001, no alternar localhost. Los correos viejos conservan su enlace viejo.
2. Revisar las plantillas de confirmación/recovery: deben usar el enlace completo
   `{{ .ConfirmationURL }}`, no un enlace manual fijo a localhost o sólo SiteURL.
   El cliente envía emailRedirectTo/redirectTo, pero GoTrue puede usar Site URL si
   el redirect no está autorizado. El navegador no puede inspeccionar ese allowlist.
3. Correlacionar hora de signup, confirmación y resend en Auth logs con logs de envío
   SMTP/proveedor, límites, supresión, bounce y spam. No compartir tokens/URI/email
   completo. Una cuenta ya confirmada no sirve para demostrar reenvío de confirmación.
4. Para certificar entrega, usar una cuenta ficticia nueva no confirmada con buzón de
   prueba, observar llegada real y abrir el enlace una sola vez. También comprobar
   enlace vencido/reutilizado y recuperación. No desactivar confirmación para que un
   test pase. La batería simulada no puede acreditar entrega real ni resolver SMTP.

Fuentes oficiales de referencia:
- https://supabase.com/docs/reference/javascript/auth-signup
- https://supabase.com/docs/reference/javascript/auth-resend
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/auth-email-templates

## Límites y bloqueos concretos

- Auth/Storage/Realtime/email reales no se vuelven a declarar aprobados: signup/login
  y una publicación fueron reportados por el operador; pruebas nuevas aquí simuladas.
  Chat entre dos cuentas reales, reintentos reales y entrega del correo siguen pendientes.
- Matching de staging sigue disabled según verify del operador. Falta worker desplegado,
  secreto propio, scheduler, heartbeat y cutover drenado. No se activó automáticamente.
- Push requiere VAPID, webhook, Edge Function y pruebas de navegador/dispositivo. No
  hay credenciales, webhook ni entrega real verificada. Avisos internos son aparte.
- PWA: verificar instalación y ciclo offline en Hosting de staging/dispositivo físico;
  Safari tiene diferencias. No almacenar privados offline fue una decisión explícita.
- Android/iOS: faltan dependencias/plataformas Capacitor, identificador final, Android
  Studio/Xcode, firma, permisos, bridge de Auth/deep links y almacenamiento de sesión.
  El guard de origen para correos necesita adaptación revisada antes de WebView. No
  hay APK/IPA ni aprobación de tiendas; no empaquetar el build con claves ficticias.
- Seguridad productiva: las políticas/RPC de producción siguen sin modificarse. Mantener
  plan de activación y respaldo fresco probado; no usar el bootstrap de staging allí.
  Persisten decisiones de retención CASCADE y moderación/reporte de abuso antes del
  lanzamiento. No se cambian por motivos estéticos ni se borran datos existentes.
- Rendimiento: Leaflet local y chunks lazy conservados; la carga paginada actual sigue
  recorriendo todas las publicaciones. Requiere paginación visible/consulta geográfica
  para volúmenes grandes y medición en móviles lentos. No hay benchmark de usuarios reales.
- Monitoreo: errores de consola sanitizados; falta destino de observabilidad y alertas
  operativas con política de privacidad. No se enviaron datos a un servicio externo.

No hace falta repetir comandos manuales después de cada commit: CI toma la regresión
local. Lo que requiere servicios/buzones/dispositivos reales necesita acceso staging
seguro o una prueba de aceptación final; no se reemplaza por fixtures que den verde.


## Resultados locales de la revisión

- Aplicación/herramientas: 109/109; aislamiento frontend staging: 5/5.
- Playwright: 16/16 (8 escenarios repetidos en escritorio/móvil emulado), backend
  simulado. Incluye axe sin violaciones serias/críticas en Auth e inicio; no auditoría completa.
- PWA: 1/1 en navegador y build de producción ficticio, offline sin privados en caché.
- Cliente/privacidad: 16/16. TypeScript y build correctos.
- PostgreSQL WASM: 58/58 DATE repositorio, 58/58 timestamptz y 61/61 estructura
  observada DATE, más 1/1 instalación completa. Datos descartables, no staging remoto.
- Deno check --frozen: ambas Edge Functions correctas; npm audit: cero hallazgos.
- Lockfiles npm/Bun actualizados para Playwright/axe; dependencias sólo de desarrollo.

El bundle principal medido en build local es ~311 kB (94 kB gzip), Leaflet ~150 kB
separado/lazy. CSS ~74 kB (18 kB gzip), ahora incluyendo Leaflet que antes venía de
CDN. No es una medición de carga de producción ni de hardware móvil real.

- PostgreSQL 17 nativo: 61/61 DATE, 61/61 timestamptz, 64/64 esquema observado,
  más orden completo correcto. Restauración nativa de 14 tablas sintéticas: 1/1.
- Instalador staging local: 4/4; TLS local con CA ficticia: 3/3; build staging correcto.
- La auditoría del inicio detectó contraste insuficiente en textos secundarios y un
  control interactivo anidado en la tarjeta. Se corrigieron los colores y se dejó
  una única acción de tarjeta accesible por teclado, conservando el enlace visual.

- Se corrigió un overflow de perfil móvil: un reset global `font: inherit` anulaba
  tamaños de Tailwind y expandía la página, impidiendo tocar la navegación fija.
  Se preserva sólo font-family, se permite ajustar las pestañas y se comprueba ancho
  real del documento, incluyendo 320 px, sin forzar clics en Playwright.
