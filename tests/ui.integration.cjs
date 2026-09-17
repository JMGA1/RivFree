// DOM integration test: no real browser, Worker or service worker emulation.
const { JSDOM, VirtualConsole } = require('jsdom');
const { indexedDB } = require('fake-indexeddb');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const root = path.resolve(__dirname, '..');

const fixture = {
  actualizado: '2026-09-17T00:00:00Z',
  resumen: [],
  productos: [
    {
      nombre: 'JBL Flip 6 Negro',
      tienda: 'DFA',
      categoria: 'electronica',
      precio_usd: 80,
      url: 'https://example.com/a'
    },
    {
      nombre: 'JBL Flip 6 Preto',
      tienda: "Yury's Free Shop",
      categoria: 'electronica',
      precio_usd: 90,
      url: 'https://example.com/b'
    }
  ]
};

(async () => {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/data/products.json')) {
      res.end(JSON.stringify(fixture));
      return;
    }

    if (req.url.startsWith('/data/meta.json')) {
      res.end(JSON.stringify({ version: 'fixture-v1' }));
      return;
    }

    const filename = path.join(
      root,
      decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    );

    if (!filename.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }

    fs.readFile(filename, (error, data) => {
      if (error) {
        res.writeHead(404).end();
      } else {
        res.end(data);
      }
    });
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  const base = `http://127.0.0.1:${server.address().port}/`;
  let dom;

  try {
    const errors = [];
    const calls = [];
    const vc = new VirtualConsole();

    vc.on('jsdomError', error => errors.push(error.message));
    vc.on('error', error => errors.push(String(error)));

    const html = fs
      .readFileSync(path.join(root, 'index.html'), 'utf8')
      .replace(/<link[^>]*fonts.googleapis[^>]*>/g, '');

    dom = new JSDOM(html, {
      url: base + '?q=JBL',
      resources: 'usable',
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      virtualConsole: vc,

      beforeParse(window) {
        window.AbortController = AbortController;
        window.indexedDB = indexedDB;

        window.matchMedia = () => ({
          matches: false
        });

        window.fetch = async (url, options) => {
          calls.push(String(url));
          return fetch(new URL(url, base), options);
        };

        window.HTMLDialogElement.prototype.showModal = function () {
          this.open = true;
        };

        window.HTMLDialogElement.prototype.close = function () {
          this.open = false;
        };
      }
    });

    const w = dom.window;
    const d = w.document;

    // Esperar hasta que el catálogo renderice.
    for (let i = 0; i < 200 && !d.querySelector('.card'); i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    assert.ok(d.querySelector('.card'), 'Catalog renders');
    assert.equal(d.querySelector('#search').value, 'JBL');

    // No deben existir logos de free shops en filtros ni tarjetas.
    assert.equal(
      d.querySelectorAll('.store-filter-chip img, .card-store img').length,
      0,
      'Store UI does not contain logos'
    );

    // La etiqueta de tienda no debe estar dentro de la acción del producto.
    const storeTag = d.querySelector('.card .card-store');

    assert.ok(storeTag, 'Store tag renders');

    assert.equal(
      Boolean(storeTag.closest('.product-target')),
      false,
      'Store tag is independent from product action'
    );

    // Click en la tienda: debe abrir solamente la información de la tienda.
    storeTag.click();

    const storeDialog = d.querySelector('#storeDialog');

    assert.ok(storeDialog, 'Store information dialog exists');

    assert.equal(
      storeDialog.open,
      true,
      'Store tag opens only store information'
    );

    // Botón correcto según index.html.
    const storeDialogClose = d.querySelector('#storeDialogClose');

    assert.ok(
      storeDialogClose,
      'Store dialog close button exists'
    );

    storeDialogClose.click();

    assert.equal(
      storeDialog.open,
      false,
      'Store dialog closes correctly'
    );

    // Favoritos.
    const favoriteButton = d.querySelector('[data-action="favorite"]');

    assert.ok(favoriteButton, 'Favorite button exists');

    favoriteButton.click();

    const favoritesOnly = d.querySelector('#favoritesOnly');

    assert.ok(favoritesOnly, 'Favorites filter exists');

    favoritesOnly.checked = true;
    favoritesOnly.dispatchEvent(new w.Event('change'));

    assert.equal(d.querySelectorAll('.card').length, 1);
    assert.ok(w.location.search.includes('favorites=1'));

    // Lista de compras.
    const openShoppingList = d.querySelector('#openShoppingList');

    assert.ok(openShoppingList, 'Shopping list button exists');

    openShoppingList.click();

    const shoppingList = d.querySelector('#shoppingList');

    assert.ok(shoppingList, 'Shopping list dialog exists');
    assert.ok(shoppingList.textContent.includes('Subtotal'));

    const closeShoppingList = d.querySelector('#closeShoppingList');

    assert.ok(
      closeShoppingList,
      'Shopping list close button exists'
    );

    closeShoppingList.click();

    // Conversión USD -> BRL.
    const exchangeRate = d.querySelector('#exchangeRate');

    assert.ok(exchangeRate, 'Exchange rate field exists');

    exchangeRate.value = '5.2';
    exchangeRate.dispatchEvent(new w.Event('change'));

    assert.ok(
      d.querySelector('.card-price').textContent.includes('R$'),
      'BRL conversion renders'
    );

    // IndexedDB: si la versión no cambió, no debe volver a descargar products.json.
    const productRequestsBefore = calls.filter(url =>
      url.includes('products.json')
    ).length;

    await w.loadData();

    assert.equal(
      calls.filter(url => url.includes('products.json')).length,
      productRequestsBefore
    );

    // Modo offline: debe seguir usando el catálogo guardado.
    w.fetch = async () => {
      throw Error('offline');
    };

    await w.loadData();

    assert.equal(
      d.querySelector('#connectionNote').hidden,
      false
    );

    assert.deepEqual(errors, []);

    console.log(
      'DOM: store tags, filters, favorites, shopping list, BRL, IndexedDB reuse and offline fallback passed.'
    );
  } finally {
    dom?.window.close();
    server.closeAllConnections();

    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
