# Servicio HTTPS independiente — BuscAG Aula Votes

Worker ESM + D1. No usa Supabase, Firebase, cuentas ni datos de BuscAG. Incluye página móvil de votación, dos encuestas, resultados, apertura/cierre y revelado protegidos. No está publicado por esta entrega sin autorización explícita.

## Estado

Código y SQL probados con SQLite sintético y requests HTTPS de fixture. Navegadores con viewports Android/iPhone usan la implementación real interceptada hacia ese servicio de prueba. Eso no certifica conectividad pública, Safari físico ni datos móviles reales.

Se reservó un borrador privado de Sites, sin desplegar:
- ID: appgprj_6af7922be62081919ce697143c808f30
- Origen esperado del proveedor: https://buscag-el-experimento-votos.reedyrook2.chatgpt.site

Este origen **no prueba publicación ni accesibilidad**. No se coloca en los QR mientras no exista un servicio compatible y comprobado. El borrador puede utilizarse para alojar el servicio con un binding D1 independiente después de revisar la configuración y autorizar publicación pública. La página móvil debe ser accesible anónimamente; un Site privado obliga a iniciar sesión y no sirve para el aula.

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
