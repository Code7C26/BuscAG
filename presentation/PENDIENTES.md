# Pendientes explícitos — aula

1. Servicio HTTPS publicado y acceso anónimo comprobado externamente. Completar conexión privada del operador y ensayo de votación remota. No es BuscAG producción y no usa Supabase.
2. Autorizar la computadora desde Conectar encuestas, comparar código e iniciar sesión con la cuenta propietaria. El usuario no administra claves.
3. Conectar el servidor Windows mediante «Conectar encuestas». Hasta entonces los QR de votación se mantienen como pendientes, sin localhost.
4. Probar desde Android/iPhone físicos con Wi-Fi y datos móviles, reconexión y latencia en el aula. Las sesiones emuladas y respuestas de fixture no prueban celulares reales.
5. Verificar conectividad al dominio confirmado BuscAG (buscag-2677c.web.app) y al sitio de prueba para demo. El preflight externo de CI confirmó HTTP 200 en ambos dominios; repetir desde la PC del evento. No se certificó login ni backend real con HTTP 200.
6. Dar acceso al jurado al repositorio privado o autorizar una alternativa pública de auditoría. El QR GitHub contiene la URL correcta; no elude permisos.
7. Incorporar el video ORIGINAL inglés de ambos, 60 s, y una grabación auténtica de respaldo de la demo. No fueron aportados ni se sustituyeron por un tráiler sintético.
8. Enlazar tutorial auténtico, redes/canales y tablero FAT reales; los campos siguen vacíos o identificados como pendientes.
9. Ensayar los tres objetos con dos cuentas autorizadas, el audio, pantalla extendida, legibilidad desde el fondo, modo reducido y transferencia en la PC de Germán. El plan suma exactamente 25:00; el discurso humano requiere ensayo.

El modo de manos levantadas y el ensayo local están disponibles sin publicar el servicio. No se presenta esa alternativa como votación online ni como cumplimiento de conectividad móvil real.

Servicio de encuestas publicado en https://buscag-el-experimento-votos.reedyrook2.chatgpt.site. Falta autorizar la PC del operador y ensayo con dispositivos físicos.

Preflight remoto HTTPS aprobado en GitHub Actions: páginas/recursos/API 200, administración 401, voto cerrado 409. No sustituye la prueba de votación remota del operador.

## Conexión simplificada 2.1.0

La conexión manual de claves descrita en versiones anteriores queda reemplazada por **Conectar encuestas** → **Abrir autorización privada** → comparar código y autorizar con tu cuenta propietaria ChatGPT. No hace falta administrar ADMIN_KEY. Seguir CONECTAR-ENCUESTAS.md. La comprobación final con la sesión real del propietario y teléfonos físicos sigue pendiente del titular.
