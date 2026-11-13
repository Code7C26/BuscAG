# BuscAG — El experimento

Presentación independiente en React + TypeScript + Vite + Motion. 24 escenas, plan nominal de **30:00**, video inglés reservado **25:00–26:00**, guion completo y modos público, presentador y Studio. No modifica `src/code/`, Firebase ni tablas de BuscAG.

## Ejecutar en la PC de Germán

Requiere **Node.js 24.13 o posterior de la serie 24** (incluye SQLite). La carpeta `dist/` viene compilada en el paquete portable. Para esa versión no hace falta instalar dependencias ni acceder a Internet:

```sh
node server/setup.mjs
node server/index.mjs
```

Elegir una contraseña privada de al menos 12 caracteres en la terminal (entrada oculta). Abrir:

- `http://127.0.0.1:4173/`: proyector, sin guion ni controles de edición.
- `http://127.0.0.1:4173/presenter`: notas privadas, reloj, próxima escena y control de escena/votos.
- `http://127.0.0.1:4173/studio`: editor protegido; `/admin` lleva al presentador.
- `http://127.0.0.1:4173/vote?poll=search` y `?poll=object`: votación móvil.

En Windows puede usarse `INICIAR-WINDOWS.cmd`. En macOS/Linux, `sh iniciar.sh`. El servidor abre sólo loopback por defecto. Para celulares, usar una LAN accesible por todos y cambiar el host:

```sh
# macOS/Linux
HOST=0.0.0.0 node server/index.mjs
# PowerShell
$env:HOST='0.0.0.0'
node server/index.mjs
```

En Studio → Encuestas configurar **el origen de la PC en la red**, por ejemplo `http://192.168.1.30:4173` (ejemplo, no dirección real). Guardar y escanear desde otro dispositivo. No usar localhost en los QR de teléfonos. Permitir el puerto en el firewall de esa PC. Una red escolar puede aislar clientes; usar una red propia autorizada si ocurre. El funcionamiento por LAN no necesita Internet; la demo real del MVP sí puede necesitarlo.

## Desarrollo

```sh
npm ci
npm run dev
npm test
npm run build
npm start
```

El modo desarrollo es sólo para trabajo local y no se publica: Vite sirve fuentes. El modo `start` sirve únicamente el build y las rutas autorizadas. No usa variables `VITE_*` ni claves de BuscAG. No copiar `.env` del MVP.

## Qué está implementado

Escenas, movimientos reducidos, fuente local, ambiente original optativo, pantalla completa, teclado, vistas de presentador y edición protegidas con sesión HttpOnly. Studio permite editar textos/guion/expositor, escenas, orden, visibilidad, tiempos, layouts, fondo, colores, fuente, escala, posición, animación, multimedia y enlaces. Incluye guardado al servidor, borradores IndexedDB, deshacer/rehacer, respaldo y ZIP con recursos.

Votos reales desde móviles por HTTP y resultados por SSE en la misma escena, persistidos en SQLite independiente. Abrir/cerrar y revelar/ocultar; empates y cero votos explícitos. Cookies aleatorias reducen repeticiones por navegador; no garantizan un voto por persona. Modo ensayo separado con datos ficticios rotulados y botones para agregar/restablecer ejemplos. No hay botón para borrar votos reales.

Se eligió un servidor local independiente en lugar de otro Supabase para poder operar por LAN sin Internet ni crear servicios remotos o modificar tablas existentes. Es un límite de despliegue: **este paquete requiere un proceso Node persistente**, no funciona como sitio estático de Firebase o Sites. SSE puede necesitar desactivar buffering en un proxy.

## Recursos y pendientes

El video original inglés no fue aportado: su escena está terminada con placeholder. Se carga desde Studio → Medios, sin editar código. Se exige duración 60 s ±0,25 s por metadatos; no se recorta, subtitula ni modifica audio. El video debe revisarse auditivamente antes del evento. Los tráileres del repositorio usan backend sintético y **no se usan como video original ni evidencia de demo**.

Ver [PENDIENTES.md](PENDIENTES.md), [OPERACION.md](OPERACION.md), [VALIDATION.md](VALIDATION.md), [GIT_AUDIT.md](GIT_AUDIT.md), [SCRIPT.md](SCRIPT.md), [STORYBOARD.md](STORYBOARD.md) y [MATRIZ_CUMPLIMIENTO.md](MATRIZ_CUMPLIMIENTO.md). No se declara aprobado el evento con requisitos todavía pendientes.

## Límites concretos del editor

Hay tres composiciones y presets de entrada; las posiciones afectan el bloque de texto con rangos limitados. No es un editor de formas vectoriales ni permite arrastrar cualquier elemento de cada visual. La velocidad cambia la duración de entrada (0,65/velocidad segundos); las animaciones de concepto conservan su composición. Las encuestas tienen 2–6 opciones y no se pueden redefinir tras recibir votos reales. Para otro evento, usar un directorio de datos nuevo y conservar el anterior como respaldo.

Los recursos se conservan en servidor e IndexedDB; no se borran al deshacer ni al quitar de una escena. El ZIP incluye únicamente recursos vinculados al inventario del proyecto y recursos base. Importar nunca sobrescribe bytes distintos de un mismo identificador. Máximo 1 GB por recurso y 2 GB por ZIP expandido, aunque la memoria del navegador puede imponer límites mucho menores: se recomienda MP4 H.264/AAC de hasta 250 MB para el video de un minuto. Ensayar la transferencia en la PC real. Una prueba automatizada de ZIP no sustituye esa aceptación.

## Publicar online, si después lo necesitan

Preparar el build y ejecutar `node server/index.mjs` detrás de HTTPS con almacenamiento persistente para `data/`. Usar `HOST=127.0.0.1` detrás del proxy, `PORT` según alojamiento y `PRESENTATION_HTTPS=1` para cookies Secure. Desactivar buffering y aumentar tiempo de espera en `/api/events`. No publicar `data/`, fuentes privadas ni archivos de respaldo. Mantener un único proceso escritor; SQLite local no se comparte entre réplicas. Configurar el origen público de QR en Studio. `PRESENTATION_ADMIN_PASSWORD` es una alternativa de secreto de servidor; nunca se usa en frontend ni en URL. Las sesiones vencen a las 8 horas y se invalidan al reiniciar.

No se realizó despliegue externo. La URL de prueba del MVP es la documentada en el repositorio; su disponibilidad y versión servida necesitan comprobación previa al evento.
