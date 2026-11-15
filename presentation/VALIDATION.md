# Validación · contenido funcional 2.2.0

## Contenido, guion y tiempo

- Fuente funcional auditada: Alexis 176bf6b473abae2586f85db429e8c1fb0845990c; el árbol src/code de esta copia es idéntico. Auditoría y límites en docs/AUDITORIA_FUNCIONES.md. No se cambió la aplicación ni su base.
- 24 escenas, seis actos y 1.500 segundos: 150 + 210 + 480 + 240 + 300 + 120. Encuestas al 02:30 y 06:00. Demo 07:00–14:00; video 21:30–22:30; cierre 25:00.
- Valentino 720 segundos / 937 palabras; Germán 720 segundos / 974 palabras. Video original compartido: 60 segundos. Los tiempos incluyen pausas y operación; se requiere ensayo oral con cronómetro.
- Un único plan docs/content-25.json genera pantalla, notas privadas, SCRIPT.md, STORYBOARD.md y TIMING-25.json. PDF de 15 páginas generado desde el mismo plan: todas las intervenciones fueron comparadas literalmente con el texto extraído del PDF, incluidos los 24 números de diapositiva.
- Se preservaron IDs, actos, tipos, animaciones, diseños, colores, velocidad, tamaño y posiciones de las 24 escenas. El contenido anterior está archivado en docs/archive/30-minutos. Los proyectos anteriores de 30 minutos siguen siendo válidos en su propio perfil y no se sobrescriben.

## Verificaciones ejecutadas

28 pruebas de presentación aprobadas: servidor, seguridad de rutas y MIME, privacidad, persistencia, editor/importación/exportación, tiempos, contenido coordinado y conexión de encuestas con servicios aislados. Build TypeScript/Vite y prueba HTTP portable aprobados.

Chromium recorrió las 24 escenas a 1920×1080 y comprobó 1280×720; se revisaron capturas de publicación, filtros, comparación, recuperación y arquitectura. Se mantienen las dos encuestas, QR decodificados, modo manual, sincronización, Studio y rendimiento reducido. Una pasada posterior revisó los últimos cambios menores. Esto no certifica una tele ni teléfonos físicos.

El ZIP generado se extrajo en una carpeta nueva y pasó la prueba de presentación, avance SSE, presentador, Studio/guardar/undo y privacidad, sin errores JavaScript ni recursos 403. El guion no está en el bundle público y el PDF privado devuelve 404 desde las rutas públicas.

Antes de publicar la rama se ejecutaron las comprobaciones requeridas del MVP sin modificar sus fuentes: npm test, lint, build y client-security. No se ejecutaron migraciones ni despliegues. CI verifica además Windows/Linux contra el ZIP distribuido exacto y su SHA256; consultar la ejecución del commit para su resultado.

El preflight de esta revisión es de lectura: no registra votos, no crea solicitudes de vinculación ni cambia el estado de las encuestas publicadas. No hubo despliegue ni configuración de Sites, Firebase o Supabase en esta tarea.

## Pendientes que no se presentan como hechos

Video original si sólo existe en la copia del usuario, ensayo del recorrido con dos cuentas en el servicio que se usará, activación de RPC de recuperación, teléfono/tele/audio reales y acceso del jurado al repositorio privado. El código implementado no demuestra que una migración esté aplicada ni una función operativa en la URL publicada. Si falta un servicio, usar el apoyo rotulado y explicar el límite sin inventar éxito.
