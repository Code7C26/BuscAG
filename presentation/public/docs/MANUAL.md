# BuscAG — Manual de usuario para el MVP

Este manual describe interfaces presentes en la rama Alexis auditada. La disponibilidad efectiva depende del backend y de la versión servida. No certifica funciones remotas que no se ensayaron.

1. Abrir el entorno de prueba previsto: https://buscag-prueba.web.app. Confirmar con el equipo su disponibilidad y versión. No usar datos privados en el ensayo.
2. Iniciar sesión con una cuenta propia. Si el servicio exige confirmación de correo, completarla antes de ingresar. No compartir contraseñas; para demo usar perfiles de navegador separados.
3. Publicar un objeto perdido o encontrado: elegir estado y categoría del catálogo real, título, descripción, fecha y ubicación pública. Cargar una foto propia válida. Revisar el formulario antes de guardar.
4. Esperar la confirmación del servidor. Un estado pendiente o un error de red no demuestra guardado. Si falla, utilizar el reintento de la interfaz; no repetir indiscriminadamente ni sobrescribir datos ajenos.
5. Buscar por texto y usar filtros de categoría/estado. El mapa aporta contexto; la ubicación del navegador es voluntaria. Si se niega GPS, usar la búsqueda y las referencias públicas disponibles.
6. Abrir el detalle y revisar descripción, fecha y ubicación. Las coincidencias sugeridas son orientativas; su índice no es una probabilidad ni una prueba de propiedad.
7. Contactar desde el objeto correcto. Comprobar quién participa y el estado real de los mensajes. Evitar publicar características privadas necesarias para verificar pertenencia. Nunca enviar contraseñas ni documentación personal por el chat del ensayo.
8. Si la recuperación bilateral está habilitada, el participante autorizado solicita confirmación y la contraparte acepta o rechaza. No marcar recuperado sólo porque hubo un chat. Si el servicio falta, no hay atajo autorizado para omitirlo.
9. Perfil y configuración: revisar opciones existentes de privacidad y consentimiento. Teléfono, bloqueos, seguimiento, denuncias y valoraciones dependen de los servicios instalados y de las condiciones de cada flujo. No se habilitan cambiando permisos para una demo.
10. Las notificaciones internas y las push externas son sistemas distintos. Las push necesitan configuración y permiso adicionales; no se prometen disponibles sin prueba.
11. Cerrar sesión al terminar en una PC compartida. No borrar cuentas ni publicaciones de otros usuarios. Informar errores al equipo por los canales reales que éste confirme.

Código y README técnico: https://github.com/Code7C26/BuscAG/tree/Alexis/src/code

Los escenarios de prueba, la recuperación de respaldo y el plan del pitch están en DEMO.md y OPERACION.md del paquete de presentación. Para la audiencia, no se leen esos documentos durante el pitch: se consultan después por enlace.
