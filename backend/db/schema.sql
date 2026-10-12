-- OpenCash on Monad, Neon schema

create table if not exists documents (
  collection text not null,
  id text not null,
  owner text,
  net text,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists documents_owner on documents (collection, owner);

create table if not exists server_bots (
  id text primary key,
  owner text not null,
  net text not null,
  enabled boolean not null default false,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists server_bots_owner on server_bots (owner, net);

create table if not exists live_bots (
  id text primary key,
  owner text not null,
  net text not null,
  enabled boolean not null default false,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists live_bots_owner on live_bots (owner, net);

create table if not exists bot_keys (
  owner_net text primary key,
  api_key text not null,
  iv text not null,
  tag text not null,
  sealed text not null,
  saved_at timestamptz not null default now()
);

create table if not exists ledger_events (
  seq bigserial primary key,
  net text not null,
  kind text not null,
  account_id bigint not null,
  block bigint,
  data jsonb not null
);
create index if not exists ledger_events_net on ledger_events (net, block);

create table if not exists ledger_cursor (
  net text primary key,
  last_block bigint not null,
  synced_at timestamptz not null default now()
);

create table if not exists kv_cache (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz not null
);
