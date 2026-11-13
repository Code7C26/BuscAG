import * as nativePath from 'node:path';

// path.relative uses the platform's separator, drive rules and case semantics.
// A string prefix check with '/' rejects every child path on Windows.
export function isInsideDirectory(base, target, paths = nativePath) {
  const rel = paths.relative(paths.resolve(base), paths.resolve(target));
  return rel === '' || (!paths.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + paths.sep));
}

export function resolvePublicPath(base, urlPath, paths = nativePath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); }
  catch { throw Object.assign(new Error('Ruta mal codificada.'), {status: 400}); }
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').some(part => part === '..' || (part.startsWith('.') && part !== ''))) {
    throw Object.assign(new Error('Ruta no permitida.'), {status: 403});
  }
  const file = paths.resolve(base, '.' + decoded);
  if (!isInsideDirectory(base, file, paths)) throw Object.assign(new Error('Ruta fuera del directorio público.'), {status: 403});
  return file;
}
