/* Studio → Base de datos: optional PostgreSQL copy of the catalog (stores, offers, price history).
   The connection lives only on this computer (.rivfree-local); the public site never talks to the database. */
(() => {
  'use strict';
  const E = window.RivFreeEditor; if (!E) return;
  const $ = id => document.getElementById(id);
  if (!$('dbUrl')) return;
  const number = value => Number(value || 0).toLocaleString('es-UY');
  let busy = false, loaded = false;

  function setMessage(text, kind = '') { const box = $('dbMessage'); box.textContent = text; box.dataset.kind = kind; }
  function when(value) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString('es-UY', {dateStyle: 'medium', timeStyle: 'short'}) : ''; }

  function showState(state) {
    $('dbDriverWarning').hidden = state.driver !== false;
    $('dbBadge').textContent = state.configured ? 'Conectada' : 'Sin configurar';
    $('dbBadge').classList.toggle('good', !!state.configured);
    $('dbTabState').hidden = !state.configured;
    $('dbMasked').hidden = !state.configured;
    $('dbMasked').textContent = state.configured ? 'Guardada: ' + state.masked : '';
    $('dbForget').hidden = !state.configured;
    $('dbSync').disabled = !state.configured || state.driver === false;
    $('dbUrl').placeholder = state.configured ? 'Pegá otra dirección solo si querés cambiarla' : 'postgresql://usuario:contraseña@servidor/base?sslmode=require';
    if (state.stats) showStats(state.stats);
  }

  function showStats(stats) {
    const box = $('dbStats'); box.replaceChildren();
    const tiles = stats.ready
      ? [['Tiendas', number(stats.stores)], ['Ofertas activas', number(stats.active_offers)], ['Precios guardados', number(stats.price_changes)], ['Tamaño de la base', stats.size]]
      : [['Tablas', 'Se crean en la primera copia'], ['Tamaño de la base', stats.size]];
    for (const [label, value] of tiles) {
      const tile = document.createElement('div'); const strong = document.createElement('strong'); const small = document.createElement('small');
      strong.textContent = value; small.textContent = label; tile.append(strong, small); box.append(tile);
    }
    box.hidden = false;
    const last = stats.last_sync;
    $('dbLastSync').textContent = last ? `Última copia: ${when(last.finished_at)} · desde ${last.source === 'github' ? 'GitHub' : last.source === 'studio' ? 'Studio' : last.source} · ${number(last.new_offers)} nuevas, ${number(last.price_changes)} cambios de precio, ${number(last.removed)} retiradas.` : 'Todavía no se copió el catálogo.';
  }

  async function call(path, payload, button, working) {
    if (busy) return null;
    busy = true; const label = button?.textContent; if (button) { button.disabled = true; button.textContent = working; }
    try { return await E.api(path, payload); }
    catch (error) { setMessage('✗ ' + error.message, 'error'); return null; }
    finally { busy = false; if (button) { button.textContent = label; button.disabled = false; } }
  }

  async function refresh() {
    try { const state = await E.api('/api/manual/db-state', {}); showState(state); loaded = true; }
    catch (error) { setMessage('✗ ' + error.message, 'error'); }
  }

  $('dbShowUrl').addEventListener('click', () => {
    const show = $('dbUrl').type === 'password'; $('dbUrl').type = show ? 'text' : 'password';
    $('dbShowUrl').textContent = show ? 'Ocultar' : 'Mostrar'; $('dbShowUrl').setAttribute('aria-pressed', String(show));
  });
  $('dbSave').addEventListener('click', async () => {
    const url = $('dbUrl').value.trim();
    if (!url) { setMessage('Pegá la dirección de conexión de tu base.', 'error'); $('dbUrl').focus(); return; }
    setMessage('Conectando…');
    const result = await call('/api/manual/db-save', {url}, $('dbSave'), 'Conectando…');
    if (!result) return;
    $('dbUrl').value = ''; $('dbUrl').type = 'password'; $('dbShowUrl').textContent = 'Mostrar';
    showState(result);
    setMessage(`✓ Conexión correcta (PostgreSQL ${String(result.stats?.server_version || '').split(' ')[0]}). Quedó guardada en esta computadora.`, 'ok');
    E.notify('Base de datos conectada.');
  });
  $('dbTest').addEventListener('click', async () => {
    setMessage('Probando conexión…');
    const result = await call('/api/manual/db-test', {url: $('dbUrl').value.trim()}, $('dbTest'), 'Probando…');
    if (!result) return;
    showState(result);
    setMessage(`✓ Conexión correcta con «${result.stats.database}» (PostgreSQL ${String(result.stats.server_version).split(' ')[0]}).${$('dbUrl').value.trim() && !result.configured ? ' Tocá Guardar y probar para usarla.' : ''}`, 'ok');
  });
  $('dbSync').addEventListener('click', async () => {
    if (E.hasUnsaved?.()) { setMessage('Guardá o descartá los cambios del formulario antes de copiar.', 'error'); return; }
    setMessage('Copiando el catálogo… puede tardar hasta un minuto.');
    const result = await call('/api/manual/db-sync', {}, $('dbSync'), 'Copiando…');
    if (!result) return;
    showState(result);
    const s = result.summary;
    setMessage(`✓ Copia lista: ${number(s.offers)} ofertas de ${number(s.stores)} tiendas · ${number(s.new_offers)} nuevas · ${number(s.price_changes)} cambios de precio · ${number(s.removed)} retiradas.` + (s.removal_skipped ? ' Faltaban demasiadas ofertas en el catálogo, así que no se marcó ninguna como retirada.' : ''), 'ok');
    E.notify('Catálogo copiado a PostgreSQL.');
  });
  $('dbForget').addEventListener('click', async () => {
    if (!window.confirm('¿Olvidar la conexión en esta computadora? La base y sus datos no se borran.')) return;
    const result = await call('/api/manual/db-forget', {}, $('dbForget'), 'Olvidando…');
    if (!result) return;
    showState(result); $('dbStats').hidden = true; $('dbLastSync').textContent = '';
    setMessage('Conexión olvidada. Tus datos siguen en la base.', 'ok');
  });
  window.addEventListener('rivfree-tab-change', event => { if (event.detail?.tab === 'database' && !loaded) refresh(); });
  window.addEventListener('rivfree-editor-state', () => { if (!loaded && E.getState?.()?.mode === 'owner') refresh(); }, {once: true});
})();
