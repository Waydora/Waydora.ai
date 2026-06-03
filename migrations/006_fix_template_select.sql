-- 006_fix_template_select.sql
-- ============================================================================
-- FIX di un bug introdotto dalla migrazione 004.
--
-- PROBLEMA:
--   La policy RESTRICTIVE `saved_trips_no_modify_template` (004) era definita
--   FOR ALL. "ALL" include anche la SELECT. La sua condizione:
--       using (is_template = false OR auth.uid() IS NOT DISTINCT FROM user_id)
--   su una riga template (is_template=true, user_id=NULL):
--     - utente ANONIMO  → auth.uid()=NULL → NULL IS NOT DISTINCT FROM NULL = TRUE → legge
--     - utente LOGGATO  → auth.uid()=<uuid> → <uuid> IS NOT DISTINCT FROM NULL = FALSE
--                         e is_template=false = FALSE → (FALSE OR FALSE) = FALSE → BLOCCATO
--   Risultato: gli utenti autenticati NON riuscivano a leggere i template.
--   Sintomo: GET .../saved_trips?...single → 0 righe → PostgREST 406 →
--            la pagina /trip mostra "Viaggio non trovato".
--
-- SOLUZIONE:
--   La restrittiva deve limitare SOLO le mutazioni (UPDATE/DELETE), non la
--   lettura. Si sostituisce la singola policy FOR ALL con due policy
--   FOR UPDATE e FOR DELETE. Cosi':
--     - SELECT dei template torna governata SOLO dalla permissive
--       saved_trips_select_public_or_owner (003): is_public=true → tutti leggono.
--     - INSERT resta governata dalla 005 (guest fork, solo non-template).
--     - UPDATE/DELETE dei template restano BLOCCATE per chiunque non sia owner
--       (i template hanno user_id NULL → nessuno e' owner → intoccabili).
-- ============================================================================


-- Rimuove la policy FOR ALL difettosa.
drop policy if exists "saved_trips_no_modify_template" on public.saved_trips;

-- Restrittiva solo su UPDATE: i template non sono modificabili.
drop policy if exists "saved_trips_no_update_template" on public.saved_trips;
create policy "saved_trips_no_update_template"
  on public.saved_trips
  as restrictive
  for update
  using (is_template = false OR auth.uid() IS NOT DISTINCT FROM user_id);

-- Restrittiva solo su DELETE: i template non sono cancellabili.
drop policy if exists "saved_trips_no_delete_template" on public.saved_trips;
create policy "saved_trips_no_delete_template"
  on public.saved_trips
  as restrictive
  for delete
  using (is_template = false OR auth.uid() IS NOT DISTINCT FROM user_id);


-- ============================================================================
-- VERIFICA (SQL editor):
--
--   select policyname, cmd, permissive
--   from pg_policies
--   where schemaname='public' and tablename='saved_trips'
--   order by permissive desc, cmd;
--
--   Atteso (restrictive): saved_trips_no_update_template | UPDATE | RESTRICTIVE
--                         saved_trips_no_delete_template | DELETE | RESTRICTIVE
--   NON deve piu' esistere una restrictive FOR ALL su saved_trips.
--
-- TEST FUNZIONALE:
--   - Da LOGGATO, apri /trip/santorini → l'itinerario deve caricarsi (niente 406).
--   - Da loggato, prova a modificare un template via SQL anon/auth → bloccato.
-- ============================================================================
