# Entrega audiovisual BuscAG — primer borrador

Se implementó el tráiler completo en un proyecto Remotion independiente dentro de
`trailer/`. Duración nominal 90 segundos, horizontal Full HD 30 FPS. Incluye el MP4,
póster, código, lockfile, 13 capturas auténticas de la aplicación, storyboard, guion
de locución con tiempos, SRT de referencia e instrucciones de Windows.

## Resultado visual y sonoro

Narrativa en 12 planos agrupados en los cinco actos solicitados: pérdida (0–12),
marca/app (12–28), publicaciones/búsqueda/mapa/filtros/coincidencias (28–55),
chat/recuperación bilateral (55–77), logo/eslogan (77–90). Dispositivos con perspectiva,
entradas de texto, zooms, iluminación petróleo/teal, partículas, profundidad y fades.
Se preservan logo y cinco colores auténticos de BuscAG. Se revisaron los encuadres
para conservar comparación, chat, publicación y confirmación dentro del formato.

Música electrónica y efectos sintetizados originales, sin samples comerciales.
El primer borrador es instrumental: **no contiene narración humana**. Hay guion
sincronizado y soporte para agregar voiceover.wav con reducción del nivel musical.

La interfaz es una captura del cliente compilado real, animada en Remotion; no es
una grabación continua del backend real. Cuentas, mensajes, publicaciones y recursos
ilustrados son de demostración. Mapa con base original ficticia y controles Leaflet
reales. No se anuncian funcionalidades ausentes ni Push verificado en dispositivos.
El índice de coincidencia no se presenta como garantía de propiedad.

## Pruebas ejecutadas

- Capturador: 13 pantallas/componentes guardados, confirmación simulada bilateral
  completada y manifiesto del árbol de aplicación `7efa4510370a15ec95b8b26cad0f1fe56cb0bb76`.
- Captura rechaza un puerto ocupado antes de leer el servidor ajeno (cero requests).
- TypeScript del tráiler: aprobado.
- Cuatro pruebas del tráiler: secuencia completa, marca auténtica, PNG/manifiesto
  y audio PCM estéreo 48 kHz de 90 segundos, no silencioso/sin clipping: aprobadas.
- Render real de un segundo H.264/AAC y render completo: aprobados. Se regeneraron
  planos para afinar voseo y coherencia de estado/categoría de la mochila. El reloj fijo de captura también
  se avanza después de cargar tiles para que Leaflet termine su fade; se verifica
  que no queden transparentes, sin cambiar código de la aplicación.
- Primer export normalizado a BT.709/rango TV para proyectores; los scripts fijan
  esa configuración en futuras exportaciones. Acabado de planos con FFmpeg.
- ffprobe del MP4 final: 1920×1080, 30/1 FPS, 2700 frames, video H.264 yuv420p BT.709
  limitado, audio AAC estéreo 48 kHz. Duración contenedor 90.005s por padding AAC;
  duración de imagen 90.000s. SHA y tamaño en deliverables/verification.json.
- Audio final: volumen medio -19.5 dBFS y pico -2.7 dBFS (volumedetect), sin saturación.
- Doce fotogramas de control revisados; chat y formulario se inspeccionaron también
  extraídos del MP4. El póster se extrajo del archivo final.
- Aplicación existente: 165 pruebas, TypeScript, build y 18 comprobaciones de
  seguridad del cliente aprobadas antes del commit. Sin cambios en sus archivos.

Todo se ejecutó localmente. No se usaron credenciales reales ni se consultaron
usuarios, datos o APIs reales. No hay despliegue Firebase/Supabase ni cambios de
producción, main o German. Los únicos archivos nuevos/versionados están en trailer/.

## Pendientes para la presentación definitiva

1. Grabar la voz siguiendo NARRACION.md si se desea locución; no se ha fingido voz.
2. Revisar el montaje y la mezcla en el proyector/altavoces de la escuela.
3. Ajustes creativos posteriores según tu devolución. El MP4 incluido ya se puede
   reproducir; no requiere instalar Remotion para verlo.

Ver README.md para comandos exactos de instalación, Studio y exportación en Windows.
Con 4 GB se recomienda un worker y cerrar otras aplicaciones durante el render.
