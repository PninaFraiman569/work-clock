-- =====================================================================
-- שעון עבודה: מבנה מסד הנתונים
-- מריצים את כל הקובץ פעם אחת ב-Supabase: SQL Editor > New query > הדבקה > Run
-- =====================================================================

-- ---------- פרופיל משתמש ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null default '',
  is_admin boolean not null default false,
  cycle_start_day int not null default 27 check (cycle_start_day between 1 and 28),
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- מקטעי עבודה ----------
create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz,                       -- ריק = השעון רץ עכשיו
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_range check (end_at is null or end_at > start_at)
);

create index if not exists work_sessions_user_start on public.work_sessions (user_id, start_at);
-- לכל משתמש לכל היותר שעון פעיל אחד
create unique index if not exists one_running_per_user on public.work_sessions (user_id) where end_at is null;

-- ---------- הערה יומית ----------
create table if not exists public.day_notes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ---------- עדכון אוטומטי של updated_at ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists work_sessions_touch on public.work_sessions;
create trigger work_sessions_touch before update on public.work_sessions
  for each row execute function public.touch_updated_at();

drop trigger if exists day_notes_touch on public.day_notes;
create trigger day_notes_touch before update on public.day_notes
  for each row execute function public.touch_updated_at();

-- ---------- יצירת פרופיל אוטומטית לכל משתמש חדש ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name, cycle_start_day)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    coalesce((new.raw_user_meta_data ->> 'cycle_start_day')::int, 27)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- הרשאות: כל משתמש רואה ועורך רק את הנתונים שלו ----------
alter table public.profiles enable row level security;
alter table public.work_sessions enable row level security;
alter table public.day_notes enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
-- אין הרשאת עדכון לפרופיל: רק פונקציית הניהול (בהרשאת שרת) משנה אותו

drop policy if exists "own sessions" on public.work_sessions;
create policy "own sessions" on public.work_sessions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own notes" on public.day_notes;
create policy "own notes" on public.day_notes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- טבלת דופק קטנה שהמשימה האוטומטית ב-GitHub פונה אליה, כדי שהפרויקט לא יושהה
create table if not exists public.keepalive (id int primary key, pinged_at timestamptz not null default now());
insert into public.keepalive (id) values (1) on conflict do nothing;
alter table public.keepalive enable row level security;
drop policy if exists "anyone can read keepalive" on public.keepalive;
create policy "anyone can read keepalive" on public.keepalive for select to anon, authenticated using (true);
