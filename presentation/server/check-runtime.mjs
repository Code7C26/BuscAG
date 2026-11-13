const [major, minor] = process.versions.node.split('.').map(Number);
if (major !== 24 || minor < 13) {
  console.error(`Node instalado: ${process.version}. Este paquete admite Node 24 LTS, version 24.13 o posterior de la serie 24.`);
  console.error('Instala la ultima version 24.x LTS desde https://nodejs.org/ y vuelve a abrir el iniciador.');
  process.exit(1);
}
try {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.prepare('select 1').get();
  db.close();
  console.log(`Node ${process.version} y SQLite: correctos.`);
} catch {
  console.error('Esta instalacion de Node no incluye SQLite utilizable. Reinstala Node 24 LTS oficial.');
  process.exit(1);
}
