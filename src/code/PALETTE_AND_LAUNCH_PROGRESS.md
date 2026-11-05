# Nueva identidad y preparación de lanzamiento

Paleta solicitada aplicada en Alexis: petróleo #031926, azul verdoso #468189,
salvia #77ACA2, gris verdoso #9DBEBB y crema #F4E9CD. La raíz CSS define tokens
brand, superficies, texto, bordes, acciones y estados. Las escalas Tailwind existentes
se adaptaron al sistema para cubrir componentes compartidos sin duplicar lógica.

| Uso | Criterio |
| --- | --- |
| Texto/estructura/portada Auth | Petróleo, con crema y salvia sobre superficies oscuras. |
| Inicio | Hero crema/salvia, tarjetas claras, buscador y filtros legibles. |
| Acciones | Azul verdoso y derivación más oscura para contraste con texto blanco. |
| Perfil/configuración | Superficies claras, bordes gris verdoso, texto petróleo; salida visible. |
| Mapa/detalle | Pines coherentes, ubicación propia azul verdoso, nombres accesibles y miniaturas decorativas sin ruido para lectores. |
| Coincidencias/chat/avisos/formularios | Escalas compartidas, badges y estados consistentes; alertas diferenciadas. |
| PWA | SVG y PNG 192/512 regenerados, manifiesto/theme-color y fallback offline actualizados. |
| Correo | Dos plantillas listas con ConfirmationURL y sin recursos externos, aún no aplicadas. |

Se conservan superficies neutrales blancas y tonos derivados para contraste; los
estados peligro/advertencia usan colores semánticos adicionales y texto/iconos,
para no depender sólo de variaciones de salvia. No se cambiaron funcionalidades,
FK ni datos reales. El ajuste no consiste en superponer una hoja de colores parcial:
se retiraron los antiguos verdes de los estilos de marca y se actualizaron también
los colores inline de los dos mapas y los recursos instalables.

## Comprobaciones y hallazgos

- Se amplió Playwright con tokens exactos y axe sobre inicio, detalle, publicación,
  mapa, coincidencias y notificaciones en desktop y móvil. Las pruebas existentes
  cubren también Auth, perfil, ajustes, chat, sesiones y vista de 320 px.
- Se corrigió contraste insuficiente del filtro de inicio usando el tono fuerte.
- Se corrigieron marcadores sin nombre, alt decorativo ausente y atribución sin
  subrayado en el mapa. No se deshabilitaron reglas de axe.
- El análisis visual espera el fin de las transiciones finitas antes de medir el
  contraste. Así compara el estado final y no colores intermedios de una animación.
- Una ejecución tuvo timeout móvil durante navegación del servidor de desarrollo
  mientras se estaban formateando fuentes. No se clasificó como fallo remoto de
  Supabase ni se ocultó con retries automáticos; se repitió la batería con las fuentes
  estabilizadas. Resultados finales registrados al cierre de la entrega.

## Producción y límites

Dominio confirmado por el titular: https://buscag-2677c.web.app. El modo release lo
fija como origen y rechaza otros destinos. El launcher admite valores públicos por
defecto de proyecto/origen confirmados, pero rechaza staging heredado, no carga .env,
exige clave pública y checkout limpio y genera inventario SHA-256. No despliega.

[SMTP_LAUNCH.md](SMTP_LAUNCH.md) documenta el bloqueo de correo predeterminado y una
opción gratuita con dominio propio. Las APIs públicas no permiten confirmar Site URL,
allowlist ni SMTP privado. No se aplicaron plantillas ni configuración remota.
[STAGING_LIVE_QA.md](STAGING_LIVE_QA.md) ofrece un runner real separado y wrapper de
PowerShell. Necesita tres cuentas ficticias y clave pública de staging vinculadas
localmente. No guarda contraseñas/sesiones en archivos ni borra objetos; conserva
los datos QA nuevos y no toca la mochila existente. Sus guardas y transporte se
probaron con fixtures, no se ejecutaron las acciones remotas.

No hay acceso staging configurado en este entorno: falta permiso de red al host y
cuentas dedicadas. Ningún test simulado certifica recepción de correo, RLS remoto,
Realtime real, push ni worker. La política del entorno no se eludió con producción.

La integración a main sigue condicionada a evidencias reales y revisión de catálogo
actual. Las ocho migraciones candidatas de producción no se ejecutan automáticamente;
los nueve pasos de staging no se copian a producción. Matching y push pueden seguir
deshabilitados hasta su certificación. El respaldo real/restauración integral de
Auth/Storage siguen requiriendo verificación del operador. Ver
[PUBLIC_RELEASE_PLAN.md](PUBLIC_RELEASE_PLAN.md) para el orden y recuperación.

## Resultados finales locales

- 113 pruebas de aplicación/herramientas y plantilla; TypeScript y build correctos.
- 5 entorno staging, 4 guardas release y 3 guardas del nuevo runner real.
- 30 E2E Chromium (desktop y viewport móvil); axe sin infracciones graves/críticas
  en las vistas auditadas. No son pruebas de Safari físico ni servicios reales.
- SQL PGlite: 58 DATE, 58 timestamptz, 61 observado y un ensayo completo de orden.
- 16 controles de seguridad cliente y una prueba PWA de build/offline correctos.
- Tras actualizar la versión de caché offline y el foco del switch, se repitieron
  aplicación, TypeScript, build, seguridad, PWA y accesibilidad perfil/ajustes.
- Capturas originales guardadas como artefacto fuera de Git: 34 PNG y galería HTML.
  El worker cambia de caché para instalar el fallback nuevo; no cachea datos privados.
- No se ejecutaron pruebas reales de staging ni PowerShell en Windows, no se creó
  un backup de producción nuevo y no se certificó la recuperación de servicios internos.
