# Qué cambió y qué se conservó

## Recorte editorial

- 01–03: se conserva pregunta, manos, nodos, logo y equipo; se eliminan las repeticiones de «dos personas sin conexión», del origen y de los avisos sobre no prometer resultados.
- 04: cada estudiante cumple una función distinta: Valentino invita y deja votar; Germán cierra, revela y enlaza con la publicación. Ya no repiten las mismas instrucciones, limitaciones estadísticas y comentarios.
- 05: el diagnóstico de información fragmentada deja espacio a los campos concretos de una publicación.
- 06: una enumeración rápida y genérica se convierte en una explicación de búsqueda y filtros combinados.
- 08–11: crecen de seis a siete minutos de demo; incorporan edición, perfil, avisos y recuperación, además de publicación, mapa, coincidencias y chat.
- 12–15: se mantienen React, Vite, TypeScript, Supabase, seguridad y pruebas. Se acorta el detalle de infraestructura y de los procesos de validación; las condiciones de backend quedan en notas de preparación.
- 16–19: se conserva modelo de negocio, cifras originales, viabilidad y organización. Se retira del discurso el presupuesto detallado de una futura app móvil, las reiteraciones sobre falta de ingresos y las referencias a una integración de ramas que no corresponde afirmar. El informe económico queda disponible.
- 22–24: se conserva la vuelta a la pregunta, invitación y cierre. Se retiran una segunda recapitulación larga del problema y varias promesas genéricas de expansión.

## Funciones con lugar concreto

05 publicación; 06 búsqueda avanzada; 08 publicación, perfil y edición; 09 filtros y mapa; 10 coincidencias y chat; 11 avisos internos y recuperación. La auditoría en AUDITORIA_FUNCIONES.md vincula cada afirmación a su implementación y sus límites.

## Plan horario

| Acto | Antes | Ahora | Nuevo tramo |
|---|---:|---:|---|
| I · apertura y equipo | 4:00 | 2:30 | 00:00–02:30 |
| II · encuesta, ficha y búsqueda | 4:00 | 3:30 | 02:30–06:00 |
| III · elección y demo | 7:00 | 8:00 | 06:00–14:00 |
| IV · ingeniería | 5:00 | 4:00 | 14:00–18:00 |
| V · negocio, costos, gestión, video y marca | 7:00 | 5:00 | 18:00–23:00 |
| VI · cierre | 3:00 | 2:00 | 23:00–25:00 |
| Total | 30:00 anterior | **25:00** | 1.500 segundos |

Video original: 21:30–22:30. Encuestas comienzan al 02:30 y al 06:00. El total incluye intervenciones, esperas y operación; no son 25 minutos de lectura continua. A 130 palabras/minuto, el texto oral ocupa aproximadamente 14:42; queda margen para votar, operar la aplicación, hacer pausas y reproducir el minuto de video. El ensayo humano sigue siendo necesario.

Valentino: 12:00 de intervención, 937 palabras. Germán: 12:00, 974 palabras. Video de ambos: 1:00 adicional compartido. Las cesiones de palabra y los avances figuran en SCRIPT.md, en el presentador y en el PDF.

Se conservaron los 24 identificadores, tipos de escena, colores, diseños, animaciones, transiciones, enlaces, encuestas y cuatro pasos de demo. Sólo se cambiaron textos, etiquetas de los campos y rutas de funciones. La plantilla anterior está en docs/archive/30-minutos. El reloj y el ajuste de Studio reconocen el plan de 25 minutos; los proyectos anteriores de 30 minutos conservan sus tiempos al importarse y muestran aviso.

## Usar la entrega

Descargar el ZIP nuevo y extraerlo en una carpeta nueva; no copiar data de la versión anterior si se quiere usar esta plantilla. Para conservar ediciones personales, exportar antes el proyecto de Studio. El PDF está en docs/Guion_BuscAG_Valentino_German_25min.pdf y no se sirve por la web pública. El video original debe volver a cargarse si estaba solamente en la copia anterior. También puede restaurarse la plantilla original desde Studio, después de respaldar el proyecto actual.

No se modificaron src/code, base de datos, Firebase, Supabase ni servicios de encuestas. El guion completo privado no se incorpora al bundle público.
