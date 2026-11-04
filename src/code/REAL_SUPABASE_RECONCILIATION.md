# Reconciliación con el diagnóstico real de Supabase

**Ensayo adicional de recuperación:** [RECOVERY_REHEARSAL.md](RECOVERY_REHEARSAL.md), con pg_dump/pg_restore nativos y verificación reforzada del respaldo de imágenes.

Fuente: buscag_production_diagnostic.json, analizado completo de forma local.
Se conserva sólo una selección técnica sin OID, datos de usuarios, claves ni cuerpos
de funciones en tests/fixtures/observed-production-contract.json. Su SHA-256 identifica
el archivo de origen. No se consultaron ni modificaron filas del proyecto real.

## Hallazgos confirmados por el catálogo y reproducidos localmente

| Gravedad | Hallazgo | Consecuencia / corrección preparada |
| --- | --- | --- |
| Alta | INSERT de items permitido a anon y autenticados con WITH CHECK true; políticas permisivas se suman por OR | El propietario puede falsificarse usando un UUID existente. Baseline 20261103000000 y RPC owner-bound cierran el acceso. Prueba con anon y datos ficticios antes/después. |
| Alta | SELECT completo de profiles para authenticated con USING true | Los campos phone/location de terceros son accesibles por API. No se inspeccionaron sus valores reales. Baseline de perfiles crea directorio y limita contacto a conversación recíproca. |
| Alta | Columnas rating/contact_count editables por su propietario, sin otras restricciones que lo impidan | El ensayo de roles reprodujo autoasignación de reputación y contador. Los grants por columna del baseline lo impiden. El permiso UPDATE de owner_id, por sí solo, no prueba cambio de dueño: WITH CHECK ya exige el UID propio. |
| Alta funcional | INSERT de messages consulta messages en su propia política y compara columnas consigo mismas | Se reprodujo 42P17 (recursión de RLS). No afirmar que hoy permita enviar a cualquiera: la recursión impide la inserción. El helper del baseline elimina ambas causas y verifica el hilo concreto. |
| Media | Items permite NULL en título, descripción, categoría, estado, lugar, coordenadas, fecha e imagen | Posible fallo de búsqueda/mapa o encabezados; no prueba que ya existan esas filas. Se corrigieron tipos/mapeo defensivo, etiquetas y edición explícita. El trigger de mensajes ahora admite títulos/imágenes NULL sin romper NOT NULL de messages. |
| Media | No existen CHECKs de categoría/estado en items | El RPC dependía del CHECK del bootstrap para categoría. Ahora valida explícitamente; el cuarto candidato valida también INSERT/UPDATE de contenido sin exigir reparar otros campos históricos no cambiados. |
| Alta por conservación | FK items→messages y profiles→messages usan ON DELETE CASCADE | Borrar publicación/cuenta borra conversaciones asociadas. Se reprodujo con rollback; no se cambió esta política. La confirmación de borrado informa la pérdida de conversaciones. Decidir retención antes del lanzamiento. |
| Bloqueo funcional | public_profiles, push_subscriptions, esquema/recibos/colas y RPC nuevos no constan instalados | Código en Alexis no equivale a backend activado. Instalar por etapas sólo después del respaldo/restauración y verificar cliente compatible. |

Los roles anon/authenticated no tienen superusuario, BYPASSRLS, CREATE de esquema ni
membresías privilegiadas declaradas. BYPASSRLS de service_role es esperado: su clave
sigue siendo exclusivamente de servidor. Hay tres tablas en supabase_realtime,
correctamente publicadas: items, messages, notifications. realtime.messages es otra
tabla administrada; ningún script la modifica.

## Riesgos condicionados o datos que el JSON no demuestra

- Los ACL incluyen TRUNCATE/REFERENCES/TRIGGER/MAINTAIN para roles cliente. TRUNCATE
  no respeta RLS y el ensayo SQL con anon lo permitió antes del baseline. Esto no
  significa que DELETE REST trunque tablas: hace falta una ruta SQL, por ejemplo un
  RPC inseguro. El baseline revoca esos privilegios. La nueva sección 21 del
  diagnóstico inventaría RPC públicos adicionales, que el export anterior no listaba.
- Las tres funciones handle_new_auth_user, notify_message_recipient y
  notify_item_recovered tienen propietario/configuración previstos, pero sus hashes
  difieren de las últimas definiciones históricas del repositorio. Una diferencia
  puede ser sólo formato. El JSON no incluye cuerpos: revisión privada obligatoria
  antes de afirmar equivalencia o reemplazar lógica. No se sobrescribieron esas funciones.
- Los defaults de seis columnas de texto se exportaron como [default omitted]. La
  presencia/tipo se reproduce; sus literales no se conocen. El fixture usa '' como
  sustituto declarado. No se infiere el contenido real de perfiles ni publicaciones.
- Faltan configuración del bucket, RLS de storage.objects, límites/MIME efectivos,
  Auth/SMTP/URLs, sesiones reales, webhook, VAPID, programación y entrega push.
  Ejecutar storage_configuration.sql sólo como SELECT para completar Storage.
- La ausencia de schema_migrations no prueba qué archivos se ejecutaron en el pasado;
  sí se comprobó que las protecciones nuevas no están reflejadas en este catálogo.

## Qué se implementó

1. Row de items ahora refleja su nulabilidad. Lecturas convierten texto ausente a
   cadena vacía y coordenadas ausentes a NaN; nunca inventan fecha, ubicación, estado
   ni categoría. Se conservan clasificaciones antiguas no vacías en el modelo.
   Tarjeta/detalle muestran ausencia de datos sin nuevos estilos. La edición exige
   elegir clasificación válida, ubicación, fecha y foto; no guarda placeholders como títulos.
2. Canonización del nuevo mensaje obtiene un título legible e imagen vacía si la
   publicación histórica no los tiene. No modifica la publicación. Coincidencias
   usan el texto disponible y descartan categoría vacía/NULL, fecha o coordenadas inválidas.
3. Nuevo candidato 20261104003000_validate_legacy_compatible_writes.sql:
   valida nuevas/alteradas columnas de contenido; no añade NOT NULL, no reescribe ni
   valida masivamente filas antiguas. Counter/read-receipt y recuperación no requieren
   completar otros campos. Un BEFORE de notificaciones completa sólo texto ausente
   de un nuevo aviso recovered; preserva el trigger existente y su lógica.
4. Diagnóstico/analizador detectan nulabilidad, CHECKs faltantes, cascadas, ACL de
   TRUNCATE, diferencias de cuerpos y superficie pública de RPC; nunca aprueban
   producción automáticamente. Se añadió consulta SELECT de configuración Storage.
5. Matriz de tres variantes: contrato del repositorio con DATE, con timestamptz y
   estructura observada con DATE. Se verifica igualdad de 41 columnas (orden, tipo,
   nullability/default presence), 15 constraints lógicos, 9 índices, 20 políticas,
   12 permisos de tabla y 82 permisos por columna, antes de corregirlos.

## Alcance real de la reproducción aislada

Se usa PostgreSQL sin red/puertos y datos ficticios. Estructura y políticas de las
cuatro tablas públicas se reproducen según el export. Auth/Storage sólo tienen
sustitutos mínimos de prueba y las funciones cuyos cuerpos faltan usan versiones del
repositorio. No es un clon completo de Supabase ni una restauración de datos reales.
PGlite puede catalogar NOT NULL como constraints adicionales; la comparación lógica
los cuenta mediante las columnas, sin confundirlos con los 15 constraints exportados.

Además de la matriz, activation-order.mjs instala los ocho archivos en el orden
recomendado ANTES de activar, comprueba cada vez que las filas preexistentes quedan
intactas y ejecuta publicación/reintento, coincidencias de ambos dueños, mensajes de
ida/vuelta/reintento, aislamiento de un tercero y recuperación que conserva el chat.

## Orden manual revisado

Ver BACKEND_ACTIVATION.md para respaldo completo de DB/Auth/Storage y reversión.
No ejecutar todavía escrituras contra producción sólo por recibir este informe.

1. Respaldar y ensayar restauración aislada; revisar privadamente las tres funciones
   existentes y completar inventario RPC/configuración Storage con los SELECT preparados.
2. Confirmar cliente publicado compatible con RPC/estado deshabilitado. No se desplegó
   Firebase; un bundle viejo no funciona al revocar INSERT directo.
3. Ensayar en staging, en este orden, los cuatro baseline de noviembre: 000000
   items/messages, 001000 profiles, 002000 notifications, 003000 push_subscriptions.
   Usar los nombres completos de la tabla de BACKEND_ACTIVATION.md.
4. Después, proposals de mensajes 20261104000000, coincidencias 20261104001000,
   publicaciones 20261104002000 y validación compatible 20261104003000. La coincidencia
   queda deshabilitada. Cada archivo tiene transacción independiente. No ejecutar bootstrap.
5. Desplegar/configurar manualmente worker y planificador protegido; comprobar HTTP
   con enabled:false y heartbeat reciente. Configurar push por separado si se requiere.
6. Sólo con autorización, backup probado y ventana sin publicaciones en curso, aplicar
   enable_trusted_matches.sql. Verificar backend_readiness.sql, permisos y pruebas reales
   con cuentas de staging. No hay backfill ni limpieza de conversaciones/imágenes.

La reversión de la validación puede retirar sus dos triggers nuevos conservando
funciones/datos; hacerlo sólo tras revisar dependencias. Esto reabre escrituras
inválidas y necesita aceptación del riesgo. No restaurar permisos amplios, DROP
CASCADE ni un backup viejo sobre producción como primer mecanismo de reversión.


## Validación completada

- Aplicación/herramientas: 92/92; cliente: 16/16.
- PostgreSQL 17: 61/61 (DATE repositorio), 61/61 (timestamptz), 64/64 (estructura observada).
- PGlite: 58/58, 58/58 y 61/61 respectivamente.
- Ensayo independiente del orden de ocho archivos y activación: aprobado en ambos motores.
- TypeScript, build y Deno check --frozen de ambas funciones: correctos.
- Sin cambios de estilos, colores, tipografía ni distribución. Los componentes sólo
  incorporan tratamiento de datos ausentes, clasificación explícita y avisos de seguridad.
- No se ejecutaron migraciones, escrituras, backups ni despliegues contra producción.
