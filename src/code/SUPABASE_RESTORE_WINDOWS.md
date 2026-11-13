# Restauración local compatible — Windows

Para Windows sin Docker Desktop: [restauración en Linux temporal privado](SUPABASE_RESTORE_CLOUD.md).

Alexis; destino exclusivamente descartable. No se usa 127.0.0.1:55432 ni se toca
BuscAG_restore, Supabase remoto, producción o Firebase. No se ejecutan las migraciones
pendientes de la aplicación. No se genera otro respaldo.

## Diagnóstico ya resuelto

Evidencia del operador: PostgreSQL origen **17.11**, 600 entradas de TOC; lectura y
conversión completa a NUL con exit code 0. Incluye SCHEMA auth, FUNCTION auth.uid(),
TABLE DATA auth.users/auth.identities y extensiones pg_stat_statements, pgcrypto,
supabase_vault y uuid-ossp. Es evidencia aportada, no una restauración hecha aquí.

PostgreSQL estándar 18.6 no trae supabase_vault. Restaurar sólo public y
buscag_private excluye auth.uid y rompe dependencias de vistas/RLS. No arreglarlo
creando funciones ficticias ni quitando políticas. Se restaurará el archivo COMPLETO
en un clúster Supabase PG17 separado, con los binarios y roles originales necesarios.
No reutilizar la base donde hubo restauraciones parciales.

## Imagen y qué se verificó realmente

Referencia oficial consultada:
https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml
(servicio db: supabase/postgres:17.6.1.136).

Se obtuvo del registro el manifiesto Linux amd64 y se fijó su digest:

```
supabase/postgres@sha256:5a4314708484bec672de2c09653a5c01fb1c84a998564ac231b0325e2238ed5b
```

El script no sigue latest ni permite sustituirlo por una imagen arbitraria. Usa
linux/amd64 explícitamente; Windows ARM necesitaría emulación compatible. Requiere
Docker Desktop en modo Linux containers y espacio/RAM disponibles (PGDATA usa tmpfs
con máximo 2 GiB). La imagen requiere varios GB de disco según el backend de Docker.

**No se afirma que el motor de esa imagen sea exactamente 17.11.** La etiqueta oficial
17.6.1.136 identifica un build de la familia 17; el script consulta y registra la versión
real del motor, exige major 17 y comprueba las extensiones disponibles. La compatibilidad
entre esos minor/builds y versiones de extensiones debe terminar de demostrarse con la
restauración completa. Si falla, se detiene: no elimina extensiones ni ignora errores.
No se actualiza ni se rebaja ningún servidor existente.

Se comprobó el origen público/tag/digest y se probaron parser, argumentos y guardas
con cinco tests locales. **La descarga aquí falló al registrar una capa por falta de
espacio (`no space left on device`). No hubo arranque, restauración real ni ensayo de
integración exitoso de este script.** El archivo real sigue en Windows y no es
accesible desde este workspace. El procedimiento está preparado, pendiente de esa
primera ejecución y sus resultados; no es una certificación del respaldo.

## Comandos mínimos en tu PC

Actualizar Alexis al commit de esta entrega. Desde src/code, con Node y tu
pg_restore 18.6 disponibles; Docker Desktop debe estar iniciado. Los comandos usan
argumentos separados, por lo que la ruta con espacios se conserva correctamente.

Primero, inspección local sin Docker ni SQL ejecutado:

```powershell
node scripts/inspect-restore-archive.mjs 'C:\Users\Valen M\Downloads\BuscAG_Staging_backup.dump'
```

Si pg_restore no está en PATH, agregar al final:

```powershell
--pg-restore 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe'
```

Es la ubicación habitual, no una ruta comprobada en tu PC: usar la del ejecutable
18.6 que ya te funcionó. El inspector calcula SHA-256, versiones, extensiones,
propietarios del TOC y cobertura de Auth. No ejecuta SQL, no extrae filas, no imprime
cuerpos de funciones y nunca declara restauración verificada. El inventario de roles
no es exhaustivo: un dump de DB no exporta todos los atributos/membresías globales.

Después, restauración real en un destino NUEVO y aislado:

```powershell
node scripts/restore-supabase-local.mjs 'C:\Users\Valen M\Downloads\BuscAG_Staging_backup.dump'
```

Agregar el mismo --pg-restore si hace falta. No necesita la contraseña local de
55432 ni credenciales de Supabase. El script:

1. Inspecciona el archivo; exige origen PG17, auth.uid real y datos users/identities,
   y exactamente las cuatro extensiones conocidas. Una variante desconocida bloquea.
2. Usa sólo el daemon local: Windows npipe docker_engine (Linux unix docker.sock).
   Ignora selectores DOCKER_HOST/context/TLS heredados. No acepta endpoints remotos.
3. Descarga la imagen fijada del registro. Crea buscag-restore-<UUID>, sin red ni
   puertos, sin socket Docker montado y sin carpetas personales adicionales. El único
   bind mount es el archivo existente a /review/backup.dump, sólo lectura.
4. El entrypoint oficial prepara su base postgres y los roles globales de Supabase.
   No se inventa auth.uid ni se modifica su definición: la de la base restaurada viene
   del archivo. Espera al postgres final, no al servidor temporal del bootstrap.
5. Comprueba major del servidor, disponibilidad de todas las extensiones y existencia
   de los propietarios del TOC. No crea roles ad hoc ni da SUPERUSER para sortear errores.
6. Comprueba que el pg_restore de la imagen puede leer el archivo. Si el formato fue
   producido por un cliente más nuevo y no es compatible, falla en archive_reader;
   no es prueba de corrupción ni permiso para ignorar la versión.
7. Crea restore_<UUID> desde template0, owner postgres, en ese contenedor nuevo.
   createdb debe tener éxito: nunca reutiliza ni sobrescribe otra base.
8. Ejecuta pg_restore completo, sin filtros de esquemas, con --exit-on-error y
   --single-transaction, conservando propietarios/ACL. No usa --clean, --create,
   --no-owner, --no-privileges ni --disable-triggers.
9. Comprueba auth.uid, conteos de Auth/aplicación, RLS habilitada en tablas de la app,
   las cuatro extensiones instaladas y que el SHA-256 del archivo no haya cambiado.
10. Guarda result.json en un directorio privado temporal y devuelve un resumen seguro.
    No establece ningún GUC backup_verified. No instala secure_recovery/community_safety.

El contenedor queda vivo para auditar la copia. Sus datos están en tmpfs: **detenerlo
pierde esa copia**. El archivo original sigue en su ruta y no se cambia. No se guardan
filas en Git ni se copian a otro dump.

### Resultado y errores

Éxito técnico: exit code 0 y restore_completed=true. Todavía mostrará
backup_verified=false, semantic_validation pendiente, versión real, contenedor/base,
SHA-256 y conteos agregados. Eso acredita restauración técnica y controles básicos,
no igualdad completa con el origen ni funcionamiento de toda la aplicación.

Fallo: exit code 1, etapa exacta en result.json y failure.private.log en la carpeta
indicada. Bootstrap también conserva un bootstrap.private.log. Los logs pueden
contener datos sensibles de errores COPY o definiciones: **no pegarlos ni subirlos a
Git**. Compartir primero sólo result.json sin rutas personales si se prefiere.

- image/bootstrap: revisar espacio Docker, Linux containers, permisos de archivo e
  inicialización oficial; no tocar el PostgreSQL de 55432.
- dependencies: falta un rol propietario o extensión real. Revisar el inventario y
  bootstrap oficial; no crear roles según errores ni conceder privilegios extra.
- archive_reader: revisar versión del productor/lector; se requiere un lector
  compatible dentro del entorno, no cambiar o recortar el archivo.
- full_restore: conservar el error privado y analizar dependencia/versión exacta.
  Si choca un esquema/objeto de template0 o una extensión tiene otra definición,
  detenerse y revisar; no editar constraints, ACL o funciones para forzar un verde.
- checks: restauración no aceptada; revisar RLS/cobertura/hash, sin desactivar controles.

El script no elimina automáticamente contenedores ni bases existentes, tampoco
cuando falla. Para descartar SÓLO el contenedor UUID devuelto tras revisar resultados:

```powershell
docker --host=npipe:////./pipe/docker_engine rm -f -v <buscag-restore-UUID-devuelto>
```

Esto destruye únicamente la copia aislada y volúmenes anónimos de ese contenedor;
no borra el bind mount del respaldo. No usar docker system prune ni borrar otras bases.

## Qué falta para considerar suficiente el respaldo

Tras restore_completed=true: revisar catálogo completo, owners, ACL, restricciones,
índices, triggers, vistas/RLS y conteos contra evidencia de origen; probar lecturas y
rechazos con roles API en la copia, sin inventar Auth. Un mismo conteo no prueba que
todos los contenidos sean iguales. El dump puede ser anterior al school actual:
clasificar su etapa antes de cualquier ensayo de las dos migraciones pendientes.

No ejecutar fixtures que borran o resembran datos sobre esa copia. El siguiente ensayo
necesita un plan para SU catálogo: el instalador generado en remoto puede tener otro
fingerprint. La validación posterior en Supabase sigue pendiente y es independiente.

Vault puede contener datos cifrados. Restaurar bytes y extensión no demuestra poder
recuperar secretos si falta material criptográfico externo del proveedor. No inventar
claves ni pedirlas en chat. Asimismo, Storage metadata no incluye necesariamente
binarios del bucket ni un dump de DB incluye secretos Edge/configuración SMTP.
Registrar alcance y límites antes de declarar suficiente el respaldo para recuperación.

## Archivos y pruebas

- scripts/inspect-restore-archive.mjs: inspección de metadatos, sin conexión/SQL ejecutado.
- scripts/restore-supabase-local.mjs: ruta local aislada, imagen inmutable y restauración.
- tests/restore-safety.test.mjs: cinco pruebas de Auth/cobertura, secretos no exportados,
  lectura offline, formato/versiones, daemon local, permisos/puertos/mounts y guardas.
- Este procedimiento y SUPABASE_RESTORE_WINDOWS_VALIDATION.json documentan los límites.

Las pruebas unitarias no se presentan como ensayo Docker ni como restauración del
respaldo real. El próximo paso mínimo es ejecutar el restaurador en Windows y revisar
su result.json. No hace falta ni está autorizado ningún cambio de staging/producción.
