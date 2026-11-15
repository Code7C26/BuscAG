**Versión 2.2.0 · aula: 24 escenas, seis actos y 25 minutos, encuestas HTTPS y alternativa con manos. Incluye la corrección 1.0.1: corregido el rechazo 403 de recursos estáticos en Windows. Ver CORRECCION-WINDOWS-1.0.1.md. Cerrar el servidor viejo antes de abrir esta copia.**

# Abrir BuscAG en Windows, paso a paso

## Descarga y primer arranque

1. Descargar **BuscAG-Windows-completo.zip** desde GitHub, como se indica abajo. Si la interfaz ofrece **Save as… / Guardar como…**, guardar una copia en Descargas. No usar la ruta `/workspace` en el Explorador de Windows: es una carpeta de la computadora cloud.
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

## Descargar desde GitHub

Abrir la rama presentation/windows-20261113-212500-b726dc85d2 en el repositorio Code7C26/BuscAG, entrar en presentation/descargas/BuscAG-Windows-completo.zip y pulsar Download raw file. El repositorio es privado: iniciar sesión con una cuenta autorizada. Descargar el paquete completo, no Code → Download ZIP si querés evitar compilar.

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

## Proyector y encuestas

Usar pantalla extendida: presentación en proyector 1920×1080 y /presenter sólo en tu pantalla. Leer CONECTAR-ENCUESTAS.md: botón Conectar encuestas y autorización con tu cuenta propietaria ChatGPT. No hay que copiar claves. Sin conexión, usar Manos levantadas. Android/iPhone físicos y datos móviles requieren ensayo real previo.

## Conexión simplificada 2.1.1

La conexión manual de claves descrita en versiones anteriores queda reemplazada por **Conectar encuestas** → **Abrir autorización privada** → comparar código y autorizar con tu cuenta propietaria ChatGPT. No hace falta administrar ADMIN_KEY. Seguir CONECTAR-ENCUESTAS.md. La comprobación final con la sesión real del propietario y teléfonos físicos sigue pendiente del titular.

La versión 2.1.1 corrige un rechazo real del runtime de Sites antes de mostrar el código. Ver CORRECCION-AUTORIZACION-2.1.1.md. Usar un enlace de conexión nuevo.

2.1.2 distingue aperturas de ensayo y reales. Para votar desde celulares, pulsar Usar votos reales en celulares o HTTPS; después Abrir. Volver a pulsar HTTPS no cierra una encuesta online ya abierta.

## Guion y tiempos de esta edición

El PDF completo está en docs/Guion_BuscAG_Valentino_German_25min.pdf. El plan nuevo dura 25 minutos con video de 21:30 a 22:30. Extraer en una carpeta nueva para iniciar con estas escenas. Si ya editaste la copia anterior, exportá su proyecto y conservá el video antes de restaurar la plantilla nueva en Studio. No sobrescribimos data/ ni convertimos tu guion anterior automáticamente.
