"""Owner-only maintenance. Fixed Git commands; no shell or remote supplied by clients."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

PUBLISH_PATHS = ['data/manual-products.json', 'data/manual-stores.json', 'data/site-config.json', 'data/highlights.json', 'assets/manual']

UPDATE_PATHS = ['catalog-worker.js', 'tests/cache.test.cjs', 'tests/test_history_partitions.py', 'RENDIMIENTO-2026-09-27.md', 'site-config.js', 'app.js', 'features.js', 'shopping.js', 'storefront.js', 'index.html', 'styles.css', 'sw.js', 'catalog-cache.js', 'scrapers/catalog_metrics.py', 'scrapers/update_exchange.py', 'tests/test_catalog_metrics.py', 'tests/test_exchange.py', 'tests/visitor-improvements.test.cjs', 'tests/search-filter.test.cjs', 'tests/studio-preview.test.cjs', 'MEJORAS-VISITANTES-2026-09-27.md', 'tools/manual_editor', 'tools/scraper_health_alerts.py',
                '.github/workflows/scrape.yml', 'scrapers/publish_data.py',
                'requirements.txt', '.gitignore', 'tests/test_studio_writes.py',
                'tests/studio-maintenance.test.cjs', 'tests/test_collaboration_editor.py',
                'Instalar-dependencias-Studio.bat', 'Instalar-dependencias-Studio.sh',
                'STUDIO-MEJORAS-2026-09-27.md']


def owner(s):
    if s.EDITOR_MODE != 'owner':
        raise ValueError('Esta función solo está disponible para el administrador')


def git(s, *args):
    env = dict(os.environ, GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='Never')
    try:
        result = subprocess.run(['git', *args], cwd=s.PROJECT_ROOT, env=env,
                                capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=90)
    except FileNotFoundError:
        raise ValueError('Git no está instalado o no está en PATH')
    except subprocess.TimeoutExpired:
        raise ValueError('Git superó 90 segundos. Revisá la conexión y las credenciales; volvé a revisar antes de publicar.')
    if result.returncode:
        output = result.stdout + result.stderr
        hint = 'Revisá la salida de Git.'
        if any(x in output.lower() for x in ['rejected', 'non-fast-forward', 'fetch first']):
            hint = 'GitHub tiene cambios nuevos. Sincronizá el repositorio y revisá los conflictos antes de reintentar. Tu commit local se conserva.'
        elif any(x in output.lower() for x in ['authentication', 'credential', 'permission denied', 'could not read username']):
            hint = 'Autenticá Git en tu computadora y reintentá. Tu commit local se conserva.'
        raise ValueError(hint + '\n' + output[-12000:])
    return result.stdout + result.stderr


def snapshot(s, include_update=False):
    owner(s)
    scope = PUBLISH_PATHS + (UPDATE_PATHS if include_update else [])
    git(s, 'rev-parse', '--show-toplevel')
    branch = git(s, 'branch', '--show-current').strip()
    if not branch:
        raise ValueError('HEAD separado: seleccioná una rama antes de publicar')
    if git(s, 'diff', '--name-only', '--diff-filter=U').strip():
        raise ValueError('Hay conflictos sin resolver. Resolvelos antes de publicar.')
    for name in ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD']:
        path = Path(git(s, 'rev-parse', '--git-path', name).strip())
        if not path.is_absolute(): path = s.PROJECT_ROOT / path
        if path.exists(): raise ValueError('Hay una operación Git pendiente: ' + name)
    if git(s, 'diff', '--cached', '--name-only').strip():
        raise ValueError('Ya hay archivos preparados para otro commit. Completá o deshacé esa preparación antes de publicar desde Studio.')
    status = git(s, 'status', '--short')
    diff = git(s, 'diff', 'HEAD', '--stat', '--', *scope)
    # Include bytes of untracked assets and every tracked edit in the review token.
    digest = hashlib.sha256((git(s, 'rev-parse', 'HEAD') + status + branch + str(include_update)).encode())
    for relative in scope:
        path = s.PROJECT_ROOT / relative
        for file in sorted(path.rglob('*')) if path.is_dir() else [path]:
            if file.is_symlink(): raise ValueError('No se publican enlaces simbólicos: ' + str(file))
            if file.is_file() and '__pycache__' not in file.parts:
                digest.update(file.relative_to(s.PROJECT_ROOT).as_posix().encode())
                digest.update(file.read_bytes())
    upstream = git(s, 'rev-parse', '--abbrev-ref', '@{upstream}').strip()
    remote = git(s, 'config', '--get', 'branch.' + branch + '.remote').strip()
    destination = git(s, 'config', '--get', 'branch.' + branch + '.merge').strip()
    digest.update((upstream + remote + destination + git(s, 'remote', 'get-url', '--push', remote)).encode())
    ahead = git(s, 'log', '--oneline', '@{upstream}..HEAD')
    return {'review': digest.hexdigest(), 'branch': branch, 'status': status, 'diff': diff,
            'outgoing': ahead, 'upstream': upstream, 'scope': scope,
            'note': 'Se agregan los archivos del alcance indicado y se publican TODOS los commits locales pendientes de esta rama. Los otros archivos sin commit no se agregan.'}


def publish(s, payload):
    owner(s)
    with s.LOCK:
        current = snapshot(s, payload.get('include_update') is True)
        if payload.get('action') != 'publish': return current
        s.check_revision(payload)
        if payload.get('review') != current['review']:
            raise ValueError('Los archivos cambiaron. Volvé a revisar antes de publicar.')
        if payload.get('confirm') is not True: raise ValueError('Confirmá la publicación revisada')
        output = []
        paths = [p for p in current['scope'] if (s.PROJECT_ROOT / p).exists() or git(s, 'ls-files', '--', p).strip()]
        if paths:
            output.append(git(s, 'add', '--', *paths))
        if git(s, 'diff', '--cached', '--name-only').strip():
            try:
                output.append(git(s, 'commit', '-m', s.text(payload.get('message'), 200) or 'Actualizar RivFree desde Studio'))
            except ValueError:
                git(s, 'reset', '--', *paths)
                raise
        remote = git(s, 'config', '--get', 'branch.' + current['branch'] + '.remote').strip()
        destination = git(s, 'config', '--get', 'branch.' + current['branch'] + '.merge').strip()
        output.append(git(s, 'push', remote, 'HEAD:' + destination))
        return {'output': '\n'.join(output), 'published': True,
                'message': 'Push completado. GitHub Actions debe terminar para que la web muestre los cambios.'}


def backups(s, payload):
    owner(s)
    with s.LOCK:
        if payload.get('action') != 'restore':
            return {'backups': [{'id': p.name, 'files': sorted(x.name for x in p.glob('*.json'))}
                                for p in sorted(s.BACKUP_DIR.glob('*'), reverse=True) if p.is_dir() and not p.is_symlink()]}
        s.check_revision(payload)
        key = str(payload.get('id', ''))
        if not re.fullmatch(r'\d{8}-\d{6}-\d{6}', key): raise ValueError('Copia inválida')
        folder = s.BACKUP_DIR / key
        if folder.is_symlink() or not folder.is_dir(): raise ValueError('Copia no encontrada')
        paths = [s.PRODUCTS_PATH, s.STORES_PATH, s.SITE_CONFIG_PATH, s.HIGHLIGHTS_PATH]
        documents = []
        for target in paths:
            source = folder / target.name
            if source.is_symlink(): raise ValueError('Copia inválida')
            if not source.exists(): continue
            try: value = json.loads(source.read_text(encoding='utf-8'))
            except (ValueError, OSError): raise ValueError('Copia dañada: ' + target.name)
            if not isinstance(value, dict): raise ValueError('Copia inválida: ' + target.name)
            field = {s.PRODUCTS_PATH: ('productos', list), s.STORES_PATH: ('tiendas', dict),
                     s.SITE_CONFIG_PATH: ('branding', dict), s.HIGHLIGHTS_PATH: ('hero', list)}[target]
            if not isinstance(value.get(field[0]), field[1]): raise ValueError('Formato inválido: ' + target.name)
            documents.append((target, value))
        if not documents: raise ValueError('Copia vacía')
        s.backup_current()
        for target, value in documents: s.atomic_write_json(target, value)
        return s.state_payload()


def references(value):
    if isinstance(value, dict):
        return set().union(*(references(v) for v in value.values())) if value else set()
    if isinstance(value, list):
        return set().union(*(references(v) for v in value)) if value else set()
    if isinstance(value, str) and value.startswith('assets/manual/'):
        return {value.split('?')[0].split('#')[0]}
    return set()


def orphans(s, payload):
    owner(s)
    with s.LOCK:
        s.check_revision(payload)
        used = set()
        # Keep images required by saved backups and legacy campaigns too.
        paths = list(s.DATA_DIR.glob('*.json')) + list(s.BACKUP_DIR.glob('*/*.json'))
        for path in paths:
            try: used |= references(json.loads(path.read_text(encoding='utf-8')))
            except (ValueError, OSError): raise ValueError('No se pudo revisar ' + path.name + '; no se eliminaron imágenes')
        used |= {p[:-5] + '-thumb.webp' for p in list(used) if p.endswith('.webp') and not p.endswith('-thumb.webp')}
        files = [p for p in s.ASSET_DIR.rglob('*') if p.is_file() and not p.is_symlink()
                 and p.resolve().is_relative_to(s.ASSET_DIR.resolve())
                 and p.relative_to(s.PROJECT_ROOT).as_posix() not in used]
        candidates = {p.relative_to(s.PROJECT_ROOT).as_posix(): p for p in files}
        if payload.get('action') == 'delete':
            requested = payload.get('paths', [])
            if not isinstance(requested, list) or not all(p in candidates for p in requested):
                raise ValueError('La selección cambió o contiene imágenes usadas. Volvé a buscar.')
            for key in requested: candidates[key].unlink()
            return {'deleted': len(requested)}
        return {'files': [{'path': key, 'bytes': p.stat().st_size} for key, p in sorted(candidates.items())]}
