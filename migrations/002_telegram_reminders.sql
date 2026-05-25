-- 002_telegram_reminders.sql
-- Reminder schedulati dal bot Telegram per attivita' dell'itinerario.

create table if not exists public.telegram_reminders (
  id                bigserial primary key,
  telegram_user_id  bigint not null,
  user_id           uuid not null references auth.users(id) on delete cascade,
  trip_id           uuid references public.user_trips(id) on delete cascade,
  fire_at           timestamptz not null,
  message           text not null,
  sent_at           timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists telegram_reminders_fire_idx
  on public.telegram_reminders(fire_at)
  where sent_at is null;

create index if not exists telegram_reminders_user_idx
  on public.telegram_reminders(telegram_user_id);

alter table public.telegram_reminders enable row level security;
-- Accesso solo via service-role
