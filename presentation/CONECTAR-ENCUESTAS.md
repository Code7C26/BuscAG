# Conectar encuestas en Windows · sin copiar claves

1. Cerrá la ventana del servidor anterior. Extraé el ZIP 2.1.2 en una carpeta nueva y ejecutá INICIAR-WINDOWS.cmd. Node 24 LTS (24.13 o superior dentro de 24.x).
2. Abrí http://127.0.0.1:4173/presenter o /studio. Ingresá la contraseña local que creaste al iniciar esta copia.
3. Buscá **Encuestas en vivo** y pulsá **Conectar encuestas**. Después pulsá **Abrir autorización privada**. No hace falta buscar Sites ni administrar ADMIN_KEY.
4. En la página HTTPS privada, iniciá sesión con la misma cuenta de ChatGPT propietaria del servicio. Si tenés varias cuentas, usá la que creó BuscAG en esta conversación. Otras cuentas no tienen acceso.
5. Compará los seis números de Studio con los de esa página. Si vos iniciaste la conexión y coinciden, pulsá **Los códigos coinciden · Autorizar esta computadora**. No autorices enlaces enviados por otra persona.
6. Volvé a Studio/presentador. En unos segundos aparecerá **Conectado y sincronizando**. Podés cerrar la pestaña de autorización. El enlace vence en cinco minutos y sólo se utiliza una vez.
7. En el presentador pulsá **Usar votos reales en celulares**, o elegí **HTTPS**. Verificá que ya no diga ENSAYO. Avanzá a la escena de la encuesta. Pulsá **Abrir** en la encuesta correcta; el público escanea su QR desde Wi-Fi o datos móviles. Esperá votos, pulsá **Cerrar** y después **Revelar**. Las opciones se cuentan en vivo; no hay que recargar.
8. Repetí con la segunda encuesta. Si falla Internet, elegí **Manos levantadas** y cargá los conteos manuales; no se mezclan con los votos online.

## Antes de exponer

Probá un Android y un iPhone físicos: escanear QR, votar, ver el contador en el proyector, cerrar y revelar. En uno apagá Wi-Fi y probá datos móviles. Los ensayos crean votos reales y no existe borrado desde la presentación. Para comenzar un evento nuevo en cero, el administrador debe preparar otro identificador de evento en el servicio aislado.

## Si no conecta

- **Acceso denegado en la página privada:** revisá la cuenta ChatGPT. No cambies permisos ni compartas esa página con el público.
- **Código vencido, pestaña cerrada o servidor reiniciado:** volvé a pulsar Conectar encuestas y usá el enlace nuevo.
- **No hay Internet:** la presentación sigue local; usá Manos levantadas.
- **Cambio de carpeta o computadora:** conectá la copia nueva otra vez. No copies ni compartas data/.
- **Para quitar acceso a esta PC:** con Internet, pulsá Desconectar esta computadora. Se cierran ambas encuestas y se revoca su credencial. Para revocar una PC perdida, solicitá al administrador la revocación en el servicio; borrar sólo el archivo local no revoca el acceso remoto.

## Qué se guarda

Cada PC recibe una credencial propia de 90 días. Viaja cifrada; el servidor Node local la descifra y la guarda sólo en data/voting-private.json. No se incluye en el navegador, QR, exportaciones, Git ni ZIP. No compartas data/ ni esta carpeta de trabajo ya utilizada. No tenés que ver, escribir ni enviar esa credencial. La cuenta de Windows también debe estar protegida; alguien con acceso a tus archivos puede leerlos.

## Páginas

Votación pública: https://buscag-el-experimento-votos.reedyrook2.chatgpt.site

Autorización privada: https://buscag-autorizar-pc.reedyrook2.chatgpt.site — sólo propietaria; conservar privada y sin colaboradores. Su aislamiento lo aplica Sites, no un rol de propietario inventado dentro de la página pública.

La versión 2.1.2 corrige un rechazo real del runtime de Sites antes de mostrar el código. Ver CORRECCION-AUTORIZACION-2.1.2.md. Usar un enlace de conexión nuevo.
