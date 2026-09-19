importScripts('matching.js','catalog.js','catalog-cache.js');
self.onmessage=async()=>{try{self.postMessage(await loadCatalogLocally());}catch(e){self.postMessage({error:e.message});}};
