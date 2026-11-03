# Desarrollo unificado en Alexis

**Procedimiento vigente de backend:** [BACKEND_ACTIVATION.md](BACKEND_ACTIVATION.md), con instalación deshabilitada y activación separada. Los pasos anteriores de activación inmediata quedan reemplazados.

Decisión del titular: única rama activa `Alexis`, commits directos, push normal,
sin ramas nuevas ni PR nuevos. `main` y `German` deben permanecer intactas.
No se despliega Firebase ni se ejecutan migraciones en Supabase real.

## Conservación del historial

La consolidación local usa dos avances rápidos desde Alexis `1ec807d`:

- PR #25, production/auth-data-readiness: `e70a0c3`.
- PR #26, production/next-functional-advances: `e311e94`.
- PR #23: `4121bb9`, ya incorporado mediante merge `8facc55`.
- PR #24: `880d118`, ya incorporado mediante merge `1ec807d`.

No hubo conflictos ni cherry-picks nuevos: se conservan los commits originales de
estos cuatro PR. Antes de borrar referencias remotas, comprobar sus SHA como ancestros
de Alexis local y comparar el SHA remoto después del push. Cerrar primero #26 y
luego #25 antes de eliminar sus ramas. Las ramas temporales antiguas de #23/#24
sólo pueden retirarse si sus puntas siguen siendo exactamente las ya incorporadas.
La rama de #22 security/rls-hardening inicialmente no era ancestro por el cherry-pick
original hacia Alexis. Se reconcilió su historia mediante el merge b4cd29e,
comprobando que el árbol resultante es idéntico byte por byte al anterior: sus
protecciones ya estaban incorporadas y se conservan todas las mejoras posteriores. No tocar ramas de compañeros aunque aparezcan como ancestros de otra rama.

## Compatibilidad de la fecha de los objetos

El titular confirmó items.date de tipo DATE. La migración histórica describe
`timestamptz`; eso no autoriza convertir la columna real ni reejecutar el esquema.
La propuesta de coincidencias ahora admite DATE y timestamptz y calcula horas
con casts explícitos en UTC. No exige ALTER TYPE y conserva todos los registros.

La publicación conserva el día local mediante un offset explícito, en vez de
convertir siempre a UTC. PostgreSQL DATE conserva la parte calendario y timestamptz
conserva el instante. Las fechas DATE se editan/muestran sin retroceder un día en
Argentina; una edición sin cambio de fecha conserva la precisión original.
Se validan días imposibles y horas inexistentes durante cambios de horario.
El input existente se mantiene visualmente igual; DATE no almacena la hora elegida.

Pruebas: fixtures completos con DATE y timestamptz, validación de permisos y datos,
notificaciones, colas y concurrencia en PostgreSQL 17 sin red. No es una copia del
catálogo real completo: el resto del diagnóstico sigue pendiente de recepción.

Las propuestas bajo supabase/proposals siguen sin aplicar. El plan de respaldo,
configuración de worker y reversión en NEXT_FUNCTIONAL_ADVANCES.md sigue vigente;
sus nombres de ramas describen el contexto del PR y quedan reemplazados por esta
organización para el desarrollo futuro.


## Organización verificada en GitHub

Alexis se publicó mediante push normal en `c7f37ea` y se verificó su SHA remoto antes
de retirar referencias. Los PR #25 y #26 están cerrados (#25 fue reconocido por GitHub
como incorporado al avanzar su base). Se eliminaron local/remotamente:
production/auth-data-readiness, production/next-functional-advances,
production/session-publication-safety y security/alexis-rls-hardening.
Las puntas exactas de las cuatro son ancestros de Alexis. main (`ef964b4`) y German
(`074539d`) se conservaron sin cambios. Después de publicar y verificar la
reconciliación b4cd29e, security/rls-hardening también puede retirarse junto al PR #22
obsoleto. No hay ramas nuevas ni PR nuevos.

## Publicación idempotente y subida recuperable

Implementado directamente en Alexis: el cliente conserva clave del intento y ruta
UUID de foto dentro de la cuenta. Clics concurrentes comparten petición; si se pierde
una respuesta, reintenta con las mismas claves. Si Storage informa duplicado, descarga
y compara los bytes antes de aceptar la ruta: nunca sobrescribe ni elimina imágenes.
Una foto ya confirmada no vuelve a subirse después de un error al guardar el objeto.
Cambiar de cuenta descarta este estado; no se almacenan borradores privados en localStorage.

La propuesta `20261104002000_publication_receipts.sql` requiere el baseline revisado y
el esquema privado de recibos. No se aplicó. Crea RPC que obtiene propietario de
Auth, valida campos/ubicación/fecha y conserva un recibo privado por clave. Repetir
una publicación eliminada devuelve error, no la recrea; el FK del recibo es SET NULL.
No cambia las cascadas ni retención existentes de publicaciones/conversaciones.

Candidato de protección contra abuso: 30 publicaciones nuevas/hora por usuario;
replays no consumen cuota. Límites propuestos: título 200 caracteres, descripción
10.000, lugar 300, recompensa 200 y URL de foto HTTPS hasta 4.096. Validar estos
límites con uso esperado antes de autorización. Actualizar clientes antes de revocar
INSERT directo de items: clientes viejos abiertos perderían la posibilidad de publicar.

Prueba de aplicación: esquema clonado compatible, cuentas sintéticas, altas en ambos
tipos de date, doble clic, respuesta perdida, misma clave/datos distintos, propietario
falso, ubicación inválida, cuota y dos transacciones concurrentes. Verificar foto
original intacta, una publicación/recibo/trabajo de cola y ningún registro real alterado.

Reversión: mantener tablas/recibos/datos; en una ventana revisada restaurar sólo los
INSERT por columna del baseline seguro si se vuelve al cliente sin RPC. No habilitar
anon ni owner ajeno ni campos administrados por servidor. Revertir el cliente después
de asegurar compatibilidad. No usar DROP TABLE/CASCADE ni eliminar imágenes como
compensación de una respuesta incierta. La reversión exacta depende del catálogo
respaldado y requiere autorización de producción.

Sin el RPC existe fallback sólo ante PGRST202: no garantiza publicaciones exactamente
una vez en backend antiguo. Las claves son de memoria y no sobreviven una recarga.
No hay deploy de Storage, Firebase, Edge Functions ni aplicación SQL implícitos.


## Validación final de esta etapa

- Aplicación: 81/81.
- Cliente/privacidad/Storage simulado: 15/15.
- PostgreSQL 17 nativo: 53/53 con DATE y 53/53 con timestamptz; incluyen tres
  escenarios de conexiones concurrentes independientes.
- PGlite: 50/50 con DATE y 50/50 con timestamptz (sin las tres multiconexión).
- TypeScript, compilación Vite y Deno check --frozen de ambas Edge Functions: correctos.
- Sin diferencias de CSS, colores, tipografías o distribución visual.
- Las comprobaciones SQL sólo usan datos sintéticos en bases descartables.
