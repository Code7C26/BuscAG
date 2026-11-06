# Siete funciones escolares: implementación y activación separadas

Trabajo sobre Alexis. Producción, main, German y Hosting no se modificaron.
El código y SQL son reales; **no están instalados en staging por esta ejecución**.
No sustituir esta distinción por resultados del navegador con APIs simuladas.

## Auditoría y dependencias reutilizadas

- Matching: `src/utils/matcher.ts`, `process_match_jobs`, cola privada y ledger
  `(lost_id,found_id,recipient_id)` existentes. No se agregó otro motor ni bandeja.
- Avisos: `notifications`, RLS, carga/reconexión y Realtime actuales.
- Contacto: cuentas confirmadas y `send_message_once`, límites e idempotencia actuales.
- Recuperación individual: continúa disponible; no se confunde con confirmación bilateral.
- Perfiles: sin nuevas lecturas de teléfono, correo ni perfiles privados.
- Línea base: las nueve migraciones del instalador de staging ya informadas como
  instaladas. Se añade **una propuesta opcional**, no se repiten las nueve.

## Qué implementa cada función

1. **Modo alerta:** propietario de publicación perdida guarda vigilancia ON/OFF
   mediante RPC. Sólo él puede hacerlo. El worker existente procesa novedades aun
   sin pestaña abierta si está programado fuera del navegador. Al reactivar se
   encola una revisión; no se reenvían pares ya notificados. Sin configuración por
   objeto se conserva el comportamiento general anterior, no se inventa un opt-in.
2. **Cercanía:** centro elegido tocando un mapa o introduciendo coordenadas, radio
   0,1–100 km; Haversine en servidor, sin GPS continuo. La zona del objeto perdido
   filtra ese par para ambos propietarios; preferencias individuales filtran cada
   destinatario. Guardar zona no publica sus coordenadas ni se aplica al mapa público.
3. **Coincidencias:** mismo algoritmo de categoría/texto/fecha/distancia, sumando
   rechazo de colores explícitos incompatibles y normalización de género/plural.
   El índice /100 no es porcentaje de certeza, reconocimiento de imagen ni prueba
   de propiedad. Descripciones incompletas o colores mal descritos producen falsos
   negativos; hay búsqueda y contacto manual. SQL y frontend usan el mismo filtro
   de colores; las sugerencias de UI siguen siendo más amplias que los avisos >=75.
4. **Avisos:** persisten en la bandeja actual; worker respeta preferencia de avisos
   de matching. Cambiar esa preferencia no elimina avisos anteriores ni silencia
   mensajes/solicitudes de devolución. Ledger evita duplicados. Instalado el backend
   escolar, el cliente nuevo deja los avisos persistentes de matching al servidor,
   incluso estando pausado; un fallo de consulta no activa otra vía de escritura.
   No se envían emails nuevos desde estas funciones. Push existente **no certificado**.
5. **Devolución bilateral:** dueño elige participante de un chat real; el otro
   acepta o cualquiera cancela. Sólo destinatario confirma, reintentos no duplican
   resultado ni avisos; bloqueos consistentes en servidor. Máximo cinco solicitudes
   nuevas por objeto/hora. Registro conserva participantes/fechas y chat; FK RESTRICT
   evita borrar el objeto con historial, incluso cancelado. Una confirmación bilateral
   no puede reabrirse mediante edición de estado. No existe purga o retención temporal
   automática; corrección excepcional requiere revisión administrativa. Recuperar
   individualmente sigue significando declaración del dueño, no certificación bilateral.
6. **QR:** dueño genera PNG local, descarga, reemplaza o revoca. Token UUID aleatorio,
   sin teléfono/correo en URL ni proveedor QR externo. RPC anónima sólo devuelve
   categoría, estado e identificador. Página pública exige login para abrir detalle y
   chat RLS existentes. El token no concede escritura ni identidad; revocar invalida
   su resolución y reemplazar invalida impresos anteriores. No elimina información
   que alguien ya haya visto/guardado. Debe imprimirse con la URL pública correcta;
   un QR de 127.0.0.1 no sirve desde otro teléfono. No incluye formulario anónimo de
   mensajes; las cuotas del chat y autenticación existentes siguen aplicándose.
7. **Estadísticas:** botón en inicio consulta `community_statistics`, SECURITY INVOKER.
   Conteos reales visibles según RLS; sin perfiles, datos privados ni números demo.
   Objetos recuperados cuenta estado declarado, no sólo devoluciones bilaterales.
   Actualización explícita evita polling y lecturas masivas en el cliente.

## Orden de activación propuesto — requiere autorización

1. Respaldar y verificar la base **de staging** y sus imágenes antes de añadir
   funciones. El respaldo original de producción no cubre publicaciones nuevas de
   staging; conservar ambos por separado y no sobrescribir el original. Reutilizar
   los procedimientos de `RECOVERY_REHEARSAL.md` con destino staging verificado.
   Confirmar que el
   destino de SQL Editor sea **BuscAG-Staging, yiarlhpbgkofhhipkfha** y que las nueve
   migraciones y smoke anteriores sigan aprobados. No usar el proyecto original.
2. Revisar/aprobar `supabase/proposals/20261105000000_school_features.sql`;
   aplicar **sólo ese archivo** en staging. Es transaccional y repetible, tiene
   timeout de locks; no reescribe datos existentes ni cambia su tipo DATE.
   Detenerse ante errores; no omitir sentencias ni conceder permisos amplios.
   El smoke/instalador de la línea base se ejecuta **antes** de esta extensión:
   su comprobación estricta de triggers desconocidos puede detenerlo después de
   instalar el nuevo trigger de protección. No ampliar listas permitidas ni borrar
   el trigger para forzar un smoke; usar las verificaciones escolares siguientes.
3. Ejecutar `supabase/audit/school_readiness.sql`, sólo lectura. Verificar cuatro
   tablas privadas con RLS, sin SELECT/DML directos; únicamente `resolve_object_tag`
   ejecutable por anon; estadísticas INVOKER y RPC de escritura DEFINER con
   search_path vacío; worker sólo service_role. Nuevas FK de historial RESTRICT.
4. **Elegir un solo programador del worker existente**:
   - Reutilizar la Edge Function `process-matches` y scheduler ya documentados,
     o el runner `demo:worker -- --watch` en un proceso de servidor/PC que permanezca
     encendido (funciona sin pestaña, pero el modo de ensayo termina automáticamente
     a los diez minutos y también se detiene si ese proceso se cierra). Para toda
     una presentación sin reinicios, preferir un scheduler de servidor verificado.
   - Alternativa independiente de PC: autorizar pg_cron en staging Dashboard y,
     después de revisar que no haya otro scheduler, ejecutar
     `supabase/activation/schedule_school_matching_STAGING_ONLY.sql`. Una ejecución
     cada minuto, cinco jobs por lote; sin secretos en SQL ni función nueva de matching.
     pg_cron **no se pudo probar aquí**, requiere verificar disponibilidad y permisos.
5. Si matching está deshabilitado, seguir el procedimiento existente de heartbeat
   y `enable_trusted_matches.sql`. Exige heartbeat observado en los últimos cinco
   minutos: con Edge verificar la llamada HTTP autenticada; con cron verificar
   ejecución SQL y heartbeat reales. No modificar la bandera sin sus precondiciones.
   La propuesta escolar no la activa y no hay backfill automático: probar nuevas
   publicaciones posteriores o activar vigilancia de un perdido para encolarlo.
6. Ejecutar la guía `VISITOR_REGISTRATION.md` en PC, con frontend staging nuevo.
   Probar signup/confirmación/recuperación de correo; siguen pendientes SMTP y
   recepción. No desactivar confirmación para evitar esa prueba.
7. Ensayo con dos cuentas nuevas confirmadas y una tercera ajena. Automatización
   preparada (requiere las tres cuentas QA, sin servicios de administración):
   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Run-StagingQA.ps1 -Mode School
   ```
   El modo School exige matching habilitado antes de crear publicaciones; si está
   pausado se detiene, en lugar de aprobar un ensayo incompleto. `-Mode Run` conserva
   su comportamiento anterior de informar matching pendiente.
   Extiende el ensayo existente de Storage/chat/Realtime con vigilancia, QR público
   y revocación, devolución bilateral, rechazo de tercero y estadísticas. No elimina
   sus nuevos datos QA ni toca la mochila previa. No certifica ON/OFF/radio remoto
   fuera de la zona con este único ensayo: esos controles se prueban aislados y se
   deben observar con los casos siguientes antes de declarar activación completa:

   - A publica perdido, activa vigilancia 3 km; cerrar su pestaña.
   - B publica encontrado compatible dentro del radio. Esperar ciclo de worker;
     volver a entrar como A: aviso persistido. Repetir worker/editar: sin duplicados.
   - Casos de control: fuera del radio, OFF, preferencia OFF, colores incompatibles;
     no aparecen avisos del par. ON no reenvía avisos ya recibidos.
   - Chat B→A sobre el objeto de A. A solicita devolución desde el detalle, B abre
     aviso y confirma en «Alertas, QR y devolución segura». C no puede resolver.
   - Verificar estado recuperado en ambos, chat e historial intactos, reintento
     sin avisos extra. No utilizar la mochila existente para pruebas de eliminación.
   - QR A generado/descargado, abrir página en sesión anónima sin PII. Login permite
     contacto; C no puede administrar el QR. Revocar/reemplazar invalida enlace viejo.
   - Comparar estadísticas con conteos SQL bajo **el mismo rol/usuario**, no con
     superusuario Dashboard. Comprobar escritorio y un celular físico.
8. Sólo con autorización específica: integrar main mediante fast-forward y publicar
   el artefacto `build:presentation` con Firebase config de presentación, staging
   exclusivamente. Verificar manifest, CSP y callbacks desde teléfono. Ninguna de
   esas operaciones se realizó aquí.

## Recuperación y pausas sin perder datos

- Error instalando SQL: la transacción revierte completa. Revisar causa y backup,
  no borrar tablas ni reaplicar la línea base a ciegas.
- Error funcional: mantener frontend anterior como artefacto recuperable; pausar
  matching mediante el procedimiento existente `pause_trusted_matches.sql` tras
  autorización. Se conservan jobs, avisos y ledger. Un frontend previo no conoce
  preferencias nuevas; no combinarlo con matching activo sin validar compatibilidad.
- No eliminar tablas privadas para «revertir»: contienen historial y etiquetas.
  Una confirmación bilateral ya aceptada no se deshace restaurando el frontend.
- Reanudar scheduler sólo tras verificar heartbeat y cero errores. Para detener
  cron, desactivarlo desde Dashboard tras autorización; no es necesario borrar datos.
- En staging Dashboard revisar ejecuciones cron y fallos de cola; `enabled=true`
  por sí solo **no prueba** worker saludable ni entrega push/email.

## Evidencia y límites

`npm run test:backend` incorpora la propuesta en la matriz de esquemas date,
timestamptz y estructura observada; utiliza datos ficticios y PostgreSQL aislado.
Prueba instalación repetida, accesos ajenos, radio, preferencias, deduplicación,
QR, conversación previa, confirmación bilateral y conservación de historial.
Los E2E usan el SDK real con HTTP/Realtime interceptados: no prueban entrega remota.
Las pruebas que requieran staging, pg_cron, SMTP, push o teléfono físico deben
registrarse por separado. No hay acceso autorizado/configurado a staging en este
entorno; no se reutilizó la clave del proyecto original para intentar conectarse.

## Resultados locales de esta entrega

- `qa:local`: TypeScript y build aprobados; 121 casos de lógica/DOM y 48 E2E
  escritorio/móvil aprobados. Los E2E interceptan HTTP/Realtime; incluyen cambio
  de cuenta, devolución bilateral, controles ajenos, radio, preferencia y QR.
- Runner de staging: ocho pruebas de protección aprobadas; una usa el SDK real
  con HTTP interceptado para demostrar que matching deshabilitado detiene School
  antes de subir imágenes o crear publicaciones. No es una prueba de servicios reales.
- El PNG QR generado por el frontend se decodificó en el navegador y coincidió con
  su URL esperada. Falta escaneo físico con la URL pública de staging.
- SQL aislado: 12 grupos nuevos en cada una de tres variantes, tanto en PGlite como
  PostgreSQL 17 nativo. La línea base nativa pasó 61/61/64 comprobaciones según
  esquema, con prueba integrada de orden de activación. PostgreSQL nativo corrió
  sin red/puertos, con almacenamiento efímero; se retiró ese contenedor al terminar.
- PWA: una prueba de build/navegador aprobada. Presentación: dos escenarios de
  navegador aprobados, staging fijo y CSP; backend simulado. TLS: tres pruebas;
  seguridad cliente: dieciséis controles aprobados.
- `npm audit --omit=dev`: cero vulnerabilidades reportadas en dependencias de
  producción en esta consulta; no constituye una auditoría de todo el sistema.
- Se corrigieron regresiones encontradas de contraste del placeholder de imagen,
  cabecera/scroll móvil del detalle y Escape cuando un control asíncrono perdía foco.
- Capturas reproducibles en `test-results/school-tools-desktop.png` y
  `test-results/school-tools-mobile.png` (datos ficticios, no evidencia remota).
- No se ejecutaron contra Supabase real las RPC nuevas, SMTP, push ni pg_cron.
  Tampoco se ejecutó PowerShell aquí; usar el ensayo School en Windows después
  de aprobar la activación. La restauración integral de Supabase sigue pendiente.
