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
    ...Array.from({length:4},(_,i)=>({nombre:'Perfume de prueba '+i,tienda:'DFA',categoria:'perfumes',precio_usd:300+i,url:'https://example.com/discovery-'+i})),
    {nombre:'Chocolate Lindt 300g',tienda:'DFA',categoria:'alimentos',precio_usd:200,precio_original_usd:250,en_oferta:true,url:'https://example.com/sale'},
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
          if(String(url).startsWith('https://api.frankfurter.dev/'))return {ok:true,json:async()=>({base:'USD',quote:'BRL',rate:5.1,date:new Date().toISOString().slice(0,10)})};
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

    // Directory includes every registered shop even when products are filtered.
    await w.openStoreDirectory();
    const storeData=JSON.parse(fs.readFileSync(path.join(root,'data/stores.json'),'utf8'));
    assert.equal(d.querySelector('#storeDirectoryDialog').open,true);
    assert.equal(d.querySelectorAll('.directory-store').length,Object.keys(storeData).length);
    for(const [name,info] of Object.entries(storeData))assert.ok(d.querySelector('#storeDirectoryList').textContent.includes(info.nombre_completo||name));
    assert.ok(d.querySelector('#storeDirectoryList').textContent.includes('Horário não informado'));
    assert.ok(d.querySelector('#storeDirectoryList a[href^="https://www.google.com/maps/"]'));
    d.querySelector('#closeStoreDirectory').click();
    assert.equal(d.querySelector('#storeDirectoryDialog').open,false);
    assert.equal(d.querySelector('#search').value,'JBL','directory preserves search');

    // Favoritos.
    const favoriteButton = d.querySelector('#grid [data-action="favorite"]');

    assert.ok(favoriteButton, 'Favorite button exists');

    favoriteButton.click();

    const favoritesOnly = d.querySelector('#favoritesOnly');

    assert.ok(favoritesOnly, 'Favorites filter exists');

    favoritesOnly.checked = true;
    favoritesOnly.dispatchEvent(new w.Event('change'));

    assert.equal(d.querySelectorAll('#grid .card').length, 1);
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
      d.querySelector('#grid .card-price').textContent.includes('R$'),
      'BRL conversion renders'
    );

    // Quantities, estimates, persistence and portable import.
    openShoppingList.click();
    const quantity=d.querySelector('#shoppingList input[type=number]');
    quantity.value='5';quantity.dispatchEvent(new w.Event('change'));
    assert.equal(d.querySelector('#listCount').textContent,'5');
    assert.match(d.querySelector('.shopping-total').textContent,/400/);
    assert.match(d.querySelector('.shopping-total').textContent,/2.080/);
    assert.equal(JSON.parse(w.localStorage.getItem('rivfree-quantities'))[0][1],5);
    const edited=d.querySelector('#shoppingList input[type=number]');
    edited.value='0';edited.dispatchEvent(new w.Event('change'));
    assert.equal(edited.value,'5','zero rejected');
    edited.value='1.5';edited.dispatchEvent(new w.Event('change'));
    assert.equal(edited.value,'5','fraction rejected');
    const shareURL=w.shoppingURL();
    const payload=JSON.parse(decodeURIComponent(new URL(shareURL).hash.slice(6)));
    assert.equal(payload.items[0][1],5);
    assert.equal(new URL(shareURL).search,'','filters excluded from shared URL');
    const originalKey=payload.items[0][0];
    w.toggleFavorite(originalKey);
    assert.equal(d.querySelector('#listCount').textContent,'0');
    w.location.hash=new URL(shareURL).hash;w.inspectSharedList();
    d.querySelector('#importShoppingList').click();
    assert.equal(d.querySelector('#listCount').textContent,'5','shared copy restores list in an empty destination');
    assert.equal(d.querySelector('#shoppingList input[type=number]').value,'5');
    closeShoppingList.click();
    w.location.hash='list='+encodeURIComponent(JSON.stringify({v:1,items:[[originalKey,7],['unknown-product',2]]}));
    w.inspectSharedList();
    assert.equal(d.querySelector('#importBanner').hidden,false);
    d.querySelector('#importShoppingList').click();
    assert.equal(d.querySelector('#listCount').textContent,'9');
    assert.match(d.querySelector('.shopping-total').textContent,/560/);
    assert.match(d.querySelector('.shopping-note').textContent,/2 unidades sem preço/);
    assert.equal(w.location.hash,'');
    const saved=w.localStorage.getItem('rivfree-favorites');
    w.location.hash='list='+encodeURIComponent(JSON.stringify({v:1,items:[[originalKey,-1]]}));
    w.inspectSharedList();
    assert.equal(w.localStorage.getItem('rivfree-favorites'),saved,'invalid share preserves list');
    w.location.hash='';
    d.querySelector('#automaticExchange').click();
    await w.refreshAutomaticExchange();
    assert.equal(exchangeRate.value,'5.1','manual rate reset to live rate');
    assert.match(d.querySelector('#exchangeNote').textContent,/Frankfurter/);
    closeShoppingList.click();

    // Marketplace: carousel navigation, category CTA, offers and honest rankings.
    await w.initStorefront();
    assert.equal(d.querySelector('#heroCampaign').hidden,false);
    assert.equal(d.querySelectorAll('#heroCampaign .campaign-dot').length,5);
    assert.equal(d.querySelector('#middleCampaign'),null,'secondary campaign carousel removed');
    assert.equal(d.querySelectorAll('#discoverGrid .card').length,5,'all unique fixture products available for discovery');
    const discoveryNames=[...d.querySelectorAll('#discoverGrid .card-name')].map(n=>n.textContent).sort();
    d.querySelector('#shuffleDiscover').click();
    assert.equal(new Set([...d.querySelectorAll('#discoverGrid .card-name')].map(n=>n.textContent)).size,5,'shuffle produces five distinct products');
    const stableDiscovery=[...d.querySelectorAll('#discoverGrid .card-name')].map(n=>n.textContent);w.render();assert.deepEqual([...d.querySelectorAll('#discoverGrid .card-name')].map(n=>n.textContent),stableDiscovery,'ordinary renders preserve random selection');
    const firstCampaign=d.querySelector('#heroCampaign h2').textContent;
    d.querySelector('#heroCampaign .next').click();
    assert.notEqual(d.querySelector('#heroCampaign h2').textContent,firstCampaign);
    d.querySelector('#heroCampaign .previous').click();
    assert.equal(d.querySelector('#heroCampaign h2').textContent,firstCampaign);
    d.querySelector('#heroCampaign .next').click();
    w.selectCampaignCategory('electronica');
    assert.equal(d.querySelector('#categoria').value,'electronica');
    assert.equal(d.querySelector('#favoritesOnly').checked,false);
    d.querySelector('#clearFilters').click();
    assert.equal(d.querySelector('#orden').value,'ofertas');
    assert.match(d.querySelector('#grid .card .card-name').textContent,/Lindt/,'sale before cheaper regular product');
    d.querySelector('#orden').value='precio_asc';w.render();
    assert.match(d.querySelector('#grid .card .card-name').textContent,/JBL/,'explicit price sorting respected');
    assert.equal(d.querySelector('#popularGrid').dataset.source,'none','no fabricated popularity');
    d.querySelector('#grid [data-action="compare"]').click();
    w.renderPopularProducts();
    assert.equal(d.querySelector('#popularGrid').dataset.source,'local');
    assert.match(d.querySelector('#popularNote').textContent,/navegador/);
    assert.equal(d.querySelector('#discoverProducts').hidden,false,'discovery survives consultation');
    assert.equal(d.querySelectorAll('#discoverGrid .card').length,5);
    const consultation=JSON.parse(w.localStorage.getItem('rivfree-consultations'));
    assert.equal(consultation[0][1].count,1);
    w.recordProductConsult(consultation[0][0]);
    assert.equal(JSON.parse(w.localStorage.getItem('rivfree-consultations'))[0][1].count,1,'duplicate click deduplicated');
    d.querySelector('#dialogClose').click();
    d.querySelector('#navOffers').click();
    assert.equal(d.querySelectorAll('#grid .card').length,1);
    assert.match(d.querySelector('#grid .card .card-name').textContent,/Lindt/);
    d.querySelector('#clearFilters').click();

    // Autoplay advances only visible, unpaused carousels and honors reduced motion.
    const hero=d.querySelector('#heroCampaign');
    hero.getBoundingClientRect=()=>({top:0,bottom:300});
    d.activeElement?.blur();
    w.advanceCarousels(100000);const beforeAuto=hero.querySelector('h2').textContent;
    w.advanceCarousels(107000);assert.notEqual(hero.querySelector('h2').textContent,beforeAuto);
    hero.querySelector('.campaign-pause').click();d.activeElement?.blur();
    const pausedTitle=hero.querySelector('h2').textContent;
    w.advanceCarousels(114000);assert.equal(hero.querySelector('h2').textContent,pausedTitle);
    assert.equal(hero.querySelector('.campaign-pause').getAttribute('aria-pressed'),'true');
    hero.querySelector('.campaign-pause').click();d.activeElement?.blur();
    w.matchMedia=()=>({matches:true});w.advanceCarousels(130000);
    assert.equal(hero.querySelector('h2').textContent,pausedTitle,'reduced motion disables automatic movement');
    w.matchMedia=()=>({matches:false});
    const realFetch=w.fetch;
    w.fetch=async(url,options)=>{
      if(String(url)==='data/popular.json')return {ok:true,json:async()=>({updatedAt:'2026-09-22',items:[{url:'https://example.com/sale',views:50}]})};
      if(String(url)==='data/campaigns.json')return {ok:true,json:async()=>({hero:[{id:'sponsor',title:'Sponsor test',sponsored:true,image:'https://example.com/banner.jpg',layout:'banner',href:'https://example.com/campaign'}],middle:[]})};
      return realFetch(url,options);
    };
    await w.initStorefront();
    assert.equal(d.querySelector('#popularGrid').dataset.source,'global');
    assert.match(d.querySelector('#popularGrid .card-name').textContent,/Lindt/);
    assert.equal(d.querySelector('#heroCampaign').dataset.layout,'banner');
    assert.match(d.querySelector('#heroCampaign .campaign-label').textContent,/Publicidade/);
    assert.ok(d.querySelector('#heroCampaign a').rel.includes('sponsored'));
    assert.equal(d.querySelector('#heroCampaign .next'),null,'single banner has no useless arrows');
    assert.equal(d.querySelector('#middleCampaign'),null);
    assert.equal(w.campaignURL('javascript:alert(1)'),null);
    w.fetch=realFetch;

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

    await w.refreshAutomaticExchange();
    assert.equal(exchangeRate.value,'5.1','offline keeps saved automatic rate');
    assert.match(d.querySelector('#exchangeNote').textContent,/taxa salva/);
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
