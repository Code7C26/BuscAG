# BuscAG — tráiler cinematográfico

**Nueva versión dinámica de 60 s:** [V2: montaje, música y comandos](V2.md).
La documentación siguiente describe la V1 de 90 s, que se conserva íntegra.

Proyecto Remotion independiente. **90 segundos · 1920×1080 · 30 FPS · MP4 H.264/AAC**.
Todos los archivos del tráiler están aquí. No cambia aplicación, base, Firebase,
service worker ni configuración de producción. No necesita claves de Supabase.

## Entregables

- `deliverables/BuscAG-trailer-draft.mp4`: primer montaje completo, con música/SFX
  originales. Sin locución humana; guion preparado.
- `deliverables/storyboard-preview.jpg`: hoja visual de los 12 planos finales.
- `deliverables/verification.json`: inspección ffprobe del video realmente exportado.
- `STORYBOARD.md`: tiempos y dirección de cada plano.
- `NARRACION.md` y `narracion-referencia.srt`: guion y ventanas exactas de locución.
- `src/Trailer.tsx`: composición animada editable; `src/timeline.mjs`: tiempos/copy.
- `public/captures`: 13 capturas del cliente REAL compilado, con manifiesto de origen.
- `scripts/audio.mjs`: score electrónico + SFX originales reproducibles.
- `LICENSES.md`: fuentes y derechos de recursos.

## Qué es real y qué es demostración

Se reutilizan el icono SVG sin cambios y la paleta histórica de V1 (base `#031926`).
El rediseño posterior `cfdca4a` usa la paleta azul (base `#081a33`); las pruebas
validan ambas paletas por separado, sin modificar la interfaz ni el video V1.
Header, tarjetas, formulario, filtros, mapa Leaflet, comparador, chat y recuperación
son capturas del React/Vite real; no se redibujaron controles como si fueran otra app.
Las capturas se animan con perspectiva, zoom y profundidad en Remotion: no son una
grabación continua de una sesión remota. La interfaz puede verse reducida/cinematográfica.

Los usuarios, publicaciones, fotos ilustradas, mensajes y respuestas RPC son
sintéticos, separados de datos reales. Las rutas HTTP/WebSocket se interceptan o
abortan. Se construye con clave publicable **ficticia**, variables mínimas y envDir
false. No se leen .env del usuario, URI de DB, claves VAPID o credenciales reales.
Los recursos externos (avatares, ilustraciones y tiles) se cumplen localmente.

El mapa usa geometría original ilustrativa; no representa lugares de personas ni
son tiles descargados de OSM. Conserva los controles reales del componente y lo
identifica en el plano. La atribución del proveedor del componente puede verse en
la captura; no se reutilizaron imágenes/cartografía de ese proveedor.

Las coincidencias se calculan con el algoritmo existente sobre publicaciones de
ensayo. El índice visible no es garantía de propiedad. La recuperación mostrada es
bilateral de **una** publicación encontrada: propietario solicita y contraparte
confirma. No muestra recuperación arbitraria de publicaciones ajenas ni actualiza
las dos publicaciones mágicamente. No se anuncia Web Push como validado en dispositivos.

## Windows — previsualización y exportación

Node.js 22 LTS o 24, Git y Chrome/Chromium. Desde un checkout de **Alexis**:

```powershell
cd trailer
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd run assets
npm.cmd run studio
```

Abrir `http://localhost:3100` y seleccionar **BuscAG**. Studio no publica nada.
Las capturas ya están incluidas: no hace falta una cuenta ni activar un backend.
La primera reproducción puede tardar mientras carga el WAV generado.

Si Remotion no encuentra Chromium, indicar el Chrome instalado:

```powershell
$env:BUSCAG_TRAILER_BROWSER = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
```

Para generar capturas nuevas desde el código real (opcional; puerto 3001 libre):

```powershell
cd ..\src\code
npm.cmd ci
cd ..\..\trailer
npm.cmd run capture
```

El proceso compila en `trailer/.app-dist`, levanta sólo loopback y cierra el servidor
al terminar. Si el puerto está ocupado, se detiene; no usa otro servidor sin verificar.
No sustituir los mocks por credenciales ni apuntar a Firebase/Supabase remoto.

Exportación y comprobaciones:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run render:smoke
npm.cmd run render:draft
npm.cmd run verify
```

En Windows se usa un worker por defecto para reducir memoria (útil con 4 GB).
Podés fijar `$env:BUSCAG_TRAILER_CONCURRENCY = "1"`; de 1 a 4 workers admitidos.
Cerrar otras aplicaciones durante el render. El MP4 incluido se reproduce sin renderizar.

Para más calidad: `npm.cmd run render` (CRF18 frente a CRF23 del borrador). Ambos
exportan 1080p30 de 90 segundos; sobrescriben sólo el archivo denominado draft.
Para revisar un solo plano: `npm.cmd run render -- --scene=chat` (salida en out/).
El render fija BT.709 y rango estándar para proyectores/Windows.
`npm.cmd run stills` genera 12 fotogramas de revisión en `out/stills`.

El render usa Chrome indicado, Chromium del sistema Linux, Chromium de Playwright
si está instalado o, como última alternativa, el navegador que descarga Remotion. En Windows, la variable anterior evita una descarga extra
si ya instalaste Chrome. La captura usa Chromium de Playwright o esa misma variable.

Para `verify` se necesita FFmpeg/ffprobe en PATH. Se puede instalar una distribución
para Windows, por ejemplo `winget install --id Gyan.FFmpeg --exact`, y abrir de nuevo
PowerShell. Alternativamente definir `FFPROBE_PATH` con la ruta a ffprobe.exe.
Remotion aporta el compositor/codificador del render; no desactivar TLS si una
descarga falla. El MP4 incluido puede reproducirse sin instalar estas herramientas.

## Locución y acabado final

No se incluyó voz sintética robótica. Grabar `NARRACION.md`, exportar WAV 48 kHz de
90 segundos (con silencios) a `public/audio/voiceover.wav` y volver a renderizar.
La mezcla baja la música automáticamente. `narracion-referencia.srt` es una guía
externa, no subtítulos incrustados ni prueba de voz existente. Antes de presentar:
revisar voz, volumen en el proyector, ortografía y lectura a distancia.

La música ya está resuelta como propuesta original: pads, subgrave, percusión,
arpegio, risers y acentos ligados a los cortes. Se puede sustituir por otra pista
con licencia adecuada, conservando duración y controlando la mezcla. No hay samples
ni canciones comerciales. No se garantiza que una melodía procedural sea exclusiva.

Los WAV y node_modules se regeneran y no se versionan. El MP4 de primera revisión,
las capturas, fuentes, código y lockfile sí se incluyen para que el resultado pueda
verse y reproducirse. No se versionan fotogramas intermedios ni .app-dist.

## Pruebas y límites

Se valida secuencia completa sin huecos/solapamientos, resolución/duración/FPS,
identidad de logo y paleta, dimensiones PNG, manifiesto de captura y audio estéreo
no silencioso/sin clipping. El render de humo prueba codificación real; ffprobe
comprueba H.264, AAC, 2700 fotogramas, 1920×1080 y 90 segundos del MP4 completo.
La revisión de fotogramas comprueba composición y encuadres, no una sesión remota
ni funcionamiento real de Supabase. Ver resultados concretos en `REPORT.md`.
