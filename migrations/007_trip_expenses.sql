-- 007_trip_expenses.sql
-- ============================================================================
-- BOZZA — applicare SOLO dopo revisione, MAI in automatico su prod.
-- Eseguire a mano dal Supabase SQL editor dopo aver letto i commenti.
-- ============================================================================
--
-- Scopo (FEATURE: sezione Spese):
--   1) Tabella public.trip_expenses per le spese REALI di un viaggio condiviso,
--      ancorata a saved_trips via share_slug (stesso modello di trip_messages).
--   2) RLS coerente con trip_messages (003): lettura/scrittura per chi può
--      accedere al viaggio padre (pubblico) o per l'owner loggato.
--   3) Bucket Storage 'receipts' (pubblico in lettura) per le foto degli
--      scontrini, con insert/delete consentiti su viaggi pubblici / all'owner.
--
-- NB: il BUDGET PIANIFICATO (spese "in programma") NON sta qui: vive dentro il
--     JSON dell'itinerario (saved_trips.itinerary.budgetPlan), così è già
--     condiviso col link e impostabile anche in fase di creazione (home).
--     Qui stanno solo le spese EFFETTIVE (kind='actual').
-- ============================================================================


-- ── 1) Tabella trip_expenses ────────────────────────────────────────────────
create table if not exists public.trip_expenses (
  id          uuid primary key default gen_random_uuid(),
  share_slug  text not null,
  author      text,                          -- chi ha pagato / inserito (nome libero, come trip_messages.author)
  user_id     uuid references auth.users (id) on delete set null,
  kind        text not null default 'actual' check (kind in ('actual')),  -- riservato per estensioni future
  category    text not null default 'other'
              check (category in ('food','transport','stay','activity','shopping','other')),
  title       text,
  amount      numeric(12,2) not null check (amount >= 0),
  currency    text not null default 'EUR',
  receipt_url text,                           -- URL pubblico foto scontrino (bucket 'receipts'), nullable
  spent_at    date,                           -- data della spesa (da scontrino o manuale), opzionale
  created_at  timestamptz not null default now()
);

create index if not exists idx_trip_expenses_slug on public.trip_expenses (share_slug);
create index if not exists idx_trip_expenses_user on public.trip_expenses (user_id);

alter table public.trip_expenses enable row level security;


-- ── 2) RLS: stesso modello di trip_messages (vedi 003) ──────────────────────
drop policy if exists "trip_expenses_select_public_or_owner" on public.trip_expenses;
create policy "trip_expenses_select_public_or_owner"
  on public.trip_expenses
  for select
  using (
    exists (
      select 1 from public.saved_trips st
      where st.share_slug = trip_expenses.share_slug
        and (st.is_public = true or auth.uid() = st.user_id)
    )
  );

drop policy if exists "trip_expenses_insert_public_or_owner" on public.trip_expenses;
create policy "trip_expenses_insert_public_or_owner"
  on public.trip_expenses
  for insert
  with check (
    exists (
      select 1 from public.saved_trips st
      where st.share_slug = trip_expenses.share_slug
        and (st.is_public = true or auth.uid() = st.user_id)
    )
  );

drop policy if exists "trip_expenses_delete_public_or_owner" on public.trip_expenses;
create policy "trip_expenses_delete_public_or_owner"
  on public.trip_expenses
  for delete
  using (
    exists (
      select 1 from public.saved_trips st
      where st.share_slug = trip_expenses.share_slug
        and (st.is_public = true or auth.uid() = st.user_id)
    )
  );

-- UPDATE: consentito a chi può accedere al viaggio (modifica importo/categoria).
drop policy if exists "trip_expenses_update_public_or_owner" on public.trip_expenses;
create policy "trip_expenses_update_public_or_owner"
  on public.trip_expenses
  for update
  using (
    exists (
      select 1 from public.saved_trips st
      where st.share_slug = trip_expenses.share_slug
        and (st.is_public = true or auth.uid() = st.user_id)
    )
  );


-- ── 3) Bucket Storage 'receipts' per le foto degli scontrini ────────────────
-- Pubblico in lettura (coerente con il modello "collaborativo via slug"): chi ha
-- il link può vedere gli scontrini. Le foto vanno salvate sotto path {share_slug}/...
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- SELECT (lettura) pubblica per il bucket receipts.
drop policy if exists "receipts_read_public" on storage.objects;
create policy "receipts_read_public"
  on storage.objects
  for select
  using (bucket_id = 'receipts');

-- INSERT (upload) consentito a anon + authenticated nel bucket receipts.
-- L'accesso al viaggio è già gated lato app dalla conoscenza dello share_slug.
drop policy if exists "receipts_insert_all" on storage.objects;
create policy "receipts_insert_all"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'receipts');

-- DELETE consentito (per rimuovere uno scontrino caricato per errore).
drop policy if exists "receipts_delete_all" on storage.objects;
create policy "receipts_delete_all"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'receipts');


-- ============================================================================
-- VERIFICA (dopo l'applicazione):
--   select policyname, cmd from pg_policies
--   where schemaname='public' and tablename='trip_expenses';
--   -- atteso: 4 policy (select/insert/update/delete)_public_or_owner
--
--   select id, public from storage.buckets where id='receipts';  -- atteso: receipts | true
-- ============================================================================
