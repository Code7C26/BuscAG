# Servicio HTTPS independiente — BuscAG Aula Votes

Worker ESM + D1 aislado. No usa Supabase, Firebase, cuentas ni datos de BuscAG. Servicio público publicado con autorización del operador:

https://buscag-el-experimento-votos.reedyrook2.chatgpt.site

## Estado verificado

GitHub Actions comprobó desde una red externa: ambas páginas /vote, JavaScript, CSS, health y polls responden 200 con MIME correcto; administración anónima rechazada 401; votos con encuesta cerrada rechazados 409. La base independiente contiene sólo polls y votes. Las encuestas se entregan cerradas y sin votos.

El flujo completo abrir/votar/cerrar/revelar y puente al proyector pasó con el mismo Worker y SQLite aislado, incluyendo navegadores Android/iPhone emulados. El flujo remoto completo con la clave del operador, teléfonos físicos y datos móviles sigue pendiente.

## Conectar en Windows sin distribuir secretos

1. Abrir el servicio en Sites con la cuenta propietaria → configuración → variables de entorno. Cambiar ADMIN_KEY por una clave aleatoria privada de al menos 32 caracteres y volver a desplegar la versión guardada del servicio. Mantener EVENT_ID=buscag-aula-20261114 y DB; no usar claves del MVP. La clave inicial está guardada como secreto y no se puede recuperar desde el ZIP.
2. Abrir /studio o /presenter local, ingresar el origen público anterior y esa clave en Servicio público HTTPS → Conectar y verificar. Guardado privado sólo en data/voting-private.json, excluido del ZIP/exportación/Git.
3. Cerrar ambas encuestas, salir de ensayo y seleccionar HTTPS. Abrir una encuesta, votar desde un teléfono, comprobar conteo, cerrar y revelar. Repetir con la segunda. Esta prueba crea votos reales: usar un EVENT_ID de ensayo y luego uno definitivo nuevo si se necesita arrancar en cero; los registros existentes se conservan.
4. Probar Wi-Fi y datos móviles. Sin esta verificación, usar el modo Manos levantadas y no afirmar que se probaron celulares físicos.

ID de servicio independiente: appgprj_6af7922be62081919ce697143c808f30. Versión guardada 1, commit de servicio 8a8716dc9310c927fbf5f75923ecca758a38d8a7. No corresponde al main del repositorio BuscAG.

## Alternativa Cloudflare Workers con cuenta propia

1. Crear una base D1 nueva exclusiva para estas encuestas. Completar su ID real en wrangler.jsonc; no usar un proyecto Supabase.
2. Elegir EVENT_ID nuevo para el evento. Los votos se separan por ese identificador y nunca se borran mediante la aplicación.
3. Aplicar migrations/0001_voting.sql únicamente a esa base independiente, con autorización. La migración crea dos tablas, sin datos de BuscAG.
4. Configurar ADMIN_KEY mediante el almacén de secretos del proveedor, mínimo 32 caracteres aleatorios. No guardarla en Git, .env del frontend, QR o chat.
5. Publicar el Worker HTTPS sólo después de autorización. El archivo worker/index.mjs exporta fetch(request,env); espera env.DB y env.ADMIN_KEY. El cliente móvil se sirve desde el mismo origen, sin CORS ni sesión de ChatGPT.
6. Comprobar /api/health: service=buscag-aula-votes, version=2, https=true. Comprobar /vote?poll=search y /vote?poll=object en una ventana sin sesión.
7. En el presentador o Studio local de Windows, introducir origen HTTPS y ADMIN_KEY en «Servicio público HTTPS» → «Conectar y verificar». El servidor privado valida el servicio y registra las preguntas. La clave se conserva sólo en data/voting-private.json.
8. El proyector consulta resultados por su servidor local; éste sincroniza HTTPS cada 1,5 s y emite SSE al público. Los teléfonos votan directamente al servicio HTTPS por Wi-Fi o datos móviles.

## Contrato y privacidad

GET /api/polls: opciones, contador y resultados sólo si se revelaron. POST /api/vote: cuerpo poll/choice. Cookie aleatoria Secure/HttpOnly/SameSite, digest SHA256 en base, unicidad por evento/encuesta/navegador. No se piden nombre, teléfono ni correo. Esto reduce repeticiones accidentales; borrar cookies o cambiar navegador permite repetir. No identifica personas ni promete prevención perfecta.

POST /api/admin/control y /api/admin/config requieren Authorization: Bearer ADMIN_KEY. No se admiten claves por query string. Los endpoints de administración nunca aparecen en el proyector. No se pueden redefinir preguntas/opciones con votos ya recibidos. No hay endpoint de borrado o reinicio de votos reales.

La apertura/cierre y la inserción usan consultas SQL acotadas; la inserción vuelve a comprobar que la encuesta siga abierta. Los resultados ocultos no incluyen conteos por opción. Votos, datos de ensayo y manos contadas son fuentes separadas.

## Corte de internet

El presentador activa «Manos levantadas». La pantalla deja de mostrar el QR y muestra el conteo manual, identificado. Se intenta cerrar las encuestas online; si el servicio no confirma el cierre, se avisa en privado porque usuarios con datos móviles podrían seguir enviando votos. Esos votos no se mezclan con las manos. Al reconectar, verificar cierre y elegir conscientemente la fuente.
