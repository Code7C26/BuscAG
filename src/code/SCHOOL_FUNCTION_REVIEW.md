# Revisión independiente de las 13 funciones de Staging

Conclusión: bloqueo de revisión de funciones CERRADO. Compatibles con la propuesta
escolar de Alexis 123669fa91de73e6ee0c01024549b512fbd984e7. Sin SQL remoto.

## Evidencia y método

Fuente: buscag_13_funciones_staging_revisadas.json, adjunto del operador, no una
consulta nueva de Supabase. SHA-256 del archivo: `e599e233d72fefd3350f92244ffd8d94fe5868da1849456dbd0c944cb21a4e5e`.
Comparación contra las definiciones finales de los nueve archivos del instalador
(STAGING_SETUP.md), sin incluir la extensión escolar como si ya estuviera instalada.
Se verificaron las 13 huellas declaradas contra los cuerpos exportados: consistentes.

Se separaron los cuerpos delimitados por dollar-quoting. Se compararon secuencias
de tokens, descartando espacios y comentarios solamente fuera de literales y de
identificadores entre comillas. Se preservaron exactamente los literales (incluidas
mayúsculas, espacios y barras) y los identificadores entre comillas. Se cotejaron
además cabeceras, parámetros/defaults, resultados, lenguajes y atributos. Se revisó
la lógica de las diferencias intencionales de la extensión. Esto es revisión estática,
no prueba formal de equivalencia ni ensayo de Staging.

## Resultado por función

| Función | Cuerpo frente a línea base | Compatibilidad |
| --- | --- | --- |
| buscag_private.enqueue_match() | Iguales los tokens | Conserva bandera, encolado y reinicio del cursor/reintentos |
| buscag_private.match_score(public.items,public.items) | Iguales los tokens | Línea base DATE/timestamptz en UTC; extensión añade colores |
| buscag_private.match_words(text) | Iguales los tokens | Mismo text[], normalización NFD, límite 10.000 y stopwords |
| public.buscag_capabilities() | Iguales los tokens | Misma bandera; INVOKER/STABLE |
| public.can_send_item_message(uuid,uuid) | Iguales los tokens | Mismos controles de dueño/conversación y usuario autenticado |
| public.canonicalize_message_display() | Iguales los tokens | Misma identidad/presentación canónica del servidor |
| public.ensure_recovered_notice_text() | Iguales los tokens | Mismo fallback de notificación sin reescribir objetos |
| public.match_backend_enabled() | Iguales los tokens | Misma bandera privada y fallback false |
| public.notify_item_recovered() | Iguales los tokens, incluidos literales | Mismo cambio de estado y owner no nulo |
| public.process_match_jobs(integer) | Iguales los tokens | Misma cola, concurrencia, ledger y reintentos; extensión filtra destinatarios |
| public.publish_item_once(uuid,jsonb) | Iguales los tokens | Mismos controles, idempotencia, cuota y UTC |
| public.send_message_once(uuid,uuid,uuid,text) | Iguales los tokens | Mismos controles, idempotencia y cuota |
| public.validate_item_content_write() | Iguales los tokens | Mismos controles de contenido nuevo/modificado |

Todas las funciones adjuntas son de postgres y tienen search_path vacío.
DEFINER/INVOKER, lenguaje, volatilidad y TimeZone coinciden con el contrato esperado.
Los nombres de tipo sin esquema que muestra pg_get_functiondef (items/messages)
son compatibles con las firmas/catálogo aportados; la propuesta usa public.items.
El JSON no contiene las ACL de funciones ni las políticas RLS: no se deducen permisos
por el mero SECURITY DEFINER. Usar los diagnósticos de catálogo anteriores y la
auditoría posterior para esos controles.

## Corrección del informe adjunto

No se reproduce su única discrepancia. La línea de notify_item_recovered contiene
cero barras invertidas tanto en el JSON como en el archivo del commit 123669f:

```sql
'Tu publicación "' || new.title || '" fue marcada como recuperada.'
```

El escape de comillas que aparece al serializar JSON/representaciones del texto no
es una barra literal del SQL. No se cambia el mensaje ni se reaplica el baseline.
12 MD5 de cuerpos difieren por formato; la coincidencia literal restante es
buscag_capabilities(). La comparación de tokens conservando literales da 13/13.

## Compatibilidad con los dos reemplazos escolares

- match_score conserva parámetros compuestos, retorno integer, STABLE/INVOKER,
  search_path vacío y TimeZone UTC. Conserva validación de datos, dos palabras,
  ponderación y cálculo temporal mediante casts DATE/timestamptz. Agrega rechazo
  de colores explícitos incompatibles y normalización de género/plural del color.
- process_match_jobs conserva parámetro p_limit/default 5, resultado JSONB,
  DEFINER y search_path vacío. Conserva advisory lock, heartbeat, pausa, lotes
  acotados, SKIP LOCKED, cursor, ledger único, transacción por lote y backoff.
  Antes de insertar en ledger/notificaciones, aplica match_recipient_allowed:
  preferencia por destinatario y radio/ON/OFF del objeto perdido. Cambia también
  el título de aviso para expresar índice /100 en vez de porcentaje de certeza.
  La propuesta revoca EXECUTE a clientes y lo concede solo a service_role.
- No reemplaza match_words ni otra función de identidad/idempotencia. No se
  identificó una implementación remota personalizada que el reemplazo elimine.
- La extensión no enciende matching ni configura scheduler, correo o push. No
  reenvía pares ya presentes en ledger, ni realiza backfill automático.

## Instalación

Seguir SCHOOL_INSTALLATION_FINAL.md. Ejecutar, tras respaldo y autorización,
solamente supabase/proposals/20261105000000_school_features.sql en
BuscAG-Staging yiarlhpbgkofhhipkfha. Después ejecutar school_readiness.sql y realizar
QA autorizado. Esta revisión no ejecutó SQL ni modificó servicios remotos.
