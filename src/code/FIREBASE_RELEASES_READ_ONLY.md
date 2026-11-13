# Listar releases del 6/11/2026: Firebase Hosting, sólo lectura

Script: scripts/list-hosting-releases.mjs. Rama Alexis. Destino fijo:
proyecto buscag-2677c, sitio buscag-prueba. Sin parámetros para cambiar de proyecto.
No consulta Supabase, crea canales, clona, hace rollback ni despliega.

## Autenticación oficial

firebase login autentica Firebase CLI, pero no configura Application Default
Credentials (ADC). Este script no reutiliza su sesión: no hay aquí una interfaz
pública documentada para exportarla a la biblioteca y no se leen sus archivos internos.
No usar firebase login:ci ni copiar refresh/access tokens para este procedimiento.
El 401 al abrir una URL REST directamente en el navegador es compatible con una
petición sin OAuth: estar logueado en Console no añade automáticamente Authorization
a una navegación directa a la API. No cambiar permisos para hacer pública la API.

Se utiliza la biblioteca oficial google-auth-library, fijada como devDependency en
11.3.3, mediante GoogleAuth.getClient() y ADC. La biblioteca pide el scope oficial
cloud-platform.read-only, admitido por releases.list; los scopes efectivos de una
credencial OAuth de usuario también dependen del consentimiento con que se generó.
No se promete que una credencial de usuario previamente amplia se reduzca sólo por
indicar un scope en código. La restricción del programa es GET + destinos fijos;
IAM controla los permisos efectivos de la cuenta.

Método recomendado: Google Cloud CLI con login de usuario ADC. No necesita Docker.
Si no está instalado, usar el instalador oficial de Google Cloud CLI compatible con
tu sistema, o ejecutar en un entorno Linux/Cloud Shell que ya tenga Node y gcloud.
No se instaló ni se inició un login en tu nombre desde esta entrega.

Desde la cuenta que puede consultar el sitio:

```powershell
gcloud auth application-default login
```

Usar el navegador que abre el comando y elegir la cuenta correcta. Es distinto de
firebase login y también de gcloud auth login. No pegar códigos, contraseñas o tokens
en el chat. El CLI oficial guarda sus credenciales ADC en el perfil privado del
usuario como parte del login; **el script no guarda ni imprime tokens**. No copiar
esos archivos al repo. Una identidad gestionada o federada ADC ya configurada es otra
opción oficial sin crear claves JSON de servicio para esta tarea.

La cuenta necesita permisos de lectura de Firebase Hosting sobre buscag-2677c; el rol
Firebase Hosting Viewer (roles/firebasehosting.viewer) es una referencia apropiada
para una identidad dedicada. No se necesita conceder administrador ni permisos de
escritura. No se cambió IAM ni se habilitó una API automáticamente.

Referencias oficiales:
- https://cloud.google.com/docs/authentication/provide-credentials-adc#local-dev
- https://cloud.google.com/sdk/gcloud/reference/auth/application-default/login
- https://cloud.google.com/nodejs/docs/reference/google-auth-library/latest
- https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.releases/list
- https://firebase.google.com/docs/reference/hosting/rest/v1beta1/projects.sites/get

## Ejecución en Windows

Actualizar Alexis e instalar las dependencias fijadas en src/code, incluidas las de
desarrollo (no usar --omit=dev para esta herramienta):

```powershell
npm.cmd ci
npm.cmd run audit:hosting:releases --silent
```

--silent elimina el encabezado de npm: en caso de éxito stdout contiene solamente un
array JSON. También se puede evitar npm para la ejecución:

```powershell
node scripts/list-hosting-releases.mjs
```

El script consulta primero el sitio por su proyecto y después pagina GET sobre
sites/buscag-prueba/releases. Solicita partial responses para no recibir emails del
autor, mensajes de release, labels, configuración ni otros campos innecesarios.
La biblioteca realiza el intercambio/refresh OAuth oficial cuando es necesario;
eso no es una modificación de recursos Firebase. No hay llamadas mutantes a Hosting.
No se ejecutan firebase hosting:versions:list ni hosting:releases:list: esos comandos
no son necesarios y no existen en tu CLI.

## Fecha y salida exacta

Se filtra **6/11/2026, America/Buenos_Aires**, intervalo UTC:
2026-11-06T03:00:00Z inclusive → 2026-11-07T03:00:00Z exclusive.
Se recorren TODAS las páginas antes de filtrar/mostrar; no se asume que las releases
estén ordenadas. El resultado se ordena cronológicamente.

Cada elemento sólo tiene cuatro campos:

```json
{
  "release_id": "ID_REAL_DE_RELEASE",
  "version.name": "sites/buscag-prueba/versions/ID_REAL_DE_VERSION",
  "fecha_hora": "2026-11-06T17:27:00Z",
  "estado": "FINALIZED"
}
```

Ejemplo de formato, NO resultado real. fecha_hora conserva exactamente el timestamp
RFC3339 devuelto por la API, incluida su precisión y zona. 17:27Z equivale a 14:27
argentina. estado corresponde a version.status; una SITE_DISABLE sin versión se
muestra con version.name=null y estado=SITE_DISABLE. No inferir del estado FINALIZED
que la versión siga activa en live o que sea funcional/compatible con producción.

[] significa que la consulta completa no devolvió releases dentro de ese día, no
que d14560 no exista en otra fecha ni que no hubiera una versión anterior activa.
El script no supone que d14560 sea un commit ni lo elige por antigüedad.

## Errores seguros

Si algo falla, exit code 1 y un mensaje fijo/sanitizado en stderr, sin volcar objetos
Gaxios, headers, respuestas completas, tokens, emails ni configuración de credenciales.
No se guarda el listado, credenciales ni logs en archivos; si el operador decide
redirigir stdout, sólo obtendrá los cuatro campos proyectados de las releases.
No activar depuración HTTP externa para capturar credenciales.

- BUSCAG_HOSTING_ADC: no se pudo obtener un cliente ADC; completar el login oficial.
- BUSCAG_HOSTING_401: credenciales ADC vencidas/revocadas o no aceptadas; renovar login.
- BUSCAG_HOSTING_403: revisar cuenta ADC, permiso Hosting de lectura, API y proyecto
  de cuota. No conceder administrador ni ejecutar deploy para solucionar una lectura.
  Un problema de red/proxy también puede requerir permitir el acceso al dominio.
- BUSCAG_HOSTING_404: sitio/proyecto no accesible para esa identidad; comprobarlos.
- BUSCAG_HOSTING_READ_FAILED: revisar red/TLS/ADC privadamente. No pegar errores crudos.
- Errores RESPONSE/PAGINATION: no se presenta una lista parcial como completa.

Para abandonar ADC local al terminar, si se creó exclusivamente para esta tarea:
`gcloud auth application-default revoke`. Es una operación de credenciales locales,
no un cambio de Hosting; no revocarla si otras herramientas dependen de ella sin
revisar su uso. El script nunca la revoca automáticamente.

## Evidencia de esta entrega

Se agregaron pruebas sin red para límites de fecha argentina, paginación completa,
GET/destino fijo, partial responses, descarte de emails/mensajes/tokens, metadatos
inválidos, SITE_DISABLE y redacción de errores 401/403/404/otros. No se hizo consulta
real autenticada al historial: este entorno sigue sin ADC de Firebase disponible.
Por tanto no se inventa un ID de release ni se atribuye d14560 a un commit.
