"""Owner-only maintenance. Fixed Git commands; no shell or remote supplied by clients."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

PUBLISH_PATHS = ['data/manual-products.json', 'data/manual-stores.json', 'data/site-config.json', 'data/highlights.json', 'assets/manual',
                 'data/product-corrections.json']

UPDATE_PATHS = ['tests/test_studio_editor.py', 'scrapers/requirements.txt', 'security-reports', 'catalog.js', '.github/dependabot.yml', '.github/scraper-alerts.cjs', 'tools/ci_data.py', 'tools/build_public_site.py', 'requirements.in', 'requirements-security.in', 'requirements-security.txt', 'tests/test_security.py', 'tests/security.test.cjs', 'SEGURIDAD-2026-09-28.md', 'catalog-worker.js', 'tests/cache.test.cjs', 'tests/test_history_partitions.py', 'RENDIMIENTO-2026-09-27.md', 'site-config.js', 'app.js', 'features.js', 'shopping.js', 'storefront.js', 'index.html', 'styles.css', 'sw.js', 'catalog-cache.js', 'scrapers/catalog_metrics.py', 'scrapers/update_exchange.py', 'tests/test_catalog_metrics.py', 'tests/test_exchange.py', 'tests/visitor-improvements.test.cjs', 'tests/search-filter.test.cjs', 'tests/studio-preview.test.cjs', 'MEJORAS-VISITANTES-2026-09-27.md', 'tools/manual_editor', 'tools/scraper_health_alerts.py',
                '.github/workflows/scrape.yml', 'scrapers/publish_data.py',
                'requirements.txt', '.gitignore', 'tests/test_studio_writes.py',
                'tests/studio-maintenance.test.cjs', 'tests/test_collaboration_editor.py',
                'Instalar-dependencias-Studio.bat', 'Instalar-dependencias-Studio.sh',
                'STUDIO-MEJORAS-2026-09-27.md']

UPDATE_PATHS += ['experience.js', 'experience.css', 'explore.js', 'explore.css',
                 'explore-model.js', 'product-content.js', 'search-api-config.js',
                 'data/stores.json', 'privacy.html', 'tests/studio-v3.test.cjs',
                 'tests/test_studio_v3.py', 'CAMBIOS-STUDIO-V3.md']

UPDATE_PATHS += ['scrapers/barao_scraper.py', 'scrapers/mantra_scraper.py',
                 'scrapers/neutral_scraper.py', 'scrapers/sineriz_scraper.py',
                 'scrapers/yurys_scraper.py', 'scrapers/utils.py',
                 'tests/test_studio_v81.py', 'tests/v81-improvements.test.cjs',
                 'tests/test_v84_audit.py', 'tests/v84-loading.test.cjs',
                  'CAMBIOS-V84.md', 'CAMBIOS-V841.md', 'tests/category-menu-loading.test.cjs']


def redact(value):
    value = re.sub(r'://[^/@\s]+@', '://***@', str(value))
    value = re.sub(r'(?i)([?&](?:token|access_token|key|password)=)[^&\s]+', r'\1***', value)
    return value


def redact_value(value):
    if isinstance(value, str): return redact(value)
    if isinstance(value, dict): return {k: redact_value(v) for k,v in value.items()}
    if isinstance(value, list): return [redact_value(v) for v in value]
    return value


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
        path = s.guarded_path(s.PROJECT_ROOT / relative)
        if path.is_symlink(): raise ValueError('No se publican enlaces simbólicos')
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
            'note': 'Se agregan los archivos del alcance indicado y se publican TODOS los commits locales pendientes de esta rama. Antes de subir se traen los cambios nuevos de GitHub (por ejemplo, los precios del robot). Los otros archivos sin commit no se agregan.'}


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
        # GitHub usually has newer price data from the daily robot: bring it in first (a merge,
        # so nothing already published is rewritten) and only then push.
        output.append(git(s, 'fetch', remote, destination))
        try:
            output.append(git(s, 'merge', '--no-edit', 'FETCH_HEAD'))
        except ValueError:
            try:
                git(s, 'merge', '--abort')
            except ValueError:
                pass
            raise ValueError('GitHub tiene cambios en los mismos archivos que editaste y no se pudieron combinar solos. '
                             'No se publicó nada y tu commit local se conserva. Resolvé el conflicto con Git (o GitHub Desktop) y volvé a publicar.')
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
        paths = [s.PRODUCTS_PATH, s.STORES_PATH, s.SITE_CONFIG_PATH, s.HIGHLIGHTS_PATH, s.corrections_path()]
        documents = []
        for target in paths:
            source = folder / target.name
            if source.is_symlink(): raise ValueError('Copia inválida')
            if not source.exists(): continue
            try: value = json.loads(source.read_text(encoding='utf-8'))
            except (ValueError, OSError): raise ValueError('Copia dañada: ' + target.name)
            if not isinstance(value, dict): raise ValueError('Copia inválida: ' + target.name)
            field = {s.PRODUCTS_PATH: ('productos', list), s.STORES_PATH: ('tiendas', dict),
                     s.SITE_CONFIG_PATH: ('branding', dict), s.HIGHLIGHTS_PATH: ('hero', list),
                     s.corrections_path(): ('correcciones', dict)}[target]
            if not isinstance(value.get(field[0]), field[1]): raise ValueError('Formato inválido: ' + target.name)
            if target == s.SITE_CONFIG_PATH: value = s.normalize_site_config(value)
            elif target == s.HIGHLIGHTS_PATH: value = {**value, 'hero': [s.normalize_campaign(c,i) for i,c in enumerate(value['hero'])]}
            elif target == s.STORES_PATH: value = {**value, 'tiendas': dict(s.normalize_import_store(k,v) for k,v in value['tiendas'].items())}
            elif target == s.PRODUCTS_PATH: value = {**value, 'productos': [s.normalize_product(p,p) for p in value['productos']]}
            elif target == s.corrections_path():
                allowed = set(s.CORRECTION_FIELDS) | {'actualizado'}
                if any(not isinstance(k, str) or '|' not in k or not isinstance(v, dict) or set(v) - allowed for k, v in value['correcciones'].items()):
                    raise ValueError('Copia inválida: ' + target.name)
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


# Editable public documents and measurement settings travel with an owner publication.
PUBLISH_PATHS += ['politicas', 'tracking-config.js', 'privacy-config.js']
UPDATE_PATHS += ['consent.js', 'consent.css', 'ui-updates.js', 'ui-updates.css', 'legal.js', 'cookies.html', 'terms.html', 'icons/flag-br.svg', 'icons/flag-uy.svg', 'CAMBIOS-V4.md', 'tools/build_seo.cjs', 'analytics.js', 'tests/privacy.test.cjs', 'tests/test_studio_v4.py']

# v5: store map (Leaflet), app icons, category index and discount tiers.
UPDATE_PATHS += ['category-index.js', 'store-directory.js', 'store-directory.css', 'leaflet.js', 'leaflet.css', 'LICENSE-leaflet.txt', 'icons/social', 'icons/ui', 'tests/v5-improvements.test.cjs', 'tests/test_studio_v5.py', 'CAMBIOS-V5.md', 'nav-bar.js', 'product-details.js', 'LICENSE-lucide.txt', 'icons/flag-ar.svg']
# v6: social networks, results bar, Mi lista with photos
UPDATE_PATHS += ['tests/v6-improvements.test.cjs', 'tests/test_studio_v6.py', 'CAMBIOS-V6.md']
# v6.1: store filter, hidden photos per store, optional PostgreSQL copy
UPDATE_PATHS += ['postgres', 'tools/postgres_sync.py', 'requirements-db.in', 'requirements-db.txt', 'POSTGRESQL-LEEME.md', 'tests/v61-improvements.test.cjs', 'tests/test_postgres.py', 'README.md']
# v7: phone layout (compact bar and side menu), 110% scale, SEO text above the footer
UPDATE_PATHS += ['mobile.css', 'mobile-shell.js', 'tests/v7-mobile.test.cjs', 'tests/seo.test.cjs', 'tests/seo-runtime.test.cjs', 'CAMBIOS-V7.md']
# v7.1: product page offers, light theme contrast
UPDATE_PATHS += ['tests/v71-product.test.cjs']
# v8: relevance search, store shortcuts, Mi lista, private notes, CSP on static pages, Studio publish/prices/hours
UPDATE_PATHS += ['privacy.css', 'database/serve.py', 'tests/test_database_local.py', 'tests/v8-improvements.test.cjs', 'tests/test_studio_v8.py', 'CAMBIOS-V8.md']
# v8.1: store photos (iPhone HEIC), corrections to store products (Studio → Catálogo)
UPDATE_PATHS += ['catalog-worker.js', 'catalog-cache.js', 'tests/test_studio_v81.py', 'tests/v81-improvements.test.cjs']
# v8.2: each store's photo on the product page, optional store logos, discount levels only in Ofertas
UPDATE_PATHS += ['tests/v82-improvements.test.cjs', 'tests/test_studio_v82.py']
# v8.3: today's dollar straight from Frankfurter in the browser, safer daily update
UPDATE_PATHS += ['tests/v83-exchange.test.cjs']
