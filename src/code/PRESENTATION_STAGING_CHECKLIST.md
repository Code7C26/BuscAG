# Ensayo real de la presentación de BuscAG

Preparado el 13/11/2026. Esta guía no ejecuta acciones remotas. El ensayo manual
queda pendiente; no marcar resultados por haber pasado pruebas con fixtures.

## Entorno y cuentas

- Proyecto Supabase único: `yiarlhpbgkofhhipkfha` (staging). Frontend previsto:
  `https://buscag-prueba.web.app`. No usar el sitio productivo para el ensayo.
- Elegir dos cuentas de prueba existentes, A y B, desde el registro privado de
  cuentas. Abrirlas en perfiles de navegador distintos o dispositivos separados.
  No copiar contraseñas, cookies, enlaces de recuperación o tokens al informe.
- Confirmar que ambas cuentas ingresan antes de cambiar contenido. No recrearlas,
  cambiarles contraseña ni modificar sus permisos para hacer pasar una prueba.
- Registrar commit, fecha, navegador, dispositivo e idioma; guardar sólo evidencias
  sin datos privados. Para cada paso usar PASS / FAIL / BLOQUEADO y detalle breve.
- El sitio aún no fue publicado por este trabajo. Si sigue sirviendo una versión
  anterior, ese ensayo no valida el commit nuevo. Ver `FIREBASE_QR_STATIC_REVIEW.md`.
- Usar únicamente publicaciones nuevas con prefijo `PRESENTACIÓN QA`, fotografías
  propias de objetos de prueba y una referencia pública de ubicación. No incluir
  rostros, documentos, domicilios ni metadatos sensibles. No editar datos ajenos.

## Secuencia de pruebas

| Paso | Acción manual | Resultado esperado |
| --- | --- | --- |
| 1. Acceso | Abrir sin sesión, también con `?section=profile`. Ingresar con A y con B por separado. | Se exige cuenta; no hay botón ni navegación invitada. Cada cuenta ve su identidad y sus permisos habituales. |
| 2. Idiomas | Verificar español inicial en un perfil sin preferencia. Elegir inglés, recargar, abrir otra pestaña y volver a español. | La elección persiste y se sincroniza. Navegación, errores, fechas y formularios cambian; títulos, mensajes del usuario y categorías almacenadas no se traducen ni se alteran. |
| 3. Publicar e imagen | A publica un objeto perdido `PRESENTACIÓN QA Mochila azul`, con descripción, categoría y foto propias y punto público confirmado. | Se crea una sola publicación, con la imagen correcta y sin duplicaciones al recargar. El formulario muestra errores útiles para datos faltantes. |
| 4. Editar | A cambia descripción y foto de su publicación; guardar y recargar. B abre el mismo detalle. | Cambios persistidos, autoría conservada, imagen visible en ambas cuentas. B no obtiene controles de edición del objeto de A. |
| 5. Mapa y filtros | Buscar el título y filtrar categoría/estado. Abrir mapa y cambiar de pestaña y volver; probar coordenadas públicas sin GPS y, opcionalmente, ubicación del navegador. | Pines, detalle y filtros coherentes; no se pierde estado ni se recorta contenido. Denegar GPS deja alternativas por texto. Nunca se necesita alterar permisos de Supabase. |
| 6. Coincidencias | B publica un objeto encontrado de prueba, misma categoría, fecha, lugar y descripción compatibles con el perdido de A. | Se puede abrir la coincidencia y su comparación. No se mezclan propietario perdido/encontrado ni se trata un recuperado como candidato activo. La entrega de avisos automáticos depende del worker existente; registrar su disponibilidad real sin activarlo. |
| 7. Mensajes | B contacta a A desde el objeto; intercambiar mensajes en ambos sentidos. Recargar y revisar bandeja y lectura. | Mensajes en la conversación correcta, sin duplicados y con estado de lectura coherente. Los teléfonos se muestran sólo si se cumplen los consentimientos existentes y el intercambio bilateral. |
| 8. Borrador y reconexión | Escribir un borrador, cerrar y reabrir el chat. Desconectar Internet, intentar enviar una sola vez y reconectar. | El borrador se conserva en esa pestaña; el pendiente se distingue de un envío confirmado, se reconcilia sin duplicar y no pasa a otra cuenta. |
| 9. Notificaciones | Abrir un aviso generado por los pasos anteriores, marcarlo como leído y recargar. | Contador correcto y destino válido; cambios persistidos. Si el servidor no generó aviso, registrar BLOQUEADO y separar ese diagnóstico de la navegación. |
| 10. Recuperación bilateral | Con los dos participantes vinculados, solicitar recuperación desde la cuenta autorizada y confirmarla desde la contraparte. | Estado recuperado sólo tras la confirmación requerida, autoría sin transferir y conversación conservada. Recargar ambas cuentas y comprobar persistencia. |
| 11. Rechazo e individual | En publicaciones adicionales de prueba, rechazar una solicitud. Probar declaración individual sólo donde el servidor la admita y con consentimiento explícito. | El rechazo no marca recuperado; no hay atajos si falta el backend. La declaración individual se distingue de una devolución bilateral. No reutilizar el objeto del paso 10 como candidato activo. |
| 12. Perfil y privacidad | Abrir perfil propio y público de la contraparte, revisar configuración y cambiar de pestaña. | Datos y controles correctos, sin teléfono/localidad privados expuestos en el perfil público. No modificar los datos de las cuentas para este ensayo salvo una acción de prueba acordada. |
| 13. Cierre de sesión | Guardar un borrador privado, salir de A y entrar con B en el mismo navegador. Repetir en el otro perfil. | Se limpia la sesión y los borradores privados de la cuenta saliente, sin borrar cuentas. No reaparecen conversaciones, pendientes ni datos de A dentro de B. |
| 14. Dispositivos | Repetir lo principal en 320–390 px, escritorio y teléfono físico modesto, en ES/EN. Activar movimiento reducido. | Sin desplazamiento horizontal; modales con teclado y foco correcto; ayuda sin tapar controles; navegación y mapa utilizables sin animaciones obligatorias. |
| 15. Sin conexión | Con la versión nueva ya instalada, desconectar y recargar. Probar después de elegir ambos idiomas. | Respaldo público en el idioma elegido; no se muestran publicaciones ni mensajes desde caché privada. |

Las notificaciones push externas se comprueban aparte sólo si ya están habilitadas
y su configuración existente está confirmada. No cambiar claves VAPID, scheduler,
permisos, buckets ni políticas para completar el ensayo. Correo, recuperación de
contraseña y alta de cuentas nuevas tampoco se dan por verificados con este plan.

## Cierre y aceptación

No borrar en masa publicaciones o conversaciones al terminar. Inventariar los IDs
sintéticos creados en un registro privado y acordar su conservación o limpieza por
separado; nunca incluir tokens QR ni credenciales. No usar SQL para la limpieza.

La versión es aceptable para el ensayo controlado cuando las dos cuentas existentes
pueden ingresar y los flujos centrales pasan. Una falla de privacidad, cruce de
cuentas, pérdida de mensajes, imagen incorrecta o recuperación sin consentimiento
bloquea la presentación. Si un módulo opcional no está disponible en staging,
registrarlo y excluirlo explícitamente del guion, sin aplicar migraciones.

La publicación en Firebase y el push de Git necesitan autorización separada.
