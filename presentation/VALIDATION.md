# Validación 2.0.0 · aula

Se ejecutaron build TypeScript/Vite y 22 pruebas automatizadas de presentación: HTTP/MIME, seguridad de rutas, autenticación, SSE, persistencia, editor/importación/exportación, seis actos, tiempos, Worker SQLite y puente HTTPS. Las pruebas de Worker usan almacenamiento aislado y transporte controlado.

Playwright/Chromium recorrió las 24 escenas a 1920×1080 y comprobó 1280×720: negro inicial, títulos de al menos 84 px a 1080p, geometría, dos encuestas, QR decodificados, sincronización, cierre/revelado, conteos manuales independientes y Studio. Pixel 7/iPhone 13 son emulaciones de navegador, no teléfonos físicos. Las capturas se conservan como artefactos de trabajo.

Plan nominal: seis actos 4+4+7+5+7+3 = 30 minutos. Video reservado 25:00–26:00. No garantiza una exposición oral de exactamente 30 minutos sin ensayo.

El servicio independiente de votación se publicó en Sites por HTTPS. La red Cloud bloquea su hostname; GitHub Actions pasó el preflight público separado: ambas páginas y recursos HTTP 200/MIME correcto, API pública 200, administración 401 y voto cerrado 409. Ambas URLs web.app dieron 200 y GitHub privado dio 404 anónimo. La prueba integral de abrir/votar/revelar con credencial remota debe repetirse tras configurar la clave privada del operador. Las pruebas locales integrales pasan con el mismo Worker y SQLite aislado.

La entrega conserva las protecciones contra traversal que corrigieron Windows 1.0.1. CI prueba el ZIP distribuido extraído, sin reconstruirlo, en Windows y Linux. Consultar el resultado de la ejecución asociada al commit antes de dar esos sistemas por aprobados.

No se probaron Android/iPhone físicos, proyector, sonido de aula ni datos móviles. Pendientes también video original inglés de 60 segundos, demo auténtica con dos cuentas y ensayo oral. El repositorio de auditoría sigue privado y exige acceso; no se cambió su visibilidad. No hubo despliegue Firebase ni modificación Supabase.
