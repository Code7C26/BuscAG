# Avances sobre PR #25: candidatos y operación segura

Base exacta: `production/auth-data-readiness` en `e70a0c3`. Rama derivada:
`production/next-functional-advances`. El PR de esta rama apunta a la primera,
no a Alexis. No se ejecutaron SQL remotos, despliegues ni cambios en datos reales.
Los cuatro archivos de migraciones del PR #23 se conservan sin cambios.

## Evidencia disponible y límites

No llegó el diagnóstico adjunto anunciado: el único archivo de texto disponible
contiene instrucciones. Los tipos/constraints reales adicionales, triggers,
propietarios de funciones, grants heredados y buckets siguen pendientes de cotejo.
Las pruebas reproducen **el contrato del repositorio y la deriva confirmada por el
titular**, no una copia del esquema remoto. También corren en PostgreSQL 17 nativo
sin red, además de PGlite; no prueban Auth, PostgREST, Storage ni Realtime remotos.

Se amplió `supabase/audit/production_diagnostic.sql`: sigue siendo un solo SELECT,
no lee filas de aplicación, no devuelve cuerpos/argumentos de triggers ni secretos.
Agrega grafo de FK con acciones ON DELETE, existencia de los nuevos objetos y ACL
por RPC/tablas privadas. Ejecutarlo manualmente antes de decidir cualquier cambio.
La ausencia de `supabase_migrations.schema_migrations` **no demuestra** qué SQL se
aplicó: comparar políticas, grants, tipos, defaults, firmas, fingerprints y triggers.
No crear historial ficticio ni ejecutar a ciegas las migraciones históricas.

## Funcionalidades implementadas

- Mensajes: RPC transaccional con clave UUID por intento, contenido canónico obtenido
  del servidor, permisos de conversación y recibo privado. Reintentar devuelve el
  mismo mensaje sin repetir notificación/contador. Límite por usuario: 120 nuevos
  mensajes/minuto; repetir uno aceptado no consume cupo. Bloqueo por usuario protege
  concurrencia. Las claves viven en memoria de la cuenta: no promete idempotencia
  tras recargar/cerrar el navegador. Las eliminaciones ya permitidas pueden eliminar
  el recibo junto con su mensaje; no constituye una política de conservación.
- Coincidencias: trigger liviano en altas/ediciones relevantes; cola por publicación;
  procesador exclusivo service_role; hasta 20 lotes de 200 candidatos por RPC (worker
  usa 5). Cursor y bloqueo de worker, índice por categoría/estado/id y ledger por
  par/destinatario. Cada lote fallido revierte sus avisos/ledger y conserva el trabajo
  con backoff de 15 segundos a una hora; registra sólo SQLSTATE. Notifica a ambos propietarios una sola vez, incluso si ambos
  objetos fueron encolados o se editan después. Ignora dueño NULL/mismo dueño,
  coordenadas inválidas, fechas incompatibles y texto débil.
- Alertas automáticas requieren dos palabras exactas distintas y puntaje >=75.
  Normalización y pesos coinciden con el motor actual para estos casos; analiza los
  primeros 10.000 caracteres combinados para limitar trabajo. Las sugerencias de UI
  conservan su criterio más amplio, incluidas coincidencias parciales.
- `process-matches`: Edge Function POST, secreto independiente del servidor de
  32–512 caracteres, autenticación antes de acceso a DB, lote fijo y timeout de la
  llamada RPC. No acepta SQL, destinatarios ni límites del cliente. Configuración
  local `verify_jwt=false` permite al planificador usar ese secreto: el handler sigue
  siendo obligatorio y deniega acceso si falta configuración.
- El cliente consulta capacidad del backend antes del aviso local. Sólo PGRST202
  habilita compatibilidad antigua; errores inciertos no disparan otra escritura.
  Igual para mensajes: **nunca** fallback tras timeout/error de permisos/red.
- Realtime: reconciliación completa al suscribir/reconectar, recuperar red y volver
  a la pestaña; cooldown de foco/visibilidad y cola existente que serializa lecturas.
  Se limpian listeners y se descartan callbacks de cuentas anteriores.
- Recuperación: sólo propietario, confirmación nativa y una petición compartida ante
  clics repetidos; celebración sólo tras respuesta confirmada.
- Lecturas: capturan IDs visibles, escriben lotes de 100 y actualizan sólo IDs
  confirmados. Avisos/mensajes llegados durante la petición conservan su estado.
  Un cambio de callback de lectura no borra el borrador del chat.

Las propuestas están en `supabase/proposals/`, **fuera de migraciones automáticas**:
no hay autorización ni evidencia suficiente para aplicarlas a producción. Los
preflight rechazan tipos incompatibles, RLS desactivado y columnas obligatorias
inesperadas. Las tablas privadas no admiten acceso de anon/authenticated/service_role;
las funciones con propietario confiable acceden con SECURITY DEFINER y search_path
vacío. Service_role sólo puede invocar el procesador público mediante su EXECUTE.

## Respaldo y aplicación, a cargo del operador tras revisión

1. Confirmar proyecto y obtener el diagnóstico completo. Exportar definiciones de
   RLS, grants por columna/tabla, funciones y triggers de forma segura para restaurar
   la configuración exacta. No compartir cuerpos con secretos ni incluirlos en Git.
2. Verificar backup administrado/PITR disponible y su fecha/retención. Hacer además
   exportación lógica cifrada fuera del repositorio; el dump normal de CLI puede
   excluir esquemas administrados. Confirmar cobertura de Auth, perfiles, publicaciones,
   mensajes, avisos y metadatos de Storage. Los dumps de DB **no incluyen los bytes**
   de las imágenes: respaldar objetos por separado, con inventario y comprobaciones.
3. Restaurar backup en proyecto/base aislada y comprobar conteos, referencias y acceso
   a imágenes. No considerar suficiente la mera descarga de un archivo. No sobrescribir
   producción para probar el respaldo. Congelar escrituras sólo en la futura ventana
   de mantenimiento si hace falta garantizar un corte consistente entre DB/Storage.
4. Cotejar/adaptar las cuatro migraciones PR #23 en el clon. Orden: items/messages,
   profiles/directorio, notifications, push_subscriptions. Conservar propietarios
   NULL y contenido existente; no asignar autores ni rellenar datos adivinados.
   Simular registro/confirmación, perfil propio/público, publicación, respuesta de
   dueño, contacto recíproco, recuperación y recibos bajo roles reales (no sólo SQL Editor).
5. Preparar frontend compatible con RPC/fallback antes de revocar INSERT directo de
   mensajes. Clientes antiguos abiertos no usan el RPC: requieren actualización o una
   ventana controlada; no prometer compatibilidad con esos clientes tras la revocación.
6. Probar `20261104000000_message_receipts.sql` en el clon. Revisar el límite de 120/min
   con el uso esperado. Después de autorización explícita, aplicarlo con un propietario
   confiable, transacción completa y verificación de permisos y datos preservados.
7. Antes del segundo candidato, desplegar/configurar manualmente el worker y un
   planificador periódico privado, con `MATCH_WORKER_SECRET`, `SUPABASE_URL` y
   `SUPABASE_SERVICE_ROLE_KEY` sólo en servidor. El planificador debe enviar POST con
   Authorization Bearer del secreto independiente; el secreto nunca va en URL ni VITE.
   No se crea un planificador desde el repositorio. Antes de instalar el SQL, el RPC
   ausente fallará de manera segura; verificar que los reintentos estén configurados.
8. Tras validación en clon y autorización, aplicar
   `20261104001000_trusted_matches.sql`. Este punto habilita la capacidad y revoca
   INSERT de avisos del cliente: **sin worker programado los avisos quedarían pendientes**.
   Verificar dos cuentas sintéticas, avisos de ambos lados, reintentos y ediciones sin
   duplicar. Monitorizar cola y fallos con acceso de operador; no exponerla por API.
9. No hay backfill: las publicaciones anteriores quedan intactas. El ledger empieza
   vacío, por lo que no deduplica retrospectivamente avisos antiguos del cliente cuyo
   par completo no estaba registrado. Una edición futura puede generar su primer aviso
   backend sobre un par anteriormente notificado por el sistema antiguo. Resolver un
   eventual backfill/deduplicación histórica sólo con política y autorización separadas.
10. Push sigue requiriendo tabla, VAPID, despliegue, webhook protegido y pruebas en
    navegadores reales. Las filas de notificación se crean aunque push esté desactivado.
    El ledger evita duplicar filas de avisos, no garantiza entrega exactamente una vez
    por proveedores push ni deduplica reintentos de un webhook de entrega antiguo.

## Reversión sin borrar datos

| Cambio | Reversión y verificación |
| --- | --- |
| Frontend/reconexión/recuperación/lecturas | Revertir el commit correspondiente en la rama y probar; no altera filas históricas. Mantener cliente con RPC si INSERT directo ya fue revocado. |
| RPC mensajes | Detener nuevas operaciones en ventana controlada. Restaurar únicamente la lista exacta de grants INSERT del baseline revisado para el cliente anterior. No dar INSERT de tabla completo, is_read/id/created_at ni reabrir anon. Conservar función, recibos y mensajes para investigar/reanudar. Verificar permisos y envío con dos cuentas. Esto retira límite/idempotencia, por lo que necesita aprobación. |
| Coincidencias | Pausar planificador. En transacción revisada, retirar sólo triggers nuevos de encolado, hacer que la capacidad anuncie modo legado según el contrato cliente y restaurar únicamente INSERT de match propio del baseline si se vuelve al cliente anterior. El cliente actual exige RPC ausente (PGRST202) para fallback: quitar sólo esa función de capacidad requiere verificar dependencias primero. No hacer DROP CASCADE ni borrar cola/ledger/avisos. Conservar procesador/metadatos y comprobar que no se generan avisos adicionales. |
| Cuatro migraciones PR #23 | Usar configuración exacta respaldada y revisar exposición que reaparecería. No hacer rollback genérico a WITH CHECK/USING(true). Preferir corrección incremental que conserve la protección. |

No se ofrece un script genérico destructivo de rollback sin conocer el catálogo real.
Una restauración completa de un backup anterior podría perder operaciones posteriores:
no es el primer mecanismo de reversión para cambios de permisos/aditivos.

## ON DELETE y bloqueos restantes

El contrato del repositorio conserva CASCADE desde items a messages y desde profiles
(a su vez desde auth.users) a varias entidades. Esto puede borrar conversaciones si
se elimina su publicación/cuenta; sigue siendo un riesgo de retención existente.
No se cambió a archivo, soft-delete ni RESTRICT: faltan política aprobada, diagnóstico
real y decisión sobre la gestión de cuentas. Las nuevas cascadas sólo limpian
metadatos nuevos; la referencia ledger→notification usa SET NULL para conservar
la deduplicación si una notificación desaparece. Ninguna propuesta borra contenido.

Tampoco se resuelven todavía: idempotencia duradera de publicaciones/subida tras
respuesta perdida, paginación incremental del historial visible (el lector ya pagina
para completar datos), benchmark de cola a escala, ubicación/red móvil real,
entrega de correo y push, Firebase publicado, alertas operativas y rate limits globales.
No cambiar el schema cache ni confiar en un test con rol postgres como prueba RLS.

## Reproducir validación local

Desde `src/code`: `npm test`, `npm run lint`, `npm run build`,
`node tests/client-security.mjs`. `lint` es tsc --noEmit; no hay ESLint configurado.
Para SQL: `PGLITE_MODULE=<módulo PGlite instalado> node tests/security.mjs`.
No se agregaron dependencias runtime para estas propuestas.

La misma suite acepta `LOCAL_PG_SOCKET=<directorio Unix del PostgreSQL de pruebas>`
y `PG_TEST_MODULE=<módulo pg instalado>`. Sólo admite socket local, crea una base
vacía de nombre aleatorio y la elimina al terminar. **Usar un clúster descartable**:
la fixture crea roles anon/authenticated/service_role si faltan. La comprobación
adicional de concurrencia requiere este modo nativo (dos conexiones independientes).
En esta ejecución se usó la imagen oficial postgres:17-alpine, sin red/puertos y datos
en tmpfs. Se destruye el contenedor al finalizar. No usar un socket de producción.

Edge functions: Deno `check --frozen` con el deno.json/lock propio de cada función.
La configuración de deploy y autenticación del planificador requiere prueba externa;
ninguna de estas comprobaciones realiza un despliegue.

### Resultado de esta ejecución

- `npm test`: **71/71** (React/DOM, worker, transporte, reconexión, recibos y utilidades).
- Cliente/privacidad: **13/13**.
- SQL PostgreSQL 17 nativo: **44/44**, incluidas dos pruebas con conexiones
  concurrentes independientes (mensajes y workers).
- SQL PGlite: **42/42** (la misma suite salvo las dos pruebas multiconexión).
- Total de comprobaciones diferenciadas: **128**; las 42 repetidas en PGlite son
  validación adicional, no se cuentan otra vez como casos distintos.
- TypeScript (`npm run lint`), build Vite y Deno check --frozen de ambas Edge
  Functions: correctos. Sin cambios de dependencias frontend, estilos ni diseño.
- Backups, diagnóstico real, permisos/PostgREST desplegados, correo, Realtime y
  entrega push en dispositivos reales siguen requiriendo verificación externa.
