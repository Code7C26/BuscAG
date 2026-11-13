#!/usr/bin/env python3
"""Snapshot local de presentation/ sin cambiar ramas existentes ni hacer push."""
import argparse, datetime, os, pathlib, subprocess, tempfile, uuid, zipfile
parser=argparse.ArgumentParser()
parser.add_argument("--zip", type=pathlib.Path, help="Incluir el ZIP portable como archivo descargable en la rama nueva")
args=parser.parse_args()
root = pathlib.Path(__file__).resolve().parents[2]
def git(*args, env=None, input=None):
    return subprocess.check_output(['git', '-C', str(root), *args], env=env, input=input, text=True).strip()
base = git('rev-parse', 'HEAD')
name = 'presentation/windows-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:10]
ref = 'refs/heads/' + name
fd, index = tempfile.mkstemp(prefix='buscag-transfer-index-'); os.close(fd); os.unlink(index)
env = {**os.environ, 'GIT_INDEX_FILE': index}
try:
    git('read-tree', base, env=env)
    git('add', '--', 'presentation', env=env)
    if args.zip:
        archive=args.zip.resolve()
        if not archive.is_file() or archive.stat().st_size > 95*1024*1024:
            raise SystemExit('ZIP ausente o mayor de 95 MB.')
        with zipfile.ZipFile(archive) as z:
            if z.testzip() is not None: raise SystemExit('ZIP dañado.')
            if any('/data/' in n or '/node_modules/' in n or '/.git/' in n or pathlib.PurePosixPath(n).name.startswith('.env') for n in z.namelist()):
                raise SystemExit('ZIP contiene recursos excluidos.')
        blob=git('hash-object','-w',str(archive))
        git('update-index','--add','--cacheinfo','100644,'+blob+',presentation/descargas/BuscAG-Windows-completo.zip',env=env)
    tree = git('write-tree', env=env)
    changed = git('diff-tree', '--no-commit-id', '--name-only', '-r', base, tree)
    if any(not line.startswith('presentation/') for line in changed.splitlines()):
        raise SystemExit('Abortado: hay cambios fuera de presentation/.')
    commit = git('commit-tree', tree, '-p', base, input='package: prepare isolated Windows presentation transfer\n')
    # Empty old value means create-only: an existing local ref is never changed.
    git('update-ref', ref, commit, '')
    print('Referencia LOCAL nueva: ' + name)
    print('Commit: ' + commit)
    print('main, Alexis, German, checkout e indice normal no se modificaron. No hubo push.')
    print('\nAntes de publicar: comprobar que NO exista el nombre en el remoto:')
    print('git ls-remote --heads origin ' + ref)
    print('Si aparece una linea, NO publicar: volver a ejecutar este script para otro nombre.')
    print('Ejecutar las comprobaciones del repositorio y revisar diff. Luego, desde Codex Cloud:')
    print('git push origin ' + commit + ':' + ref)
    print('Es push normal a un nombre aleatorio nuevo: no usar --force ni reutilizar ramas existentes.')
finally:
    try: os.unlink(index)
    except FileNotFoundError: pass
