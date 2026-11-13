# Perfil y cierre de sesión — verificación local

## Problema y corrección

La salida existía únicamente dentro de Configuración. En la vista inicial del perfil
no había un acceso visible. Ahora la tarjeta de cuenta propia muestra «Cerrar sesión»
en todas sus pestañas, con estado ocupado y bloqueo de solicitudes repetidas.
El perfil vuelve al inicio del desplazamiento al entrar para evitar heredar el scroll
del listado. La presentación adapta tarjeta, estadísticas, publicaciones y ajustes
al escritorio y al celular; las pestañas admiten teclado y los ajustes tienen etiquetas.

La salida usa Supabase Auth con scope local (este dispositivo). El cambio de identidad
remonta el estado de cuenta, descarta borradores y protege contra respuestas antiguas.
Se intenta desvincular push antes de salir, sin borrar publicaciones ni conversaciones.
Un fallo de push se informa sin bloquear la salida. Las preferencias no privadas no se
borran. La pantalla de acceso permite ingresar con otra cuenta.

El SDK instalado elimina su sesión local incluso ante ciertos errores del endpoint
remoto de logout. En ese caso se muestra acceso sin sesión y un aviso de revocación
remota no confirmada; no se promete que el servidor haya invalidado sus tokens. Si un
SDK falla conservando la sesión, se mantiene el perfil con error y opción de reintento.
No se manipulan tokens mediante APIs privadas ni se vacía indiscriminadamente storage.

El nuevo perfil público, accesible desde una publicación, sólo presenta nombre, avatar
y publicaciones ya disponibles. Nunca muestra email, teléfono, configuración ni salida,
aunque su objeto en memoria contenga datos privados. Esto no sustituye RLS del backend.

## Comprobaciones ejecutadas

`npm run qa:local` finalizó correctamente:

- 112 pruebas de aplicación y TypeScript sin errores.
- 5 comprobaciones de entorno staging.
- Matriz SQL aislada PGlite: 58 casos con DATE, 58 con timestamptz, 61 con DATE observado;
  una comprobación adicional de orden completo. No se modificó SQL en esta entrega.
- Build de producción correcto.
- 28 E2E Playwright (Chromium escritorio y viewport móvil), incluyendo salida visible,
  duplicados, fallo remoto, recarga sin sesión, cambio de cuenta sin borrador anterior,
  perfil público, teclado, 320 px y axe sin infracciones graves/críticas en perfil/ajustes.
- 1 prueba PWA con build y 16 comprobaciones de seguridad del cliente.

Los E2E usan el SDK real con HTTP/WebSocket interceptados y usuarios ficticios.
No prueban revocación real en Supabase, entrega de correo, push remoto ni Safari físico.
No se accedió a producción, ni se desplegó Firebase ni se ejecutaron migraciones reales.
La revocación efectiva en staging y los permisos push reales siguen requiriendo una
sesión de staging autorizada. Ninguna cuenta real se utilizó para estas pruebas.

## Evidencia visual

Se guardaron capturas originales antes (commit ecbb3b7) y después, misma cuenta ficticia
y viewports desktop/mobile. El artefacto de entrega `buscag-profile-redesign/comparison.html`
contiene las cuatro capturas sin retoques. Las capturas quedan fuera del repositorio.
