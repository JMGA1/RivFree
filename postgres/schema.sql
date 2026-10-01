-- RivFree · PostgreSQL
-- Studio y GitHub ejecutan este archivo solos antes de cada copia: no hace falta pegarlo a mano.
-- Se puede ejecutar varias veces y no borra datos. Todo queda en el esquema "rivfree",
-- separado de cualquier otra tabla que ya tengas en tu base.

create schema if not exists rivfree;

-- Tiendas (data/stores.json + los cambios hechos en Studio)
create table if not exists rivfree.stores (
  id          text primary key,
  name        text not null,
  profile     jsonb not null default '{}'::jsonb,
  hide_photos boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- Ofertas: un producto publicado por una tienda. Las que desaparecen del catálogo quedan con active = false.
create table if not exists rivfree.offers (
  id            text primary key,
  store_id      text not null references rivfree.stores (id) on delete cascade,
  url           text not null,
  name          text not null,
  category      text,
  brand         text,
  price_usd     numeric(12, 2) check (price_usd is null or price_usd >= 0),
  old_price_usd numeric(12, 2) check (old_price_usd is null or old_price_usd >= 0),
  on_sale       boolean not null default false,
  image         text,
  manual        boolean not null default false,
  first_seen    timestamptz,
  last_seen     timestamptz not null default now(),
  active        boolean not null default true,
  removed_at    timestamptz,
  unique (store_id, url)
);
create index if not exists offers_store_active_idx on rivfree.offers (store_id) where active;
create index if not exists offers_category_idx on rivfree.offers (category) where active;
create index if not exists offers_name_idx on rivfree.offers (lower(name));

-- Historial: una fila solo cuando cambia el precio, la oferta o aparece un producto nuevo.
create table if not exists rivfree.price_changes (
  id            bigserial primary key,
  offer_id      text not null references rivfree.offers (id) on delete cascade,
  changed_at    timestamptz not null default now(),
  price_usd     numeric(12, 2),
  old_price_usd numeric(12, 2),
  on_sale       boolean not null default false
);
create index if not exists price_changes_offer_idx on rivfree.price_changes (offer_id, changed_at desc);

-- Registro de cada copia (Studio o GitHub)
create table if not exists rivfree.sync_runs (
  id              bigserial primary key,
  started_at      timestamptz not null,
  finished_at     timestamptz not null default now(),
  source          text not null,
  catalog_updated text,
  stores          integer not null default 0,
  offers          integer not null default 0,
  new_offers      integer not null default 0,
  price_changes   integer not null default 0,
  removed         integer not null default 0
);

-- Consultas listas para usar
create or replace view rivfree.current_offers as
  select o.id, s.name as store, o.name, o.category, o.brand, o.price_usd, o.old_price_usd, o.on_sale,
         o.url, o.image, o.first_seen, o.last_seen
  from rivfree.offers o join rivfree.stores s on s.id = o.store_id
  where o.active;

create or replace view rivfree.price_drops as
  select o.store_id as store, o.name, o.url, c.changed_at, prev.price_usd as previous_price, c.price_usd as price,
         round(100 * (1 - c.price_usd / prev.price_usd)) as drop_percent
  from rivfree.price_changes c
  join lateral (
    select p.price_usd from rivfree.price_changes p
    where p.offer_id = c.offer_id and p.id < c.id
    order by p.id desc limit 1
  ) prev on true
  join rivfree.offers o on o.id = c.offer_id
  where prev.price_usd > 0 and c.price_usd < prev.price_usd;
