# Desarrollo unificado en Alexis

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
La rama de #22 security/rls-hardening no es ancestro ni da equivalencia completa
con git cherry; conservarla hasta reconciliar su diferencia y confirmar que está
sin uso. No tocar ramas de compañeros aunque aparezcan como ancestros de otra rama.

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
