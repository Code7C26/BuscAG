# Diagnóstico 3: consultas y planificación local

Rama `Alexis`. No se modificaron Supabase, Firebase, credenciales ni configuración
de seguridad. No se conectó al proyecto remoto en esta revisión. Sólo se ejecutaron
fixtures y pruebas en bases descartables locales.

## Hallazgos

La salida de Windows acredita TCP/TLS/autenticación correctos. No acredita que la
primera consulta haya fallado: el manejador de rollback reemplazaba el contexto
de una excepción local por `queries / lastCompleted=authentication`, sin contador.
Luego el manejador externo conservaba ese contexto incompleto. Por eso se perdía
el número incluso si ya habían terminado las consultas de catálogo y evidencia.

Se corrigió esa pérdida: el error se captura con el estado real **antes del cleanup**.
Los contextos externos sólo completan campos ausentes; no reemplazan el paso ni
los contadores originales. El rollback y el cierre no pueden convertirse en la
causa principal ni mover el punto del fallo.

Además se reprodujo una causa concreta compatible con Windows: `core.autocrlf`
puede convertir a CRLF las referencias oficiales guardadas como LF en Git. La
verificación anterior exigía los bytes LF sin contemplar esa conversión y lanzaba
`Error('Official source integrity failure')`, sin código. Después, el rollback
ocultaba su contexto y terminaba en BUSCAG_QUERY_FAILURE.

**No se afirma que CRLF sea la causa confirmada de ese PC:** la salida v2 no permite
probarlo. Sí se reparó ese fallo reproducible y ahora cualquier causa restante queda
identificada por paso, origen, clase y contador seguro.

## Compatibilidad de referencias sin cambiar seguridad

El verificador admite bytes originales o conversión CRLF→LF únicamente si el
resultado coincide exactamente con **ambos** hashes fijados: SHA-256 y blob Git.
La conversión es en memoria; no escribe archivos ni cambia Git, manifiestos,
propietarios, ACL o reglas de aceptación remotas.

No se recortan espacios, no se eliminan BOM ni comentarios, no se reformatea SQL.
Cualquier otro cambio sigue bloqueado. Se prueban archivos CRLF con contenido
modificado, BOM o retornos CR aislados, y todos se rechazan. El parser utiliza los
bytes canónicos ya verificados. `official_validation.reference_crlf_files` informa
cuántas referencias locales necesitaron esa conversión.

## Salida nueva

El comando soportado, desde `src/code` y con la URI/CA privadas ya configuradas:

```powershell
npm.cmd run prepare:staging -- --project-ref yiarlhpbgkofhhipkfha --upgrade-plan
```

Debe mostrar **diagnóstico 3**, Node, pg y plataforma/arquitectura. No requiere otro
flag, cambiar contraseñas ni desactivar TLS.

Ejemplo orientativo de progreso:

```text
[SQL #4 · catalog.collect] OK
[SQL #5 · evidence.collect] OK
[local · official.sources] iniciando (última SQL completada #5)
```

La numeración cuenta llamadas al driver remoto, incluidas las que contienen varios
SET. La construcción de referencias con PostgreSQL WASM local no incrementa ese
contador. SQL OK significa que el driver devolvió el resultado; su validación y
procesamiento aparecen por separado.

Un fallo SQL conserva `consulta #N`, el paso y SQLSTATE. Un fallo local muestra
`origen: local`, paso y `última SQL completada #N`; no inventa una consulta fallida.
Si no se completó ninguna, se muestra #0. El cleanup posterior puede ejecutar SQL
adicional, pero el error conserva el contador del instante original.

## Puntos identificables

| Paso | Qué delimita |
| --- | --- |
| session.settings / session.identity | SET de sesión e identidad; se valida la forma de la respuesta |
| transaction.begin / transaction.rollback | Inicio READ ONLY y cleanup |
| catalog.collect | Lectura de upgrade_catalog.sql y validación de JSON |
| evidence.collect | Lectura de upgrade_evidence.sql y validación de JSON |
| official.sources | Archivos/manifiesto, hashes y parser de referencias oficiales |
| official.validate | Comparación de metadatos con evidencia oficial |
| reference.import / reference.bootstrap | Importación e inicialización local de PGlite/WASM |
| reference.baseline.1 … 9 | Cada SQL de referencia local, en el orden de files del instalador |
| reference.school / secure / community | Etapas locales de referencia |
| reference.snapshot / reference.close | Captura y liberación de las referencias locales |
| catalog.compare / sources.hash | Comparación y cálculo de hashes locales |
| artifacts.save / plan.output / plan.acceptance | Archivos del plan, serialización y decisión de compatibilidad |

Los identificadores son una lista fija. No se imprime el SQL, sus argumentos,
resultados privados, cuerpos, stack, rutas privadas ni mensajes crudos del driver.

## Códigos y acciones

- **BUSCAG_OFFICIAL_INTEGRITY:** hay una diferencia real de contenido/hash, no sólo
  CRLF. Revisar la copia de Alexis y referencias fijadas. No editar hashes para pasar.
- **BUSCAG_OFFICIAL_PROVENANCE / HEADER / INCOMPLETE / OWNERSHIP:** problema de
  manifiesto o parser local; revisar la copia del repositorio, no objetos remotos.
- **BUSCAG_CATALOG_RESULT / EVIDENCE_RESULT / IDENTITY_RESULT:** el driver devolvió
  una forma no esperada. Revisar pg/npm ci y parsers JSON/JSONB locales. No se expone
  el contenido recibido ni se sustituye por un catálogo vacío para forzar compatibilidad.
- **BUSCAG_JS_TYPE / SYNTAX / REFERENCE / RANGE:** excepción JavaScript en el paso
  indicado; no es por sí sola un rechazo SQL. Si el origen es query, ocurrió dentro
  de la llamada al driver; si es local, ocurrió después/fuera de la consulta.
- **BUSCAG_WASM_RUNTIME:** error local de compilación, enlace o ejecución WASM.
  Revisar Node compatible, arquitectura y npm ci; no se corrige con migraciones remotas.
- **BUSCAG_LOCAL_FILE:** archivo/permisos/espacio locales, por ejemplo en artifacts.save.
  No se confunde EACCES local con un bloqueo de red o permisos de PostgreSQL.
- **42501 / 42883 / otros SQLSTATE:** la consulta señalada falló en PostgreSQL.
  El paso identifica si es catálogo, evidencia o incluso SQL de la referencia local.
  No se cambian permisos/configuración automáticamente.
- **BUSCAG_LOCAL_PROCESSING_FAILURE:** error local no tipificado, pero con punto y
  última consulta. **BUSCAG_DRIVER_QUERY_FAILURE:** error sin SQLSTATE dentro de la
  llamada numerada al driver. No se imprime el texto privado para ganar precisión.

Siguen vigentes las guardas de TLS, destino, transacción READ ONLY y rechazo de
metadatos desconocidos. Generar un plan/bundle revisable no autoriza ejecutarlo.

## Pruebas y resultado

- `npm run qa:local`: las 16 etapas pasaron, incluyendo 133 pruebas de aplicación,
  TypeScript (`lint`), compilación, 84 pruebas E2E, navegador PWA/presentación,
  matriz de seguridad backend y 18 controles de seguridad del cliente.
- Diagnóstico TLS/sesión: 12 pruebas pasaron, incluidas SQLSTATE, excepciones
  JavaScript/WASM, permisos de archivos, resultados malformados, privacidad y
  conservación del fallo original durante rollback/cierre. Se incorpora esta
  suite al QA habitual. La última ampliación también se ejecutó por separado.
- Herramientas de preparación: 14 pruebas pasaron; herramientas live: 8.
- Planificador en PostgreSQL nativo 17.10 y 18.6: 10 pruebas pasaron en cada
  versión. Se verificaron recolección real y compatibilidad de metadatos locales.
- La regresión de checkout CRLF convierte los 11 archivos oficiales en una copia
  descartable, reconoce `school` y genera un bundle revisable sin ejecutarlo.
  Es una simulación de los finales de línea de Windows, no una ejecución en ese PC.

No se ejecutó el comando contra Supabase remoto. Por eso la causa concreta del
equipo del usuario y la generación de su plan todavía requieren el próximo intento.

El próximo paso mínimo es actualizar Alexis y ejecutar el comando anterior. Si
el bloqueo era CRLF, esa causa ya está corregida y la planificación puede continuar.
Si hay otro fallo, compartir sólo el banner y la salida nueva de pasos/código;
no hace falta aportar URI, variables, contraseñas ni cuerpos de funciones.
