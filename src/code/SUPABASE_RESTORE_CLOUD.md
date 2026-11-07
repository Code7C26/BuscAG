# Restauración privada en Linux temporal (sin Docker Desktop)

Rama Alexis. No modifica el Windows local, staging, producción ni Firebase. El modo
nube usa el mismo restaurador aislado, pero NO requiere pg_restore instalado en el
host: lee el archivo mediante el binario de la imagen oficial. Nunca instala las dos
migraciones pendientes automáticamente.

## Estado real de Codex Cloud en esta entrega

- Linux amd64; Docker local 29.9.2 disponible, almacenamiento vfs.
- Límite de memoria efectivo: 8 GiB.
- Espacio libre del workspace: aproximadamente 6,2 GiB. **No es una medición del
  espacio libre del daemon Docker**: DockerRootDir no es accesible desde Node aquí.
- Una descarga anterior de la imagen falló con `no space left on device`.
- El dump real no está adjunto ni montado en este entorno. La ruta C: de tu PC no es
  accesible desde Cloud. Los adjuntos actuales sólo contienen textos anteriores.
- No hay una herramienta disponible en esta sesión para ampliar el disco del daemon.

Se ejecutó sólo preflight (sin pull, arranque de contenedores ni SQL):

```sh
node scripts/restore-supabase-cloud.mjs --check --result /tmp/buscag-cloud-current/result.json
```

Su exit code 1 corresponde a bloqueos reales: docker_disk_unknown y
private_archive_unavailable. restore_completed=false, backup_verified=false.
No se volvió a intentar la descarga grande ni se repitió un respaldo.

**No se ha restaurado ni verificado el respaldo.** El resultado actual sólo documenta
capacidad/acceso. El procedimiento y sus guardas están probados unitariamente; la
integración completa con el archivo real sigue pendiente.

## Opción A: Codex Cloud con capacidad y archivo privado

Hace falta un entorno cuyo filesystem del daemon pueda medirse y tenga espacio
suficiente, más el archivo existente recibido privadamente. El preflight exige
conservadoramente 20 GiB libres del almacenamiento Docker y 4 GiB de memoria efectiva.
Ese umbral es una política operativa, no una estimación exacta ni una garantía de que
cualquier dump quepa. PGDATA tiene límite tmpfs de 2 GiB; un dump mayor exige revisar
recursos, sin desactivar controles ni fingir éxito.

Subir el archivo mediante un adjunto privado/almacenamiento del entorno con acceso
restringido, fuera del repositorio. No usar GitHub, un bucket público, un enlace
público ni el proyecto Supabase. No necesitamos una contraseña remota. El archivo
puede incluir hashes de Auth, chats y otros datos sensibles: revisar permisos y
retención del servicio antes de transferirlo. No pegar su SQL en el chat.

Ejemplo de ubicación privada: /tmp/buscag-private/backup.dump, directorio 0700 y
archivo 0600. La ruta real de un adjunto también sirve si está fuera de BuscAG.
El script resuelve symlinks y bloquea archivos dentro del repositorio; nunca ejecuta
git add sobre un dump. No cambiar sus permisos a world-readable para sortear errores.

Con el archivo privado ya disponible:

```sh
node scripts/restore-supabase-cloud.mjs --check \
  --backup /tmp/buscag-private/backup.dump \
  --result /tmp/buscag-review/result.json
```

Sólo continuar si status=preflight_passed y blockers=[]. No reemplazar el espacio
Docker desconocido por el espacio libre del workspace ni bajar el umbral sólo para
pasar. Si faltan permisos para medir DockerRootDir, usar una cuenta administradora
DEL HOST DESCARTABLE o un entorno que exponga esa medición; no cambiar permisos de
bases, roles, RLS ni archivos de otras tareas.

Para restaurar exclusivamente en el contenedor local:

```sh
node scripts/restore-supabase-cloud.mjs --restore \
  --backup /tmp/buscag-private/backup.dump \
  --result /tmp/buscag-review/result.json
```

El comando no acepta URI de conexión ni endpoint Docker remoto. Usa el socket local
fijo, elimina selectores Docker heredados y nunca llama a Supabase. La descarga de
la imagen contacta sólo su registro público, antes de crear el contenedor.

## Opción B: VM Linux temporal privada

Si Codex Cloud no permite resolver el disco/acceso, usar una VM Linux x86_64 temporal,
por ejemplo Ubuntu 24.04 con Docker y Node 24 preparados. Recomendación operativa:
8 GiB RAM y disco de 40–60 GiB, con al menos 20 GiB libres en DockerRootDir; preferir
almacenamiento overlay2 disponible de fábrica. No cambiar el driver de un daemon con
trabajo ajeno ni borrar sus datos. No crearla dentro del proyecto Supabase.

Sólo SSH/SFTP privado desde tu IP, sin puerto PostgreSQL abierto. No guardar claves
Supabase ni copiar variables del entorno de staging. Usar el checkout Alexis mediante
el acceso habitual a GitHub; estos scripts usan sólo módulos nativos y no requieren
npm install ni secretos del proyecto.

Transferir el dump existente desde Windows mediante SFTP o scp si está disponible
(`Get-Command scp`); alternativamente, una carga privada de archivos del proveedor.
No necesita Docker ni virtualización en Windows. Ejemplo, una vez creados el usuario,
la VM y un directorio privado con sus permisos:

```powershell
scp "C:\Users\Valen M\Downloads\BuscAG_Staging_backup.dump" usuario@IP-DE-LA-VM:/home/usuario/buscag-private/backup.dump
```

No poner contraseñas/tokens en la URL ni en el comando. El destino real debe ser una
VM bajo tu control con acceso privado, no una dirección inventada ni un servidor de
base existente. Es una transferencia del respaldo existente para el ensayo, no la
generación de un nuevo dump de Supabase.

En Linux, fuera del repo:

```sh
chmod 700 /home/usuario/buscag-private
chmod 600 /home/usuario/buscag-private/backup.dump
```

Desde src/code, ejecutar los mismos dos comandos --check y --restore cambiando la
ruta. Si Docker requiere privilegios, usar el mecanismo administrativo de esa VM
sin exportar credenciales de Supabase. No exponer el daemon Docker por TCP.

## Imagen e independencia de plataforma

Se conserva la imagen oficial inmutable Linux amd64:

```
supabase/postgres@sha256:5a4314708484bec672de2c09653a5c01fb1c84a998564ac231b0325e2238ed5b
```

Procedencia/tag: supabase/postgres:17.6.1.136, referenciada por el compose oficial;
fuentes y digest en SUPABASE_RESTORE_WINDOWS.md y su JSON. El origen del dump es
17.11. **No se afirma que ese build ejecute exactamente minor 17.11**: el restaurador
consulta la versión real, exige major 17 y verifica extensiones/roles. Sólo una
restauración real exitosa demuestra compatibilidad de ese archivo con el build.
No actualizar ni modificar staging para alinear versiones.

El entrypoint oficial prepara únicamente el clúster descartable. La base destino es
nueva, desde template0, nombre UUID; no se sobreescribe una base existente. auth.uid y
los datos Auth del destino vienen del dump completo, no de stubs. Si falta un rol,
una extensión o un formato de archivo compatible, el proceso falla y se revisa;
no crea roles arbitrarios ni omite objetos para continuar.

El contenedor de restauración tiene network=none, ningún puerto publicado, PGDATA
nuevo en tmpfs y sólo el dump montado read-only. Los lectores de metadatos también
son contenedores sin red, root filesystem read-only y sin SQL ejecutado. No reciben
credenciales del proyecto y no montan el socket Docker. El runner no utiliza
127.0.0.1:55432 ni ninguna URL remota.

## Comprobaciones reales programadas para la copia

La ejecución --restore realiza:

1. Inventario y SHA-256 del archivo, origen PG17, Auth completo y las cuatro
   extensiones conocidas (pg_stat_statements, pgcrypto, supabase_vault, uuid-ossp).
2. Restauración completa y transaccional, conservando propietarios/ACL. Ningún
   --no-owner, --no-privileges, --disable-triggers ni recorte de esquemas.
3. Presencia de auth.uid; conteos agregados de auth.users, auth.identities,
   profiles, items y messages; extensiones y RLS habilitada en tablas de BuscAG.
4. Dentro de una transacción READ ONLY y con rol authenticated: configurar claims
   de prueba (UUID constante sintético, sin crear usuarios), llamar a la función
   auth.uid REAL restaurada y comprobar que perfiles ajenos siguen ocultos por RLS.
   No crea ni reemplaza funciones Auth ni modifica filas de usuarios.
5. Recalcular SHA-256 del dump para detectar cambios durante el ensayo.

El result.json publicable contiene estados, recursos, hashes, versiones y conteos,
no nombres, emails, teléfonos, UUID de usuarios reales, filas, SQL o cuerpos de
funciones. Los logs de fallos detallados permanecen en /tmp/buscag-restore-private-*
con permisos restringidos: pueden contener datos COPY; **no compartirlos ni subirlos
a Git**. El modo cloud excluye directorios privados y nombres de roles faltantes del
resultado público. No establece el GUC remoto backup_verified.

Éxito: status=restored_pending_semantic_review y restore_completed=true. El campo
backup_verified sigue false hasta revisar también catálogo/ACL/integridad y alcance
real del archivo. Las comprobaciones de RLS programadas no sustituyen todas las
pruebas de autorización de la aplicación ni validación posterior en Supabase.
Si falla: status=restore_failed o blocked, failed_stage/code cuando están disponibles;
no se presenta una restauración parcial como éxito.

Después se podrá ensayar el SQL propio sobre esa copia con un plan para SU catálogo.
El install.review.sql del remoto puede tener otro fingerprint y no se ejecuta aquí
sin esa revisión. La instalación remota de secure_recovery/community_safety sigue
pendiente de autorización explícita; este pedido no se interpreta como permiso para
modificar staging.

## Cierre y eliminación

El contenedor queda vivo para inspección posterior; detenerlo pierde el tmpfs.
Tras terminar, eliminar sólo el contenedor UUID que devolvió el runner:

```sh
docker --host=unix:///var/run/docker.sock rm -f -v buscag-restore-UUID-DEL-RESULTADO
```

Después eliminar únicamente la copia transferida y sus logs privados según la
política del entorno y destruir la VM temporal. Conservar el respaldo original en
Windows; no ejecutar docker system prune ni borrar otras bases. No hacer públicos
snapshots/discos del ensayo. No se borró ningún archivo del usuario en esta misión.
