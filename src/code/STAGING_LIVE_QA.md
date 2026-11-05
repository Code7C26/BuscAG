# Pruebas reales de staging en un comando

**Presentación escolar:** dos cuentas confirmadas bastan para el recorrido. No es
obligatorio contratar SMTP ni ejecutar Register. Ver SCHOOL_PRESENTATION.md.
`-AccountCount 3` en el wrapper agrega un observador de privacidad opcional.

Destino fijo: yiarlhpbgkofhhipkfha. No usa .env ni VITE_* para seleccionar backend,
ni acepta URL libre, service_role, migraciones o borrado. `scripts/staging-live.mjs`
usará APIs reales cuando el operador lo ejecute con acceso. **Esta entrega sólo probó
sus guardas/transportes localmente: los escenarios reales permanecen SIN EJECUTAR.**
El entorno cloud actual no permite el host de staging ni tiene cuentas dedicadas;
no se intentó suplir ese acceso usando producción.

## Windows PowerShell, desde src/code

Instalar dependencias una vez con npm.cmd ci. Después, diagnóstico público sin escrituras:

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Run-StagingQA.ps1 -Mode Probe
```

La política Bypass afecta sólo ese proceso; no cambia la configuración de Windows.
El wrapper solicita la clave PUBLICABLE de staging si no está vinculada en el entorno.
Tras configurar SMTP, el modo Register solicita dos correos/contraseñas FICTICIAS
exclusivas del ensayo. No usar contraseñas ni cuentas personales. Las mantiene sólo
en memoria del proceso y restaura las variables al terminar; no crea archivos secretos:

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Run-StagingQA.ps1 -Mode Register
```

Crea/solicita registro de esas dos cuentas y recuperación para la primera. **No valida
entrega, confirmación ni cambio de contraseña.** Confirmar los correos y probar el
cambio en la cuenta ficticia; luego usar su nueva contraseña en Run. No repetir
Register como mecanismo de reenvío ni usarlo sobre cuentas existentes personales.

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Run-StagingQA.ps1 -Mode Run
```

Si el gestor de secretos ya proporciona BUSCAG_STAGING_PUBLISHABLE_KEY,
BUSCAG_STAGING_TEST_ACCOUNTS_JSON (array de dos o tres objetos email/password) y
BUSCAG_STAGING_TEST_ACCOUNTS_CONFIRMED=dedicated-test-accounts, basta:

```
npm.cmd run qa:staging:live -- --run
```

No pegar JSON con contraseñas en comandos, chat, Git o CI logs. No almacenar sesiones
Playwright, traces ni tokens para facilitar estos tests. PowerShell no está instalado
en el entorno de desarrollo de esta entrega; el wrapper no se declaró probado allí.

## Cobertura implementada y límites

Run: login de dos o tres cuentas confirmadas; perfil propio/privacidad ajena y directorio;
Storage PNG ficticio y bytes de vuelta, escritura en carpeta ajena rechazada;
publicar/reintentar por RPC con mismo ID, edición propia y UPDATE ajeno rechazado;
mensaje/reintento mismo ID, evento postgres_changes recibido, tercero sin lectura si se configuró una tercera cuenta,
recibo, respuesta, notificación interna y is_read; resync REST tras desconexión;
recuperación del objeto ficticio conserva la conversación. Si el backend matching
está activo, espera hasta 90 s avisos de ambos dueños; no lo activa. Esa observación
no prueba exactamente un aviso por par ni deduplicación entre ejecuciones. El ensayo
SQL aislado cubre el ledger; certificar scheduler/cola y comportamiento remoto aparte.
No se declara probada reconexión WebSocket prolongada, push, Safari físico o UI real.
Los Playwright de qa:local siguen usando backend simulado y son una batería distinta.

Las publicaciones llevan UUID QA único. No se borra nada al terminar: quedan los
usuarios, imágenes, publicaciones, mensajes y avisos ficticios. Esto conserva también
cualquier evidencia de un fallo. Cada ejecución genera nuevos datos sintéticos y
consume cuotas (30 publicaciones/h y 120 mensajes/min si se mantienen las propuestas).
No reintentar a ciegas tras errores. La mochila previa no se toca. El runner sólo
modifica publicaciones/avisos creados por ese ensayo y cierra sus propias sesiones.
Una ejecución detenida puede dejar una fracción de esos objetos; revisar el último
paso antes de repetir. No hay limpieza automática ni service_role para saltar RLS.
