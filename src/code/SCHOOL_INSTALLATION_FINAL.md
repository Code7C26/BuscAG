# Propuesta escolar revisada: funciones compatibles, procedimiento definitivo

Rama: Alexis. SQL revisado: 123669fa91de73e6ee0c01024549b512fbd984e7.
El SQL conserva la corrección de retención aprobada en las pruebas aisladas.
Este cambio no ejecuta SQL remoto, no despliega y no altera main/German.

## Diagnóstico y funciones: revisión cerrada

Estado: LISTO PARA INSTALAR la propuesta revisada en Staging, sujeto al respaldo,
verificación del destino y autorización de escritura de los pasos siguientes.
La instalación no fue ejecutada. La activación y certificación funcional remotas
son etapas posteriores; este estado no certifica SMTP, push ni pg_cron.

El operador informa 26/26 preflight verdaderos, match_words(text) presente y las
cuatro tablas escolares ausentes. Se recibieron las 13 definiciones reales en
buscag_13_funciones_staging_revisadas.json y el informe comparativo adjunto.
La revisión independiente contra Alexis 123669f está en
SCHOOL_FUNCTION_REVIEW.md: 13/13 cuerpos coinciden conservando literales.
Las 12 diferencias de MD5 literal se explican por formato fuera de literales.
El informe adjunto atribuye una diferencia a las comillas de notify_item_recovered;
no se reproduce: ambos archivos contienen comillas dobles sin barras invertidas.
No reemplazar esa función ni reaplicar una migración antigua para alinear huellas.

Firmas, resultados, lenguajes, volatilidad, contexto DEFINER/INVOKER y configuración
son compatibles. Todas las funciones exportadas tienen propietario postgres y
search_path vacío; match_score y publish_item_once mantienen TimeZone UTC.
match_words(text) conserva text[], normalización NFD, límite de entrada 10.000,
stopwords y eliminación de duplicados. La extensión lo reutiliza sin reemplazarlo.

match_score y process_match_jobs se reemplazan intencionalmente por la propuesta:
se añaden colores, vigilancia/radio y preferencias; se conservan firmas, umbral,
UTC/DATE, cola, ledger, reintentos, heartbeat, exclusión del worker y ACL restringida.
No se identificó lógica remota adicional que se pierda. El bloqueo de revisión de
funciones queda cerrado con la evidencia adjunta, no por coincidencia de MD5.

El JSON no exporta GRANT/RLS/triggers ni el catálogo completo. Su revisión no
revalida esos elementos: se usa como contexto el preflight informado por el
operador y se exige una comprobación vigente del destino/baseline antes de escribir.
No hay una inspección remota nueva implícita en esta conclusión.

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

## Archivo definitivo

`supabase/proposals/20261105000000_school_features.sql`

SHA-256 de los bytes del archivo revisado: `49b72f1354327c841fb1947728c2e1fd7e4d4f0d214d2b8da6fa783a499c158f`.
Este cierre de revisión cambia documentación, no modifica nuevamente el SQL.

## Pasos exactos de instalación futura (no ejecutados)

1. La revisión de las 13 funciones está cerrada según SCHOOL_FUNCTION_REVIEW.md.
   Confirmar que Staging no cambió desde los diagnósticos: dependencias/RLS/ACL,
   propietarios, tipos y triggers compatibles; las cuatro tablas escolares ausentes.
   Si cambió, repetir las consultas de catálogo de solo lectura antes de instalar.
   Conservar la evidencia de las 26 comprobaciones verdaderas y sus secciones de
   políticas/permisos. La ausencia de historial no exige repetir las nueve migraciones.
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
La comparación estática independiente de los cuerpos adjuntos cierra su revisión;
las pruebas locales no sustituyen los ensayos funcionales posteriores en Staging.
