# Integración segura Alexis → main

## Estado inicial, 13/11/2026

Checkout limpio en `work`, idéntico a main. Remoto https://github.com/Code7C26/BuscAG.git. Se consultaron las tres ramas remotas sin sobrescribir referencias de compañeros:

| Rama | SHA remoto auditado |
|---|---|
| main | ef964b4d901fbc923d98bf2b46e4d76fceb7cb1a |
| Alexis | cfdca4af4155e0a24c11255286913ad7a55ddbbf |
| German | 074539db8bcb2d67058c982dc18845dd32227a31 |

`rev-list --left-right --count origin/main...origin/Alexis`: **0 / 91**. main es ancestro de Alexis; no hay commits de main que necesiten reemplazo. No había cambios locales sin confirmar que preservar fuera de Git.

## Respaldos

Bundles completos en el directorio de trabajo del agente, fuera del paquete público: `BuscAG-before-integration.bundle` y `BuscAG-all-branches.bundle`. El segundo se verificó con `git bundle verify`: historial completo. Pueden contener historia privada antigua; no se publican como material del pitch.

Tags identificables: `backup/main-before-presentation-20261113`, `backup/Alexis-before-presentation-20261113` y `backup/German-before-presentation-20261113`. No se eliminó ninguna rama. German no recibió cambios.

## Merge de desarrollo existente

Se creó main local en su punta remota y se hizo **merge normal con --no-ff** de Alexis, sin conflictos:

`7be8cf39f8531c452cc97817ee13eb1045fa56d0`

Padres: main `ef964b4…` y Alexis `cfdca4a…`. Se verificaron ambos como ancestros y **el árbol resultante es idéntico byte por byte al de Alexis**. No se usó cherry-pick, squash, reset destructivo ni force push.

Las pruebas de src/code pasaron antes de integrar: 167 tests, TypeScript, build y 18 comprobaciones de seguridad cliente. Al finalizar se repiten sobre main. La presentación se desarrolla en Alexis bajo `presentation/`, separada de `src/code/`, y se integra a main mediante otro merge normal después de sus verificaciones locales. Su SHA final se obtiene con `git log -1 main`; no se escribe un SHA autorreferencial dentro del mismo commit.

## Comprobaciones reproducibles de conservación

```sh
git merge-base --is-ancestor backup/main-before-presentation-20261113 main
git merge-base --is-ancestor backup/Alexis-before-presentation-20261113 main
git merge-base --is-ancestor backup/German-before-presentation-20261113 main
git merge-base --is-ancestor Alexis main
git diff --exit-code backup/Alexis-before-presentation-20261113 main -- src/code
git rev-parse origin/German
git log -1 main --format='%H %P %s'
git status --short
```

No se creó una rama local German ni se modificó su referencia remota; se consulta `origin/German` para su SHA.

## Publicación y producción

Los remotos se volvieron a consultar y seguían en las puntas anteriores. **No se hizo push ni despliegue.** La condición del prompt para publicar main exige todas las verificaciones; faltan revisión visual, teléfonos físicos, PC de Germán y demo real. Esta retención responde a esa condición, no a falta de autorización para trabajar. No se alteraron Firebase, Supabase real ni datos de producción. El estado remoto sigue intacto y los merges locales conservan toda la historia.
