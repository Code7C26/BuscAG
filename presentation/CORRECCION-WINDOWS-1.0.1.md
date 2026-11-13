# Corrección Windows 1.0.1 — archivos estáticos y pantalla en blanco

## Causa raíz comprobada

Se extrajo el ZIP publicado (SHA256 2897b46ff9f3fff6fb21e3300d0fabf113e0ada3ca8dc8c99623811739955456). Su servidor validaba `file.startsWith(base + "/")`. En Windows, path.resolve/join generan `C:\...\dist\assets\...`; ese texto nunca comienza con `C:\...\dist/`. El HTML raíz pasaba por igualdad, mientras todos sus recursos obtenían 403. El MIME application/json correspondía al mensaje de rechazo; no era el contenido del CSS.

Las pruebas anteriores de transporte se ejecutaron en Linux y no cubrieron este caso de Windows. La corrección usa path.relative/isAbsolute/sep, valida la URL, comprueba la ruta canónica y mantiene el aislamiento del directorio dist. No deshabilita autenticación, controles de origen, cookies seguras, límites de archivos, CSP ni X-Content-Type-Options.

## Cambios

- Archivos legítimos: HTTP 200 con MIME explícito para HTML, JS, CSS, SVG/PNG/JPEG/WebP, WOFF2, WAV/MP3/OGG, MP4/WebM, PDF y documentos de texto.
- HEAD funciona sin cuerpo.
- Fallback HTML únicamente para rutas conocidas de la aplicación; un CSS inexistente devuelve 404, nunca HTML.
- Traversal, backslashes codificados, rutas de red, archivos ocultos y escapes mediante symlink continúan rechazados.
- /data, /server y /src no exponen archivos. Las API de notas/proyecto privado siguen exigiendo sesión.
- Regresión automatizada con path.win32 (unidad C: y UNC), POSIX, pruebas HTTP y navegación en Chromium a 1920×1080.
- El workflow de la rama presentation ejecuta build, pruebas y revisión del ZIP extraído tanto en Windows como en Linux. No tiene tareas de despliegue ni escritura a servicios de BuscAG.

## Actualizar en tu PC

1. En la ventana del servidor anterior, presionar Ctrl+C. No dejar el servidor viejo usando 4173.
2. Descargar el ZIP actualizado de la rama presentation/windows-20261113-212500-b726dc85d2, carpeta presentation/descargas.
3. Extraer en una carpeta nueva. No mezclar server/ o dist/ viejos con los nuevos.
4. Si querés conservar contraseña, guion y medios cargados, copiar solamente la carpeta data/ anterior a la nueva con ambos servidores detenidos. El ZIP no incluye data ni credenciales.
5. Con Node 24 LTS instalado, ejecutar INICIAR-WINDOWS.cmd. Abrir http://127.0.0.1:4173/ en Chrome y recargar con Ctrl+Shift+R.
6. Abrir /presenter y /studio con la contraseña configurada. El servidor debe mostrar los recursos legítimos sin 403 y el CSS como text/css.

No hace falta npm install con el ZIP compilado. La corrección no incorpora el video original pendiente ni convierte el MVP remoto en una demo verificada.

## Pruebas reproducibles desde fuentes

npm ci → npm run build → npm test → npm run test:portable.

Para navegador: npx playwright install chromium → npm run test:browser.

Para ZIP: npm run pack:windows, extraerlo y usar BUSCAG_TEST_PACKAGE_DIR apuntando a esa carpeta al ejecutar test:browser. Ese comando carga el servidor del ZIP y no lo reconstruye. Las pruebas locales de esta entrega usan Chromium en Linux y path.win32; una ejecución de CI en Windows o tu PC comprueba el sistema operativo real. No se atribuye una prueba física de Windows a un entorno Linux.
