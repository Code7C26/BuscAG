# Corrección real de autorización · Windows 2.1.1

## Causa comprobada en Sites publicado

Windows generaba solicitudes válidas (POST /api/pair/start 200), consultaba su estado (POST /api/pair/poll 200) y la sesión ChatGPT llegaba autenticada al Worker privado. Sin embargo, la página privada fallaba antes de enviar GET /api/pair/admin/inspect, en 0–3 ms.

El runtime publicado devolvió exactamente: `Invalid redirect value, must be one of "follow" or "manual" ("error" won't be implemented since it does not make sense at the edge; use "manual" and check the response status code).`

El Worker privado usaba redirect: error, una opción válida en Node que este runtime de Sites no admite. El catch ocultaba ese TypeError y devolvía incorrectamente 410/enlace vencido. AbortSignal.timeout sí está disponible en el runtime real; se comprobó explícitamente, no fue la causa.

## Solución

El Worker usa redirect: manual y rechaza explícitamente cualquier respuesta 3xx antes de leer datos. No sigue redirecciones ni envía la credencial a otra dirección. Mantiene origen fijo, acceso privado sólo para propietario, comprobación de sesión, formulario firmado, cinco minutos, cifrado RSA y entrega de un uso. Los errores de red, autenticación, HTTP, timeout, formato y vencimiento ahora se distinguen; los registros sólo contienen códigos sanitizados, sin credenciales.

Se usa AbortController con temporizador cancelable para que el timeout tampoco dependa de APIs opcionales. El servicio público incluye un diagnóstico de sólo lectura que consulta su propio /api/health por HTTPS usando el mismo modo manual. No acepta destinos arbitrarios ni devuelve claves.

## Pruebas

Regresión que reproduce exactamente el rechazo de redirect: error en Sites, rechazo de 302 hacia otro dominio, falta de AbortSignal.timeout, errores de credencial y red, y recorrido de conexión/voto/revocación. La comprobación externa consulta los servicios publicados y exige HTTP 200 en la llamada real Worker → servicio HTTPS; también comprueba rechazo anónimo/identidad falsificada de la página privada.

El acceso con la sesión real del propietario y la aprobación concreta de su PC deben terminarse desde su navegador. Las pruebas con identidad fixture no se declaran como autenticación real.

## Qué hacer en tu PC

Cerrar el servidor anterior, extraer este ZIP en otra carpeta, ejecutar INICIAR-WINDOWS.cmd, entrar en /presenter y pulsar Conectar encuestas. Abrir el enlace NUEVO, comparar los seis números y autorizar. Los enlaces anteriores pueden estar vencidos o cancelados. La corrección principal ya se aplica en el servicio remoto y también permite reintentar desde 2.1.0 mientras se descarga 2.1.1.

No se modificaron la aplicación principal BuscAG, Firebase, Supabase ni main/Alexis/German.

## Mejora incluida en Windows 2.1.2

La apertura en ensayo estaba separada de la apertura online, pero el presentador no lo explicaba junto al control. Ahora se muestra ENSAYO: los celulares no pueden votar y la acción Usar votos reales en celulares. Seleccionar HTTPS cambia explícitamente a real; repetir esa selección conserva abiertas las encuestas online. La apertura muestra ABIERTA EN CELULARES o Abierta sólo en ensayo según la fuente. No se mezclan votos ficticios con votos reales.
