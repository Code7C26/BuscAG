# Ajustes visuales de recuperación, comunidad y chat

Rama Alexis. Sin cambios de RPC, SQL, migraciones, RLS o datos. Sin despliegue.

## Cambios

- Recuperación: separación vertical entre estado, historial y formularios; etiquetas
  encima del selector/textarea; tarjetas de historial con padding y separación propia.
- «Valorar devolución» pasa a «Confirmar valoración», sin cambiar su operación.
- Botones de recuperación y mensajes fallidos: mínimo 44px de alto, texto adaptable,
  ancho completo en móvil, foco visible y colores existentes de BuscAG.
- Chat: mensaje, estado de error y acciones separados; acciones con gap y apiladas
  en móvil. La bandeja de pendientes también separa contenido, estado y descarte.
- Comunidad: separación en formularios de denuncias, listas de bloqueos,
  valoraciones y acciones de moderación; checkbox sin comprimir junto a textos largos.
- Configuración/perfil público explican dónde se comparte el teléfono.

Archivos: `src/components/RecoveryPanel.tsx`, `ContactModal.tsx`, `MessagesView.tsx`,
`ProfileSettings.tsx`, `PublicProfileModal.tsx`, `src/index.css`,
`tests/e2e/community.spec.ts`, `tests/e2e/experience.spec.ts` y este informe.

## Teléfono: resultado de la revisión

**Ausencia en el perfil público: comportamiento esperado.** PublicProfileModal
omite el teléfono deliberadamente y los modelos del listado se limpian de contacto.
El acceso previsto es el icono de llamada de ContactModal (dentro del chat).

El SQL existente de `can_share_contact` exige, para ver el número de otra persona:

1. Sesión autenticada.
2. Consentimiento GUARDADO del titular del número (`phone_shared`). No hace falta
   que el observador comparta también su propio número.
3. Ausencia de bloqueos en ambos sentidos.
4. Al menos un mensaje enviado por cada participante en **la misma publicación**.
   Un borrador, envío fallido o mensajes en publicaciones diferentes no sirven.

Luego el cliente consulta `public_profiles.phone`; sólo muestra la opción de llamada
si la autorización es verdadera y el número devuelto no está vacío. Reconsulta cada
cinco segundos mientras el chat está abierto. Ante error o permiso denegado, oculta
el número: no elude el servidor ni recurre a datos antiguos del cliente.

No se cambiaron estas condiciones. Las pruebas simuladas verifican que no aparece
el botón con autorización falsa aun habiendo un número en memoria, y sí aparece con
la autorización positiva. No se accedió a sesiones reales ni se verificaron los dos
usuarios del operador. Si falta también dentro del chat cumpliendo las condiciones,
revisar en esa sesión las respuestas de `can_share_contact` y de la lectura de
`public_profiles` (sin publicar tokens/números); el síntoma del perfil solo no
constituye un fallo de privacidad ni justifica ampliar permisos.

## Verificación

- `npm test`: 145 aprobadas.
- `npm run lint`: TypeScript aprobado.
- `npm run build` y `npm run build:staging`: aprobados, sin publicación.
- `node tests/client-security.mjs`: 18 comprobaciones aprobadas.
- Comunidad, recuperación y experiencia: 30 pruebas Chromium desktop/mobile
  aprobadas con backend simulado. Incluyen medidas de separación y altura táctil,
  reintento de mensaje sin duplicado, aceptación/rechazo y acceso al teléfono.
- Regresión final con los últimos estilos: 10/10 pruebas adicionales aprobadas
  sobre un build nuevo de escritorio/móvil.
- Revisión visual local de recuperación a 390×844 con datos sintéticos; no equivale
  a una prueba de Safari o un iPhone físico. El operador confirmó previamente los
  flujos reales en Prueba; esta entrega cambia presentación, no sus reglas.

No se repiten migraciones ni pruebas SQL porque no se modificó backend. Falta
revisar estos ajustes en el iPhone después de un futuro despliegue autorizado.
