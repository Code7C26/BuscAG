# Correo de lanzamiento: bloqueo, solución y comprobación

Revisión de fuentes oficiales: 5 de noviembre de 2026. No se cambió SMTP remoto.
El operador confirmó Site URL https://buscag-2677c.web.app, Confirm email activo y
Custom SMTP desactivado. Con esa combinación todavía NO aprobar el registro público.

Supabase documenta que el SMTP predeterminado sólo entrega a miembros del equipo,
con límite actual de dos mensajes/hora y sin garantía de entrega. Es un bloqueo
independiente del diseño y de que registro/reenvío devuelvan 200. No demuestra por
sí solo por qué faltó un mensaje concreto de staging: una cuenta confirmada, cuotas,
spam, plantillas o filtros del proveedor también requieren evidencia.
Fuente: https://supabase.com/docs/guides/auth/auth-smtp

## Opción elegida: Resend Free, dominio de correo propio

Plan consultado: 0 USD/mes, 3000 correos/mes y 100/día. Son correos, no usuarios:
confirmaciones, recuperaciones y reenvíos consumen cuota. No activar cobros/overages
sin decisión del titular. Revalidar precio/límites antes de contratar.
https://resend.com/pricing

Requiere un dominio bajo tu control y acceso DNS para verificarlo. El dominio gratuito
buscag-2677c.web.app sirve para la web, pero no permite administrar el DNS necesario
para verificar un remitente de correo. La web puede permanecer allí; no hace falta
migrarla ni comprar un dominio adicional para Hosting. Si ya tenés un dominio, se
puede usar un subdominio exclusivo de Auth; si no, el registro del dominio es un costo
externo separado, según registrador y extensión.
https://resend.com/docs/dashboard/domains/introduction

Alternativa: Brevo ofrece 300 correos/día gratuitos. Requiere alta/aprobación y revisar
las condiciones del remitente; también conviene autenticar un dominio controlado.
No se asume que una dirección Gmail sea una alternativa de producción verificada.
https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans

## Configuración a realizar por el titular, primero staging

1. Crear/verificar dominio de envío; añadir los DNS exactos indicados por el proveedor
   (SPF/DKIM y DMARC revisado). No inventar registros, reemplazar MX de buzones existentes
   ni crear varios registros SPF independientes. No compartir claves por chat/Git.
2. Obtener credencial restringida a envío, guardarla sólo en Supabase Custom SMTP.
   Resend: host smtp.resend.com, puerto 465 TLS implícito o 587 STARTTLS, usuario resend,
   contraseña la clave del proveedor. Remitente en el dominio verificado y nombre BuscAG.
   Nunca VITE_*, navegador, archivo del repo ni argumentos de consola con secretos.
   https://resend.com/docs/send-with-smtp
3. Desactivar seguimiento de enlaces para no reescribir tokens. Mantener la plantilla
   predeterminada con ConfirmationURL; no construir un enlace al localhost ni pegar
   TokenHash en informes. Mantener Confirm email activado.
4. Revisar cuotas tanto del proveedor como de Supabase (el límite inicial con custom
   SMTP puede ser 30/h). Evitar ampliaciones sin monitoreo de rebotes/abuso.
5. En staging, solicitar registro con correo nuevo externo al equipo. Verificar
   recepción real y destino correcto, confirmar y entrar. Reenvío sólo para cuenta
   todavía no confirmada; esperar cooldown, no insistir tras HTTP 200.
6. Solicitar recuperación; abrir el correo en navegador nuevo, cambiar contraseña
   ficticia y verificar login con nueva clave y rechazo de la anterior. No registrar
   URLs callback, tokens ni cuerpos de correo. Un evento delivered del proveedor
   prueba aceptación por el servidor destinatario, no llegada a la bandeja de entrada.
7. Configurar producción sólo con autorización específica; repetir aceptación de
   correo con cuentas de prueba autorizadas y observar errores/rebotes/cuotas.

## Plantillas listas para revisar

`supabase/templates/confirmation.html` y `recovery.html` usan la nueva paleta,
un único botón accesible y el placeholder firmado `{{ .ConfirmationURL }}`. No
interpolan nombres, emails ni metadatos del usuario, ni incorporan seguimiento o
recursos externos. Aplicarlas sólo tras probarlas en staging; no se modificaron
plantillas remotas. La prueba local comprueba placeholders y ausencia de scripts/PII,
no entrega ni compatibilidad de todos los clientes de correo.

## Redirects preparados

El release fija VITE_APP_URL=https://buscag-2677c.web.app y el SDK utiliza:
- Confirmación/reenvío: https://buscag-2677c.web.app/
- Recuperación: https://buscag-2677c.web.app/?auth=recovery

El patrón informado https://buscag-2677c.web.app/** está limitado a ese origen. La
recomendación de Supabase para producción es configurar destinos exactos. Comprobar
los dos anteriores (incluida la query de recuperación) antes de retirar el wildcard.
No modificar esa allowlist automáticamente ni añadir localhost/staging en producción.
https://supabase.com/docs/guides/auth/redirect-urls

La API pública /auth/v1/settings no expone Site URL, allowlist ni credenciales SMTP;
no se afirma haber verificado esos campos por HTTP. Requieren consola o acceso de
operador seguro y una prueba recibida de extremo a extremo.
