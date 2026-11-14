# Servicio independiente · conexión 2.1.0

El servicio público conserva votaciones y resultados en D1 independiente. Se añadió una segunda página privada de autorización, desplegada mediante Sites owner-only y verificada con una sola cuenta propietaria, sin grupos, visitantes ni editores. No compartirla: el permiso de propietario lo aplica el límite de acceso de Sites. El Worker además exige identidad ChatGPT autenticada; la identidad por sí sola no concede rol propietario dentro del servicio público.

El propietario abre un enlace generado por Studio, compara seis dígitos y aprueba mediante formulario firmado HMAC, ligado a la identidad, solicitud y vencimiento. La PC guarda una clave RSA-OAEP-SHA256 efímera sólo en memoria; el servicio cifra una credencial específica de 90 días con su clave pública. La consulta autenticada por un secreto aleatorio de 256 bits entrega el cifrado una sola vez mediante UPDATE RETURNING atómico. Ni el formulario ni el código temporal contienen ADMIN_KEY. Se guardan hashes de tokens en D1; los votos se conservan.

La credencial de dispositivo permite administrar las dos encuestas, pero no aprobar otras computadoras. Cancelación, vencimiento (5 minutos), deduplicación de aprobación y revocación están probados. Desconectar cierra las dos votaciones y revoca el token remoto; sin conexión no se declara revocado.

ADMIN_KEY permanece sólo como secreto runtime de ambos servicios. Fue renovada para esta configuración, sin publicarla. El usuario no debe editarla. No se incluyen hosting IDs, secretos ni runtime data de la página privada en el ZIP; se incluye su código auditable sin credenciales. La migración 0002 sólo agrega pairings/devices a la D1 aislada y no modifica votos existentes.

## Operación

Leer ../CONECTAR-ENCUESTAS.md. No configurar manualmente variables ni pegar claves en el navegador. Para PC perdida, revocar su hash en el servicio o renovar credenciales mediante el administrador; el panel local sólo revoca su propia PC.

## Verificación y límites

Pruebas automatizadas con Worker real/SQLite y navegador cubren protocolo y botones; el control de acceso de Sites se verifica externamente sin sesión y con encabezados falsificados. La aprobación real con la cuenta propietaria y teléfonos físicos debe validarla el titular. Un fixture de identidad no prueba un inicio de sesión ChatGPT real.
