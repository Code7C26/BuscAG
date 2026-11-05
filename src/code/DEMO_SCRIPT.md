# Guion de demostración de BuscAG — 6 a 8 minutos

**Actualización de alcance:** se requiere registro real de visitantes con su propio
correo y confirmación activa. Ver [VISITOR_REGISTRATION.md](VISITOR_REGISTRATION.md).
Las cuentas preconfirmadas son sólo contingencia y no prueban recepción de email.
No se desactivó la confirmación ni se modificó producción.

Usar dos cuentas ficticias confirmadas: **Cuenta A** (pierde) y **Cuenta B** (encuentra).
No incluir ni proyectar credenciales. A en navegador normal; B en otro navegador o
ventana privada. Iniciar sesión antes de compartir pantalla y tener una foto propia
ficticia de mochila, sin rostros, documentos ni datos personales. No borrar ejemplos
previos; usar un sufijo de ensayo único para distinguirlos.

## Preparación única, antes de la clase

- Ejecutar el ensayo real de SCHOOL_PRESENTATION.md. Abrir ambos navegadores conectados
  al mismo proyecto real. No usar el Playwright simulado como aplicación a presentar.
- Probar internet del aula y la web desde un teléfono. Elegir el mismo punto público
  de ejemplo en el selector de ubicación de ambos objetos; confirmar ubicación.
- Si habrá avisos automáticos de backend, verificar el worker real e iniciar watch
  justo antes de exponer: termina después de diez minutos.
  Si no, anunciar que se mostrará comparación automática en pantalla y chat real.
- Evitar depender de recibir un correo durante la exposición. No desactivar seguridad.

## Recorrido

1. **Problema y entorno (30 s).** «BuscAG conecta objetos perdidos y encontrados».
   Mostrar la franja de presentación y explicar que las cuentas/publicaciones son
   ficticias, pero Supabase, imágenes, chat y sincronización son servicios reales.
   Hacer esa afirmación sólo después del ensayo remoto; si falta, decirlo claramente.
2. **Publicar pérdida, A (1 min).** Título «Mochila azul escolar · Ensayo [sufijo]»;
   categoría Mochilas y Bolsos; descripción «Mochila azul con cuaderno rojo y llavero
   negro»; estado perdido; fecha del día; foto ficticia y ubicación confirmada.
   Mostrar estado guardado y el detalle. No atribuir éxito si aparece un error.
3. **Mapa y filtros (45 s).** Buscar el título y alternar Perdidos/Encontrados. Abrir
   el pin y la publicación. Mostrar en celular que navegación y controles siguen accesibles.
4. **Publicar hallazgo, B (1 min).** Mismo título/descripción/categoría, estado encontrado,
   misma fecha y punto cercano. Con datos compatibles el algoritmo debe encontrar la
   pareja. Abrir Coincidencias y Comparar lado a lado. Explicar los motivos del score;
   no prometer un porcentaje exacto ni identificación garantizada. Puede haber otras
   sugerencias de ensayos previos: elegir la pareja por su sufijo y autores.
5. **Contacto y notificación (1 min).** Desde A, contactar al autor del hallazgo B.
   Enviar «Hola, creo que es mi mochila de ejemplo». B muestra el aviso interno y
   responde «Podemos verificar sus detalles». Mostrar recibo de lectura y actualización
   sin recarga. No revelar teléfono ni datos personales; no presentar push del sistema
   operativo como disponible si no está configurado.
6. **Recuperación, B (45 s).** Marcar el hallazgo como recuperado y aceptar confirmación.
   Comprobar que la conversación sigue disponible y la pareja deja de ser candidata.
   No pulsar Eliminar: no aporta al recorrido y puede borrar conversaciones por la FK.
7. **Perfil y sesión (45 s).** Abrir perfil propio, configuración y Cerrar sesión.
   Mostrar pantalla de acceso. Entrar con la otra cuenta sin proyectar la contraseña;
   comprobar que no quedan borradores ni datos privados de la anterior.
8. **Cierre (30 s).** Explicar límites: las coincidencias son sugerencias; cuentas demo
   confirmadas para no depender del correo; push o scheduler permanente no forman parte
   de la exposición si no fueron certificados. No fingir correos o avisos recibidos.

## Si algo falla en vivo

- Error de red: conservar borrador y reintentar una vez tras comprobar conexión; no
  pulsar repetidamente Publicar/Enviar. Mostrar error honesto, sin crear una segunda fila.
- Realtime retrasado: mencionar el problema, reabrir/recargar y comprobar datos por
  REST. No decir que fue instantáneo si hubo que recargar.
- Sin avisos de matching: mostrar la comparación calculada y aclarar si el worker
  no está activo. No insertar manualmente avisos para fingir entrega automática.
- Correo no recibido: continuar con cuentas ya confirmadas. Registro/recuperación por
  correo se explican como flujo preparado y con la verificación real pendiente.
- Llevar capturas o video de un ensayo **real identificado y fechado** como respaldo;
  rotularlo grabación, no demostración en vivo. Las capturas de fixtures del repositorio
  sólo ilustran diseño/pruebas y deben presentarse como tales.
