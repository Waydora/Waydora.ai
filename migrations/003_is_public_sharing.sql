-- 003_is_public_sharing.sql
--
-- ============================================================================
-- BOZZA — applicare SOLO dopo revisione, MAI in automatico su prod.
-- Eseguire a mano dal Supabase SQL editor dopo aver letto i commenti.
-- ============================================================================
--
-- Scopo (TASK #22 — RLS hardening con modello is_public):
--   1) Rendere i saved_trips privati di default ed esporli in lettura pubblica
--      solo quando l'owner li condivide esplicitamente (is_public = true).
--   2) Chiudere le policy completamente aperte di trip_messages (SELECT true /
--      INSERT true) legandole alla pubblicazione del viaggio padre.
--   3) Aggiungere indici su user_id per le query owner-scoped piu' frequenti.
--
-- Tabella padre di trip_messages: public.saved_trips (collegamento via share_slug).
--   Verificato dal codice della webapp (artifacts/waydora/src/pages/trip.tsx):
--     - il viaggio viene caricato da saved_trips per share_slug;
--     - le UPDATE realtime dell'itinerario avvengono su saved_trips per share_slug;
--   quindi i messaggi/idee della chat sono ancorati al saved_trip omonimo.
--
-- NOTA SUI NOMI DELLE POLICY:
--   I nomi usati nei DROP sotto sono quelli reali comunicati dall'utente
--   ("Viaggio pubblico tramite slug" per saved_trips). Per trip_messages i nomi
--   reali non erano noti, quindi i DROP sono difensivi (drop if exists su piu'
--   varianti probabili). Prima di applicare, VERIFICARE i nomi effettivi con:
--     select policyname, cmd, qual, with_check
--     from pg_policies
--     where schemaname = 'public' and tablename in ('saved_trips','trip_messages');
--   e adattare i DROP qui sotto ai nomi reali.
-- ============================================================================


-- ── 1) saved_trips: colonna is_public ──────────────────────────────────────
alter table public.saved_trips
  add column if not exists is_public boolean not null default false;


-- ── 2) saved_trips: SELECT pubblico solo se is_public, altrimenti solo owner ─
-- Rimuove la vecchia policy "SELECT using (true)" che esponeva TUTTE le righe
-- a chiunque con anon key.
drop policy if exists "Viaggio pubblico tramite slug" on public.saved_trips;

create policy "saved_trips_select_public_or_owner"
  on public.saved_trips
  for select
  using (
    is_public = true
    or auth.uid() = user_id
  );

-- La policy owner ALL (ALL using auth.uid() = user_id) NON va toccata: resta
-- in vigore e copre insert/update/delete del proprietario. NON la ricreiamo qui.


-- ── 3) trip_messages: accesso legato alla pubblicazione del saved_trip padre ─
-- Stato attuale: SELECT using (true) + INSERT with check (true) => lettura e
-- scrittura totalmente aperte. Le sostituiamo con policy che consentono accesso
-- SOLO se il viaggio padre (saved_trips.share_slug = trip_messages.share_slug)
-- e' pubblico, OPPURE l'utente loggato e' l'owner del viaggio padre.
--
-- Scelta progettuale (commentata):
--   - I GUEST (anon, non loggati) devono poter leggere E scrivere messaggi/idee
--     sui viaggi PUBBLICI: e' il flusso di collaborazione del link condiviso
--     (vedi TripChat / IdeasPanel in trip.tsx, che inseriscono trip_messages
--     anche senza utente loggato). Per questo la condizione principale e'
--     "il saved_trip padre e' pubblico".
--   - L'OWNER loggato puo' sempre leggere/scrivere sul proprio viaggio anche se
--     non e' (ancora) pubblico: utile per testare la chat prima di condividere.
--     Da qui l'OR auth.uid() = st.user_id.

-- DROP difensivo delle vecchie policy aperte (adattare ai nomi reali!).
drop policy if exists "trip_messages_select_all"  on public.trip_messages;
drop policy if exists "trip_messages_insert_all"  on public.trip_messages;
drop policy if exists "Enable read access for all users"   on public.trip_messages;
drop policy if exists "Enable insert for all users"        on public.trip_messages;
drop policy if exists "Lettura pubblica"  on public.trip_messages;
drop policy if exists "Scrittura pubblica" on public.trip_messages;

create policy "trip_messages_select_public_or_owner"
  on public.trip_messages
  for select
  using (
    exists (
      select 1
      from public.saved_trips st
      where st.share_slug = trip_messages.share_slug
        and (st.is_public = true or auth.uid() = st.user_id)
    )
  );

create policy "trip_messages_insert_public_or_owner"
  on public.trip_messages
  for insert
  with check (
    exists (
      select 1
      from public.saved_trips st
      where st.share_slug = trip_messages.share_slug
        and (st.is_public = true or auth.uid() = st.user_id)
    )
  );

-- NOTA: IdeasPanel (trip.tsx) elimina anche righe trip_messages (DELETE) per le
-- idee. Con RLS attiva e SENZA una policy DELETE, nessuno potra' piu' cancellare
-- idee dal client. Non e' nello scope di questa task aggiungere una policy DELETE,
-- ma SE si vuole mantenere la cancellazione lato guest sul viaggio pubblico,
-- aggiungere una policy analoga:
--   create policy "trip_messages_delete_public_or_owner"
--     on public.trip_messages for delete
--     using (exists (select 1 from public.saved_trips st
--                    where st.share_slug = trip_messages.share_slug
--                      and (st.is_public = true or auth.uid() = st.user_id)));
-- (decisione rimandata all'utente — vedi sezione RISCHI nel report della task)


-- ── 4) Indici performance su user_id (query owner-scoped) ───────────────────
-- Mancanti secondo lo stato live del DB. UNIQUE/index su share_slug esistono gia'.
create index if not exists idx_chat_sessions_user_id on public.chat_sessions (user_id);
create index if not exists idx_saved_trips_user_id   on public.saved_trips   (user_id);
create index if not exists idx_user_trips_user_id    on public.user_trips    (user_id);
create index if not exists idx_trips_user_id         on public.trips         (user_id);
create index if not exists idx_trip_ideas_user_id    on public.trip_ideas    (user_id);


-- ============================================================================
-- EFFETTO DOPO L'APPLICAZIONE:
--   - I saved_trips diventano PRIVATI di default (is_public = false).
--   - I link /trip/<slug> ESISTENTI smetteranno di funzionare per i guest finche'
--     is_public non viene impostato a true dal nuovo pulsante "Condividi" in webapp.
--   - La chat/idee di un viaggio sono accessibili solo se il viaggio e' pubblico
--     (o all'owner loggato).
--
-- PER RIATTIVARE I LINK ESISTENTI IN PRE-LANCIO (decisione dell'utente):
--   update public.saved_trips set is_public = true where share_slug is not null;
-- ============================================================================
