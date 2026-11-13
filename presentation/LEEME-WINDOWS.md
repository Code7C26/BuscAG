**Versión 1.0.1: corregido el rechazo 403 de recursos estáticos en Windows. Ver CORRECCION-WINDOWS-1.0.1.md. Cerrar el servidor viejo antes de abrir esta copia.**

# Abrir BuscAG en Windows, paso a paso

## Descarga y primer arranque

1. Descargar **BuscAG-Windows-completo.zip** desde los archivos de esta tarea de Codex Cloud. Si la interfaz ofrece **Save as… / Guardar como…**, guardar una copia en Descargas. No usar la ruta `/workspace` en el Explorador de Windows: es una carpeta de la computadora cloud.
2. Clic derecho al ZIP → **Extraer todo**. Elegir por ejemplo `Documentos\BuscAG-Presentacion`. Abrir la carpeta extraída `BuscAG-presentation`, donde aparecen INICIAR-WINDOWS.cmd, dist y server. No ejecutar desde dentro del ZIP.
3. Instalar **Node.js 24 LTS para Windows** desde https://nodejs.org/. Elegir la última versión **24.x**, al menos **24.13**. Este paquete fue probado con **24.22.1** en Linux. Node 20 no incluye el SQLite que requiere este servidor. No hace falta instalar Git, Python ni paquetes globales para el ZIP compilado. Si ya tenés Node, comprobar `node --version` en una terminal nueva.
4. Doble clic en **INICIAR-WINDOWS.cmd**. Comprueba Node/SQLite y, la primera vez, pide crear una contraseña privada de al menos 12 caracteres. La entrada está oculta; escribir y presionar Enter. Conservar esa contraseña para presentador/Studio.
5. Se inicia el servidor local y se intenta abrir Chrome automáticamente. Si Chrome tiene una instalación distinta, abrirlo manualmente y escribir **http://127.0.0.1:4173/**.
6. Mantener abierta la ventana negra del iniciador. Pulsar **Entrar en presentación** en Chrome; habilitar sonido opcional si se quiere. No abrir dist/index.html con doble clic: la presentación necesita el servidor local.
7. En otra pestaña abrir **http://127.0.0.1:4173/presenter**, ingresar la contraseña y usar **Siguiente/Anterior** para recorrer las escenas. La pestaña pública sigue los cambios. **http://127.0.0.1:4173/studio** abre el editor.
8. Para terminar, volver a la ventana del iniciador y presionar **Ctrl+C**. Las próximas veces basta con INICIAR-WINDOWS.cmd.

El servidor de este iniciador escucha sólo en tu PC (127.0.0.1). No publica ni modifica BuscAG, Firebase, Supabase ni el repositorio principal. Los cambios locales de la presentación se guardan en `data/` dentro de esta copia independiente.

## Si descargaste código fuente desde GitHub

El ZIP de **Code → Download ZIP** puede no incluir `dist/`, porque es un build ignorado por Git. En ese caso entrar a la carpeta `presentation` y ejecutar **PREPARAR-DESDE-FUENTE.cmd**. Descarga dependencias con `npm.cmd ci`, compila con `npm.cmd run build` y abre el iniciador. Esta preparación requiere Internet una vez y trabaja sólo dentro de presentation/; no ejecuta comandos en src/code/.

La alternativa en PowerShell, dentro de presentation, es:

```powershell
npm.cmd ci
npm.cmd run build
.\INICIAR-WINDOWS.cmd
```

## Si Codex no permite descargar el archivo

La publicación remota todavía no se hizo. No sirve descargar el main remoto actual: no contiene esta presentación. Procedimiento para quien opera la terminal de Codex Cloud, sin cambiar ni sobrescribir ramas existentes:

1. Conservar los cambios actuales y revisar `git status`; no hacer checkout/reset ni push sobre main, Alexis o German.
2. Desde `/workspace/BuscAG`, crear una referencia nueva apuntando al commit local que contiene la presentación; nombre de ejemplo **presentation/windows-preview-20261113**. Confirmar antes con `git ls-remote --heads origin refs/heads/presentation/windows-preview-20261113` que no exista; si existe, usar otro nombre nuevo.
3. Para incluir los archivos nuevos de Windows sin mover ninguna rama existente, usar el script **scripts/preparar-github-seguro.py**. Crea un commit mediante un índice temporal, agrega sólo presentation/ y deja checkout, índice normal, main, Alexis y German intactos. No hace push. El script devuelve nombre de referencia, SHA y comando exacto para revisión. Con `--zip /ruta/al/BuscAG-Windows-completo.zip` incluye además el ZIP portable en presentation/descargas/, sin copiarlo al checkout.
4. Revisar que el diff respecto de su padre contenga sólo presentation/. Antes de publicar, ejecutar las comprobaciones de AGENTS.md (`npm test`, `npm run lint`, `npm run build` y `node tests/client-security.mjs` en src/code). Las que involucran al MVP no hacen despliegue.
5. Publicar exclusivamente la nueva referencia con el comando mostrado por el script. Comprobar inmediatamente antes que el nombre no exista. El script usa fecha, hora y un sufijo aleatorio para evitar colisiones; si existe, generar otro nombre. Es un push normal, sin --force. No usar force push general, no cambiar ramas existentes y no crear PR/merge/deploy.
6. Si la rama incluye `presentation/descargas/BuscAG-Windows-completo.zip`, abrir ese archivo en GitHub y pulsar **Download raw file**. Es el paquete ya compilado: extraer y ejecutar INICIAR-WINDOWS.cmd. Como alternativa, elegir esa rama nueva → **Code → Download ZIP**; extraer, abrir presentation/ y ejecutar PREPARAR-DESDE-FUENTE.cmd.

Estos pasos son una alternativa de transferencia de código, no un despliegue. No autorizan ejecutar SQL, desplegar Firebase ni modificar la aplicación principal. El ZIP portable de Codex es más rápido porque incluye dist/ y no necesita npm install.

## Problemas comunes

- **No se reconoce node:** instalar Node 24 LTS y abrir de nuevo el iniciador; cerrar terminales viejas.
- **Node distinto de 24.x o menor que 24.13:** instalar la serie soportada. El iniciador muestra la versión detectada.
- **Puerto 4173 ocupado:** cerrar el iniciador anterior. No se abre silenciosamente otra aplicación en ese puerto.
- **Chrome no se abre:** escribir la dirección local en Chrome manualmente. El servidor puede estar funcionando igualmente.
- **Pantalla sin avanzar:** usar la pestaña /presenter; el avance es manual.
- **Contraseña de menos de 12 caracteres:** el iniciador se detiene; volver a ejecutarlo y elegir otra.
- **Video inglés pendiente o demo sin conexión:** son pendientes del contenido original, no fallas de instalación. La presentación, Studio y ensayo pueden probarse igualmente. No usar los QR del MVP si la prioridad es sólo revisar esta presentación local.

## Alcance verificado

ZIP con fuente, build, medios, guion, documentos, diseños y lanzadores. Sin node_modules, .git, .env, contraseñas ni votos. Servidor y rutas comprobados con Node 24.22.1 en Linux, incluyendo una copia sin dependencias instaladas. No se ejecutó CMD ni Chrome en un Windows físico: la comprobación final de apertura automática corresponde a tu PC.
