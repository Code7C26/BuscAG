# Revisión estática para presentación: Firebase, cuentas y QR

13/11/2026. No se consultó ni modificó Supabase, Storage o Firebase. Las conclusiones
sobre el servidor se limitan al resumen de staging proporcionado por el titular;
no se dispone aquí del JSON completo ni de las definiciones reales de sus funciones.

## Commit y material excluido

El commit de interfaz incluye traducción ES/EN, navegación, animaciones, estilos,
rendimiento móvil y pruebas. No cambia el esquema, RPC de datos, autenticación,
cuentas preexistentes, permisos ni semillas. El modo invitado carece de entrada
UI y de importación desde App. Las pruebas de acceso exigen cuenta.

Los 20 archivos pospuestos de invitados se conservaron, byte por byte, fuera del
repositorio en `/workspace/work/buscag-presentation/deferred-guest/`. Su
`manifest.json` registra rutas originales, destinos y SHA-256. Incluyen propuesta
SQL, consultas de auditoría, informes, componentes y pruebas; no forman parte del
commit ni del artefacto. Se retiraron exclusivamente sus conexiones pendientes en
package.json, lib/supabase.ts y tests/security.mjs; estos dos últimos recuperan el
contenido original de HEAD. No se ejecutó SQL ni se tocaron funciones QR.

La búsqueda de patrones de claves privadas, JWT completos, claves secretas de
Supabase/AWS y URI PostgreSQL con contraseña en los 77 archivos inicialmente
pendientes no arrojó coincidencias. Se revisan además los archivos del índice antes
del commit. Esto no certifica la inexistencia absoluta de cualquier secreto.
Dependencias y lockfile sólo agregan i18next/react-i18next y sus dependencias; no se
incluyen node_modules, dist, capturas, trazas, logs, archivos .env o credenciales.

## Firebase: configuración compatible y límites

| Elemento | Configuración local | Conclusión |
| --- | --- | --- |
| Firebase CLI | `.firebaserc` usa proyecto `buscag-2677c`. | No demuestra acceso remoto ni existencia del sitio; no se consultó el servicio. |
| Presentación | `firebase.presentation.json`: sitio explícito `buscag-prueba`, directorio `dist-presentation`. | Es la configuración apropiada para este ensayo; no usar el despliegue genérico. |
| Configuración habitual | `firebase.json` publica `dist`, sin el sitio de presentación fijado. | Un comando genérico podría publicar otro artefacto o destino. No ejecutarlo para esta presentación. |
| Build de presentación | `npm run build:presentation` exige árbol limpio y registra HEAD; ignora variables VITE ambientales de producción y apunta a `yiarlhpbgkofhhipkfha`. | Preparación local sin despliegue. Su clave pública configurada debe corresponder realmente a staging; el formato de una clave opaca no verifica pertenencia remota. |
| Origen | `https://buscag-prueba.web.app`, sesiones con clave local separada de producción. | Una cuenta existente puede necesitar iniciar sesión nuevamente; no se recrea ni elimina. Auth debe admitir este origen y sus redirecciones, pendiente de comprobar en el ensayo. |
| Rutas | Reescritura SPA a index.html. | Compatible con sección, retorno de Auth y enlaces QR; no registra ni cambia tokens en servidor. |
| CSP | Scripts propios, estilos inline permitidos, HTTPS/WSS de staging, imágenes de staging/Unsplash/UI Avatars y tiles OSM. | Compatible estáticamente con i18next, chunks, Leaflet y offline.js. Las fotos existentes que apunten a producción u otros dominios pueden quedar bloqueadas: verificar URLs reales sin ampliar CSP ni reescribir datos a ciegas. |
| Caché | Assets con hash inmutables; index y sw sin caché; fallback público offline v3. | Las pestañas antiguas y el ciclo de actualización del service worker pueden conservar la versión anterior hasta cerrarlas y reabrirlas. Verificar el aviso de versión del commit; no confundirlo con una publicación nueva. |
| Backend opcional | No se instala ni activa nada. | Coincidencias/avisos automáticos, push, QR y recuperación requieren el backend existente disponible. La UI no lo acredita por sí sola. |

El build de producción y las pruebas de navegador simuladas no certifican el
Hosting remoto, sus encabezados efectivos, la whitelist de Auth, correo, push,
buckets o RLS reales. No hay incompatibilidad estática identificada que exija
cambiar Supabase. La preparación local no autoriza desplegar ni abrir a público
sin completar el ensayo de `PRESENTATION_STAGING_CHECKLIST.md`.

## Diferencias QR investigadas sin modificar funciones

Referencia local: `supabase/proposals/20261105000000_school_features.sql`.
Ambas definiciones son idénticas a HEAD; no tienen cambios pendientes:

| Función | Cuerpo local (MD5 de comparación, no firma de seguridad) | Comportamiento local |
| --- | --- | --- |
| `resolve_object_tag(uuid)` | `9b48814d9542a99ddb79df3b41916069` | SQL STABLE SECURITY DEFINER, search_path vacío. Por token habilitado devuelve item_id, categoría y estado permitidos. |
| `manage_object_tag(uuid,boolean,boolean)` | `c8ffe7654b2c7e6864188968805e473c` | PL/pgSQL SECURITY DEFINER, search_path vacío; exige auth.uid propietario, valida opciones y permite habilitar, rotar o revocar su etiqueta. |

El permiso local de resolve se concede primero a authenticated y al final también
a anon. No son dos cuerpos diferentes: el GRANT final agrega la ruta pública QR.
El resumen real de staging confirma SECURITY DEFINER y ejecución anónima, de modo
que no prueba una divergencia de permisos respecto de este archivo. El comentario
que dice «never identity» no debe interpretarse como anonimato absoluto: item_id
es un identificador enlazable aunque no sea el ID del propietario. El token opera
como enlace de acceso revocable; categoría/estado/ID quedan públicos para su poseedor.
Esto pertenece al QR existente y es independiente del modo invitado pospuesto.

La pantalla `PublicObjectTag.tsx` y los controles de `ItemSchoolTools.tsx` tienen
cambios previos de presentación/traducción. Conservan los nombres RPC, parámetros,
validación UUID y de categorías/estados, control de montaje, confirmación de rotación
y requisito de sesión para contactar. No se cambiaron lib/schoolFeatures.ts,
funciones SQL ni sus permisos. No se generan, rotan ni revocan tokens en esta revisión.

Quedan por verificar en staging: cuerpo/firma y sobrecargas reales, propietario y
membresías, search_path, permisos efectivos de manage, RLS/ACL de object_tags,
generación/unicidad del token y resolución/revocación reales. Un hash distinto
exige revisar la definición real; no actualizar el hash esperado automáticamente.
No se ejecutaron consultas adicionales ni las consultas anteriormente autorizadas:
no hay una conexión de staging inequívocamente verificada en esta tarea.

## Estado de aceptación

Apta técnicamente para un ensayo controlado con las cuentas existentes una vez
servido el artefacto correcto. No aceptada todavía para presentación final ni
usuarios abiertos: falta comprobar los flujos reales, los recursos externos y el
comportamiento en un teléfono físico. QR no queda certificado por esta revisión.
