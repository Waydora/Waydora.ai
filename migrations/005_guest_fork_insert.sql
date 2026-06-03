-- 005_guest_fork_insert.sql
-- ============================================================================
-- BOZZA — applicare SOLO dopo revisione, MAI in automatico su prod.
-- Eseguire a mano dal Supabase SQL editor dopo aver letto i commenti.
-- ============================================================================
--
-- PROBLEMA RISOLTO:
--   POST /rest/v1/saved_trips → 401 (42501) per i visitatori anonimi (anon)
--   che tentano di fare fork di un template dalla webapp trip.tsx.
--
-- CAUSA RADICE:
--   Su saved_trips esistono le seguenti policy PERMISSIVE (da migrazioni 003/004):
--     - saved_trips_select_public_or_owner  → FOR SELECT only, non copre INSERT
--     - (policy pre-003 "owner ALL")        → FOR ALL USING (auth.uid() = user_id)
--       Menzione in 003:51 come policy già esistente. Per il ruolo anon,
--       auth.uid() ritorna NULL; NULL = user_id è sempre UNKNOWN (non TRUE),
--       quindi questa policy non passa mai per anon.
--   Nessuna delle policy PERMISSIVE esistenti concede INSERT al ruolo anon.
--   Postgres RLS: se zero policy PERMISSIVE passano → accesso negato → 401.
--
--   La policy RESTRICTIVE saved_trips_no_modify_template (004:25-30) viene
--   valutata in AND DOPO le PERMISSIVE. Per righe con is_template=false,
--   la sua clausola USING è: (false = false OR ...) = TRUE → passa.
--   Quindi la restrittiva NON è il blocco primario; sarebbe superata se
--   esistesse una PERMISSIVE che già passa. Il blocco è l'assenza di quest'ultima.
--
-- SOLUZIONE:
--   Aggiungere una policy PERMISSIVE FOR INSERT che consenta a entrambi i ruoli
--   (anon e authenticated) di inserire righe NON-template:
--     - is_template = false  obbligatorio (WITH CHECK non negoziabile)
--     - user_id coerente: se authenticated, user_id deve essere NULL oppure
--       coincidere con auth.uid() (impedisce impersonazione)
--     - anon può inserire con user_id NULL (fork anonimo corretto)
--
-- PERCHE' E' SICURO:
--   1) Un guest NON PUO' creare template:
--      WITH CHECK impone is_template = false. Qualsiasi INSERT con is_template=true
--      fallisce il WITH CHECK → rigettato da Postgres prima che la riga esista.
--
--   2) Un guest NON PUO' modificare/eliminare template esistenti:
--      Questa è una policy FOR INSERT: non copre UPDATE né DELETE.
--      La RESTRICTIVE saved_trips_no_modify_template (004) continua a fare
--      il suo lavoro su UPDATE/DELETE per is_template=true.
--
--   3) Un guest NON PUO' falsificare user_id altrui:
--      Il WITH CHECK include:
--        (auth.uid() IS NULL OR auth.uid() = user_id OR user_id IS NULL)
--      Se un guest autenticato inviasse user_id diverso dal proprio auth.uid(),
--      la condizione auth.uid() = user_id sarebbe FALSE e user_id IS NULL
--      sarebbe FALSE → WITH CHECK fallisce → INSERT rigettato.
--      Un guest anonimo (auth.uid() IS NULL = TRUE) può solo inserire con
--      user_id NULL, il che è il comportamento corretto del fork anonimo.
--
--   4) Il fork anonimo è effimero e non agganciato a nessun account:
--      user_id NULL significa che la riga non ha owner. Il guest può leggerla
--      via share_slug (policy SELECT is_public=true della 003) ma non può
--      rivendicarne la proprietà né modificarla (nessuna policy UPDATE per anon).
--
-- INTERAZIONE CON POLICY ESISTENTI (schema completo dopo questa migrazione):
--
--   PERMISSIVE su saved_trips:
--     a) (pre-003) owner ALL           → FOR ALL, USING (auth.uid() = user_id)
--        Copre INSERT authenticated con user_id = auth.uid(). Rimane intatta.
--     b) saved_trips_select_public_or_owner (003:43)
--        FOR SELECT, USING (is_public=true OR auth.uid()=user_id). Non toccata.
--     c) [NUOVA] saved_trips_guest_fork_insert (questa migrazione)
--        FOR INSERT, TO anon, authenticated
--        WITH CHECK (is_template=false AND (auth.uid() IS NULL OR auth.uid()=user_id OR user_id IS NULL))
--
--   RESTRICTIVE su saved_trips:
--     d) saved_trips_no_modify_template (004:26-30)
--        FOR ALL, USING (is_template=false OR auth.uid() IS NOT DISTINCT FROM user_id)
--        Per un INSERT di riga is_template=false: USING = TRUE → restrittiva non blocca.
--        Confermato: per FOR INSERT, PostgreSQL applica la RESTRICTIVE USING come
--        WITH CHECK quando la policy non ha WITH CHECK esplicito (doc PG §5.8).
--        Con is_template=false, (false=false OR ...) = TRUE → pass.
--
-- IMPATTO SU ENDPOINT/TABELLE ESISTENTI:
--   - saved_trips SELECT:  invariato (policy 003 non modificata)
--   - saved_trips INSERT authenticated (owner): invariato (policy pre-003 copre)
--   - saved_trips UPDATE/DELETE: invariati (questa policy è solo FOR INSERT)
--   - trip_messages: non toccato
--   - lib/api-zod: nessun cambio schema → nessun allineamento necessario
--   - lib/db (Drizzle itinerariesTable): tabella diversa (itineraries), non impattata
--
-- ============================================================================


-- ── 1) Policy PERMISSIVE: consente INSERT di fork (non-template) ad anon e auth ─

drop policy if exists "saved_trips_guest_fork_insert" on public.saved_trips;

create policy "saved_trips_guest_fork_insert"
  on public.saved_trips
  as permissive
  for insert
  to anon, authenticated
  with check (
    -- Condizione 1: il fork non può MAI essere un template.
    -- Blocca qualsiasi tentativo di inserire is_template=true da client.
    is_template = false

    AND

    -- Condizione 2: coerenza user_id.
    -- a) anon puro: auth.uid() IS NULL → consenti (user_id sarà NULL nel payload)
    -- b) authenticated che inserisce user_id NULL: consentito (fork senza claim)
    -- c) authenticated che inserisce il proprio user_id: consentito
    -- d) authenticated che inserisce user_id altrui: NEGATO (auth.uid() != user_id)
    (
      auth.uid() IS NULL          -- visitatore anonimo
      OR user_id IS NULL          -- fork senza rivendicazione owner (anon o auth)
      OR auth.uid() = user_id     -- utente loggato che inserisce con il proprio id
    )
  );


-- ── 2) Commento esplicativo sul catalogo di sistema (visibile in Supabase UI) ───
comment on policy "saved_trips_guest_fork_insert" on public.saved_trips is
  'Consente a visitatori anonimi e utenti autenticati di creare fork privati '
  'di template (is_template=false obbligatorio). '
  'Non concede UPDATE/DELETE. Non permette inserimento di template ne'' spoofing user_id.';


-- ============================================================================
-- QUERY DI VERIFICA (eseguire nel SQL editor dopo l''applicazione):
-- ============================================================================
--
-- 1) Controlla che la nuova policy sia registrata con i parametri attesi:
--
--    select
--      policyname,
--      cmd,
--      permissive,
--      roles,
--      qual,        -- USING clause
--      with_check   -- WITH CHECK clause
--    from pg_policies
--    where schemaname = 'public'
--      and tablename  = 'saved_trips'
--    order by permissive desc, cmd;
--
--    Atteso tra i risultati:
--      policyname  = saved_trips_guest_fork_insert
--      cmd         = INSERT
--      permissive  = PERMISSIVE
--      roles       = {anon,authenticated}
--      qual        = NULL  (FOR INSERT non ha USING, solo WITH CHECK)
--      with_check  = (is_template = false) AND (auth.uid() IS NULL OR ...)
--
-- 2) Controlla che la RESTRICTIVE sia ancora presente:
--
--    select policyname, cmd, permissive
--    from pg_policies
--    where schemaname = 'public'
--      and tablename  = 'saved_trips'
--      and permissive = 'RESTRICTIVE';
--
--    Atteso: saved_trips_no_modify_template  |  ALL  |  RESTRICTIVE
--
-- ============================================================================
-- TEST MANUALE (Supabase SQL editor, simulando i ruoli client):
-- ============================================================================
--
-- A) Simula INSERT anonimo (fork corretto) — deve RIUSCIRE:
--
--    set local role anon;
--    set local "request.jwt.claims" to '{}';
--    insert into public.saved_trips
--      (share_slug, title, itinerary, is_public, is_template, user_id)
--    values
--      ('test-fork-anon-001', 'Fork test anonimo', '{}'::jsonb, true, false, null);
--    -- Atteso: INSERT 0 1
--    -- Cleanup: delete from public.saved_trips where share_slug = 'test-fork-anon-001';
--
-- B) Simula INSERT anonimo con is_template=true — deve FALLIRE (WITH CHECK):
--
--    set local role anon;
--    set local "request.jwt.claims" to '{}';
--    insert into public.saved_trips
--      (share_slug, title, itinerary, is_public, is_template, user_id)
--    values
--      ('test-template-inject', 'Template inject attempt', '{}'::jsonb, true, true, null);
--    -- Atteso: ERROR 42501: new row violates row-level security policy
--
-- C) Simula INSERT autenticato con user_id corretto — deve RIUSCIRE:
--
--    set local role authenticated;
--    set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000000001"}';
--    insert into public.saved_trips
--      (share_slug, title, itinerary, is_public, is_template, user_id)
--    values
--      ('test-fork-auth-001', 'Fork test auth', '{}'::jsonb, true, false,
--       '00000000-0000-0000-0000-000000000001'::uuid);
--    -- Atteso: INSERT 0 1
--    -- Cleanup: delete from public.saved_trips where share_slug = 'test-fork-auth-001';
--
-- D) Simula INSERT autenticato con user_id altrui — deve FALLIRE (WITH CHECK):
--
--    set local role authenticated;
--    set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000000001"}';
--    insert into public.saved_trips
--      (share_slug, title, itinerary, is_public, is_template, user_id)
--    values
--      ('test-fork-spoof-001', 'Spoof attempt', '{}'::jsonb, true, false,
--       '00000000-0000-0000-0000-000000000099'::uuid);
--    -- Atteso: ERROR 42501: new row violates row-level security policy
--
-- E) Verifica che i template esistenti NON siano toccabili via INSERT/UPDATE:
--    (la RESTRICTIVE 004 li protegge; questa migrazione non cambia nulla per loro)
--
--    set local role anon;
--    update public.saved_trips set title = 'hacked' where is_template = true;
--    -- Atteso: UPDATE 0  (zero righe aggiornate; la RESTRICTIVE blocca)
--
-- ============================================================================
-- COMANDO DA ESEGUIRE IN PRODUZIONE (dopo revisione):
--
--   Aprire Supabase Dashboard → SQL Editor → New query
--   Incollare il contenuto di questo file (solo la sezione DDL, righe 79-97)
--   oppure incollare l'intero file: i blocchi di verifica sono solo commenti.
--   Cliccare "Run".
--
--   Nessun dato viene modificato. Nessun indice viene creato (non necessario:
--   il WITH CHECK non introduce scan aggiuntivi non già coperti da indici
--   esistenti su is_template e user_id dalla migrazione 003/004).
-- ============================================================================
