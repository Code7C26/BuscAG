# Candidato escolar revisado: instalación bloqueada hasta comparar Staging

Rama: Alexis. Base revisada: 848577ac80ee65db7bd289c68b3916010708ad34.
Este cambio no ejecuta SQL remoto, no despliega y no altera main/German.

## Diagnóstico y huellas

El operador informa 26/26 preflight verdaderos, match_words(text) presente y las
cuatro tablas escolares ausentes. No se recibió el JSON completo ni las definiciones
reales de las funciones. Informa 12/13 MD5 diferentes, sin identificar la coincidencia.
Por tanto, las 13 comparaciones individuales están pendientes de evidencia: no es
posible etiquetar ninguna diferencia como solo formato, funcional o de seguridad.
MD5 se utiliza como huella textual, no como prueba criptográfica de seguridad.

La consulta anterior calculó MD5 sobre prosrc literal (UTF-8), incluidos espacios,
saltos de línea y comentarios. SQL Editor, CRLF/LF o formato podrían explicar una
diferencia, pero 12 diferencias no prueban que esa sea su causa. No normalizar
expresiones, literales o identificadores ni quitar comentarios con regex para
aprobar equivalencia: puede ocultar cambios semánticos.

Solicitar las definiciones reales y metadatos desde el SQL Editor de Staging,
revisarlos privadamente antes de compartir (los cuerpos podrían contener secretos).
Comparar cada firma/cuerpo/atributo/propietario/ACL contra los nueve archivos del
instalador documentado en STAGING_SETUP.md. No reemplazar funciones para hacer
coincidir huellas. Una diferencia en notify_item_recovered puede ser lógica
personalizada legítima y debe preservarse/revisarse.

Funciones: notify_item_recovered, can_send_item_message,
canonicalize_message_display, send_message_once, match_backend_enabled,
buscag_private.match_words, buscag_private.match_score,
buscag_private.enqueue_match, process_match_jobs, buscag_capabilities,
publish_item_once, validate_item_content_write, ensure_recovered_notice_text.

Especialmente: match_words(text) debe devolver text[], conservar su normalización,
límite de entrada y stopwords; estar en esquema privado sin acceso cliente y con
search_path vacío. La propuesta reemplaza match_score y process_match_jobs: revisar
primero cualquier lógica remota adicional que pudiera perderse. Las funciones que
no reemplaza también deben ser compatibles. No ejecutar RPC para comparar cuerpos.

## Retención y seguridad revisadas

- recovery_confirmations.item_id: NOT NULL, ON DELETE CASCADE. La eliminación
  autorizada del objeto borra su historial; no modifica permisos de DELETE de items.
- owner_id y partner_id: anulables, ON DELETE SET NULL. Si la publicación sobrevive,
  se desvincula la identidad eliminada y se conservan estado y fechas. Esto no es
  anonimización integral de toda la base: otros registros conservan su política.
- Un BEFORE DELETE en auth.users desvincula ambas referencias antes de las cascadas
  de cuentas/publicaciones; evita el conflicto SET NULL/CASCADE detectado en pruebas.
  Función privada DEFINER, search_path vacío, sin EXECUTE cliente/service_role.
  No concede permiso para eliminar cuentas ni ejecuta eliminaciones por sí misma.
- Una confirmación conservada sigue impidiendo reabrir la publicación, aunque un
  participante desaparezca. Las comparaciones de autorización son NULL-safe.
- Solo el interlocutor vivo confirma; no se acepta una solicitud si falta cualquiera
  de sus participantes. El participante restante puede cancelar. No se notifica a
  una identidad nula. Terceros y anónimos no deciden solicitudes desvinculadas.
- Eliminar un objeto elimina también chat según las FK anteriores: este historial
  no es un archivo legal inmutable. No se conserva un snapshot de PII ni una copia
  secreta del chat. Cancelar conserva la fila hasta eliminar el objeto.
- Reaplicar conserva datos. Una tabla previa con RESTRICT/incompatibilidad detiene
  la instalación; no intenta convertir ni borrar un historial ya instalado.

## Pasos exactos de instalación futura (no ejecutados)

1. Cerrar la revisión de las 13 funciones y del JSON completo de catálogo de Staging.
   Exigir dependencias/RLS/ACL/propietarios/tipos/triggers compatibles; el historial
   de migraciones ausente no obliga a repetir las nueve. Confirmar las cuatro tablas
   escolares ausentes. Si hay diferencias funcionales, reconciliar antes de instalar.
2. En Dashboard seleccionar BuscAG-Staging, referencia yiarlhpbgkofhhipkfha. Verificar
   visualmente proyecto y rol postgres/propietario. Respaldar base e imágenes de
   Staging por separado y verificar recuperación según RECOVERY_REHEARSAL.md.
3. Obtener autorización para mantenimiento/escritura y, si está activo, pausar
   matching y su único scheduler con el procedimiento existente. Conservar cola y
   ledger. No ejecutar instalador/smoke de la línea base después del escolar.
4. Revisar el diff aprobado y ejecutar completo, una sola vez en SQL Editor de
   Staging, supabase/proposals/20261105000000_school_features.sql.
   Incluye BEGIN/COMMIT, lock_timeout 5s y statement_timeout 60s.
   Si falla, ROLLBACK en esa sesión y detenerse: no saltar preflight ni ampliar ACL.
5. Ejecutar supabase/audit/school_readiness.sql en el mismo proyecto (solo lectura).
   Verificar cuatro tablas con RLS, sin acceso directo cliente; FK item CASCADE,
   owner/partner SET NULL anulables; trigger BEFORE DELETE en auth.users habilitado
   y función privada sin EXECUTE cliente; estadísticas INVOKER; RPC DEFINER con
   search_path vacío; solo resolve_object_tag para anon; worker solo service_role.
6. Con autorización separada, elegir/verificar un único scheduler según
   SCHOOL_FEATURES.md, observar heartbeat <5 minutos y habilitar matching con
   supabase/activation/enable_trusted_matches.sql si estaba pausado.
   No ejecutar process_match_jobs como diagnóstico de lectura: escribe.
7. Con autorización para datos QA, usar tres cuentas ficticias confirmadas y frontend
   nuevo de Staging; ejecutar el modo School de scripts/Run-StagingQA.ps1 y los
   casos radio/OFF/preferencia/colores/sin duplicados de SCHOOL_FEATURES.md.
   Añadir eliminación de publicación y de cuentas QA pendientes/confirmadas/canceladas;
   comprobar desvinculación, cascadas y rechazo de tercero sin usar datos existentes.
   Verificar QR desde teléfono y estadísticas bajo el mismo usuario/RLS.
8. No desplegar Firebase ni integrar main como parte de este procedimiento.
   Fallos posteriores requieren pausa autorizada y revisión; no borrar tablas como
   rollback: contienen historial y QR. Volver al frontend anterior no revierte SQL.

## Verificación local de esta revisión

Resultados de esta revisión:

- PostgreSQL 17 nativo, contenedor sin red ni puertos, almacenamiento efímero y
  socket Unix local: DATE/repositorio, timestamptz/repositorio y DATE/observado.
  17 grupos escolares por variante; 61/61/64 verificaciones generales y prueba
  integrada del orden de activación aprobadas.
- PGlite: las mismas tres variantes, 16 grupos escolares por variante (sin la
  prueba multiconexión nativa); orden de activación aprobado.
- npm test: 121/121; npm run lint y npm run build aprobados.
- node tests/client-security.mjs: 16/16.
- Se probaron rechazo de un esquema previo con RESTRICT, reaplicación sin perder
  datos, borrado por propietario/rechazo de tercero, baja de interlocutor y dueño,
  referencias nulas simples/dobles, cancelación sin notificar identidades eliminadas,
  imposibilidad de confirmar sin dueño y protección del estado ya confirmado.

La baja de cuentas y la resolución pueden contender por locks. Ante 40P01/40001,
la transacción abortada debe reintentarse completa tras revisar el resultado; nunca
omitir FK/triggers para forzar una baja. Las pruebas existentes de concurrencia
cubren worker/vigilancia; no certifican todos los interleavings de baja/resolución.
No se ejecutaron ensayos remotos ni se certificaron SMTP, push o pg_cron.
Ninguna prueba local demuestra equivalencia con los cuerpos reales de Staging
no recibidos.
