# Visitantes reales: registro abierto sólo en BuscAG-Staging

Objetivo vigente: profesores y compañeros entran desde su celular, se registran con
su propio email y utilizan servicios reales. Las cuentas preconfirmadas siguen siendo
útiles para contingencia, pero ya no bastan como criterio de aceptación del registro.
No se desactivó Confirm email, ni se configuraron servicios reales en esta entrega.
**No registrar visitantes en el sitio actual hasta comprobar que sirve el artefacto
de staging: podría seguir conectado a la base original.**

## Recomendación: Gmail dedicado como SMTP temporal

Para una exposición pequeña, usar una cuenta Gmail exclusiva del proyecto, con
verificación en dos pasos y contraseña de aplicación, como Custom SMTP de **staging**.
No requiere comprar dominio: el remitente será esa dirección Gmail, no una dirección
inventada de web.app. Es una opción técnicamente compatible, condicionada a que Google
permita crear la contraseña de aplicación y a superar la prueba de recepción real.
No se garantiza entrega ni capacidad comercial. No utilizar el buzón personal principal.

Fuentes oficiales consultadas el 5 de noviembre de 2026:
- Google documenta App Passwords con 2-Step Verification. Algunas cuentas educativas,
  de organización, con Advanced Protection o sólo llaves de seguridad no ofrecen esa
  opción: https://support.google.com/mail/answer/185833
- Gmail publica smtp.gmail.com:465 con TLS implícito, o 587 con STARTTLS, y límites
  compartidos por cuenta: https://developers.google.com/workspace/gmail/imap/imap-smtp
- Supabase documenta su integración con Google SMTP y contraseña de aplicación; su
  ejemplo de Workspace no prueba por sí solo la configuración de este Gmail dedicado:
  https://supabase.com/kb/troubleshooting/using-google-smtp-with-supabase-custom-smtp-ZZzU4Y

## Alternativas y límites

| Alternativa | Dominio comprado | Ventaja | Límite para esta presentación |
| --- | --- | --- | --- |
| Gmail dedicado + App Password | No | Mantiene email/password y confirmación para direcciones de otros proveedores. | 2FA/App Password disponible, filtros antispam y cuotas de Google/Supabase; debe probarse. |
| Brevo Free | Puede evitarse inicialmente si la cuenta es aprobada y permite remitente reescrito | Plan gratuito de 300 mensajes/día. | Brevo puede sustituir el remitente por brevosend.com; es una ayuda temporal, no una promesa de aceptación de cuenta ni entrega. Requiere validar sus condiciones reales. |
| SMTP2GO Free | Requiere dirección de dominio propio/empresarial según su alta, aunque admite verificar un remitente individual | 1000/mes, 200/día según documentación. | No asumir que admite alta/remitente Gmail. Sin dominio verificado puede limitar a 25/h. No es la primera opción sin dominio existente autorizado. |
| Resend Free | Sí, o dominio existente bajo control | SMTP transaccional y plan gratuito. | La verificación de dominio lo aleja del requisito sin compra/control DNS. |
| SMTP incorporado de Supabase | No | No exige configuración adicional. | Sólo destinatarios del equipo, límite publicado de dos mensajes/hora: no sirve para visitantes arbitrarios. |
| OAuth Google | No necesariamente para esta web | Login de usuarios Google sin enviar un correo propio. | No sustituye registro email/password para cualquier proveedor; requiere configurar consentimiento/proveedor y probarlo. No se implementó como reemplazo. |
| Desactivar Confirm email | No | Evita el envío durante signup. | No autorizado; se pierde prueba de propiedad del correo y no resuelve recuperación. No se aplicó. |

Fuentes de comparación:
https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans
https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication
https://support.smtp2go.com/hc/en-gb/articles/12747932085145-Quick-Start-Guide
https://developers.smtp2go.com/docs/rate-limiting
https://resend.com/docs/dashboard/domains/introduction
https://supabase.com/docs/guides/auth/auth-smtp

Google documenta hasta 500 mensajes/día para Gmail personal; no es una garantía de
ráfaga horaria ni entrega. Supabase impone su propio límite de correo, inicialmente
30/h al usar SMTP personalizado según su documentación. Presupuestar confirmaciones,
reenvíos y recuperación junto con los ensayos: 30 visitantes pueden consumir esa
cuota sólo registrándose. Revisar el límite de staging para la asistencia prevista,
sin ampliarlo ilimitadamente ni exceder al proveedor. Evitar reenvíos repetidos.
https://support.google.com/mail/answer/22839
https://supabase.com/docs/guides/auth/rate-limits

## Configuración manual mínima: sólo staging

1. En una cuenta Gmail dedicada y controlada por el titular, activar 2-Step Verification
   y generar una App Password para BuscAG-Staging. Si no está disponible, detener esta
   opción y evaluar Brevo o SMTP institucional autorizado; no usar «apps menos seguras»
   ni la contraseña principal. No enviarla al chat ni al repositorio.
2. En Supabase Dashboard, comprobar ref **yiarlhpbgkofhhipkfha**, Auth → SMTP:
   host smtp.gmail.com; puerto 465; usuario la dirección Gmail completa; contraseña
   la App Password; sender email la misma dirección; sender name BuscAG. Mantener TLS.
   No usar smtp-relay.gmail.com como sustituto: tiene requisitos distintos de Workspace.
3. En Auth de ese mismo proyecto, permitir nuevos usuarios y mantener Confirm email
   **activado**. Revisar cuotas/registro y no habilitar CAPTCHA sin integrar/probar su
   token en el frontend. No se modifica ninguna política de Auth desde el código.
4. Site URL: https://buscag-2677c.web.app. Redirect URLs exactas:
   - https://buscag-2677c.web.app/
   - https://buscag-2677c.web.app/?auth=recovery
   No añadir producción Supabase, localhost equivocado ni comodines entre dominios.
   Para el ensayo local elegido, agregar también http://127.0.0.1:3001/ y
   http://127.0.0.1:3001/?auth=recovery en staging. No confundir esa excepción de staging con un callback público.
5. Revisar plantillas locales confirmation/recovery, que usan el enlace firmado
   ConfirmationURL, y aplicarlas primero en staging si se desea la marca nueva.
   No inventar links SiteURL/auth/confirm ni habilitar tracking que reescriba el enlace.
   Gmail/antivirus pueden inspeccionar enlaces; expiración/uso previo debe investigarse
   con logs privados, no interpretarse como entrega ni acceso humano confirmado.
6. Archivo preparado para revisar: supabase/activation/staging_visitor_auth.plan.json.
   Es un plan declarativo sin credenciales, **no un payload ejecutable ni una migración**.
   Las nueve migraciones de staging ya confirmadas no se reejecutan.

## Ensayo elegido: en tu computadora, sin tocar el sitio publicado

El titular eligió ejecutar el ensayo localmente. Después de configurar Gmail SMTP
**en staging** y los callbacks locales/públicos anteriores:

**Terminal 1**, en src/code, usando Node 24 y las dependencias ya instaladas:

```powershell
$env:BUSCAG_STAGING_PUBLISHABLE_KEY = Read-Host 'Clave PUBLICABLE de BuscAG-Staging'
npm.cmd run dev:staging -- --visitors
```

El modo --visitors detiene el inicio si Auth no permite registros o no exige
confirmación de correo, incluso si faltan indicadores públicos. No cambia esos ajustes.
Mantener esa terminal abierta. Abrir http://127.0.0.1:3001 en dos navegadores o
contextos separados. Crear dos cuentas nuevas desde el formulario, con buzones
controlados de Gmail y Outlook/escolar; recibir/confirmar cada enlace **en la misma
computadora**. No usar el sitio Firebase actual para esas altas: todavía puede
estar conectado a producción. No confirmar administrativamente las cuentas de prueba.

Desde ese frontend local solicitar y completar una recuperación real. Verificar
nueva contraseña aceptada y anterior rechazada; no proyectarlas ni incluirlas en logs.

**Terminal 2**, también en src/code, para automatizar el uso posterior:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Run-StagingQA.ps1 -Mode Run
```

El wrapper pide clave pública y las dos cuentas ya confirmadas, con contraseñas
ocultas. Si una contraseña cambió por recuperación, proporcionar la nueva. No guarda
archivos de credenciales. El runner crea sólo datos QA nuevos de staging, conserva
la mochila previa y verifica APIs de publicación, imagen, permisos, chat, notificación,
Realtime, recuperación de objeto y logout. El modo no envía correos.

Para probar únicamente requisitos públicos de Auth antes de crear cuentas se puede
usar `-Mode Visitors`; para solicitar registros por API, `-Mode Register` es opcional.
Este último requiere BUSCAG_STAGING_TEST_APP_ORIGIN=http://127.0.0.1:3001 durante el
ensayo local. La prueba del formulario real sigue siendo necesaria.

Esto certifica servicios y callbacks locales de staging si los resultados son correctos;
la URL pública y los celulares se comprueban **después** de autorizar y publicar el
artefacto staging. No presentar el ensayo local como un despliegue público ya verificado.

## Pruebas reales, sin confundir HTTP 200 con recepción

Acceso aún no disponible en este entorno: sólo están vinculadas variables públicas
originales de producción; no se usan para staging. Falta permitir el host de staging
y vincular BUSCAG_STAGING_PUBLISHABLE_KEY. No hay credenciales SMTP/operador ni buzones
independientes vinculados. No se realizaron registros o envíos reales en esta ejecución.

Con acceso seguro o en la computadora del titular, desde src/code:

```
npm.cmd run qa:staging:live -- --visitor-preflight
```

Es sólo lectura. Comprueba flags de email, signup y confirmación estrictamente. Si
faltan indicadores, falla. Incluso si pasa, **no prueba SMTP, Site URL, allowlist ni
entrega**: la API pública no expone esa configuración privada.

Después preparar dos buzones nuevos de prueba controlados por personas que consientan
el ensayo (idealmente Gmail y Outlook o correo escolar). No usar emails aleatorios
ni confirmar administrativamente esas cuentas: eso invalidaría la prueba del correo.
Las credenciales sólo en variables privadas de CLI o el wrapper local, nunca VITE_*:

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Run-StagingQA.ps1 -Mode Visitors
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Run-StagingQA.ps1 -Mode Register
```

Register verifica antes el manifiesto público de staging si el callback es el Hosting,
y después exige el preflight de confirmación; envía únicamente solicitudes de registro con callback público como predeterminado.
La recuperación se solicita después de confirmar la cuenta, desde la web; no se
envía prematuramente a cuentas todavía sin confirmar. Una respuesta aceptada **no**
certifica creación nueva, correo recibido ni contraseña recuperada. No repetir el modo
para forzar reenvíos. Si se ensaya deliberadamente el frontend local, establecer
BUSCAG_STAGING_TEST_APP_ORIGIN=http://127.0.0.1:3001; cualquier otro origen se rechaza.

Aceptación por cada cuenta independiente:

1. Registrarse en la web pública conectada a staging; antes de confirmar no puede entrar.
2. Observar llegada real, remitente y spam; abrir el enlace en navegador nuevo/móvil.
   Debe terminar en el Hosting público, iniciar sesión y quitar tokens de la URL.
3. Cerrar sesión, volver a entrar y publicar con foto/ubicación confirmada.
4. A y B intercambian mensajes y recibos; verifican notificaciones y reconexión.
   Mapa/filtros/coincidencias deben usar esas publicaciones reales.
5. Solicitar recuperación desde la web, recibir el correo, abrir el enlace, guardar
   nueva contraseña; comprobar login nuevo y rechazo de la anterior. No grabar ni
   compartir tokens/URL de email, contraseñas o mensajes personales.
6. Actualizar la contraseña del ensayo en su binding privado si se cambió; ejecutar
   `npm.cmd run qa:staging:live -- --run` para automatizar Storage, RPC/idempotencia,
   permisos entre cuentas, chat, evento Realtime, avisos, recuperación de objeto y
   logout/cambio de cuenta. Una tercera cuenta opcional comprueba aislamiento ajeno.

No se requieren cuentas preconfirmadas para la prueba de alta: deben confirmarse por
su enlace real. El runner funcional posterior necesita que ya estén confirmadas.
Las pruebas del navegador incluidas en QA usan servicios simulados; son una batería
separada y no sustituyen el recibo observado en dos buzones.

La franja de entorno ahora identifica «Presentación escolar · Supabase-Staging»;
no afirma que todos los datos sean ficticios, porque los visitantes aportarán su
propio correo. No se cambiaron ni ampliaron permisos de perfiles o mensajes.

## Web pública y permisos necesarios

`build:presentation` conserva el único backend de esta versión, BuscAG-Staging, y
namespace de sesión propio. `firebase.presentation.json` mantiene SPA y CSP que
permite Auth/Storage/Realtime de staging y bloquea la API original de producción.
Los callbacks públicos comparten origen, incluidos query/fragment; los tests nuevos
cubren retorno de confirmación y recuperación en un contexto fresco, limpieza de URL,
y enlace expirado sin sesión. No se encontró necesidad de otra migración por esas rutas.

No se desplegó Firebase ni se cambió main. La prueba de retorno real al dominio
publicado necesita publicar el artefacto staging con **autorización específica**, y comprobarse después de esa publicación. Antes puede ensayarse la entrega y el
callback local de staging. Un preview con otro dominio necesitaría configurar
explícitamente su origen; el build actual está fijado al Hosting confirmado.
No apuntar la web actual a otro backend silenciosamente. Hasta esa operación, el sitio
existente puede seguir usando producción y no sirve como evidencia del cliente nuevo.

Con SMTP y pruebas de correo reales aprobadas, autorizar la actualización de Hosting
usando el artefacto escolar revisado. No migrar ni escribir la base original de producción.

## Verificación de esta preparación

- TypeScript, build de producción y `qa:local`: aprobados.
- 114 comprobaciones de lógica; 40 casos E2E escritorio/móvil aprobados, con
  backend interceptado y SDK real. Incluyen confirmación, recuperación, enlace
  vencido y rechazo de destinatario sin exponer el detalle privado del servidor.
- 6 pruebas de las protecciones para visitantes; 3 de TLS; 16 controles de
  seguridad del cliente aprobados. PostgreSQL aislado: 58/58/61 comprobaciones
  según variante de esquema y prueba de orden de activación aprobadas.
- La revisión de patrones sensibles en los archivos cambiados no detectó claves
  privadas, tokens privados ni URI PostgreSQL con contraseña.
- Un caso de perfil móvil falló en una ejecución intermedia; no se reprodujo en
  cinco repeticiones ni en la batería final completa. Sigue pendiente observar
  navegación en un dispositivo físico.
- PowerShell no está disponible en este entorno: el wrapper Windows no se ejecutó
  aquí. SMTP, recepción real, nuevas cuentas y servicios de staging quedan para
  el ensayo del titular; no se realizaron escrituras remotas ni despliegues.
