# Auditoría de fuentes y alcance

13/11/2026. Se leyeron completos el archivo adjunto BUSCAG_PROMPT_MAESTRO_CODEX (2).md (14.946 bytes) y las siete páginas del PDF Informe_BuscAG_actualizado_con_Viabilidad.pdf. Se trataron como requisitos delegados por el pedido del usuario y como fuentes documentales, sin convertir afirmaciones del PDF en verificación de servicios reales.

## Repositorio

- `origin/main`: ef964b4d901fbc923d98bf2b46e4d76fceb7cb1a.
- `origin/Alexis`: cfdca4af4155e0a24c11255286913ad7a55ddbbf, 91 commits delante de main, cero exclusivos de main.
- `origin/German`: 074539db8bcb2d67058c982dc18845dd32227a31.
- Estado inicial: rama local work, limpia, en la punta de main. No había cambios de usuario sin confirmar.
- AGENTS y ALEXIS_DEVELOPMENT se leyeron al traer Alexis. La instrucción directa del usuario autoriza específicamente el merge seguro de main, sobre la pauta local histórica de conservar main intacta. Se trabajó en Alexis, sin PR ni ramas nuevas de desarrollo. main sólo recibió merges normales.
- El README raíz conserva marcadores históricos de conflicto y contenido inadecuado. No se usa como material de pitch. Se enlaza el README técnico de src/code, auditado. No se alteró ese archivo raíz ni la aplicación productiva para esta presentación.
- Logo: símbolo de brújula auténtico de src/code/public/icon.svg, copia exacta. Fuente local y paleta azul noche/cyan de identidad de Alexis. Sin logo inventado.
- Firebase configurado en src/code; Supabase en el cliente. El PDF presupuesta Vercel/Render: se distingue de la configuración real.
- URL prevista de demo documentada: https://buscag-prueba.web.app. Consulta HEAD intentada: túnel de red rechazado con 403; no prueba disponibilidad ni indisponibilidad del sitio para el público.

## Funciones y evidencias

Existen componentes de publicación, búsqueda, filtros, mapa Leaflet, coincidencias, chat, notificaciones y recuperación. El código y sus pruebas no garantizan que toda RPC esté instalada en el destino online. Push requiere configuración propia; no se anuncia activo. Capacitor está considerado para futuro; no se afirma publicación en tiendas.

Desafío técnico documentado: respuestas inciertas y duplicaciones en publicación/mensajería, con claves idempotentes, validación de propiedad y reconciliación. Referencias: src/code/ALEXIS_DEVELOPMENT.md, lib/publicationDelivery.ts, lib/messageDelivery.ts y pruebas de cliente. La explicación no inventa una caída de producción ni una tasa de éxito.

Capturas: trailer/public/captures/manifest.json declara real_ui_synthetic_backend, sin credenciales reales y red interceptada. Se copiaron con rótulo explícito. No prueban usuarios, mensajes ni recuperaciones reales. Los videos del trailer tienen la misma limitación; se excluyeron del video inglés y del respaldo de demo.

## Economía

Se respetan 180 horas y $1.730.700 ARS de valorización; $39.250/mes y $479.500/año fijos directos previstos; freemium + destacados + patrocinios B2B como propuesta. Móvil: 60–90 h y $576.900–$865.350. Se distinguen inversión técnica, operación recurrente y gastos ejecutados. No se atribuyen usuarios, ingresos, demanda validada, rentabilidad ni acuerdos.

El PDF completo queda disponible para auditoría. Trámites, patentes y políticas de tiendas no desplazan las escenas obligatorias. Las referencias de tiendas provienen del informe, no se anuncian como una nueva consulta oficial realizada en esta entrega.

## Decisiones de implementación

Aplicación independiente bajo presentation/. Votación con servidor HTTP/SSE + SQLite propio: preserva el aislamiento del MVP y permite LAN sin Internet. No se creó Supabase externo ni se usaron las credenciales ambientales de staging/producción. Three.js no se incorporó: los mockups y capas usan perspectiva CSS y Motion para reducir peso; la consigna lo pide sólo donde aporte valor.

No se hicieron llamadas a usuarios ni se ejecutaron SQL, migraciones, envío de mensajes o despliegues en servicios de BuscAG. Se crearon diseños corporativos editables con enlaces documentados; las redes y datos de contacto faltantes permanecen vacíos.
