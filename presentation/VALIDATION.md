# Validación de esta entrega

13/11/2026. Los resultados siguientes corresponden a comandos ejecutados en este entorno, no a cifras copiadas de informes históricos.

| Área | Resultado | Alcance |
|---|---|---|
| MVP `npm test` | 167 aprobadas, 0 fallos | Datos y servicios controlados, no cuentas remotas |
| MVP `npm run lint` | Código 0 | TypeScript |
| MVP `npm run build` | Código 0 | Bundle Vite, no despliegue |
| MVP `node tests/client-security.mjs` | 18 aprobadas | Cliente y privacidad con fixtures offline |
| Presentación `npm test` | 15 aprobadas, 0 fallos | HTTP/SSE/SQLite, DOM, edición y ZIP |
| Presentación `npm run build` | Código 0 | TypeScript y Vite |
| 24 escenas | Renderizado aprobado | HTML/DOM; no geometría visual de navegador |
| Tiempos | 1.800 s; video 1.500–1.560 | Plan nominal; ensayo oral pendiente |
| Logo y código | Copia exacta / fragmento literal | Comparados con archivos de Alexis |
| Capturas | Procedencia auditada | Interfaz real con backend sintético, rótulo permanente |

## Pruebas de presentación

1. Plan, bloques horarios, validación de esquema y rechazo de enlaces inseguros.
2. Autenticación administrativa, rutas privadas, CSRF por origen y guion excluido de API pública.
3. Tres sesiones de voto, duplicado rechazado, conteos ocultos/revelados, cierre y rechazo de redefinición con votos reales.
4. Proyecto persistido, copia anterior, reloj y rechazo de iniciar un plan fuera de 30 minutos.
5. Evento SSE real de cambio de escena, sin notas privadas.
6. Almacenamiento de bytes y petición parcial de video (no decodificación audiovisual).
7. Reinicio del servidor conserva votos y deduplicación.
8. Un recurso con el mismo identificador y bytes distintos no se sobrescribe.
9. Ejemplos de ensayo modificables y restablecimiento independiente.
10. Controles concurrentes persistidos en orden sin pérdida.
11. Cero votos y empate no generan ganador falso.
12. Las 24 escenas renderizan con su contenido y rótulos de evidencia.
13. Studio duplica/reordena/oculta, deshace/rehace y guarda realmente. Se corrigió una carrera de carga: no hay controles activos antes de cargar el proyecto y preservar el borrador anterior.
14. Exportar ZIP, vaciar IndexedDB e importar restaura proyecto, recursos y fuente; rechaza inventario incompleto. Usa recursos sintéticos pequeños, no certifica un MP4 grande en la PC física.

15. Los ocho SVG corporativos se parsean como XML válido, conservan textos editables y recursos vectoriales embebidos.

El paquete compilado se sirve por HTTP sin node_modules: raíz, rutas, documentos, fuente, sonido y JS/CSS responden correctamente; las rutas privadas rechazan accesos anónimos. Comando reproducible: `npm run test:portable` después del build.

El bundle público utiliza public-seed con guiones vacíos; el guion completo se carga únicamente mediante API autenticada. Se comprobó que frases del guion privado no aparezcan en el JS compilado. Las fuentes completas y ZIP contienen el guion: conservarlos privados, no servir el árbol de fuentes como sitio estático.

## Límites pendientes

El entorno cloud seleccionado ccarenv_b64_Y2NhcmVudl83MDlkOGI0Yjg1NTg4MTkxYTg0ZjA5MGYzOWIxYzZkZg informa desktop enabled/state unknown. No ofrece la herramienta cua_repl.js ni equivalente de control del navegador. Según el flujo managed de Sites no se improvisó otra ruta de preview: no hay capturas ni aprobación visual/FPS. El renderizado DOM no sustituye esa revisión.

La consulta a buscag-prueba.web.app devolvió `CONNECT tunnel failed, response 403`. No se verificaron URL servida, versión, cuentas ni flujos reales. No hubo SQL ni escrituras remotas. Faltan teléfonos físicos, proyector, audio, original inglés, demo con dos cuentas y transferencia a la PC de Germán. Ver PENDIENTES y ENSAYO.csv.

No se afirma que el evento esté listo con esas verificaciones ausentes.
