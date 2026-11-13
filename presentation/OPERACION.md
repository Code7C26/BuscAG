# Operación, ensayo y contingencias

## Preparación

1. Extraer el paquete completo; conservar `dist/`, `server/`, `src/seed.json` y `package.json`. Usar Node 24. Configurar contraseña con `node server/setup.mjs` y arrancar servidor.
2. Monitor de Germán: `/presenter`. Proyector en pantalla extendida: `/`. El público nunca debe ver la pestaña de notas/Studio. Entrar con clic; tecla **F** para pantalla completa, **Alt+P** presentador, **Alt+E** editor. El navegador puede reservar atajos: las rutas directas siempre funcionan.
3. Confirmar enlaces reales en Studio → Enlaces. Los QR de web y GitHub codifican destinos documentados; no certifican disponibilidad. No se enlazan redes inventadas. Documentación técnica local: `/docs/MANUAL.md`, `/docs/MVP_README.md` y `/docs/Informe.pdf`.
4. Verificar foco, tamaño de texto y contraste con proyector **1920×1080**. Revisar las 24 escenas una por una. Activar reducir movimiento si hace falta; se respeta también la preferencia del sistema.
5. Cargar video original inglés de 60 s en su escena; comprobar audio de ambos, volumen y reproducción completa. Conservar audio original, sin subtítulos nuevos. Habilitar sonidos opcionales con el checkbox inicial. La reproducción automática puede requerir ese clic; los medios tienen controles manuales.
6. Si se necesita un sonido cargado, subirlo en Studio → Medios y elegirlo para la escena. En Studio se previsualiza con reproductor. El ambiente inicial sintetizado es CC0, sin muestras externas.
7. Registrar PASS/FAIL/BLOQUEADO en `ENSAYO.csv`, incluyendo fecha, dispositivo, origen y commit. No poner contraseñas ni datos personales en evidencias.

## Ensayo de 30 minutos

El reloj cuenta tiempo real y muestra alerta discreta si se supera el final previsto de la escena. Se inicia/pausa/reinicia desde presentador. **No avanza escenas automáticamente**, tampoco en demo o votaciones. Sólo inicia si el plan suma 1.800 s y tiene un único video de 60 s comenzando en 1.500 s. Modificar duraciones en Studio y usar ajuste si corresponde; volver a ensayar el discurso. Un plan exacto no garantiza por sí solo duración oral exacta.

Las flechas del presentador cambian la escena para el proyector por SSE. Primero iniciar el reloj y mostrar escena 1. Mantener las ventanas de bloques de STORYBOARD. A 24:00 empezar FAT; a 25:00 reproducir el original, a 26:00 marketing, a 27:00 visión. Cerrar con los QR sostenidos hasta 30:00.

Valentino y Germán tienen guion completo y acciones indicadas en SCRIPT. La planificación nominal reparte 15:25 y 14:35 contando 30 s de video para cada uno; ambos intervienen en demo y técnica. No acelerar hablando si falla una operación: usar el plan de contingencia y declarar el alcance observado.

## Votación real

Todos los dispositivos usan el mismo servidor. En ensayo se muestran ejemplos claramente ficticios; no se mezclan con votos reales. Los botones +1 de presentador modifican sólo ejemplos. Restablecer ensayo deja esos contadores en cero. Cerrar ambas encuestas antes de cambiar al modo real. Abrir la encuesta correcta; esperar; cerrar; revelar. Las preguntas/opciones editadas deben guardarse antes de abrir.

Resultados reales ocultos no incluyen conteos por opción en la API pública. El contador total sí se muestra. Ganador único se anuncia como tal; empate y cero votos se resuelven verbalmente sin inventar datos. La encuesta 2 elige el objeto. No hay botón para atribuir ganador inexistente ni reiniciar votos reales.

## Transferencia completa

1. Guardar en Studio. Exportar ZIP; incluye proyecto privado, multimedia, símbolo, fuente, capturas y ambiente. Conservar ZIP y paquete de aplicación de la misma versión.
2. En la PC de Germán extraer la aplicación, configurar contraseña y abrir Studio. Importar ZIP. Verificar el inventario y la vista previa; **Guardar** para actualizar el proyector.
3. Cerrar y reabrir navegador y servidor. Revisar textos, orden, video, sonido y QR. Reproducir MP4 de principio a fin. Exportar otra copia y comprobar contenido. El test automatizado verifica el proceso con recursos sintéticos; esta prueba física sigue pendiente.
4. Los votos y las contraseñas no viajan en el ZIP de proyecto. Para respaldo del servidor completo, detenerlo y copiar toda la carpeta `data/` (incluye SQLite y sus archivos asociados). Es un respaldo privado. Restaurar esa carpeta con el servidor detenido. No copiar sólo `votes.sqlite` mientras está escribiendo.
5. Un respaldo `project.backup.json` conserva el proyecto anterior en el servidor; también hay copia local en IndexedDB y deshacer/rehacer (40 cambios por sesión). No borrar los datos del navegador sin exportar primero.

## Contingencias

- **Sin Internet pero LAN disponible:** presentación, medios cargados y encuestas siguen en el servidor local. La demo del MVP puede fallar: comunicarlo. No presentar capturas sintéticas como una operación real.
- **LAN aislada o teléfonos sin acceso:** cerrar votos y usar mano alzada. No ingresar conteos manuales como si fueran votos online. La pantalla conserva su estado con aviso de desconexión si se pierde SSE.
- **Desconexión del proyector al servidor:** una pestaña ya abierta conserva la escena en memoria; flechas permiten avance local. Sin conexión no se reciben votos ni se sincroniza con presentador. Restaurar conexión antes de retomar. No hay garantía de recarga con el servidor detenido; mantenerlo en la PC del proyector.
- **Falla del MVP:** mostrar la grabación real de respaldo sólo si existe y está rotulada como grabación. Si falta, reconocer el bloqueo y explicar código; esto deja pendiente el requisito de demo real. Los clips sintéticos del tráiler no cumplen ese requisito.
- **Video inglés ausente:** sostener placeholder con el requisito pendiente. No crear guion ni video alternativo, no usar el ambiente original como reemplazo.
- **Cambios grandes de tiempos:** revisar el guion, no confiar únicamente en normalización matemática. En caso de duda restaurar el original y exportar la versión alterada antes.

## Aceptación en sala

Probar al menos tres teléfonos de distintas sesiones, un intento repetido, cierre de encuesta, empate, ausencia de votos, reconexión y ambos QR. Probar 1080p, audio, pantalla extendida y ritmo de 30 min. No dejar guion en la pantalla proyectada. Completar ENSAYO.csv. Ningún resultado de navegador emulado certifica un celular físico.
