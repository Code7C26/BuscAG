# Demo real: dos perfiles, tres objetos

Usar sólo cuentas de prueba existentes y autorizadas, en perfiles separados de navegador. No publicar en producción ni ejecutar SQL. No activar servicios, cambiar permisos ni crear usuarios para forzar el éxito. El entorno previsto es `https://buscag-prueba.web.app`; disponibilidad, versión y acceso de ambas cuentas pendientes de ensayo.

Las fichas siguientes son datos sintéticos preparados para carga manual. **No fueron insertados en ningún servidor.** Usar fecha local real del ensayo, hallazgo el mismo día o hasta 24 h después, coordenadas públicas confirmadas en el mapa y foto propia. No usar fecha futura, domicilio, DNI, rostro ni características privadas de alguien. No ejecutar seeds remotos.

| Opción | Categoría del MVP | Título perdido A | Título hallazgo B | Descripción común de prueba |
|---|---|---|---|---|
| Auriculares | Electrónicos | PRESENTACIÓN QA Auriculares negros | PRESENTACIÓN QA Hallazgo auriculares negros | Auriculares negros inalámbricos con estuche azul de prueba. Foto propia. |
| Llaves | Llaves | PRESENTACIÓN QA Llaves llavero rojo | PRESENTACIÓN QA Hallazgo llaves llavero rojo | Juego de llaves metálicas con llavero rojo circular de prueba. |
| Billetera | Otros, si el catálogo no tiene Billeteras | PRESENTACIÓN QA Billetera marrón | PRESENTACIÓN QA Hallazgo billetera marrón | Billetera marrón lisa de prueba, sin documentos ni dinero. |

La categoría se elige de las opciones reales de la versión servida; el mismo par debe usar la misma. Confirmar antes del evento las opciones disponibles. El criterio del matcher no garantiza que cualquier texto dé un resultado: ensayar los tres casos y registrar sus IDs sintéticos en un registro privado. No cambiar el algoritmo ni las políticas para producir la coincidencia.

08:00–09:00 votación. 09:00–10:30 A publica y comprueba. 10:30–12:00 B busca y publica hallazgo. 12:00–13:30 comparación y mensajes. 13:30–15:00 recuperación si el servicio real está habilitado y se confirma bilateralmente. Ambos participan. Si una operación falla, se explica y no se activa un éxito.

Al ensayar: persistencia tras recarga, propietarios distintos, imagen correcta, filtros/mapa coherentes, conversación bidireccional y estado confirmado. La animación «CONEXIÓN ENCONTRADA» sólo se activa desde presentador tras comprobar el resultado; no escribe en el MVP. Recuperación requiere confirmación real si el backend la ofrece; nunca un PATCH directo como atajo. Los avisos push externos, scheduler y cobros quedan fuera si no están verificados.

La grabación de respaldo debe ser del ensayo real, sanitizada, rotulada y cargada en la escena demo desde Studio. No se aportó esa grabación. La interfaz permite cargar un MP4 sin tocar código; se verá con controles y nombre de recurso.

No borrar en masa los registros al terminar. Acordar limpieza por separado, sin SQL ni eliminación de datos ajenos.
