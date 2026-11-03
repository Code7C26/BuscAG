# Preparación para producción: etapa 1

Rama basada en Alexis. Esta etapa modifica exclusivamente el cliente y sus pruebas.
No aplica SQL, no despliega Firebase y no usa datos reales en las verificaciones.

## Cambios y cobertura

| Corrección | Implementación | Pruebas |
| --- | --- | --- |
| Estado privado y sesiones | App conserva Auth; AccountApp se monta con una clave por sesión de cuenta. Cambiar identidad invalida inmediatamente los permisos de las operaciones capturadas y descarta estado y componentes anteriores. El refresco de token de la misma cuenta conserva sus borradores. | Cambio directo A→B, cierre de sesión, lectura inicial tardía, StrictMode, datos/Realtime/push/GPS antiguos, subida pendiente y conservación al refrescar token. |
| Confirmación de eliminación | Un único handler comprueba propiedad, exige confirmación y devuelve éxito/error. Perfil y detalle usan ese mismo handler; el detalle sólo se cierra tras éxito, sin preguntar dos veces. | Cancelación desde ambos accesos sin DELETE; confirmación produce una llamada simulada; detalle abierto tras error/cancelación. |
| Ubicación confirmada | El centro inicial sigue sirviendo para explorar el mapa, pero no autoriza una publicación. Hace falta un clic, arrastre válido del pin o GPS válido. Escribir una dirección no confirma coordenadas; tras seleccionar el punto puede editarse su descripción. | Envío sin confirmar, selección inválida, GPS inválido/válido, coordenadas cero y conservación de una dirección descriptiva. |
| Coordenadas defensivas | Un validador común rechaza null, cadenas, NaN, infinitos y valores fuera de rango. Los mapas omiten sólo marcadores inválidos y usan un centro válido de reserva; el detalle conserva la publicación sin crear un mapa inválido. | Límites geográficos, registros heredados inválidos, marcador válido y detalle disponible sin excepciones de Leaflet. |
| Mensajes fiables | El callback devuelve una promesa. El borrador se conserva hasta confirmar, los botones y un bloqueo síncrono evitan dobles envíos. App comparte una solicitud pendiente por hilo/destinatario/texto. La respuesta antigua no limpia otro hilo. | Error y reintento explícito, doble submit, respuestas rápidas, éxito, cambio de hilo y cambio de cuenta durante el envío. |
| Reinicio al publicar | Se reinician campos, estado, fecha, recompensa, imagen inicial, archivo y confirmación de ubicación únicamente después del éxito. Un fallo conserva el borrador. El cierre se bloquea mientras se guarda. | Fallo con borrador intacto, éxito y reapertura sin ubicación previamente autorizada, doble submit y GPS tardío de un formulario cerrado. |

Las funciones de carga de perfil, imágenes y configuración push aceptan un guard de
sesión opcional. Sus llamadores anteriores siguen siendo compatibles. El guard impide
continuar con escrituras después de esperas si la identidad ya cambió. Las respuestas
de mutaciones, lecturas, geolocalización y avisos también se descartan en App cuando
su sesión o componente dejaron de estar vigentes. Los canales y temporizadores se
retiran al desmontar la cuenta.

## Validación ejecutada

Desde `src/code`, usar el lock de npm del repositorio:

```sh
npm ci
npm run lint
npm test
npm run build
node tests/client-security.mjs
```

- TypeScript: correcto.
- `npm test`: 22 pruebas correctas, incluidas las cinco de matcheo previas.
- Cliente: 12 comprobaciones correctas.
- Seguridad SQL previa: 26 comprobaciones correctas en PostgreSQL efímero/PGlite.
  Para reproducirlas, consultar SECURITY_ROLLOUT.md: se ejecutan sólo contra la base
  local en memoria, sin URL o credenciales de Supabase.
- `git diff --check`: correcto.
- Los tests de componentes usan jsdom (dependencia sólo de desarrollo), React DOM,
  un backend simulado y Leaflet/GPS simulados. No eliminan publicaciones reales.
- Ninguna versión de las dependencias preexistentes se actualizó al añadir jsdom.
- No hay cambios de CSS ni de expresiones className/style en los componentes
  modificados. La compilación conserva el asset CSS `index-DVYIy_Vc.css` de Alexis.
- Vite mantiene la advertencia de bundle JavaScript mayor de 500 kB.

## Límites y revisión antes de publicar

1. Ignorar una respuesta tardía no revierte una petición ya aceptada por el servidor.
   Por ejemplo, una imagen cuya subida ya empezó podría terminar de guardarse antes
   de detectar un cierre de sesión. Esta etapa no borra esa imagen ni otros archivos.
2. No hay reintentos automáticos de mensajes. Los bloqueos cubren envíos concurrentes
   en esta sesión, no garantizan exactamente una inserción si el servidor guardó el
   mensaje pero se perdió la respuesta y luego se reintenta. Eso requiere una clave
   de idempotencia aceptada por el backend y una futura migración revisada.
3. La confirmación no cambia el DELETE original ni sus cascadas del backend. Antes de
   lanzar debe revisarse el archivado/retención de conversaciones. En este trabajo
   sólo se ejecutó el handler con un backend simulado; no se borraron datos reales.
4. Las suscripciones push ya registradas no se desvinculan automáticamente al cerrar
   sesión en esta etapa. Se impiden continuaciones tardías de activación/desactivación,
   pero el ciclo completo del dispositivo y su baja segura requieren otro cambio.
5. No se modifica el esquema, la seguridad RLS ni Firebase. Las migraciones del PR #23
   siguen pendientes según la auditoría. Esta etapa no sustituye SECURITY_ROLLOUT.md.
6. La defensa del mapa conserva registros heredados inválidos; la validación adicional
   en PostgreSQL debe proponerse por separado tras inventariar esos datos.
7. Quedan pruebas manuales en staging de varios navegadores y móviles, GPS real,
   pestañas concurrentes, refresco/expiración de sesión y errores de red del SDK.

Para revisar sin producción: usar usuarios/datos ficticios en staging y ejecutar los
casos de la tabla. Para revertir el cliente, retirar únicamente estos commits mediante
un PR; no hay una reversión SQL asociada ni archivos de datos que deban eliminarse.
