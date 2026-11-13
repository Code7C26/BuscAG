# BuscAG: interfaz bilingüe y presentación con cuentas de prueba

Prioridad vigente del 13/11/2026. Trabajo local exclusivo en Alexis. La presentación
usa las cuentas de prueba existentes. No se necesita una migración de invitados.

## Integración conservada

- Catálogo central español/inglés con i18next; español predeterminado, preferencia
  persistente, idioma del documento y fechas relativas/locales coherentes.
- Traducción de autenticación, publicaciones y edición, mapa, filtros, coincidencias,
  conversaciones, notificaciones, perfil, recuperación y herramientas comunitarias.
  Los valores de categorías enviados al backend y el contenido del usuario se conservan.
- Navegación inferior de siete destinos con indicador móvil, historial del navegador,
  contadores y secciones conservadas para no reconstruir mapas ni perder filtros.
- Identidad azul, formularios, modales, estados vacíos, errores, foco visible y
  distribución adaptable; módulos pesados cargados a demanda.

Estas mejoras estaban desarrolladas en el árbol de trabajo antes del cambio de
prioridades y se aprovecharon en lugar de reemplazar componentes funcionales.

## Cambios del cierre actual

- Desconectado GuestApp del punto de entrada y retirado el botón y la propiedad
  onExplore del acceso. No hay opción de navegación invitada en la interfaz.
- Ayuda de acceso actualizada: hace falta iniciar sesión; se conservan registro,
  recuperación y el flujo QR existente.
- Código, diagnósticos y propuesta SQL de invitados conservados como material
  pospuesto fuera del árbol de la aplicación, sin aplicación. El build habitual no depende de validar fotos invitadas.
- Preferencia de idioma sincronizada entre pestañas sin remontar formularios.
- Título y descripción del documento traducidos. Respaldo sin conexión en ambos
  idiomas según la preferencia local, con español como alternativa. La caché PWA
  contiene exclusivamente offline.html y su script público offline.js, sin datos
  de cuentas ni respuestas privadas. La versión de caché se actualiza para retirar
  el respaldo anterior.
- Colores de instalación y pantalla sin conexión alineados con la identidad azul.
- El botón flotante de ayuda se oculta durante los modales; el fondo no se desplaza.
  Los movimientos programáticos del mapa respetan movimiento reducido.
- Contadores de navegación descritos para lectores de pantalla; foco contenido
  dentro del botón y estado activo distinguible también en colores forzados.
- Entradas de modales de 180 ms con transform/opacity y respeto de movimiento
  reducido. Superficies opacas en móvil evitan desenfoques repetidos de navegación,
  cabecera y etiquetas de tarjetas.
- Unificada la terminología de coincidencias en español y corregido el singular
  del contador de resultados.
- Pruebas de invitados sustituidas por comprobaciones de acceso autenticado,
  persistencia del idioma, sincronización, conservación de borradores y 320 px.

## Alcance de la validación

Las pruebas de interfaz usan backend, imágenes, GPS y comunicaciones simulados.
No prueban la disponibilidad del Supabase real, la entrega de correo o push, las
políticas reales de Storage ni las cuentas existentes. No se ejecuta SQL remoto.
No se modificaron funciones QR, permisos o configuraciones del servidor.

Antes de publicar se necesita un ensayo con las cuentas existentes en staging,
incluyendo publicación/edición con imagen, mapa/filtros, coincidencias, conversación
entre dos cuentas, lectura de notificaciones y perfil en ambos idiomas. Correo,
push y disponibilidad de módulos opcionales requieren comprobación real separada.
También conviene revisar la experiencia en un teléfono físico de bajos recursos:
la simulación de CPU lenta no equivale a ese dispositivo.

Push y despliegue siguen sujetos a autorización del titular.

## Resultados locales previos a preparar el commit

- `npm test`: 169 pruebas aprobadas, sin fallos.
- `npm run lint`: TypeScript aprobado.
- `npm run build`: build de producción aprobado.
- `node tests/client-security.mjs`: 18 comprobaciones aprobadas.
- `npm run test:e2e`: 106 pruebas aprobadas en Chromium, escritorio y móvil;
  incluyen WCAG, 320 px, navegación, imágenes, edición, filtros, mapa, coincidencias,
  mensajes, notificaciones, perfiles y herramientas comunitarias. La prueba móvil
  de navegación e idioma aplica ralentización de CPU de 4x.
- `npm run test:pwa-browser`: respaldo real de producción sin conexión en español
  e inglés y verificación de que no se cachean callbacks ni datos privados.
- `node --test tests/service-worker.test.mjs`: 4 pruebas aprobadas, incluida la
  exclusión de APIs, orígenes externos y variantes con parámetros del script público.
- `git diff --check`: aprobado.

Los resultados funcionales no sustituyen el ensayo real de staging descrito arriba.
La preparación posterior del commit se documenta en `FIREBASE_QR_STATIC_REVIEW.md`; el ensayo real está en `PRESENTATION_STAGING_CHECKLIST.md`. No se realizó push ni despliegue.
- Repetición final de `tests/e2e/ux-i18n.spec.ts`: 10 pruebas aprobadas tras la
  traducción del título del documento, en escritorio y móvil.
