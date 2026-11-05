# BuscAG: presentación escolar, sin infraestructura comercial

Esta es la prioridad vigente. No es un lanzamiento público general. No se exige
comprar dominio, contratar SMTP, instalar cron comercial, certificar push o compilar
Android/iOS para aprobar la demostración. Los planes anteriores de lanzamiento masivo
conservan su contexto; no son una lista de compras para la presentación.

## Ruta recomendada y separación de datos

Preparada una opción explícita: la web en https://buscag-2677c.web.app usando
**BuscAG-Staging REAL** (yiarlhpbgkofhhipkfha) y dos cuentas ficticias confirmadas.
No contiene mocks ni un dataset incrustado: datos, imágenes, mensajes y avisos usan
las APIs reales del proyecto de pruebas. La franja «Presentación escolar ·
Supabase-Staging · datos de prueba» identifica el entorno sin fingir producción.

Esta opción está preparada, **no desplegada ni elegida en tu nombre para el sitio
publicado**. La autorización posterior debe decir expresamente que el Hosting
usará staging para la presentación. La alternativa de backend producción conserva
sus requisitos de diagnóstico/backup y ocho migraciones; no aplicarlos sólo para
mostrar la web si se aprueba usar staging ya instalado.

- `build:release` conserva su destino exclusivo de producción y salida `dist`.
- `build:presentation` sólo acepta la clave pública de staging, ignora VITE_* heredadas,
  no carga .env y genera `dist-presentation`, con manifiesto y checksums.
- `firebase.presentation.json` publica únicamente `dist-presentation`, con rutas SPA,
  cabeceras y CSP que bloquea la API de producción. `firebase.json` no se modifica.
- La sesión de presentación tiene una clave de almacenamiento distinta. No reutiliza
  una sesión antigua de producción ni la del frontend local de staging.
- No existe deploy automático ni script que integre main. Todo sigue en Alexis.

## Evidencia: qué sabemos y qué no

| Área | Evidencia real disponible | Falta |
| --- | --- | --- |
| Staging SQL | El titular confirmó nueve migraciones, verify RPC/permisos y smoke revertido. | Revalidación remota antes del ensayo. No repetir migraciones para fabricar historial. |
| Registro/login/publicación | El titular confirmó registro/login y una mochila ficticia publicada. | Ensayo actual con dos cuentas; no afirmar que volvió a ejecutarse aquí. |
| RLS, RPC y recuperación | Pruebas con PostgreSQL 17 nativo y PGlite: políticas, fechas, idempotencia, mensajes, ledger, recibos y recuperación. | PostgREST/Auth/Storage/Realtime reales no se sustituyen por SQL local. |
| Restauración | pg_dump/pg_restore de 14 tablas ficticias, metadata, privacidad y replay en clúster sin red. | No es ensayo integral del backup real del titular ni de los servicios administrados. |
| UI y móvil | Navegador Chromium con backend simulado, incluyendo formularios, imágenes, mapa, filtros, chat, logout y cambio de cuenta. | Internet del aula, navegador/dispositivo físico y APIs reales. |
| Coincidencias | Algoritmo real del frontend sobre filas ficticias y procesamiento SQL real aislado con avisos de ambos dueños. | Worker de staging no desplegado/configurado/verificado por esta ejecución. |
| Correo/push | Formularios y manejo de respuestas probados localmente. | Recepción real no certificada. No prometer email por HTTP 200 ni push por una fila en DB. |

El preflight `qa:staging:live -- --probe` se intentó en esta ejecución y se detuvo
**antes de HTTP**, por falta de clave pública de staging. El entorno tampoco tiene
permiso de red para su host ni credenciales de prueba vinculadas. No se probó
producción como sustituto. Es una falta de acceso, no un fallo demostrado de la app.

## Mínimos para aprobar la presentación

1. Dos cuentas ficticias distintas, confirmadas y funcionales; las credenciales quedan
   privadas. No hace falta un tercer usuario salvo para ensayar aislamiento de terceros.
2. Una ejecución del runner real, sin errores en login, Storage, publicación/RPC,
   edición propia y rechazo ajeno, chat, recibos, avisos, Realtime, recuperación y logout.
   El aislamiento de terceros queda marcado pendiente si sólo hay dos cuentas.
3. Abrir el frontend real con ambos usuarios en navegadores separados y comprobar
   mapa/filtros y sincronización durante el recorrido del guion. No usar las capturas
   de fixtures para asegurar que el backend remoto pasó.
4. Para mostrar coincidencias visuales basta el algoritmo del navegador sobre las
   publicaciones reales. Para afirmar entrega automática a ambos propietarios por
   backend se necesita el worker real; ver la sección siguiente.
5. Checkout limpio, CI verde del SHA final y main ancestro de Alexis. Después pedir
   autorización específica de integración, y otra de Hosting con backend staging.

No bloquear por SMTP comercial: usar las cuentas confirmadas. Registro y recuperación
por email pueden quedar fuera del recorrido si no hay correo disponible. No simular
recepción, desactivar confirmaciones ni decir que el alta abierta está certificada.
El SMTP predeterminado limita destinatarios/cuota, como documenta SMTP_LAUNCH.md.
Si se desea mostrar correo, usar un buzón de prueba permitido y configurar en staging
los callbacks públicos exactos / y /?auth=recovery; no cambiar producción.

## Ensayo real en un comando

Preferencia: vincular una vez, mediante configuración segura del entorno, el host de
staging, BUSCAG_STAGING_PUBLISHABLE_KEY y las dos cuentas ficticias como
BUSCAG_STAGING_TEST_ACCOUNTS_JSON. No enviar contraseñas al chat. Con
BUSCAG_STAGING_TEST_ACCOUNTS_CONFIRMED=dedicated-test-accounts:

```
npm.cmd run qa:staging:live -- --run
```

Si no se vincula acceso a este entorno, desde src/code en la computadora del titular:

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Run-StagingQA.ps1 -Mode Run
```

Solicita clave PUBLICABLE y dos cuentas ficticias en memoria; no guarda archivos de
credenciales ni cambia la política global de Windows. `-AccountCount 3` añade el
observador de privacidad opcional. PowerShell no está instalado aquí: el wrapper
se revisó, pero no se declaró ejecutado en Windows. No volver a registrar las cuentas
confirmadas ni usar Register como paso obligatorio. El ensayo deja sus datos QA nuevos
identificables y no borra la mochila previa ni conversaciones existentes.

## Coincidencias: dos capacidades diferentes

La pestaña Coincidencias recalcula en el frontend las parejas compatibles de datos
leídos de Supabase: misma categoría, fechas cercanas, ubicación y descripción. Eso
funciona sin worker y no es un resultado ficticio si las publicaciones vienen del
backend real. En modo heredado sólo el usuario que publica recibe el aviso propio;
no prometer notificación de backend para ambos con matches_enabled=false.

Para demostrar los avisos de backend, no hace falta contratar un planificador:

1. Operador de **staging**: desplegar process-matches desde esta revisión al ref
   yiarlhpbgkofhhipkfha, con config/lock existentes y verify_jwt=false. Configurar
   MATCH_WORKER_SECRET independiente (32–512 caracteres) en Secrets. SUPABASE_URL y
   SERVICE_ROLE del worker deben ser los gestionados de staging, nunca producción.
2. Vincular ese mismo secreto sólo en la terminal privada del presentador como
   BUSCAG_STAGING_MATCH_WORKER_SECRET, nunca VITE_*. Comprobar una llamada:

   ```
   npm.cmd run demo:worker -- --once
   ```

   Debe informar enabled:false y cero fallos si todavía está deshabilitado. No se
   activa nada desde el CLI. Es una llamada HTTP real; no confundirla con tests de fixtures.
3. En staging, drenar publicaciones en curso y revisar/aplicar manualmente
   supabase/activation/enable_trusted_matches.sql después de verificar heartbeat.
   No repetir migraciones ya aplicadas. Esta ejecución no aplicó ese SQL remoto.
4. Mantener durante el ensayo el procesador local confiable:

   ```
   npm.cmd run demo:worker -- --watch
   ```

   Invoca el backend real cada diez segundos durante diez minutos, después termina.
   Ctrl+C detiene llamadas futuras. No es un servicio permanente ni procesa offline.
   Publicar una pareja **nueva** mientras está habilitado y comprobar avisos para ambos
   dueños; no hay backfill automático de las publicaciones antiguas. Ver fallos/cola
   con backend_readiness.sql. No filtrar IDs o texto de mensajes en logs.
5. No activar push para este recorrido. Las notificaciones internas no lo necesitan.
   Si el worker no está operativo, demostrar la comparación y explicar la limitación
   del aviso; no crear avisos falsos ni presentarlo como automático a ambos dueños.

El watch sólo conoce la URL de staging y su respuesta pública de contadores. No acepta
un destino libre, no contiene service_role y no habilita matching ni despliega funciones.

## Integración y publicación: pendientes de autorización separada

1. Con ensayo real aprobado, refrescar refs y CI del SHA final. Confirmar que main
   sigue siendo ancestro. **No se realizó la integración en esta entrega.**
2. Con autorización específica: integrar con `git merge --ff-only origin/Alexis` desde
   main y push normal sólo main, conservando todos los commits; regresar a Alexis.
   Si hay divergencia/protección/cambio remoto, parar, sin reset ni force.
3. Con la clave pública de staging vinculada y checkout limpio:
   `npm.cmd run build:presentation`. Validar manifiesto (ref staging, SHA y origen).
   No reutilizar dist-presentation-test: contiene una clave ficticia y sólo sirve a QA.
4. Guardar versión/release Hosting actual y manifiesto antes de cambiar el sitio.
   La reversión de Hosting debe conservar un cliente compatible con el backend elegido.
5. Con autorización específica que confirme usar staging en el sitio, ejecutar desde
   src/code `firebase deploy --only hosting --project buscag-2677c --config firebase.presentation.json`.
   No desplegar Functions/DB/Storage de Firebase ni ejecutar SQL de producción.
6. Comprobar franja de entorno, manifest SHA/ref, raíz/recarga, HTTPS, fotos, login y
   dos usuarios. Una pestaña antigua debe recargarse: no mezclar clientes anteriores.
   Para recuperar Hosting, volver al release guardado; no restaurar un dump ni abrir RLS.

**No se ejecutó ninguno de los pasos de integración o publicación.** No se exige
migrar producción para esta ruta de presentación; usarla en otro momento mantiene
el plan de BACKEND_ACTIVATION.md y requiere autorización nueva.

## Resultados locales de esta entrega

PostgreSQL 17 aislado: 61/61 DATE, 61/61 timestamptz, 64/64 esquema observado;
ensayo de orden completo y pg_dump/restore de 14 tablas ficticias correctos. No se
usaron backups ni conexiones reales. Deno check --frozen pasó en las dos Edge Functions.
TLS local del instalador: tres pruebas correctas. El ensayo remoto no llegó a HTTP
por falta de clave staging. Resultados de aplicación/navegador y CI se informan al
cierre por su commit exacto, sin heredar el resultado de una revisión anterior.

La validación del runner acepta las contraseñas existentes de las cuentas de prueba,
sin imponer un cambio de contraseña por longitud local. La política y autenticación
reales siguen siendo las de Supabase; no se debilitaron ni modificaron allí.

Batería completa final: 113 pruebas de aplicación, TypeScript/build, 32 E2E de
Chromium con backend simulado y dos recorridos adicionales del build escolar
(desktop/móvil, backend simulado); PWA, 16 controles cliente y matriz PGlite correctos.
Se ejecutaron también las cuatro pruebas del instalador staging, tres TLS, cuatro
guardas release, tres de configuración escolar, tres del invocador worker y cinco
del runner live (la quinta se repitió junto con TypeScript tras ajustar cuentas
existentes). Los fallos iniciales del nuevo test de coincidencias eran selectores
que no contemplaban el contador accesible; se corrigieron y la batería final pasó.
Ninguna de esas pruebas acredita servicios remotos. CI del commit final se consulta
después del push; no se hereda el resultado del commit anterior.
