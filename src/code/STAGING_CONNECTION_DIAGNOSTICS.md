# Diagnóstico de conexión de BuscAG Prueba

Rama `Alexis`. No se modificaron Supabase, Firebase, datos ni secretos. No se
desactivó TLS ni se intentó conectar con credenciales reales en esta revisión.

## Causas comprobadas del ocultamiento

El `UNKNOWN` anterior no permite identificar el fallo concreto ocurrido en Windows.
Sí se reprodujeron las vías del código que lo producían:

1. `stagingDiagnostic` dependía principalmente de `error.code`. `pg` emite errores
   comunes **sin código**, incluidos firma SCRAM incorrecta, timeout, cierre y rechazo
   del SSLRequest. Sus mensajes conocidos ahora se traducen a códigos/mensajes fijos,
   sin imprimir el mensaje original.
2. Una URI que acepta `new URL()` puede fallar después al decodificar sus credenciales
   en `new Client()`. Por ejemplo, `%FF` no es UTF-8 válido. La construcción del
   cliente ocurría **después de imprimir la CA**, pero antes de `connect()`, por lo
   que ver la CA no probaba ni un intento TCP. Otros porcentajes inválidos pueden
   provocar reparaciones ambiguas del parser. Se validan los escapes antes del cliente,
   sin cambiar la contraseña ni intentar adivinar su codificación.
3. `finally { await db.end() }` podía reemplazar el error original por un fallo de
   cierre. El rollback tenía el mismo riesgo. Ambos conservan ahora el fallo primario
   y muestran por separado errores secundarios sanitizados.
4. Sólo se inspeccionaba un nivel de `cause/errors`; se perdían causas anidadas de
   Node/AggregateError. Se recorren con límites y protección de ciclos.
5. No se registraba la etapa. Además, en pg 8.16.3 el evento `sslconnect` indica que
   se creó el TLSSocket: **no** confirma el handshake. TLS sólo se confirma cuando
   `secureConnect` termina con `authorized=true`.

Ninguno de estos hallazgos permite afirmar retrospectivamente que la contraseña de
Windows era incorrecta. El nuevo resultado separará esas causas.

## Un comando en Windows

Desde `src/code`, con la URI privada y CA ya configuradas:

```powershell
npm.cmd run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-plan
```

El script versionado se llama **prepare:staging**. No se agregó un alias `prepare`:
ese nombre tiene semántica de lifecycle de npm y podría ejecutar la herramienta al
instalar dependencias. Si el comando anterior `run prepare` imprimía la CA, había
un alias/copia local diferente; usar el comando versionado evita esa ambigüedad.

La salida debe empezar con `BuscAG prepare:staging · diagnóstico 2`, indicar Node/pg
y mostrar fases TCP, TLS, autenticación, consultas y cierre. `iniciando` no significa
éxito; `OK` confirma la fase. La CA impresa sólo acredita el archivo cargado.
En un error aparecen **etapa**, **último paso confirmado**, número de consulta si
corresponde, código seguro y acción. Un cierre correcto libera recursos; no convierte
en exitosa una operación que falló antes.

Ejemplo ilustrativo, no resultado del equipo del usuario:

```text
[TCP] OK
[TLS] OK
[autenticación] iniciando
...
Preparación detenida [etapa: autenticación; último paso confirmado: TLS] [autenticación] BUSCAG_SCRAM_SIGNATURE. ...
```

## Interpretar y actuar

| Código | Qué confirma / acción |
| --- | --- |
| BUSCAG_URI_ENCODING | Error local antes del cliente. Codificar la contraseña **original una sola vez** con encodeURIComponent; `%` literal es `%25`. No recodificar una URI ya codificada ni imprimirla. |
| BUSCAG_SCRAM_SIGNATURE | Falló la verificación de la firma SCRAM. Revisar contraseña vigente, usuario/ref del pooler y codificación; no ignorar la firma ni debilitar TLS. |
| 28P01 / otros 28xxx | PostgreSQL rechazó autenticación. Revisar credenciales de Prueba localmente; el puerto abierto y CA cargada no las validan. |
| BUSCAG_PASSWORD_TYPE / EMPTY | El driver no recibió texto no vacío. Revisar configuración local y dependencias; no modificar permisos del servidor. |
| BUSCAG_POOLER_IDENTITY | El pooler no reconoce tenant/usuario. Contrastar URI de sesión, región y postgres.REF con Dashboard. |
| BUSCAG_POOLER_LIMIT / 53300 | Capacidad del pooler/servidor agotada. Revisar disponibilidad/conexiones; reconstruir la contraseña no soluciona ese caso. |
| BUSCAG_PG_SSL_REFUSED / RESPONSE | El endpoint rechazó SSLRequest o no respondió como PostgreSQL. Revisar pooler de sesión y puerto 5432; no desactivar SSL. |
| SELF_SIGNED_CERT_IN_CHAIN / otros de confianza | Revisar CA oficial y cadena; nunca adoptar automáticamente el certificado del peer fallido. |
| ERR_TLS_CERT_ALTNAME_INVALID | Hostname/certificado no coinciden. Revisar host oficial; mantener SNI y validación de nombre. |
| BUSCAG_CONNECT_TIMEOUT / errores de red | Usar la etapa para distinguir apertura TCP de TLS/autenticación pendientes; revisar DNS, firewall/VPN y estado del proyecto. |
| BUSCAG_QUERY_TIMEOUT / 57014 / 55P03 | La sesión abrió; falló o se canceló una consulta. Revisar disponibilidad/bloqueos, sin repetir escrituras a ciegas. |
| 42501 / otros SQLSTATE | Error de permisos/esquema, acompañado de fase y número de consulta; no es prueba de contraseña incorrecta. |
| BUSCAG_CLOSE_FAILURE / CLOSE_TIMEOUT | Falló el cierre. El primer fallo se conserva si lo hubo; sólo reintentar diagnóstico de lectura. El cierre se limita a 5 s. |

Si un error nuevo no coincide con patrones conocidos, recibe un código específico
de fase (`BUSCAG_TCP_FAILURE`, `TLS_FAILURE`, `AUTH_FAILURE`, `QUERY_FAILURE`, etc.).
Se informa lo comprobado y una acción segura; no se inventa una causa más precisa
para sustituir el mensaje privado. No existe un modo para volcar stack/URI/SQL.

Puede compartirse la salida nueva de fases/códigos/versiones. No compartir variables
de entorno, contraseñas, URI, tokens, archivos privados ni mensajes crudos del driver.

## Cambios y seguridad

- `scripts/staging-tls.mjs`: clasificación recursiva, patrones pg, contexto de fase,
  códigos de fallback, formato seguro y errores públicos autenticados por el factory.
  Un error ajeno no puede hacer imprimir su `publicMessage` fingiendo un código.
- `scripts/staging-session.mjs`: ciclo de un cliente, TLS realmente verificado,
  consultas numeradas, errores asíncronos capturados y limpieza acotada sin ocultar
  el fallo original. No registra argumentos/resultados de consultas.
- `scripts/prepare-staging.mjs`: validación de escapes de credenciales, banner de
  versión, uso del ciclo anterior y preservación de errores del rollback.
- `tests/staging-tls.test.mjs`: regresiones con datos sintéticos y conexiones locales.

Se conservan rejectUnauthorized=true, checkServerIdentity, SNI, TLS mínimo 1.2,
validación de destino y modo upgrade READ ONLY. No se añadió un apply, auto-retry,
fallback sin TLS ni modificación de credenciales. Se conservan los objetos Error
originales para compatibilidad de los consumidores, pero la CLI sólo usa el formato
sanitizado. El resultado de planificación sigue sin autorizar instalaciones.

## Validación

Pruebas aprobadas en esta revisión:

- `npm run test:staging-tls`: **9** grupos. Incluyen URI válida para WHATWG pero no
  para decode UTF-8 de pg, comando real sin abrir TCP ante esa URI, SCRAM sin code,
  causas recursivas/cíclicas, sanitización, cierre/rollback/idle errors y timeout.
  También prueban pg real con SSLRequest y TLS en loopback: 28P01 tras TLS,
  42P01 en consulta, rechazo SSL y timeout antes de handshake; nunca TLS OK prematuro.
- `npm run test:staging-tools`: **13** aprobadas; conserva instalación/reanudación,
  selección de etapas, integridad, privacidad y las guardas existentes, sólo en fixtures.
- `npm run test:staging-live-tools`: **8** aprobadas; consumidores compartidos del diagnóstico.
- `npm test`: **133** aprobadas; `npm run lint`: TypeScript correcto.
- `npm run build`: compilación correcta con configuración sintética; sin despliegue.
- `node tests/client-security.mjs`: **18** controles aprobados.
- `git diff --check`: correcto. No cambiaron SQL de migración, frontend ni dependencias.

No se repitieron navegador ni instalación SQL nativa: no hay cambios de UI/esquema.
La compatibilidad del driver se verifica mediante el protocolo pg real sobre TLS
local y los tests existentes de preparación con bases WASM descartables.

No se ejecutaron pruebas contra el pooler real ni Windows: las regresiones reproducen
el protocolo con Node/pg y TLS verificado en loopback. No se declara resuelta la conexión
del equipo hasta volver a ejecutar el comando y obtener sus fases/código concretos.
