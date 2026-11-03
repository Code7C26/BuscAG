# BuscAG: preparación autónoma para producción

Base: Alexis, con PR #23 y #24 fusionados (1ec807d). Rama de revisión derivada;
ningún cambio se aplica al backend o al hosting por preparar/compilar este código.
Las funcionalidades del PR #24 se conservan y sus regresiones siguen en la suite.

## Implementado y comprobable localmente

| Área | Cambio | Evidencia |
| --- | --- | --- |
| Supabase | Diagnóstico único SELECT a catálogos y plan condicionado al esquema real | production_diagnostic.sql probado sin tablas/historial y con el fixture PostgreSQL |
| Cuenta | Recuperar contraseña, reenviar confirmación, establecer contraseña y cambio desde perfil | DOM/API simulada: redirects, validación, errores, éxito, duplicados y evento PASSWORD_RECOVERY |
| Sesión | No usar un query param como autorización de recuperación; limpiar tokens/códigos del URL después del evento SDK; conservar sesiones actuales seguras | Regresiones de cuenta, callback, StrictMode y respuestas tardías |
| Privacidad | Logout revoca suscripción del navegador y cierra avisos sin borrar registros de la base; si falla, cierra sesión y muestra advertencia genérica | Desconexión simulada, fallo, cambio de cuenta durante la espera y cero DELETE de datos |
| Datos | Lecturas paginadas estables, siguiendo el tamaño real devuelto aunque el servidor tenga max_rows menor; perfiles por lotes de propietarios | Tests de páginas pequeñas, falta de count, errores y cancelación; fallback sin privados |
| Realtime | Cola serial que agrupa recursos, evita respuestas fuera de orden y no vuelve a leer todo por renovar un token | Pruebas de concurrencia, reintento y renovación; actualizaciones de items/messages/notices separadas |
| Estado | Modales derivados por ID de los datos actuales; un resultado viejo de push no deshace un toggle nuevo | Regresiones de UI y cuenta |
| Publicaciones | Edición de contenido por propietario, sin cambiar ID/owner/count; imagen idéntica no se vuelve a subir | Pruebas del payload/filtros y formulario con datos existentes |
| Fotos | No publicar una foto de muestra por defecto; selección explícita o archivo, teclado y drag/drop con validación | Foto requerida sólo para nuevas publicaciones; éxito limpia selección; archivo inválido rechazado |
| Recuperación de objeto | Celebración sólo después del éxito confirmado, sin modificar la semántica de recuperación anterior | Prueba de respuesta negativa/positiva |
| Mensajes | Nuevos mensajes del hilo abierto reciben marcado de lectura sin vaciar el borrador | Prueba DOM con recepción mientras el chat está abierto |
| Mapa/matches | Un mismo radio cercano; cache de palabras sin retener cuentas; una sugerencia sólo geográfica no recibe confianza alta | Se mantienen sugerencias y umbrales; pruebas de textos modificados y reglas previas |
| Accesibilidad | Labels asociados, tarjetas/avisos por teclado, semántica de diálogos, foco y Escape | Regresiones DOM; sin rediseñar CSS |
| Errores | ErrorBoundary recuperable, códigos de error redactados, callbacks sin texto arbitrario | Pruebas de render y URL; sin logs de payloads, teléfonos o tokens |
| Build | Validación de origen HTTPS/configuración, rechazo de claves secretas, carga diferida y vendor SDK separado | TypeScript, build, tests de variables; no se usa un service_role en el navegador |
| Dependencias | Retirar Express/GenAI/dotenv/motion sin referencias; herramientas de build a devDependencies; Vite/source-map parcheados y locks coherentes | Instalación limpia, npm audit; lock Bun migrado y validado en modo frozen |
| Push backend | ID recibido se resuelve en DB; esquema webhook público; payload limitado; allowlist HTTPS de proveedores; 4 envíos concurrentes y timeout | Tests del handler y Deno check, sin ejecutar envíos reales |
| Worker | JSON defensivo, enlaces de aviso del usuario visible y navegación sólo mismo origen | Pruebas de payload/click; deep link autenticado en DOM |
| Firebase | Preparar nosniff/referrer-policy y cache diferenciada para assets con hash vs HTML/worker | Config JSON validada; NO desplegada |

Los links/botones nuevos son acciones funcionales, usando las clases y estructuras
existentes. No se editó src/index.css ni se cambiaron colores, tipografías o diseño.
El selector conserva fotos de muestra como opción explícita y los registros antiguos,
incluso los sin foto o dueño: no se convierten ni eliminan automáticamente.

## Archivos principales

- `lib/authFlow.ts`, `environment.ts`, `readAll.ts`, `reportError.ts`, `database.ts`,
  `push.ts`, `supabase.ts`.
- `src/App.tsx`, `main.tsx`, componentes AuthView/ProfileView/PublishModal/
  ItemDetailModal/ContactModal/MapView/MatchComparisonModal/ItemCard/NotificationsView/
  FaqChat/AppErrorBoundary y utilidades de cola, foco, geografía y coincidencias.
- `supabase/audit/production_diagnostic.sql`, `SUPABASE_MIGRATION_PLAN.md`.
- `supabase/functions/send-push/{index.ts,handler.ts,deno.json,deno.lock}`.
- Configuración de Vite/Firebase, manifests/locks de npm/Bun y pruebas.
- Las cuatro migraciones de seguridad anteriores NO se alteraron ni se ejecutaron en
  Supabase. SECURITY_ROLLOUT.md y PRODUCTION_STAGE_1.md son registros de etapas previas.

## Reproducir verificaciones

Desde src/code, con variables públicas correctas para compilar (nunca service_role):

```sh
npm ci
npm run lint
npm test
node tests/client-security.mjs
npm run build
npm audit
```

La suite SQL en memoria se reproduce con el comando PGlite de SECURITY_ROLLOUT.md.
No usa la URL real ni credenciales y no debe sustituirse por una conexión de producción.
Para tipos de Edge Function, con Deno instalado:

```sh
deno check --config supabase/functions/send-push/deno.json supabase/functions/send-push/index.ts
```

Las pruebas backend usan dependencias inyectadas y no transmiten push ni correos. La
configuración Deno tiene lock propio, separado de npm. La auditoría npm de un árbol
externo de los dos paquetes fijados se comparó con todas las versiones del deno.lock;
coinciden. La auditoría nativa de Deno falló por confianza TLS de este entorno; no se
desactivó TLS ni se declara esa herramienta como aprobada.

## Pendiente o bloqueado: no afirmar producción lista

| Pendiente | Por qué no se ejecuta o decide automáticamente | Siguiente evidencia/acción |
| --- | --- | --- |
| Aplicar RLS/grants/vista/push table | Esquema real diferente y sin historial, según titular | Ejecutar manualmente el diagnóstico y seguir SUPABASE_MIGRATION_PLAN.md tras respaldo/restauración y aprobación |
| Correos y confirmación real | SMTP, Site URL, Redirect URLs y políticas de Auth son externos | Probar URL pública exacta, recuperación, confirmación, vencimiento y reenvío con buzones reales en staging |
| Entrega push real | Falta tabla, función/secretos/webhook y configuración del proyecto | Verificar SDK/lock en el runtime de Supabase, proveedores reales, VAPID, payload con schema public, logout y apps cerradas |
| Exactamente una entrega/mensaje | Reintento tras una respuesta perdida requiere estado/idempotencia transaccional | Proponer esquema/RPC después del diagnóstico; no deduplicar por texto de manera que borre mensajes legítimos |
| Avisos de matches para ambos dueños | La escritura actual del cliente sólo es propia; ampliar RLS sería inseguro | Diseñar proceso confiable del backend y deduplicación tras verificar tipos/triggers reales |
| Borrado/retención de conversaciones | El DELETE original puede tener cascadas; archivar es una decisión sobre datos | Aprobar política de archivo/retención; no probar borrados con publicaciones reales |
| Limpieza de imágenes huérfanas | Una subida/INSERT podría haberse confirmado aunque se pierda respuesta | Inventario y referencias verificadas; ninguna limpieza automática ni compensación destructiva |
| EXIF, calidad y fotos existentes | Cambiar imágenes existentes está expresamente fuera de autorización | Decidir privacidad/calidad; probar normalización con fotos reales y móviles antes de otro PR |
| Calibración de matches | No hay corpus etiquetado ni regla de negocio aprobada para descartar sugerencias | Mantener sugerencias; medir precisión/recall con ejemplos autorizados |
| Escala mayor | Leer todo con paginación evita truncamiento, pero no reemplaza búsqueda/geo/matches del servidor | Definir volumen objetivo y schema real para índices/RPC/paginación de interfaz |
| Firebase publicado | No se conoce URL/version desplegada; no hay autorización para deploy | Revisar artefacto/headers/redirects/caché reales y desplegar sólo tras aprobación |
| CSP, embedding y orígenes externos | Política estricta requiere inventario de fotos/mapas/custom domains/iframes | Definir orígenes y ensayar Report-Only; no introducir un bloqueo que rompa funciones existentes |
| Dispositivos/accesibilidad | DOM simulado no mide Safari, GPS, Web Push iOS, contraste o teclado virtual | Matriz física Android/iOS/escritorio, lector de pantalla y pruebas de red |
| Secretos históricos | Escaneo limitado de código/config no equivale a revisar Git/secret stores | Auditoría privada de historial y variables; rotación si se descubre una exposición real |
| Observabilidad/abuso/backups | Requiere servicios, cuotas y decisiones operativas | Alertas redactadas, rate limiting de servidor, moderación y ensayo de restauración |

No se solicitó autorización por correcciones locales. Sólo los pasos que alteran
producción, datos/retención o configuración externa requieren aprobación posterior.
Este PR no hace merge ni despliega nada. Preparación local mejorada; lanzamiento
abierto bloqueado principalmente por el estado real de Supabase y las pruebas externas.

## Resultados registrados en esta rama

- Instalación limpia: `npm ci --ignore-scripts --no-audit --no-fund`, correcta.
- TypeScript (`npm run lint`): correcto.
- `npm test`: 53 pruebas correctas (incluye las regresiones anteriores y las pruebas
  nuevas de aplicación, handler push y worker).
- `node tests/client-security.mjs`: 13 comprobaciones correctas.
- SQL en PostgreSQL efímero/PGlite: 27 comprobaciones correctas.
- Total: 93 comprobaciones locales, sin correo/push ni datos de producción.
- Deno 2.5.6 `check --frozen` con configuración/lock del handler: correcto.
- Auditoría npm del proyecto: 0 avisos conocidos. Árbol npm externo de push: 0 avisos;
  todas sus versiones se contrastaron con deno.lock sin diferencias.
- `bun pm migrate --force` (sólo reescribe el lock local desde npm, NO es un push) y
  `bun install --frozen-lockfile --lockfile-only --ignore-scripts`: correctos.
- Build positivo: correcto, sin advertencia de chunks >500 kB. Principal ~298 kB y
  SDK ~227 kB; mapas/modales en chunks separados. No confundir el principal con el
  total inicial: el SDK también se necesita para Auth. Sin mediciones Lighthouse.
- Build negativo con clave secreta sintética: rechazado, sin imprimir su valor.
- `git diff --check`: correcto. No se cambió src/index.css ni las cuatro migraciones.
- Escaneo limitado de literales privilegiados en código/configuración: sin hallazgos;
  no se inspeccionaron archivos privados de entorno ni historial de Git.

Para iOS siguen pendientes los requisitos de instalación/PWA (manifest e iconos reales)
y pruebas físicas. No se inventaron iconos ni se declara Web Push iOS terminado.
El mínimo de 8 caracteres del formulario no sustituye configurar la política de Auth
en Supabase: las llamadas directas a la API siguen sujetas a su configuración real.

## Inventario exacto de archivos del PR

- `src/code/PRODUCTION_READINESS.md`
- `src/code/README.md`
- `src/code/SUPABASE_MIGRATION_PLAN.md`
- `src/code/bun.lock`
- `src/code/firebase.json`
- `src/code/lib/authFlow.ts`
- `src/code/lib/database.ts`
- `src/code/lib/environment.ts`
- `src/code/lib/push.ts`
- `src/code/lib/readAll.ts`
- `src/code/lib/reportError.ts`
- `src/code/lib/supabase.ts`
- `src/code/package-lock.json`
- `src/code/package.json`
- `src/code/public/sw.js`
- `src/code/src/App.tsx`
- `src/code/src/components/AppErrorBoundary.tsx`
- `src/code/src/components/AuthView.tsx`
- `src/code/src/components/ContactModal.tsx`
- `src/code/src/components/FaqChat.tsx`
- `src/code/src/components/ItemCard.tsx`
- `src/code/src/components/ItemDetailModal.tsx`
- `src/code/src/components/MapView.tsx`
- `src/code/src/components/MatchComparisonModal.tsx`
- `src/code/src/components/NotificationsView.tsx`
- `src/code/src/components/ProfileView.tsx`
- `src/code/src/components/PublishModal.tsx`
- `src/code/src/main.tsx`
- `src/code/src/utils/dataReadiness.test.ts`
- `src/code/src/utils/geo.ts`
- `src/code/src/utils/matcher.test.ts`
- `src/code/src/utils/matcher.ts`
- `src/code/src/utils/pushHandler.test.ts`
- `src/code/src/utils/refreshQueue.ts`
- `src/code/src/utils/useDialogFocus.ts`
- `src/code/supabase/audit/production_diagnostic.sql`
- `src/code/supabase/functions/send-push/deno.json`
- `src/code/supabase/functions/send-push/deno.lock`
- `src/code/supabase/functions/send-push/handler.ts`
- `src/code/supabase/functions/send-push/index.ts`
- `src/code/tests/client-security.mjs`
- `src/code/tests/production.test.mjs`
- `src/code/tests/security.mjs`
- `src/code/tests/service-worker.test.mjs`
- `src/code/vite.config.ts`
