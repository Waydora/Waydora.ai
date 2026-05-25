-- 001_telegram_bindings.sql
-- Tabella di binding 1:1 fra account Telegram e account Supabase Waydora.
-- Eseguire da Supabase SQL editor (una tantum).

create table if not exists public.telegram_bindings (
  telegram_user_id  bigint primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  telegram_username text,
  language_code     text,
  -- Tier cache per gate paid (sincronizzato all'atto del bind; fonte di verita' restera'
  -- altrove quando arrivera' il sistema subscriptions). Valori: 'free' | 'paid'.
  tier              text not null default 'free',
  created_at        timestamptz not null default now(),
  last_seen_at      timestamptz
);

-- Un account Supabase puo' essere bindato ad un solo Telegram (e viceversa).
create unique index if not exists telegram_bindings_user_id_uniq
  on public.telegram_bindings(user_id);

-- RLS: nessuna policy. Accesso solo via service-role (bot server-side).
alter table public.telegram_bindings enable row level security;

-- Realtime: il bot ascolta i cambi su user_trips e trip_messages.
-- Se non gia' presenti, aggiungere queste tabelle alla publication:
--   alter publication supabase_realtime add table public.user_trips;
--   alter publication supabase_realtime add table public.trip_messages;
