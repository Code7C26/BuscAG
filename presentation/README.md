# BUSCAG — EL EXPERIMENTO · versión aula 2.0

Reconstrucción de 24 escenas en seis actos, 30:00 nominales y video original reservado 25:00–26:00. React/TypeScript/Vite/Motion, Canvas limitado y SVG/CSS. Fuente, imágenes, guion y recursos locales. Se conservan Studio, presentador, backups, IndexedDB, import/export y el iniciador Windows con la corrección de rutas estáticas 1.0.1.

## Windows

Extraer el ZIP en una carpeta nueva, usar Node 24 LTS (24.13+ de la serie 24) y ejecutar INICIAR-WINDOWS.cmd. No abrir dist/index.html como archivo. / es el proyector; /presenter es privado; /studio edita. El ZIP compilado funciona sin npm install. Cerrar el servidor anterior antes de iniciar otra copia.

## Aula y votaciones

Leer AULA-OPERACION.md. La opción preferida es un servicio público HTTPS independiente para Android/iPhone con Wi-Fi o datos móviles. No se genera ningún QR de votación con localhost. Los QR no se habilitan hasta configurar un origen compatible mediante el panel privado. Su clave se guarda sólo en data/voting-private.json, excluida de Git/ZIP/exportaciones.

El servicio está implementado en voting-service/; se guardó un borrador privado de Sites sin publicar. Su activación necesita autorización y configuración. Ver PENDIENTES.md. No se afirma funcionamiento en teléfonos físicos. El modo «Manos levantadas» funciona localmente y conserva resultados manuales separados de votos online. El ensayo usa ejemplos ficticios rotulados y nunca borra datos reales.

GitHub es privado; su QR requiere una cuenta con acceso. El dominio público confirmado por el titular es buscag-2677c.web.app. La demo usa el entorno de prueba documentado, buscag-prueba.web.app, y requiere ensayo con dos cuentas autorizadas. Ningún QR demuestra por sí solo que el MVP esté operativo.

## Desarrollo y pruebas

```sh
npm ci
npm run build
npm test
npm run test:portable
npm run verify:qr
npm run test:classroom
npm run pack:windows
```

Para las pruebas de navegador hace falta Chromium de Playwright o /usr/bin/chromium. test:classroom revisa 24 escenas, 1080p/720p, dos encuestas con Worker/SQL sintéticos, QR decodificados en pantalla, viewports Android/iPhone y conteo manual. Es emulación de red y dispositivos, no aceptación física. test:browser puede apuntar a un ZIP extraído mediante BUSCAG_TEST_PACKAGE_DIR. No reconstruye ese paquete.

Servidor de producción de esta presentación local: node server/index.mjs. Desarrollo: npm run dev. No copiar variables o secretos del MVP. No se cambia src/code, Firebase, Supabase ni ramas principales.

SCRIPT.md contiene el discurso nuevo y STORYBOARD.md el resumen escena por escena. docs/archive conserva el guion/storyboard anteriores y el proyecto original. Exportar antes de restaurar/importar otra versión. Un proyecto anterior puede conservar textos pero requerirá asignar actos y ajustar tiempos antes del ensayo nuevo.
