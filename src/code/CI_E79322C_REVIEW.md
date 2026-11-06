# Revisión de CI e79322c y de school_features

## Evidencia del fallo 42133829042

Se descargaron el log del job 127616811693 y el artefacto 13463934366.
La aserción original falló esperando cinco segundos el H1 «Lo importante…».
La captura y el contexto, tomados después de esa espera, sí contienen ese H1,
usuario autenticado y publicación cargada. No hay evidencia de un texto cambiado
ni de rechazo de credenciales. El log informa 47 E2E aprobados y uno fallido.
No había traza de red de ese caso: no se puede atribuir retrospectivamente la
latencia a un archivo exacto a partir de la captura sola.

El código envolvía toda la cuenta en un único Suspense. Publicación, detalle y
comparación se montaban también cerrados: sus imports pendientes ocultaban el
inicio completo. El detalle ahora importa QR/Leaflet, aumentando esa dependencia
innecesaria. e79322c no cambió la UI; el fallo reveló un problema de carga previo,
sensible a la velocidad del runner. Es un problema real de carga, no una razón
para cambiar el selector o ampliar su timeout.

## Reproducción y corrección

Se añadió una prueba que retiene expresamente la descarga del módulo de detalle.
Con el código anterior reproduce el mismo timeout de cinco segundos buscando el
mismo H1. Con la corrección, el inicio y el formulario se usan mientras la descarga
sigue retenida, tanto en escritorio como en móvil. El borrador sobrevive al cierre
y reapertura del formulario.

Cada vista/modal tiene ahora su propio límite Suspense. Un modal cerrado no
reemplaza el inicio por el indicador global de carga. Los formularios permanecen
montados para conservar sus borradores; el desmontaje de la cuenta sigue limpiando
los datos privados al cerrar sesión. No se añadieron retries, no se aumentó ningún
timeout ni se eliminó la prueba que falló. Los rechazos reales de imports siguen
llegando al ErrorBoundary; una carga pendiente abierta tiene su estado visible.

## Revisión SQL y activación

Se encontró otro bloqueo reproducible con dos conexiones a PostgreSQL 17 aislado:
una transacción set_item_watch retenía FOR UPDATE sobre items, impidiendo los
KEY SHARE usados por las FK de avisos del worker. La prueba anterior a la corrección
terminó con SQLSTATE 57014. Podía causar espera o ciclos de bloqueo con la cola.

Las RPC escolares usan ahora FOR NO KEY UPDATE sobre items. Serializa escrituras
de contenido/propietario y evita borrado/cambio de clave, pero permite las FK del
worker. Ninguna RPC modifica la clave primaria. Se conserva FOR UPDATE en la fila
de confirmación y en la cola; no se eliminaron comprobaciones de identidad ni RLS.
La prueba concurrente exige que el worker termine con cero fallos y dos avisos
mientras la transacción de vigilancia aún está abierta.

El preflight ahora rechaza ausencia de dependencias, roles privilegiados,
USAGE pública del esquema privado, RLS/ACL incompatibles, INSERT directo de
publicaciones/mensajes y tipos distintos de DATE/timestamptz. Se prueba que un
esquema con RLS desactivado o ACL de INSERT ampliada se rechaza antes de crear
las tablas escolares. La transacción conserva publicaciones, perfiles y mensajes.

Esas comprobaciones no certifican por sí solas el contenido de todas las políticas
ni los servicios internos de Supabase. Antes de aplicar, obtener en **staging**
un catálogo reciente con supabase/audit/production_diagnostic.sql y cotejar sus
expresiones RLS con la línea base; no basta comprobar los nombres de políticas.
Usar el orden de SCHOOL_FEATURES.md, con rol postgres/propietario de las tablas.
Si matching ya está activo, autorizar una pausa antes del mantenimiento; nunca
reinstalar la línea base para forzar un resultado del instalador.

Se mantienen pendientes de autorización/verificación real: backup propio de staging,
aplicar esta propuesta, pg_cron o scheduler Edge, heartbeat/activación, correo,
ensayo entre cuentas y cliente público. Se conservan las decisiones documentadas:
FK RESTRICT para historial bilateral, sin purga automática; QR anónimo limitado a
categoría/estado permitidos; métricas INVOKER bajo RLS; worker privado y sin grants
amplios. No se modificaron bases remotas, main, German ni Firebase.

## Comprobaciones de esta corrección

- Batería completa local: 121 lógica/DOM, 50 E2E, TypeScript, build, PWA y
  presentación con APIs interceptadas; 16 controles de seguridad del cliente.
- Veinte ejecuciones dirigidas aprobadas: prueba original y descarga retenida,
  cinco repeticiones de cada una en escritorio y móvil, sin retries ni timeouts nuevos.
- PGlite: 13 grupos escolares por variante; PostgreSQL 17 nativo: 14 por variante,
  sobre DATE, timestamptz y estructura observada. TLS: tres pruebas aprobadas.
- Los fallos antes de las correcciones se reprodujeron deliberadamente; no se
  confunden con el resultado de estas baterías finales. Servicios Supabase reales
  y aplicación de migraciones continúan pendientes de autorización.

## Segundo resultado remoto y ajuste del entorno E2E

La ejecución 42136336615 de fad0057 no aprobó: 49/50. El inicio pasó y el fallo
se desplazó a esperar el diálogo de publicación tras el clic. Su captura/contexto
vuelven a mostrar el inicio, sin diálogo ni fallback de formulario pendiente. La
primera corrección era necesaria, pero no bastó para cerrar el incidente. No se
presenta ese resultado como un CI exitoso.

Los E2E utilizaban el servidor de desarrollo con compilación y optimización tardía
más HMR. Su primera carga puede introducir esperas/recargas que no existen en
Firebase estático. Sin traza no se afirma retrospectivamente cuál evento exacto
perdió la acción. La aceptación ahora utiliza el cliente realmente compilado en
modo staging, servido por preview en 127.0.0.1, sin HMR. Las aserciones originales
siguen intactas y se añade el requisito de que abrir el formulario no recargue el
documento. Leaflet y qrcode se preoptimizan también para el ensayo de desarrollo.

La prueba de módulo retenido cubre tanto la URL fuente como el chunk compilado;
no se desactivó. El backend continúa interceptado. Service workers se bloquean
únicamente en esos E2E para permitir intercepción fiable: las pruebas separadas
PWA/presentación siguen ejecutándose. Se retienen trazas sólo al fallar para que
un nuevo incidente tenga evidencia de navegación/red, con las cuentas ficticias
de este entorno. No se incluyen servicios ni credenciales reales.

La batería local completa volvió a aprobar con el servidor compilado: 50 E2E,
121 lógica/DOM, TypeScript/build, controles de seguridad y pruebas PWA separadas.
También aprobaron veinte repeticiones dirigidas con la nueva comprobación de
una sola navegación de documento al abrir el formulario. El resultado del CI
remoto se comprobará para el SHA final, sin reutilizar éxitos de otros commits.
