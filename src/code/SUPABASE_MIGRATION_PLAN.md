# Diagnóstico y aplicación de seguridad: pendiente de evidencia remota

**Diagnóstico real recibido:** [reconciliación y cambios vigentes](REAL_SUPABASE_RECONCILIATION.md). Las referencias históricas a un adjunto ausente ya no describen el estado actual.

**Procedimiento vigente de backend:** [BACKEND_ACTIVATION.md](BACKEND_ACTIVATION.md), con instalación deshabilitada y activación separada. Los pasos anteriores de activación inmediata quedan reemplazados.

Estado conocido por el titular: cuatro tablas principales con RLS, policies INSERT
abiertas en items, lectura amplia de perfiles, comprobación sospechosa de mensajes,
owner_id nullable, public_profiles/push_subscriptions ausentes y sin historial de
migraciones. NO se supone que las demás columnas/defaults/constraints coincidan.

## Diagnóstico manual único

Ejecutar `supabase/audit/production_diagnostic.sql` en SQL Editor. Es una sola consulta
SELECT a catálogos, sin DO, DDL, DML ni lectura de filas personales. Devuelve un único
JSON, incluso si faltan tablas/vistas o el esquema de historial. Omite argumentos de
triggers y cuerpos de funciones porque podrían contener secretos de webhooks.
Guardar los resultados en privado y compartir para revisión sin credenciales.

Los apartados muestran relaciones (public_profiles debe ser vista), tipos y defaults,
RLS/force RLS, políticas, grants efectivos de tabla/columna e herencia, constraints,
triggers, colisiones de funciones/vistas y Realtime. Las funciones llevan huella de
fuente, no código: para comprobar su comportamiento habrá que revisar su definición
privadamente si los metadatos no bastan. RLS se evalúa además de los grants; SQL Editor
como propietario no simula anon/authenticated.

## Riesgos de las cuatro migraciones actuales

- 000000 items/messages: elimina TODAS sus políticas y revoca ACL cliente de tabla y
  columna, incluidas personalizaciones; no basta revisar sólo las policies abiertas.
  No cambia ni rellena owner_id NULL: las publicaciones antiguas se conservan pero no
  adquieren un dueño editable. UUID de usuario/publicación y tipos de participantes
  deben coincidir. El trigger nuevo copia nombres/avatares/títulos: columnas o datos
  NULL incompatibles pueden bloquear nuevos mensajes aunque no borren los anteriores.
- 001000 profiles/directorio: requiere id, full_name, avatar_url, phone, location,
  rating y created_at con tipos adecuados. La vista y funciones nuevas fallan si los
  nombres ya existen. El propietario confiable de la vista debe poder leer el origen;
  FORCE RLS y funciones existentes deben revisarse. Views adicionales que lean la
  tabla podrían seguir exponiendo privados y no las corrige automáticamente el PR.
- 002000 notifications: necesita columnas/valores de tipo compatibles. Después el
  cliente sólo crea matches propios; message/recovered/system requieren servidor.
  Verificar los triggers originales de mensajes, recuperados y registro de Auth.
- 003000 push: CREATE TABLE IF NOT EXISTS no repara una tabla incompatible; la FK exige
  una clave única y tipo compatibles en profiles.id. service_role debe existir y tener
  permisos necesarios. No instala función, webhook ni VAPID, ni entrega avisos por sí.
- Las inserciones cliente ya no incluyen id/created_at/rating/contact_count/is_read:
  comprobar DEFAULT/identity/nullable adecuados y columnas extra NOT NULL sin default.
- No contienen DELETE de datos ni DROP TABLE, pero cambian comportamiento y acceso.
  Cada archivo confirma su transacción por separado: un fallo posterior no revierte
  los anteriores. No son todas idempotentes. No ejecutar archivos viejos indiscriminadamente.
- La ausencia de supabase_migrations.schema_migrations NO prueba esquema vacío: SQL
  manual puede no tener historial. No marcar versiones como aplicadas ni crear un
  historial ficticio. Decidir posteriormente entre SQL manual trazado y baseline CLI
  basado en los resultados; ninguna reparación de historial se ejecuta en este trabajo.

## Respaldo previo (procedimiento propuesto, no ejecutado)

1. Confirmar proyecto y alcance. Usar respaldo de la plataforma/pg_dump compatible con
   su plan y acceso. No pegar contraseñas ni connection strings en chat/Git/terminal.
2. Respaldar estructura y datos de public y Auth, ACL/políticas/funciones/triggers,
   historial si existe, publicaciones Realtime y configuración de Auth. Verificar el
   alcance de las copias automáticas del plan: no asumir que cubren todo.
3. Copiar también los binarios de Storage y su inventario; respaldar sólo storage.objects
   no conserva las fotos. Conservar configuración de buckets y políticas de Storage.
4. Conservar configuración/secrets de Edge Functions y webhook mediante un procedimiento
   seguro separado. Un dump de esquema puede contener secretos en triggers: cifrar,
   limitar acceso y nunca adjuntarlo al PR. Registrar la versión del frontend desplegado.
5. Restaurar en un entorno aislado y probar que usuarios, publicaciones, mensajes y
   fotos corresponden. Conteos no bastan: comparar identidades/integridad privadamente.
   Fijar una copia consistente o una ventana controlada para no confundir escrituras
   concurrentes con pérdida de datos. No comenzar la aplicación sin ensayo de restauración.

## Orden condicionado a los resultados

1. Recibir el JSON y construir la comparación real vs esperado por cada archivo.
2. Resolver incompatibilidades mediante una propuesta revisable; no usar casts,
   eliminación de filas, reasignación de dueños o reemplazo de tablas como atajo.
3. Ensayar registro, publicaciones nuevas/heredadas, conversaciones previas, recibos,
   matches y privacidad con usuarios ficticios A/B/C y roles anon/authenticated.
4. Confirmar que el bundle compatible está desplegado antes de limitar profiles. Un
   merge en Alexis no confirma un despliegue Firebase; esa comprobación sigue pendiente.
5. Proponer la aplicación de 000000, 001000, 002000 y finalmente 003000 por etapas con
   punto de control tras cada una. El orden definitivo queda pendiente del diagnóstico
   y de la revisión de triggers/cargas externas. Aplicación real sólo con autorización.
6. Comparar conservación de datos y verificar permisos efectivos tras cada etapa;
   registrar exactamente versiones/checksums ejecutados de forma privada y trazable.
7. Reversión: restaurar ACL/políticas previas revisadas o corregir hacia adelante; no
   borrar filas ni la nueva tabla de suscripciones si ya tiene datos. Una restauración
   de políticas abiertas reintroduce vulnerabilidades: requiere decisión explícita.

Bloqueos: resultados reales, respaldo/restauración, URL y bundle Firebase, acceso a
configuración de Auth/Storage/Functions. Este plan no autoriza ni ejecuta SQL de escritura.
