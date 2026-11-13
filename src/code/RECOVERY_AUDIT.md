# Auditoría del flujo de recuperación

Nota posterior: la mejora integral agrega una declaración individual explícita
para recuperaciones independientes aunque haya una conversación previa. No cierra
solicitudes pendientes ni habilita valoraciones bilaterales. Ver la propuesta
`20261106001000_community_safety.sql` y el informe integral para el comportamiento actual.

Fecha: 6 de noviembre de 2026. Rama: Alexis. Base: 5bc98a5.

Estado: implementación y pruebas locales completadas. **Pendientes: verificación
del catálogo instalado en Supabase Prueba, instalación del SQL revisado y despliegue
del cliente. No se declara resuelto el incidente en la web publicada.**

## Hallazgos y alcance

1. `AccountApp.handleMarkAsRecovered` hacía un `UPDATE items SET status='recuperado'`
   tras una confirmación exclusiva del propietario. Lo invocaban el perfil y el
   detalle. No llamaba al circuito bilateral. El nombre SQL real es `recuperado`,
   no `recovered` (este último también identifica un tipo de notificación).
2. Ya existían `recovery_confirmations`, `request_item_recovery`,
   `resolve_item_recovery` y `list_recovery_confirmations` en la propuesta escolar
   `20261105000000_school_features.sql`. La interfaz estaba dentro de un desplegable
   secundario y dependía además de preferencias/alertas para cargar. El camino
   principal podía saltarla incluso si esa propuesta estuviera instalada.
3. Las ACL/RLS del repositorio limitan el UPDATE a publicaciones propias, pero
   permiten actualizar la columna `status`. El trigger escolar sólo impedía reabrir
   una recuperación bilateral confirmada; no exigía confirmación antes de cerrar.
   Ocultar un botón no corregía ese bypass por API. `publish_item_once` ya rechaza
   altas con estado recuperado; editar contenido en App no envía un nuevo status.
4. El listado general consulta las publicaciones visibles de toda la comunidad.
   Que ambas cuentas vean las mismas dos filas es correcto y no acredita duplicación
   ni suplantación. El perfil ya filtraba por `item.user.id === currentUser.id`.
   `loadItems` conserva el ID y `owner_id` incluso sin perfil público disponible.
   Sí había un riesgo de duplicación visual por páginas con offset solapadas al
   entrar filas nuevas: se añadió deduplicación por ID sin borrar datos.
5. No se consultaron filas ni el catálogo de las cuentas reales en este trabajo.
   Los hallazgos están demostrados en el código y en bases sintéticas. El estado
   efectivamente instalado en `yiarlhpbgkofhhipkfha` y los IDs del caso real requieren
   verificación de sólo lectura; no se deducen del comportamiento visual.

## Corrección

- Se retiró el UPDATE directo y sus callbacks. Perfil y detalle conducen al mismo
  panel visible de recuperación, separado de la disponibilidad de alertas y QR.
- Se reutilizan las cuatro RPC y la misma tabla de historial. `recovery_context`
  añade lectura de capacidad versión 2, estado y contrapartes verificadas en servidor.
  Una contraparte debe estar vinculada por conversación de ese objeto o por una
  coincidencia persistida por el motor (`match_notices`); una sugerencia calculada
  sólo en el navegador no constituye por sí misma un vínculo persistido.
- El propietario solicita y confirma su parte. Sólo la contraparte elegida puede
  aceptar. Cualquiera de los participantes puede rechazar/cancelar. El estado
  `pending` no modifica `items.status`; `cancelled` conserva la publicación activa.
  El panel muestra «Pendiente de confirmación», «Recuperado» o «Confirmación rechazada».
  Por compatibilidad, el estado histórico `cancelled` incluye rechazo y cancelación.
- Sin vínculos ni historial bilateral, el propietario puede declarar recuperación
  individual tras una confirmación explícita. Se guarda evidencia `mode=individual`
  en la misma tabla. No se presenta como confirmación de dos personas. No se ofrece
  este camino para evadir una solicitud rechazada o una conversación existente.
- Un trigger exige evidencia confirmada antes de una transición a recuperado,
  incluidos INSERTs directos. Las RPC guardan evidencia y cambian el estado en la
  misma transacción; no usan flags de sesión que un cliente pueda falsificar.
  Las tablas privadas conservan RLS y no admiten escrituras del cliente.
- Bloqueos por publicación y solicitud serializan operaciones; reintentos terminales
  y solicitudes pendientes repetidas no duplican evidencia ni notificaciones.
  Se conserva `notify_item_recovered`, sin reemplazar su cuerpo. Una aceptación
  puede generar dos avisos distintos al dueño: cambio de estado y resolución;
  los reintentos no generan copias adicionales.
- Las confirmaciones se refrescan cada cinco segundos, al recuperar foco y mediante
  un botón. Los cambios finales mantienen la resincronización existente de items.
  Respuestas de componentes desmontados o lecturas anteriores no pisan el panel.
  Si falta el backend seguro, no se recurre al UPDATE antiguo.
- Cada solicitud afecta una publicación. No se cierra automáticamente la publicación
  de la contraparte. Los estados recuperados históricos se conservan y no reciben
  una certificación bilateral inventada ni se revierten automáticamente.

## Validación

Sin usuarios reales, SQL remoto, Firebase ni modificaciones de Producción.

| Comprobación | Resultado |
| --- | --- |
| `npm test` | 121/121 |
| `npm run lint` | TypeScript correcto |
| `npm run build` | Vite correcto |
| `node tests/client-security.mjs` | 17/17 |
| `npm run test:e2e` | 58/58, escritorio y móvil, APIs simuladas |
| Regresión final de recuperación, escolar y mapa | 16/16 sobre cliente compilado |
| Matriz PostgreSQL nativo aislado | DATE: 61; timestamptz: 61; estructura observada DATE: 64 |
| Integración escolar en PostgreSQL | 17 grupos por variante |
| Recuperación segura en PostgreSQL | 8 grupos por variante, incluidas dos conexiones concurrentes |
| Matriz PGlite aislada | 58/58/61 + 16 grupos escolares y 7 de recuperación por variante |
| Orden de instalación existente | Correcto en ambos motores |

Las pruebas cubren individual, bilateral aceptada/rechazada, terceros, propietario
que intenta confirmar por el otro, escritura directa y evidencia falsa, duplicados,
notificaciones, recarga, dos sesiones y listados general/propio. SQL nuevo aplicado
dos veces conserva filas e historial existentes. El diagnóstico de catálogo también
se ejecutó en las bases descartables. La suite de navegador usa mocks; no certifica
la instalación ni Realtime del proyecto remoto.

## Instalación pendiente en Supabase Prueba

No se ejecutó ninguno de estos pasos remotos:

1. Revisar el catálogo con `supabase/audit/recovery_readiness.sql` y comparar
   funciones, triggers, ACL y RLS con este commit. Comprobar por ID los dos objetos
   del caso reportado, sus propietarios y estados; no inferir duplicación por título.
2. Verificar el baseline documentado en `STAGING_SETUP.md`. Si faltan dependencias,
   reconciliarlas antes de instalar; no reaplicar migraciones históricas a ciegas.
3. Si no está instalada, la propuesta escolar
   `supabase/proposals/20261105000000_school_features.sql` es prerrequisito, con su
   revisión y procedimiento existentes. No se asume que esté instalada por existir
   el archivo en Git.
4. Aplicar, en una futura operación autorizada, **después del baseline escolar**:
   `supabase/proposals/20261106000000_secure_recovery.sql`. Esta propuesta no modifica
   registros existentes ni el cuerpo de `notify_item_recovered`. Reaplicar la propuesta
   escolar antigua después de ésta reemplazaría RPC corregidas: mantener este orden.
5. Volver a ejecutar el diagnóstico, desplegar el cliente compilado mediante una
   operación posterior autorizada y repetir QA con dos cuentas de prueba. Clientes
   antiguos que sigan haciendo PATCH de status serán bloqueados por el trigger.

## Archivos modificados

Todos bajo `src/code/`:

- `lib/database.ts`
- `lib/schoolFeatures.ts`
- `lib/supabase.ts`
- `src/App.tsx`
- `src/components/FaqChat.tsx`
- `src/components/ItemCard.tsx`
- `src/components/ItemDetailModal.tsx`
- `src/components/ItemSchoolTools.tsx`
- `src/components/ProfileView.tsx`
- `src/components/RecoveryPanel.tsx` (nuevo)
- `supabase/audit/recovery_readiness.sql` (nuevo)
- `supabase/proposals/20261106000000_secure_recovery.sql` (nuevo)
- `tests/client-security.mjs`
- `tests/e2e/app.spec.ts`
- `tests/e2e/fixtures.ts`
- `tests/e2e/map-markers.spec.ts`
- `tests/e2e/school.spec.ts`
- `tests/e2e/recovery.spec.ts` (nuevo)
- `tests/production.test.mjs`
- `tests/security.mjs`
- `tests/recoveryChecks.mjs` (nuevo)
- `RECOVERY_AUDIT.md` (este informe)
