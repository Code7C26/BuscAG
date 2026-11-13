# BuscAG V2 — revisión y entrega

## Alcance

Versión audiovisual nueva de 60 segundos, sin narración. La V1 se conserva.
Los cambios están limitados a `trailer/`. No se modifican código de aplicación,
Supabase, Firebase, permisos, migraciones ni servicios remotos.

## Cambios

- `v2/TrailerV2.tsx`, `index.ts`, `timeline.mjs`: composición independiente de
  30 planos, tipografía grande, planos ampliados, perspectiva, parallax, tarjetas,
  mapa en movimiento, comparador, chat, confirmación y cierre de marca.
- `v2/audio.mjs`: música electrónica original a 120 BPM, percusión y bajo;
  subida, silencio de medio segundo, lead nuevo y drop en 32 s. Sin muestras ni voz.
- `v2/capture.ts`, `realtime.mjs`: captura de siete recorridos del cliente real
  con backend ficticio y aislado; reconocimiento local de Phoenix v1/v2 para
  evitar avisos de desconexión causados por una simulación incompleta.
- `public/v2/`: clips de alta densidad y capturas auténticas con datos ficticios.
- `v2/render.mjs`, `verify.mjs`, `contact-sheet.mjs`, `tests.mjs`: render separado,
  inspección del archivo final, hoja visual y pruebas de regresión.
- `package.json`, `tsconfig.json`, `.gitignore`, `README.md`, `LICENSES.md`,
  `V2.md`: comandos, tipos, exclusión de temporales, documentación y licencias.

## Pruebas ejecutadas

| Comprobación | Resultado |
| --- | --- |
| Aplicación: `npm test` | 165 aprobadas |
| Aplicación: `npm run lint` | TypeScript aprobado |
| Aplicación: `npm run build` | Aprobado |
| Aplicación: `node tests/client-security.mjs` | 18 aprobadas |
| Tráiler: `npm run typecheck` | Aprobado |
| V1: `npm test` | 4 aprobadas |
| V2: `npm run test:v2` | 5 aprobadas |
| Exportación de prueba del drop | MP4 H.264/AAC generado |
| Fotogramas representativos | 17 exportados y revisión visual de encuadres clave |

La aplicación conserva el árbol Git `7efa4510370a15ec95b8b26cad0f1fe56cb0bb76`.
La V1 conserva el SHA-256
`bbcae3b755dc1d6e418a4de7be5c0936599cdf9d02ce40bb239ec120e9c9031f`.

## Entregables y validación final

Los datos técnicos medidos del MP4 final quedan en `deliverables/verification-v2.json`.
El montaje se entrega en `deliverables/BuscAG-trailer-v2.mp4`, acompañado de
`storyboard-v2.jpg` y `poster-v2.png`, extraídos del propio video.

La revisión automática comprueba duración, resolución, fotogramas, codecs,
espacio de color, decodificación completa, sonoridad y ausencia de saturación.
No equivale a una evaluación humana de la mezcla o de la eficacia publicitaria.
Antes de la presentación, reproducir el MP4 completo en la pantalla y sistema de
sonido que se usarán y ajustar su volumen. No se necesita una locución pendiente.

La captura del cliente usa imágenes a 15 FPS codificadas a 30 FPS; las animaciones
son de 30 FPS. El mapa es ilustrativo y los intercambios del backend son ficticios.
No se presenta este material como una prueba de un backend remoto ni de Web Push.

## Resultado del MP4 exportado

- Video: 1920×1080, 30 FPS, 1800 fotogramas, 60 s.
- Contenedor: 60.011 s (padding AAC); video H.264, YUV420p, BT.709.
- Audio: AAC estéreo, 48 kHz; -16 LUFS y pico verdadero -1.9 dBFS.
- Decodificación completa de imagen y audio: aprobada, sin errores.
- Tamaño: 19,973,548 bytes.
- SHA-256: `78e47d564c5c81012d663e666ca4d5eca5bc26d2cb153e189229fabce88676ba`.
- Hoja visual y portada extraídas del MP4 final; revisión visual de encuadres clave aprobada.
