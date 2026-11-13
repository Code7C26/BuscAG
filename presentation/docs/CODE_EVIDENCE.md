# Código auténtico y desafío técnico

Fuente: src/code/src/utils/matcher.ts en Alexis cfdca4af4155e0a24c11255286913ad7a55ddbbf. El fragmento de src/code-evidence.json se extrajo literalmente, incluyendo comentarios, entre el filtro de categoría y la validación de coordenadas. Se muestra sin atribuir al índice una probabilidad de propiedad.

También se revisaron src/code/src/utils/matcher.test.ts, src/code/lib/database.ts, src/code/lib/publicationDelivery.ts, src/code/lib/messageDelivery.ts, src/code/tests/client-security.mjs y src/code/ALEXIS_DEVELOPMENT.md.

Desafío elegido: una respuesta perdida deja incierto si el servidor confirmó el envío. La solución documentada conserva la identidad del intento y comprueba los bytes de una subida ya existente, evitando sobrescrituras. La garantía completa depende del contrato disponible en el servidor; no se promete exactamente una publicación con un backend antiguo que use fallback. Los controles locales no certifican los datos ni las políticas de una instancia remota.

No se inventa un incidente histórico concreto, una duración de caída o una estadística de mejora. Ambos expositores explican decisiones y pruebas, sin atribuir a IA resultados que no están documentados.
