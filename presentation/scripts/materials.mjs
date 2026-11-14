import QRCode from "qrcode";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const out = new URL("../materials/", import.meta.url);
await mkdir(out, { recursive: true });
const web = "https://buscag-2677c.web.app",
  repo = "https://github.com/Code7C26/BuscAG";
const q = await QRCode.toString(web, { type: "svg", margin: 2, width: 200 }),
  qr = await QRCode.toString(repo, { type: "svg", margin: 2, width: 200 });
const icon = await readFile(
  new URL("../public/brand/icon.svg", import.meta.url),
  "utf8",
);
const embed = (svg, x, y, w, h) =>
  svg.replace(/<svg\b[^>]*>/, tag=>tag.replace(/\s(?:x|y|width|height)="[^"]*"/g, "").replace("<svg ", `<svg x="${x}" y="${y}" width="${w}" height="${h}" `));
const text = (x, y, t, size = 30, color = "#f4f8ff", extra = "") =>
  `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${color}" ${extra}>${t}</text>`;
const logo = (x, y, size = 70) =>
  embed(icon, x, y, size, size) +
  text(x + size + 16, y + size * 0.72, "BuscAG", size * 0.58);
const save = async (name, w, h, mmw, mmh, body) =>
  writeFile(
    new URL(name + ".svg", out),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${mmw}mm" height="${mmh}mm"><title>BuscAG · ${name} · diseño editable</title><rect width="100%" height="100%" fill="#061327"/>${body}</svg>`,
  );
await save(
  "flyer-A4",
  794,
  1123,
  210,
  297,
  `<circle cx="730" cy="180" r="300" fill="#12365b"/>${logo(60, 70, 75)}${text(60, 330, "¿Lo perdiste?", 77)}${text(60, 430, "Conectemos.", 77, "#60c8ff")}${text(60, 535, "Publicá. Buscá. Encontrá una conexión.", 29)}${text(60, 590, "Encontrarnos hace la diferencia.", 27, "#a7bed9")}${embed(q, 60, 690, 220, 220)}${text(310, 765, "Conocé BuscAG", 34)}${text(310, 815, "Web de BuscAG", 21, "#a7bed9")}${text(60, 1015, "buscag-2677c.web.app", 24, "#60c8ff")}${text(60, 1060, "PROPUESTA · Confirmar disponibilidad antes de imprimir", 16, "#a7bed9")}`,
);
await save(
  "sticker-QR-70mm",
  700,
  700,
  70,
  70,
  `<circle cx="350" cy="350" r="330" fill="#f4e9cd"/>${embed(icon, 285, 65, 130, 130)}${text(350, 255, "¿Y si encontrarlo fuera", 33, "#031926", 'text-anchor="middle"')}${text(350, 300, "mucho más fácil?", 36, "#031926", 'text-anchor="middle"')}${embed(q, 215, 335, 270, 270)}${text(350, 643, "BuscAG · web", 24, "#031926", 'text-anchor="middle"')}`,
);
for (const [name, role] of [
  ["Valentino Mamonde", "Desarrollo e investigación"],
  ["Germán Luján", "Marketing y documentación"],
])
  await save(
    "credencial-" + name.split(" ")[0],
    540,
    860,
    54,
    86,
    `${logo(45, 60, 70)}<path d="M185 16h170v15H185z" fill="#8fabc7"/>${text(45, 285, "EL EXPERIMENTO", 26, "#60c8ff")}${text(45, 365, name, 37)}${text(45, 420, role, 24, "#a7bed9")}${text(45, 465, "Equipo BuscAG · expositor", 23, "#a7bed9")}${embed(qr, 45, 535, 200, 200)}${text(45, 790, "Código y documentación", 21, "#a7bed9")}`,
  );
await save(
  "tarjeta-90x50mm",
  900,
  500,
  90,
  50,
  `${logo(50, 50, 70)}${text(50, 230, "Encontrarnos hace", 40)}${text(50, 285, "la diferencia.", 40, "#60c8ff")}${text(50, 395, "Web de BuscAG", 21, "#a7bed9")}${text(50, 435, "buscag-2677c.web.app", 22, "#a7bed9")}${embed(q, 590, 135, 250, 250)}`,
);
await save(
  "indumentaria-propuesta",
  1000,
  850,
  210,
  178.5,
  `<path d="M300 130 410 100Q500 180 590 100L700 130 870 300 760 405 700 345V740H300V345L240 405 130 300Z" fill="#102942" stroke="#527491" stroke-width="4"/>${embed(icon, 565, 245, 85, 85)}${text(435, 455, "BuscAG", 52)}${text(350, 515, "Encontrarnos hace la diferencia.", 20, "#a7bed9")}${text(70, 800, "Propuesta editable · remera azul noche, símbolo al pecho", 24, "#a7bed9")}`,
);
await save(
  "stand-propuesta",
  1600,
  1000,
  320,
  200,
  `<rect x="180" y="70" width="1240" height="600" rx="12" fill="#12365b"/>${logo(260, 130, 100)}${text(260, 370, "¿Y si encontrarlo fuera", 72)}${text(260, 460, "mucho más fácil?", 72, "#60c8ff")}${embed(q, 1120, 220, 220, 220)}${text(1090, 490, "Web de BuscAG", 22, "#a7bed9")}<rect x="330" y="590" width="940" height="280" rx="15" fill="#061327" stroke="#60c8ff"/>${logo(650, 665, 95)}${text(180, 945, "Propuesta de stand · QR, computadora para demo y materiales impresos", 30, "#a7bed9")}`,
);
await save("tarjeta-reverso-90x50mm",900,500,90,50,`${logo(50,45,65)}${text(50,225,"Código abierto a revisión.",38)}${text(50,280,"Una conexión, con evidencia.",28,"#a7bed9")}${text(50,400,"GitHub · README · documentación",22,"#60c8ff")}${embed(qr,610,130,240,240)}`);
await writeFile(
  new URL("README.md", out),
  "# Identidad corporativa editable\n\nSVG vectoriales con textos editables en Inkscape/Figma/Illustrator. Sin datos de contacto inventados. Flyer A4, sticker 70 mm, credenciales 54×86 mm, tarjeta 90×50 mm, propuesta de indumentaria y stand.\n\nLos QR codifican el dominio confirmado del proyecto y el repositorio auténtico. Confirmar disponibilidad antes de imprimir. Regenerar: editar destinos en scripts/materials.mjs y ejecutar node scripts/materials.mjs. Para imprenta agregar sangrado y validar color y tamaño; son diseños editables, no una prueba de impresión aprobada. El símbolo original proviene del repositorio.\n",
);
console.log("8 diseños SVG editables generados.");
