# Activación: criterios de aprobación y secuencia operativa

Revisión local del 4 de noviembre de 2026, desde `ace90cc`, exclusivamente en Alexis.
**No autoriza ejecutar cambios remotos. No se hizo push ni despliegue.** Complementa
[BACKEND_ACTIVATION.md](BACKEND_ACTIVATION.md),
[REAL_SUPABASE_RECONCILIATION.md](REAL_SUPABASE_RECONCILIATION.md) y
[RECOVERY_REHEARSAL.md](RECOVERY_REHEARSAL.md).

## Estado y límites de la evidencia

El export real vuelve a pasar el análisis de tipos, pero no constituye aprobación.
Las políticas permisivas, ACL amplias y recursión de mensajes documentadas siguen
siendo problemas del esquema exportado hasta verificar una instalación real. Las
correcciones SQL ya preparadas pasan pruebas aisladas con DATE y timestamptz; esta
revisión no necesitó alterar esas ocho migraciones. No convertir `items.date` ni
completar campos NULL históricos artificialmente.

El formulario ahora comprueba los límites SQL de título (200), descripción (10000),
ubicación (300) y recompensa (200), contando puntos de código Unicode como
`char_length`, y rechaza NUL. Lo hace antes de subir una imagen al publicar o editar.
Los campos históricos por encima del límite pueden conservarse sin modificación,
igual que en SQL; no se bloquean las ediciones de otros campos por ese motivo.
Una publicación nueva no puede comenzar como recuperada; la edición conserva esa
capacidad. Los borradores inválidos permanecen abiertos con el error existente.
La compilación también rechaza nombres VITE_* de credenciales privadas. Esta
protección por nombres no detecta cualquier secreto arbitrario mal etiquetado:
revisar igualmente variables y artefactos antes de publicar.

El usuario verificó 4 publicaciones, 3 usuarios, 3 perfiles, 1 aviso, 0 mensajes y
8 FK en su copia; no se accedió a ese dump ni a Windows. Los conteos no prueban
identidad/contenido, contraseñas, sesiones, MFA o integridad de archivos. Si hubo
actividad después, esos números ya no son la referencia para la ventana de cambio.

## 1. Bloqueos previos: no iniciar SQL hasta resolverlos

- Repetir el diagnóstico de sólo lectura y revisar diferencias con el export.
  Revisar privadamente las definiciones reales de `handle_new_auth_user`,
  `notify_message_recipient` y `notify_item_recovered`: los hashes difieren y el
  export no incluye cuerpos. Puede ser formato o lógica; no sustituirlos a ciegas.
  Revisar también RPC públicas adicionales y su EXECUTE/SECURITY DEFINER.
- Ejecutar `supabase/audit/storage_configuration.sql`: comprobar bucket, MIME,
  límite de tamaño, acceso de lectura de imágenes y RLS. Las pruebas SQL usan
  sustitutos de Auth/Storage; no demuestran compatibilidad de esos servicios.
- Rehearsar el flujo completo en un proyecto Supabase aislado: registro,
  confirmación de correo, login, recuperación, renovación de sesión y logout;
  PostgREST/RPC, Storage (foto propia y lectura), Realtime tras desconexión y dos
  cuentas intercambiando mensajes. Configurar SMTP y URLs del proyecto de staging,
  sin webhooks/cron/secretos que apunten a producción.
- Confirmar URL pública de Firebase y Site URL/redirect allowlist de Supabase;
  VITE_APP_URL debe apuntar al origen correcto. Probar un correo de confirmación y
  uno de recuperación en navegador nuevo, sin registrar sus tokens.
- Aprobar las cuotas propuestas (120 mensajes/minuto y 30 publicaciones/hora), la
  exigencia de cuenta para publicar y el contacto privado tras conversación mutua.
  La eliminación de una publicación sigue borrando sus mensajes por CASCADE:
  se conserva el comportamiento existente; no aprobar otra retención implícitamente.
- Revalidar el respaldo completo según RECOVERY_REHEARSAL: contenidos/IDs y no sólo
  conteos; bytes de Storage y rutas/MIME; cobertura de identidades/MFA y configuración
  externa. La restauración integral de servicios administrados sigue pendiente.

## 2. Preparar y publicar el cliente compatible (operador, con autorización)

1. Guardar revisión Git exacta, artefacto `dist` y release Hosting actual para poder
   recuperarlos. Verificar que el sitio/proyecto objetivo sea BuscAG.
2. En una máquina autorizada ejecutar `npm ci`, `npm test`, `npm run lint`,
   `npm run build`, `node tests/client-security.mjs`; instalar sólo variables públicas
   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_APP_URL y, opcionalmente,
   VITE_VAPID_PUBLIC_KEY. No incluir service_role, secretos worker ni VAPID privada.
3. Probar el artefacto contra staging antes y después de las ocho migraciones.
   Verificar ambos RPC en la pestaña Network sin copiar cabeceras/token a informes.
   Un error PGRST202 antes de instalar permite el fallback antiguo; un timeout o un
   error de permisos nunca debe activar otro INSERT. El fallback no ofrece la
   idempotencia del servidor: mantener una ventana sin escrituras en la transición.
4. Sólo cuando el operador esté autorizado a publicar, desde src/code usar
   `firebase deploy --only hosting --project ID_CONFIRMADO` (reemplazar el marcador).
   Este documento no ejecuta ese comando. No desplegar Functions/Database/Storage
   de Firebase. Probar raíz, recarga de rutas, HTTPS, imágenes y callback Auth.
5. Verificar el artefacto realmente servido, no sólo la rama Git. Recargar las
   pestañas antiguas y controlar clientes abiertos antes de cambiar permisos.
   Mantener disponible el cliente compatible durante toda la instalación SQL.

## 3. Ventana de SQL: un archivo completo por paso

Detener nuevas escrituras y esperar peticiones en curso. Tomar backup nuevo y
conteos con `supabase/audit/backup_counts.sql`; conservar el original anterior.
Guardar catálogo/ACL/políticas preexistentes y SHA de cada archivo fuera de Git.
No usar `supabase db push` indiscriminadamente: no hay historial de migraciones.
No ejecutar los bootstrap de octubre. Aplicar manualmente sólo tras autorización:

| Paso | Archivo dentro de supabase | Criterio para continuar |
| --- | --- | --- |
| 1 | migrations/20261103000000_secure_items_messages.sql | RLS activa; INSERT items sólo owner; mensajes sólo participantes, sin política recursiva; ACL de campos protegidos retiradas. |
| 2 | migrations/20261103001000_private_profiles_public_directory.sql | Perfil propio completo; directorio accesible a authenticated, teléfono/ubicación ajenos ocultos sin intercambio mutuo; anon sin lectura. |
| 3 | migrations/20261103002000_secure_notifications.sql | SELECT propio; UPDATE sólo is_read; sin falsificar avisos ajenos ni tipos de servidor. |
| 4 | migrations/20261103003000_ensure_private_push_subscriptions.sql | Tabla compatible, RLS y CRUD propios; no cambia filas de las cuatro tablas existentes. |
| 5 | proposals/20261104000000_message_receipts.sql | send_message_once existe con firma esperada y EXECUTE sólo authenticated; recibos privados; INSERT directo revocado. |
| 6 | proposals/20261104001000_trusted_matches.sql | Capacidad false; cola/ledger privados; worker restringido a service_role; ningún backfill. |
| 7 | proposals/20261104002000_publication_receipts.sql | publish_item_once existe con firma esperada, EXECUTE authenticated; recibos privados; INSERT directo revocado. |
| 8 | proposals/20261104003000_validate_legacy_compatible_writes.sql | Validadores instalados sin convertir DATE, imponer NOT NULL, modificar FK o reescribir filas históricas. |

Después de **cada archivo**: confirmar COMMIT sin errores, repetir conteos y diagnóstico
sólo lectura; comparar app rows con el snapshot privado y revisar RLS/ACL/firmas.
Los escenarios de acceso efectivo de la tabla se ensayan con cuentas ficticias en
staging; cualquier prueba que escriba en producción necesita autorización aparte.
No crear usuarios/publicaciones reales automáticamente para verificar el despliegue.
Si un objeto ya existe o cualquier conteo cambia inesperadamente, detenerse y revisar.
No marcar historial artificial ni ejecutar el siguiente archivo para tapar un error.

Después de instalar RPC, comprobar que PostgREST las reconoce. PGRST202 puede ser
caché de esquema desactualizada, firma equivocada o esquema no expuesto; no reabrir
INSERT para ocultarlo ni reintentar escrituras masivas. Revisar configuración y
refresco admitido por Supabase antes de reabrir escrituras. Confirmar pub/sub de
Realtime para items/messages/notifications, permisos y reconciliación al reconectar.
Ejecutar backend_readiness.sql sólo tras instalar propuestas: no es un preflight.

## 4. Reapertura y funcionalidades opcionales

1. Reabrir sólo al verificar el cliente compatible y ambas RPC vía servicios reales.
   Observar errores, latencias y conteos sin exponer mensajes/teléfonos en logs.
2. Mantener coincidencias de backend deshabilitadas inicialmente. Desplegar
   process-matches y configurar secreto/scheduler según BACKEND_ACTIVATION.
   Exigir heartbeat reciente, llamada real enabled:false y programación verificada.
3. En otra ventana drenada, activar con enable_trusted_matches.sql. Verificar
   enabled:true, cola sin fallos y avisos para ambos propietarios (probados primero
   en staging). No hay coincidencias retroactivas para todas las publicaciones.
4. Push es opcional e independiente: VAPID, secreto webhook, send-push y suscripción
   real de navegador. Sin esto los avisos internos funcionan, pero no afirmar que
   push esté operativo. Revisar duplicados ante reintentos del proveedor.

## 5. Recuperación y condiciones de parada

Cada archivo tiene transacción propia: un error revierte ese archivo, no los
anteriores. Conservar la ventana, registrar SQLSTATE y revisión aplicada; corregir
hacia adelante tras reproducir el fallo en staging. No reejecutar baseline sobre
propuestas ni devolver políticas anónimas/USING true/ACL completas como solución.

Para coincidencias, drenar y usar pause_trusted_matches.sql: conserva avisos, cola,
ledger y recibos. Para un fallo de frontend, recuperar sólo un release compatible
con las RPC ya instaladas; el release viejo puede depender de INSERT revocado.
No borrar recibos ni recrear tablas para reintentar: perdería la deduplicación.

Restaurar backup completo es último recurso, en un destino aislado y mediante el
procedimiento del proveedor, porque puede perder escrituras posteriores y requiere
coherencia Auth/DB/Storage. No usar DROP/--clean sobre producción ni importar a
ciegas esquemas administrados. Decidir recuperación con el operador antes de actuar.

## Evidencia ejecutada en esta revisión

- Aplicación/herramientas: **102/102**; TypeScript y build de producción correctos.
- Cliente/privacidad: **16/16**, sin consultas a servicios reales.
- PostgreSQL 17 aislado: **61/61 DATE**, **61/61 timestamptz**, **64/64 esquema real
  observado DATE**, más **1/1** ensayo del orden completo.
- PGlite: **58/58**, **58/58**, **61/61**, más **1/1** orden completo. Son variantes
  del mismo conjunto, no cientos de escenarios independientes.
- Restauración nativa: **1/1**, 14 tablas ficticias y metadatos, replay idempotente,
  privacidad y pausa sobre la copia; no usa ni valida el respaldo real del usuario.
- Deno check --frozen: ambas Edge Functions correctas.
- npm audit completo y de dependencias de ejecución: cero vulnerabilidades detectadas.
- El diagnóstico real se volvió a analizar sin SQL ni red. Sus cuerpos de funciones
  desconocidos y los servicios externos siguen pendientes.

**Conclusión:** compatible y probado localmente para pasar a staging; todavía no
aprobado para activación definitiva. Los bloqueos son las verificaciones reales de
servicios/funciones y recuperación, la publicación controlada del cliente compatible
y la revisión humana de los cambios de permisos. Ningún resultado local los sustituye.
