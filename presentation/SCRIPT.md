# SCRIPT — BuscAG: El experimento

Plan nominal de 30:00. Avance manual. Los tiempos incluyen votaciones, acciones, silencios y video; el ensayo oral debe ajustar el ritmo. Ningún texto certifica una operación no observada.

## scene-01 · 00:00–01:15 · Valentino

**¿Cuánto tardarías en recuperar algo que perdiste?**

Antes de mostrar una pantalla, les proponemos una pregunta. Piensen en un objeto que hayan perdido y que de verdad les importara. Puede ser una llave, unos auriculares o algo con valor personal. No hace falta decirlo en voz alta. Recuerden qué hicieron primero, a quién preguntaron y cuántas veces tuvieron que contar lo mismo. [Pausa de ocho segundos.] En esta pantalla hay dos puntos. Uno representa a quien busca; el otro, a quien encontró. Los dos quieren resolver el mismo problema, pero todavía no tienen un lugar común donde encontrarse. Ese espacio entre las personas es nuestro punto de partida. No vamos a representar una pérdida ni a prometer una recuperación. Vamos a hacer un experimento con ustedes: reconocer el problema, elegir un caso y recorrer el sistema que construimos.

**Acciones y pausas:** 0–8 s: negro y sonido opcional. 8–55 s: pregunta y dos puntos. 55–75 s: unión cyan y logo. Activar sonido requiere clic previo.

## scene-02 · 01:15–02:30 · Germán

**BuscAG. Encontrarnos hace la diferencia.**

Somos Valentino Mamonde y Germán Luján. BuscAG es una plataforma comunitaria para conectar publicaciones de objetos perdidos y encontrados. Valentino tuvo más dedicación al código y yo a marketing y documentación. Esa distribución no significa que uno conozca solamente la aplicación y el otro solamente la venta. Los dos investigamos, tomamos decisiones técnicas y vamos a explicar arquitectura, pruebas y negocio. También vamos a usar dos sesiones independientes durante la demostración. Nuestro objetivo es que se pueda distinguir una idea atractiva de un producto que se puede revisar. Por eso van a ver qué existe en el código, qué pudimos comprobar y qué sigue pendiente. El código y la documentación quedan disponibles al final. Ahora queremos empezar por la experiencia de ustedes: cuando algo desaparece, ¿en qué lugar buscarían primero?

**Acciones y pausas:** Mostrar nombres con entrada escalonada. No atribuir títulos profesionales ni responsabilidades exclusivas.

## scene-03 · 02:30–04:00 · Valentino

**¿Dónde buscarías primero?**

Pueden escanear el QR y elegir una opción: redes sociales, grupos de WhatsApp o volver al lugar. Hay una respuesta por sesión del navegador. No es una encuesta representativa ni mide a toda la comunidad: recoge solamente lo que responda este público hoy. [Dar treinta segundos para votar.] Mientras llegan las respuestas, observen algo: las tres opciones pueden servir, pero cada una conserva una parte distinta de la información. [Cerrar la encuesta y revelar.] Estos son los votos recibidos por el sistema. Si hay empate, lo diremos; no vamos a fabricar una opción ganadora. Si no hay conexión, hacemos una consulta a mano alzada y la identificamos como tal. La pregunta que sigue es cómo reunir esos caminos para que una publicación pueda ser encontrada por la otra persona.

**Acciones y pausas:** Abrir encuesta 1 desde presentador. 30 s para teléfonos; cerrar, revelar. Sin avance automático. Si hay cero votos, decirlo.

## scene-04 · 04:00–05:20 · Germán

**La información está. La conexión falta.**

El problema que identificamos no es que nadie quiera ayudar. Muchas veces alguien publica un hallazgo, pero lo hace en un grupo al que la persona que perdió el objeto no pertenece. Otra persona vuelve al lugar y pregunta, mientras la foto queda en otra red. Cada canal puede ser útil; el problema es la fragmentación. No tenemos una estadística que nos permita afirmar cuántos objetos se pierden en la ciudad ni qué porcentaje se recupera. Nuestro diagnóstico parte de esa necesidad concreta y de la descripción del proyecto: ordenar publicaciones y facilitar el contacto. BuscAG nace de preguntarnos qué pasaría si la información de pérdida y hallazgo estuviera en una misma plataforma. La animación reúne avisos para explicar esa idea. Es una representación del problema, no un registro de usuarios reales.

**Acciones y pausas:** Tarjetas dispersas convergen. Aclarar representación conceptual. Pausa para observar la reorganización.

## scene-05 · 05:20–06:40 · Valentino

**Una comunidad concreta primero.**

El público inicial definido en el proyecto son estudiantes, docentes y vecinos que comparten espacios. Elegir una comunidad delimitada es una decisión técnica y de negocio: una plataforma vacía no resuelve el problema aunque tenga muchas pantallas. Necesitamos publicaciones útiles en una zona y personas que puedan encontrarlas. Nuestra hipótesis es que publicar con categoría, ubicación y descripción facilita la búsqueda frente a revisar conversaciones dispersas. Esa hipótesis todavía requiere un piloto. Tenemos documentación de investigación y de viabilidad, pero no presentamos resultados de mercado que no estén medidos. En ese piloto registraríamos publicaciones, contactos recibidos, recuperaciones confirmadas, tiempo de resolución y personas que vuelven a usar el servicio. Primero necesitamos comprobar utilidad; después tiene sentido ampliar alcance. La solución que desarrollamos intenta convertir esa necesidad en un flujo simple y revisable.

**Acciones y pausas:** Distinguir hipótesis, decisión de alcance y evidencia. No convertir la encuesta de sala en investigación de mercado.

## scene-06 · 06:40–08:00 · Germán

**De “lo perdí” a una posibilidad de encuentro.**

Esta es la interfaz de BuscAG. Las capturas provienen de la aplicación del repositorio, con un backend sintético utilizado para documentación visual. Por eso están rotuladas: muestran el diseño, no prueban una recuperación real. En el código encontramos publicación de objetos, búsqueda, filtros, mapa, comparación de coincidencias y conversaciones. También existen interfaces de notificaciones y recuperación, con condiciones que dependen del backend disponible. No vamos a anunciar push externo ni funciones pagas como activas sin verificarlas. La idea central es reunir información y permitir un contacto contextual. El sistema sugiere coincidencias: una sugerencia no demuestra propiedad y tampoco confirma una entrega. Enseguida salimos de estas capturas y usamos dos sesiones reales del MVP. Ustedes van a elegir qué objeto organiza esa demostración.

**Acciones y pausas:** Mockups con capturas del repo. Rótulo permanente: interfaz real / datos sintéticos. Abrir la URL de prueba sólo para la demo.

## scene-07 · 08:00–09:00 · Valentino

**¿Qué buscamos juntos?**

Ahora elijan el objeto de la demostración: auriculares, llaves o billetera. Los tres tienen una ficha preparada para ensayar con datos de prueba. [Veinte segundos para votar.] Cerramos y revelamos. Si hay un empate, elegimos entre las opciones empatadas y lo decimos. Si no entraron votos, hacemos la elección en sala. No vamos a convertir datos de ensayo en participación real. El resultado define el caso; el funcionamiento lo vamos a comprobar en la aplicación.

**Acciones y pausas:** Encuesta 2. Cerrar antes de demo; no avanzar automáticamente. Registrar ganador o empate.

## scene-08 · 09:00–10:30 · Valentino

**Una publicación. Una cuenta responsable.**

Estamos en una sesión independiente de la cuenta de Germán. Voy a publicar el objeto elegido con el prefijo PRESENTACIÓN QA. Usamos una fotografía propia, una referencia pública de ubicación y una descripción de prueba. No necesitamos poner un domicilio ni información sensible para explicar el flujo. [Completar y guardar.] La interfaz puede mostrar un envío pendiente; eso todavía no significa que el servidor lo haya confirmado. Ahora comprobamos la publicación y recargamos para verificar que siga ahí. Si aparece un error lo vamos a leer y registrar, sin reemplazarlo por una animación de éxito. Esta es la primera evidencia: una publicación persistida con su autor correcto.

**Acciones y pausas:** 0–20 s: sesión A. 20–65 s: completar. 65–90 s: guardar y recargar. Datos de prueba según DEMO.md. Nunca crear cuentas ni editar datos ajenos para forzar el resultado.

## scene-09 · 10:30–12:00 · Germán

**Buscar con contexto.**

Yo estoy en otro perfil de navegador, con otra sesión. Primero buscamos por el título y comprobamos los filtros de categoría y estado. La ubicación nos aporta contexto; si no damos permiso de GPS, el sistema no debería inventar nuestra posición. Ahora publicamos el hallazgo de prueba con la misma categoría, fechas compatibles y una descripción coherente. [Ejecutar la búsqueda y publicación.] La comparación necesita datos suficientes, pero no debemos escribir secretos del objeto para hacerla coincidir. Que dos publicaciones se parezcan es una pista. La persona que entrega sigue necesitando comprobar la pertenencia de forma prudente.

**Acciones y pausas:** 0–35 s: búsqueda/mapa. 35–75 s: hallazgo B. 75–90 s: persistencia. Si una función no está disponible, registrar BLOQUEADO.

## scene-10 · 12:00–13:30 · Valentino

**Una coincidencia debe poder explicarse.**

Abrimos las coincidencias disponibles. El sistema compara categoría, términos, distancia y fecha; después muestra razones para que podamos entender la sugerencia. No es una probabilidad científica de propiedad. [Abrir comparación.] Si esta pareja aparece, revisamos que sean nuestras dos publicaciones y que cada propietario esté correctamente identificado. Ahora contacto desde el objeto y Germán responde desde su cuenta. Comprobamos que el mensaje aparezca en la conversación correcta. Recién si vemos el resultado confirmado podemos activar la transición CONEXIÓN ENCONTRADA. Esa transición celebra lo observado, no lo reemplaza. Si el servicio no responde, dejamos visible el error y pasamos al análisis técnico.

**Acciones y pausas:** 45 s Valentino: comparación; 45 s Germán: responder y recargar. Germán dice: «Confirmo desde mi sesión que recibí este mensaje y que la respuesta quedó en esta conversación». Transición sólo manual tras confirmación.

## scene-11 · 13:30–15:00 · Germán

**Contactar no es recuperar.**

Llegamos al último paso. Un chat no demuestra una devolución. Si el backend habilita la recuperación bilateral, la cuenta autorizada solicita confirmación y la otra persona acepta o rechaza. Vamos a comprobar el resultado desde ambas sesiones. [Ejecutar sólo si el ensayo lo habilitó.] Si falta ese servicio, lo declaramos pendiente y la demo termina en el contacto real. No usamos un cambio de estado directo para evitar una restricción del servidor. Tampoco afirmamos una recuperación real de un objeto perdido en la comunidad: esta es una prueba controlada entre nosotros. Lo que importa es mostrar qué estado confirmó el sistema, qué permisos aplicó y qué podemos repetir.

**Acciones y pausas:** 45 s Germán: solicitud y explicación; 45 s Valentino: confirmación y recarga. No marcar recuperación si no está probada. Respaldo sólo grabación real etiquetada; los clips sintéticos del trailer no son respaldo de MVP.

## scene-12 · 15:00–16:15 · Valentino

**La interfaz es sólo la primera capa.**

Ahora abrimos las capas del sistema. React organiza componentes y estado; TypeScript permite comprobar contratos antes de ejecutar. Vite construye el cliente. La lógica de coincidencias compara publicaciones y explica por qué propone una pareja. Supabase reúne base PostgreSQL, autenticación, almacenamiento y mecanismos de actualización. RLS aplica permisos en el servidor: ocultar un botón no alcanza para impedir una operación. El repositorio configura Firebase Hosting; Vercel y Render aparecen en el informe como escenarios presupuestados, no como prueba del hosting activo. La versión que sirve una URL debe verificarse contra su artefacto. Esta separación nos ayuda a ubicar una falla: una pantalla disponible no prueba que una RPC esté instalada ni que una operación esté autorizada.

**Acciones y pausas:** Capas se separan en profundidad con CSS transform. Cada capa permanece legible. No afirmar despliegue actual por la sola configuración.

## scene-13 · 16:15–17:30 · Germán

**Una sugerencia no es una certeza.**

Este fragmento está tomado del motor real de coincidencias y su referencia queda en la documentación. La comparación no depende de pedirle a una IA que decida de quién es un objeto. Hay reglas: categorías compatibles, estados válidos, texto y proximidad geográfica y temporal. Las pruebas cubren casos que deberían coincidir y casos que deben rechazarse. También hay reglas para datos inválidos y publicaciones del mismo propietario. Una puntuación sirve para ordenar sugerencias; no equivale a certeza de identidad o de propiedad. Nosotros tenemos que elegir esas reglas, revisar sus límites y construir casos de prueba. Podemos usar IA para explorar alternativas o revisar código, pero no atribuimos al equipo un proceso específico de uso de IA que no esté documentado. La responsabilidad de verificar la decisión sigue siendo nuestra.

**Acciones y pausas:** Mostrar fragmento extraído del HEAD auditado. Abrir archivo por enlace de auditoría sólo si el jurado lo solicita.

## scene-14 · 17:30–18:45 · Valentino

**Una respuesta perdida puede duplicar una acción.**

Un desafío real documentado fue qué hacer cuando el servidor puede haber guardado una acción, pero la respuesta se pierde. Si repetimos una publicación con una clave nueva, podemos duplicarla. Si damos el envío por hecho, podemos mentirle al usuario. El historial registra trabajo sobre publicación y mensajería idempotentes: conservar la identidad del intento y reconciliar la respuesta confirmada. La subida de fotos tampoco debe sobrescribir un archivo ante una respuesta incierta. Hay pruebas con fallas simuladas y límites documentados para backends antiguos. No basta con mostrar un mensaje verde; hay que comprobar un único resultado persistido. Esta investigación enlaza frontend, contrato de servidor y pruebas. La evidencia está en ALEXIS_DEVELOPMENT y en las suites, con el alcance de cada verificación.

**Acciones y pausas:** Secuencia visual: timeout → reintento con misma clave → respuesta confirmada. Esquema conceptual, no incidente de producción medido.

## scene-15 · 18:45–20:00 · Germán

**Que pase localmente es el comienzo.**

Las pruebas se leen junto a su entorno. Una prueba unitaria comprueba reglas con datos controlados. Una prueba de navegador puede comprobar interfaz con respuestas simuladas. Una prueba real necesita cuentas y servicios disponibles. El repositorio separa esos niveles y documenta pendientes de Safari físico, sesiones autenticadas y versión servida. En esta entrega guardamos los resultados de los comandos que efectivamente ejecutamos, sin reciclar cifras de otro informe como si fueran nuevas. Para el jurado dejamos el código, las instrucciones y la evidencia accesibles. Antes del evento necesitamos repetir el flujo con los dos perfiles y probar el proyector. Una falla de privacidad, una conversación cruzada o una recuperación sin consentimiento bloquea la demo. Mostrar esos límites también es parte de la ingeniería.

**Acciones y pausas:** Mostrar VALIDATION.md actualizado. No leer un listado extenso. No equiparar móvil emulado con teléfono real.

## scene-16 · 20:00–21:20 · Germán

**La utilidad tiene que llegar antes que el cobro.**

La propuesta de valor es facilitar que quien perdió y quien encontró compartan un mismo canal. Eso requiere participación. Por eso el modelo propuesto mantiene gratuitas la búsqueda y la publicación básica. El informe plantea dos vías posibles de ingresos: publicaciones destacadas opcionales y patrocinios de comercios u organizaciones. Son propuestas comerciales, no funciones cobrando hoy ni acuerdos firmados. Antes de elegir un precio, hay que comprobar que la plataforma resulta útil y que existe disposición a pagar por visibilidad sin bloquear su función esencial. También tenemos que considerar privacidad, soporte y moderación. La venta que hacemos hoy es una invitación a probar una solución concreta y a validar su continuidad. No presentamos ingresos, clientes ni rentabilidad que no estén medidos.

**Acciones y pausas:** Tarjetas: gratis / destacado propuesto / patrocinio propuesto. Sin precios inventados.

## scene-17 · 21:20–22:40 · Valentino

**Poner números también es diseñar.**

El informe valoriza ciento ochenta horas de desarrollo web en un millón setecientos treinta mil setecientos pesos argentinos. Son horas estimadas a una tarifa de referencia, no un registro de pagos realizados. El fijo directo presupuestado es de treinta y nueve mil doscientos cincuenta pesos por mes y cuatrocientos setenta y nueve mil quinientos por año. El anual incluye el dominio; por eso no es simplemente el mensual multiplicado por doce. El escenario usa Supabase Pro y hosting inicial sin cargo según los supuestos del documento. Los servicios variables, mantenimiento e impuestos deben revisarse aparte. Si crecemos, actualizamos consumo y condiciones. Estas cifras permiten conversar sobre sostenibilidad, pero sin ingresos validados todavía no permiten afirmar un resultado financiero positivo.

**Acciones y pausas:** Gráfico breve con magnitudes separadas: inversión única / fijo mensual / fijo anual. Fuente PDF, páginas 1 y 7.

## scene-18 · 22:40–24:00 · Germán

**Técnicamente favorable. Comercialmente por demostrar.**

La conclusión del informe distingue dos preguntas. ¿Podemos construir y operar la solución? La evaluación técnica es favorable, sujeta a pruebas y seguridad. ¿Conviene ampliar la inversión y cómo se sostiene? La viabilidad comercial es prometedora, pero no está demostrada. El próximo paso razonable es un piloto en una zona definida con indicadores acordados. La aplicación móvil es una visión futura: Capacitor permitiría reutilizar parte de la web, con sesenta a noventa horas adicionales estimadas y entre quinientos setenta y seis mil novecientos y ochocientos sesenta y cinco mil trescientos cincuenta pesos. No está publicada en tiendas. Las cuentas, revisiones y pruebas agregan condiciones que quedan en el informe. Si el acceso móvil resulta una barrera comprobada, esa inversión tendrá una razón basada en evidencia.

**Acciones y pausas:** Rotular VISIÓN FUTURA en móvil. No sumar valores mensuales con inversión. Tiendas: USD 25 Google único / USD 99 Apple anual sólo en notas y PDF.

## scene-19 · 24:00–25:00 · Valentino

**Construir, revisar, dejar evidencia.**

En FAT conectamos desarrollo y gestión. Una tarea necesita una necesidad, un responsable y un criterio de aceptación; terminar una pantalla no alcanza si el flujo no puede comprobarse. Git conserva las decisiones y permite comparar versiones. En esta entrega revisamos main, Alexis y German, respaldamos las puntas y documentamos si la integración pasó sus condiciones. El tablero de tareas real queda pendiente de enlazar si no está disponible: no fabricamos sprints ni métricas. README, manual y bitácora acompañan al producto para que otra persona pueda ejecutarlo y auditarlo. No vamos a leerlos acá; quedan accesibles por enlace. Esa documentación permite continuar el proyecto después de este pitch.

**Acciones y pausas:** 24:00–25:00 exacto. Mostrar flujo de trabajo propuesto, no tablero ficticio. Dar paso al video al minuto 25.

## scene-20 · 25:00–26:00 · Ambos

**Video publicitario BuscAG**

[No hay un guion alternativo. Reproducir únicamente el video publicitario ORIGINAL de Valentino y Germán hablando inglés. Si falta el archivo, comunicar que el requisito sigue pendiente; no presentar otro video como equivalente.]

**Acciones y pausas:** 25:00–26:00 exacto. Cargar MP4 desde Studio, validar duración 60 s y audio original. Reproducir tras clic. Pausar/reiniciar/volumen disponibles. No subtitular sin permiso.

## scene-21 · 26:00–27:00 · Germán

**De la pantalla a la comunidad.**

El video conecta la propuesta con una identidad que también funciona fuera de la pantalla. Preparamos diseños editables de flyer, stickers QR, credenciales, tarjetas, indumentaria sencilla y stand. Todos llevan a enlaces configurables del proyecto, sin inventar teléfonos ni cuentas sociales. El tutorial tiene un espacio reservado para su archivo real. Los canales de marca que no estén verificados permanecen como pendientes. El objetivo de difusión no es sumar piezas aisladas: es que alguien vea una invitación, llegue a BuscAG y entienda cómo participar. También necesitamos medir ese recorrido en el piloto. Los diseños están listos para adaptar; imprimirlos exige confirmar antes el destino final de cada QR.

**Acciones y pausas:** 26:00–27:00. Mostrar materiales editables. No usar el trailer sintético como tutorial real ni como publicidad inglesa.

## scene-22 · 27:00–28:00 · Valentino

**Empezar cerca. Aprender. Conectar más lejos.**

Este mapa representa una visión, no usuarios actuales. Nuestra primera meta no es cubrir todo el país: es lograr que una comunidad concreta pueda publicar, buscar y ponerse en contacto de forma útil y segura. Si el piloto muestra valor, aprendemos qué mejorar y evaluamos nuevas zonas. La expansión requiere confianza, soporte y sostenibilidad, además de infraestructura. Cada conexión del mapa es una posibilidad futura. El criterio para crecer será la evidencia, no la animación.

**Acciones y pausas:** 27:00–28:00. Mapa estilizado con conexiones progresivas, rótulo persistente VISIÓN FUTURA.

## scene-23 · 28:00–29:00 · Germán

**Probalo. Revisalo. Ayudanos a mejorarlo.**

Ahora la invitación es concreta. Un QR lleva al entorno web de prueba previsto y el otro al repositorio, donde está el código y la documentación. La disponibilidad del sitio debe comprobarse antes del evento; el QR no demuestra por sí solo que el servicio esté operativo. Si lo prueban, nos interesa saber dónde encuentran una barrera, qué información necesitan y qué les genera confianza para contactar a otra persona. Si quieren auditar, pueden revisar el motor de coincidencias y los límites que documentamos. No necesitamos que crean en una promesa de rentabilidad. Necesitamos una prueba útil, una revisión honesta y un próximo paso que podamos medir.

**Acciones y pausas:** 28:00–29:00. QR legibles. No afirmar piloto abierto sin decisión del equipo.

## scene-24 · 29:00–30:00 · Valentino

**¿Y si encontrarlo fuera mucho más fácil?**

Volvamos a la pregunta del principio. ¿Cuánto tardarían en recuperar algo que perdieron? No podemos prometer un tiempo ni asegurar que todo objeto vuelva. Lo que sí podemos construir es una forma de que la información no quede separada de quien la necesita. Hoy vieron una propuesta, sus reglas, sus costos y los límites que todavía tenemos que validar. Germán y yo queremos seguir ese trabajo con una comunidad real. [Pausa de cinco segundos.] ¿Y si encontrarlo fuera mucho más fácil? BuscAG: encontrarnos hace la diferencia.

**Acciones y pausas:** 29:00–30:00. Últimos 15 s: sostener logo y QR en silencio. No cerrar con una diapositiva de “gracias”.
