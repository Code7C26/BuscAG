# BuscAG 1.0.0-rc.1 — cierre funcional de Prueba

Esta es la candidata de **Alexis**, destinada exclusivamente a
https://buscag-prueba.web.app y Supabase Prueba yiarlhpbgkofhhipkfha.
No requiere integrar main/German, ejecutar migraciones ni modificar producción.
Este procedimiento reemplaza las instrucciones históricas de integración a main
para esta candidata. No constituye aprobación de publicación.

## Alcance que puede presentarse

El catálogo aportado por el titular identifica la etapa school. Los wrappers
administrados no impiden usar el backend existente; su conciliación deja de ser
un requisito para compilar/presentar los flujos base. Siguen bloqueando el bundle
de actualización SQL, que no se necesita para esta candidata.

| Funcionalidad | Estado para 1.0 candidata | Evidencia/límite |
| --- | --- | --- |
| Registro, confirmación, login, recuperación de contraseña y logout | Implementados; compatibles con Auth | Pruebas automáticas; GET real de Auth confirma email/registro habilitados y confirmación obligatoria. La recepción de correo y los redirects reales requieren ensayo. |
| Publicar y editar con foto | Compatibles con school | RPC y edición owner-bound probados en PostgreSQL WASM, reintentos con ID estable; upload real a Storage pendiente de ensayo. |
| Listado general, propias, búsqueda, filtros, mapa y geolocalización | Implementados y probados en navegador | No se inventan fechas/coordenadas de publicaciones históricas. Marcador rojo local empaquetado con Vite. Las APIs del navegador se simulan en QA. |
| Coincidencias disponibles | Implementadas en el cliente | Índice orientativo sobre publicaciones visibles; no confirma identidad del objeto. No requiere las dos migraciones pendientes. |
| Chat, bandeja, reintentos y recibos | Compatibles con school | SQL aislado verifica envío idempotente, lectura y exclusión de un tercero; reconexión/Realtime real requiere dos sesiones. |
| Notificaciones internas | Compatibles con school | Un envío genera un aviso al destinatario sin duplicarlo. No equivale a entrega push. |
| Perfil propio | Corregido para school | Nombre, foto y zona editables con RLS e ID propietario; no cambia teléfono, reputación ni privacidad implícitamente. Sólo usa baseline cuando falta el RPC nuevo, nunca ante 403/errores de red. |
| Estadísticas, zona de búsqueda y QR escolar | Implementados en school | Sólo muestran respuestas reales. La entrega de avisos automáticos depende de worker/activación, que no se certificó aquí. |
| Recuperación segura individual/bilateral | Pendiente de secure_recovery | No ofrece confirmaciones ni cambia estado sin el servicio. Explica la actualización pendiente y deja de repetir consultas ausentes. |
| Compartir teléfono, seguimiento, bloqueos, denuncias, moderación y valoraciones | Pendientes de community_safety | Sin botones de mutación ni falsos listados vacíos cuando el servicio está ausente. Las funciones completas se conservan y vuelven a mostrarse con su backend. |
| Push y alertas en segundo plano | No certificados para lanzamiento | No anunciar entrega automática sin VAPID/worker/scheduler/dispositivo y prueba real. Los avisos dentro de la app continúan disponibles. |

## Errores corregidos

- La configuración del perfil requería cuatro RPC de comunidad: un fallo opcional
  bloqueaba incluso editar el nombre. Ahora separa perfil de listados opcionales y
  conserva el contrato básico de school. Verifica sesión e ID antes de actualizar.
- Los controles de seguridad permanecían deshabilitados sin explicación y todavía
  ofrecían una denuncia fallida. Ahora explican disponibilidad sin simular éxito.
- Recuperación segura y consulta del teléfono repetían RPC ausentes cada cinco
  segundos. Ese caso detiene el polling; no usa UPDATE de estado como sustituto.
- El panel de recuperación podía describir una publicación recuperada como activa
  mientras no tenía contexto. Ahora distingue el estado ya registrado de una nueva
  confirmación que nunca ocurrió.

No se cambió SQL, funciones internas, datos, Auth/Storage remoto ni Firebase.
La UI no pretende reparar el acceso de clientes antiguos a recuperación: hasta
aplicar secure_recovery, la garantía bilateral tampoco existe en la API antigua.

## Validación de esta revisión

- Comprobación real, GET y limit=0: Auth accesible, signup por email habilitado,
  autoconfirm=false; profiles/items/messages/notifications/push_subscriptions
  rechazan acceso anónimo. No se leyeron filas personales ni se hicieron escrituras.
- 133 pruebas de aplicación, TypeScript, compilación Vite y 18 controles del cliente:
  correctos. Los tests se ejecutan también con node --import tsx para evitar el IPC
  innecesario del launcher en entornos restringidos.
- 11 pruebas nuevas de candidata: DOM con APIs simuladas, integridad del artefacto y
  backend aislado school con DATE/timestamptz. Cubren sesión expirada, permiso
  denegado sin fallback, perfil completo conservado y ausencia de mutaciones falsas.
- 8 pruebas de entorno release/presentación: correctas. No cambian el destino ni la
  configuración de producción.
- QA integral: **17 etapas correctas**, incluidos 90 E2E en escritorio/móvil,
  PWA en modo compilado y presentación compilada en ambos tamaños. Incluye los
  seis casos nuevos de school. El bloqueo transitorio de aprobación del entorno
  se levantó y el reintento autorizado pasó; el navegador ya no queda pendiente.
- Matriz de seguridad WASM: DATE/timestamptz y esquema histórico observado, además
  de instalación, activación, recuperación y comunidad en bases descartables.
  Las mejoras pendientes se instalan únicamente dentro de esos fixtures de prueba.

Resumen verificable: [V1_RC_VALIDATION.json](V1_RC_VALIDATION.json). El código probado
es cc12f86; el commit de cierre posterior sólo actualiza este informe y su resumen.

Pendiente obligatorio de aceptación: ensayo real de correo, upload, chat/Realtime
y notificaciones entre dos cuentas dedicadas, sin borrar publicaciones existentes.
No se puede certificar 1.0 estable ni publicación sólo con tests simulados.

## Artefacto y publicación exacta

Desde src/code en Windows, conservando la clave **publicable de Prueba** en
BUSCAG_STAGING_PUBLISHABLE_KEY (no necesita contraseña SQL ni service_role):

```powershell
git branch --show-current
git status --short
npm.cmd ci
npm.cmd run qa:local
npm.cmd run check:staging-public
npm.cmd run build:rc
npm.cmd run verify:rc
```

La rama debe ser Alexis y status debe estar vacío. qa:local incorpora test:v1 y
debe terminar sin fallos, incluidos E2E/PWA/presentación. Si el fallo es de entorno,
resolverlo o ejecutar esos checks en Windows; no omitirlos para declarar verde.

build:rc usa el launcher existente de presentación, exige checkout limpio y Alexis,
descarta variables ambientales de producción/secretos y genera **dist-presentation**.
presentation-manifest.json identifica versión, commit, destino y SHA-256 de todos
los archivos. verify:rc rechaza alteraciones, archivos adicionales, enlaces,
destino incorrecto o commit distinto. No usar dist, dist-staging,
dist-presentation-test ni claves ficticias de QA para publicar esta candidata.

Conservar el directorio completo y su manifiesto fuera de Git. El build no autoriza
despliegue. Tras QA y autorización explícita, verificar en Firebase Console que el
proyecto del site buscag-prueba sea el configurado. La configuración separada fija
ese site; no cambiarla por firebase.json ni confiar en el alias default.

Sólo para un operador con la publicación de **Prueba** autorizada y validada:

```powershell
firebase deploy --only hosting --project buscag-2677c --config firebase.presentation.json
```

El identificador del proyecto es el ya documentado por el repositorio; confirmar su
asociación con el site antes de ejecutarlo. No ejecutar si difiere. Ese comando usa
únicamente el hosting/site buscag-prueba de la configuración indicada. No ejecutar
deploy genérico, merge a main, Functions/Firestore/Storage ni ninguna migración.
Esta entrega no ejecuta dicho comando ni modifica un proyecto de producción.

Antes de publicar, guardar el release anterior de ese site para rollback. Después,
comparar el manifiesto servido con el local, comprobar recarga, mapas/fotos y dos
sesiones; recargar pestañas antiguas. Ante fallo, restaurar ese release Hosting
compatible; no restaurar dumps ni ampliar RLS como reversión de frontend.

## Materiales del proyecto

Presentar login con cuenta confirmada, publicación real con foto, búsqueda/filtros,
mapa, coincidencias orientativas, chat con otra cuenta, avisos internos y perfil.
No anunciar recuperación bilateral, moderación, reputación ni push como activados.
No usar datos ficticios sin rotularlos ni mostrar como entregada una alerta que sólo
está calculada localmente. Las migraciones pendientes quedan fuera del cierre de la
candidata y de las promesas de la presentación.
