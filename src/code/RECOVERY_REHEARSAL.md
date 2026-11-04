# Ensayo de respaldo y restauración preparado

Se añadió `npm run test:restore:postgres`. Ejecuta pg_dump y pg_restore reales sobre
bases sintéticas distintas, creadas con nombre aleatorio. No acepta URL, contraseña,
nombre de base origen/destino ni dump de producción como argumentos.

## Qué prueba

1. Instala los ocho SQL en la estructura observada, con usuarios y publicaciones
   ficticios y funciones de triggers del repositorio como sustitutos declarados.
2. Activa el backend y genera publicaciones, coincidencias, mensajes y reintentos.
   Añade identidades mínimas, metadatos de imagen y una suscripción push ficticia.
3. Crea un archivo custom de PostgreSQL en memoria y lo restaura en otra base nueva.
4. Compara exactamente las filas de 14 tablas, RLS, grants, políticas, constraints,
   índices, triggers, funciones y sus fingerprints. Ignora OID y orden interno de ACL;
   compara sus permisos efectivos por rol y columna.
5. Repite la publicación y el mensaje ya aceptados: devuelve los mismos IDs, no
   escribe otra vez y conserva el estado recuperado posterior de la publicación.
6. Comprueba que un tercero no lee mensajes, avisos ni suscripciones; profiles
   devuelve sólo su propia fila, el directorio oculta contacto ajeno salvo intercambio
   recíproco y no se puede editar otra publicación ni cambiar rating desde el cliente.
7. Pausa únicamente la copia restaurada: conserva trabajos/recibos/avisos y deja
   intacta la base origen. Ambas bases se eliminan al terminar el ensayo.

Un backup conserva también enabled:true si el origen estaba activo. Por eso una
restauración destinada a staging debe aislarse de cron, webhooks, claves y servicios
externos **antes** de conectarla a ellos, y pausar su procesamiento. No modificar el
archive para fingir que los indicadores no estaban activos.

## Reproducción local

Requiere Linux/WSL con Docker local y PostgreSQL 17. Preparar deliberadamente un
contenedor descartable: etiqueta `buscag.disposable=true`, red `none`, datos en tmpfs
`/var/lib/postgresql/data` y socket Unix montado en `/var/run/postgresql` desde un
**directorio de pruebas nuevo**. Nunca montar un socket de producción. El script
comprueba estas condiciones antes de ejecutar las pruebas y usa sólo el daemon local.

Desde src/code, con las dependencias de desarrollo instaladas:

```
LOCAL_PG_SOCKET=/ruta/del/socket-de-pruebas BUSCAG_TEST_CLUSTER=disposable BUSCAG_TEST_CONTAINER=buscag-restore-drill npm run test:restore:postgres
```

El socket debe coincidir exactamente con el bind mount del contenedor. Los archivos
reales no se copian al contenedor ni se leen variables/credenciales de otro proyecto.
La salida muestra sólo el resultado y SHA-256 del archive sintético, no filas ni claves.
Los comandos pg_dump/pg_restore se ejecutan dentro del contenedor con sus herramientas
compatibles. Las bases de prueba se cierran y eliminan; el operador detiene su
contenedor descartable al finalizar. No se inicia/reinicia Docker ni se afectan
otros contenedores desde el script.

## Verificación reforzada de imágenes

`backup:storage -- --verify` comprueba ahora que el directorio raíz, objects,
manifest.json y cada objeto sean archivos/directorios reales, sin symlinks; que todos
los objetos pertenezcan a buckets declarados y únicos; y que no haya archivos sin
referenciar en objects. Se conservan tamaño y SHA-256, y no se acepta una lista vacía
de buckets como prueba de cobertura. Un bucket declarado realmente vacío sí es válido.
La salida mantiene snapshot_consistent:false: no puede probar un snapshot global ni
la cobertura remota sólo leyendo archivos locales. No borra archivos sobrantes ni
corrige automáticamente un respaldo inválido.

Las nuevas pruebas primero reprodujeron dos falsos positivos del verificador anterior:
un directorio objects enlazado fuera del respaldo y un manifiesto sin buckets o con
archivos no inventariados. Se corrigieron sin modificar datos de Storage real.

## Límites antes de activar producción

Este ensayo no es un backup de tu Supabase: usa Auth/Storage mínimos, datos ficticios
y las funciones del repositorio. No sustituye el respaldo cifrado de DB/Auth, los bytes
de imágenes ni un ensayo de restauración del proyecto real en otro destino privado.
Siguen pendientes revisión de las tres funciones reales con hashes distintos,
configuración de Storage y pruebas de Auth/correo/PostgREST/Realtime/push reales.
Ver BACKEND_ACTIVATION.md y REAL_SUPABASE_RECONCILIATION.md antes de cualquier SQL remoto.

## Resultado de esta ejecución

- pg_dump/pg_restore nativos: aprobado, 14 tablas sintéticas y su estado de seguridad.
- Reintentos después de restaurar, privacidad y pausa sólo del destino: aprobados.
- Aplicación/herramientas: 95/95; cliente: 16/16.
- Matriz PostgreSQL: 61/61 DATE del repositorio, 61/61 timestamptz, 64/64 estructura
  observada; ensayo adicional de ocho archivos y activación aprobado.
- PGlite: 58/58, 58/58 y 61/61, más el ensayo de instalación completo.
- TypeScript, build y ambas Edge Functions con Deno check --frozen: correctos.
- Sin nuevas dependencias, cambios visuales, SQL remoto, deploy ni datos reales.
