importScripts('matching.js?v=20260925-partitions1','catalog.js?v=20260925-partitions1','catalog-cache.js?v=20260925-partitions1');
self.onmessage=async()=>{try{self.postMessage(await loadCatalogLocally());}catch(e){self.postMessage({error:e.message});}};
