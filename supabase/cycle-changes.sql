-- =====================================================================
-- הגדרת חודש: שינוי יום תחילת החודש בלי להשפיע אחורה, עם היסטוריה.
-- מריצים את כל הקובץ פעם אחת ב-Supabase: SQL Editor > New query > הדבקה > Run
-- אפשר להריץ שוב בלי לפגוע בנתונים.
-- =====================================================================

-- ---------- היסטוריית השינויים ----------
-- effective_month: החודש הראשון שמסתיים לפי ההגדרה החדשה (היום הראשון של אותו חודש).
create table if not exists public.cycle_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  effective_month date not null check (extract(day from effective_month) = 1),
  old_start_day int not null check (old_start_day between 1 and 28),
  new_start_day int not null check (new_start_day between 1 and 28),
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now(),
  notice_pending boolean not null default false,
  unique (user_id, effective_month)
);

-- אין גישה ישירה לטבלה. קוראים וכותבים רק דרך הפונקציות שלמטה.
alter table public.cycle_changes enable row level security;

-- ---------- פונקציות פנימיות ----------
-- היום שבו החודש מתחיל, לפי ההגדרה שתקפה לחודש מסוים
create or replace function public.cycle_day_for(target uuid, label date) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select new_start_day from cycle_changes
      where user_id = target and effective_month <= label
      order by effective_month desc limit 1),
    (select old_start_day from cycle_changes
      where user_id = target
      order by effective_month limit 1),
    (select cycle_start_day from profiles where id = target)
  )
$$;

-- היום האחרון של החודש שנקרא על שם label
create or replace function public.cycle_last_day(target uuid, label date) returns date
language plpgsql stable security definer set search_path = public as $$
declare
  d int := public.cycle_day_for(target, label);
begin
  if d = 1 then
    return (label + interval '1 month' - interval '1 day')::date;
  end if;
  return label + (d - 2);
end $$;

-- ---------- שינוי ההגדרה: המשתמש לעצמו, או מנהל לכל משתמש ----------
-- החודש הנוכחי תמיד נשאר כמו שהוא: השינוי מתחיל מהחודש הבא.
-- שינוי נוסף לפני שההגדרה נכנסה לתוקף מחליף את הקודם, ולא יוצר חודש מעבר נוסף.
create or replace function public.set_cycle_start_day(new_day int, target_user uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  target uuid := coalesce(target_user, me);
  today date := (now() at time zone 'Asia/Jerusalem')::date;
  this_month date := date_trunc('month', today)::date;
  current_label date;
  effective date;
  in_force int;
begin
  if me is null then
    raise exception 'צריך להתחבר מחדש.';
  end if;
  if new_day is null or new_day not between 1 and 28 then
    raise exception 'יום תחילת החודש לא תקין.';
  end if;
  if target <> me and not exists (select 1 from profiles where id = me and is_admin and not disabled) then
    raise exception 'הפעולה הזאת מותרת רק למנהל.';
  end if;

  -- מונע שני שינויים במקביל לאותו משתמש
  perform 1 from profiles where id = target for update;
  if not found then
    raise exception 'המשתמש לא נמצא.';
  end if;

  current_label := case
    when today <= public.cycle_last_day(target, this_month) then this_month
    else (this_month + interval '1 month')::date
  end;
  effective := (current_label + interval '1 month')::date;

  -- חייב לקרות לפני המחיקה: בלי שורות, הפונקציה חוזרת להגדרה שבפרופיל, שכבר עשויה להיות החדשה
  in_force := public.cycle_day_for(target, current_label);
  delete from cycle_changes where user_id = target and effective_month >= effective;

  if new_day <> in_force then
    insert into cycle_changes (user_id, effective_month, old_start_day, new_start_day, changed_by, notice_pending)
    values (target, effective, in_force, new_day, me, target <> me);
  end if;

  update profiles set cycle_start_day = new_day where id = target;
end $$;

-- ---------- קריאת ההיסטוריה: של עצמך, או של כל משתמש למנהל ----------
create or replace function public.get_cycle_history(target_user uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  target uuid := coalesce(target_user, me);
begin
  if me is null then
    raise exception 'צריך להתחבר מחדש.';
  end if;
  if target <> me and not exists (select 1 from profiles where id = me and is_admin and not disabled) then
    raise exception 'הפעולה הזאת מותרת רק למנהל.';
  end if;

  return jsonb_build_object(
    'since', (select (created_at at time zone 'Asia/Jerusalem')::date from profiles where id = target),
    'changes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'effective_month', effective_month,
        'old_start_day', old_start_day,
        'new_start_day', new_start_day,
        'changed_at', changed_at,
        'notice_pending', notice_pending
      ) order by effective_month)
      from cycle_changes where user_id = target
    ), '[]'::jsonb)
  );
end $$;

-- ---------- אישור שהמשתמש ראה הודעה על שינוי שהמנהל עשה ----------
create or replace function public.ack_cycle_notices() returns void
language sql security definer set search_path = public as $$
  update cycle_changes set notice_pending = false
  where user_id = auth.uid() and notice_pending
$$;

-- ---------- הרשאות הרצה ----------
revoke all on function public.cycle_day_for(uuid, date) from public, anon, authenticated;
revoke all on function public.cycle_last_day(uuid, date) from public, anon, authenticated;
revoke all on function public.set_cycle_start_day(int, uuid) from public, anon;
revoke all on function public.get_cycle_history(uuid) from public, anon;
revoke all on function public.ack_cycle_notices() from public, anon;
grant execute on function public.set_cycle_start_day(int, uuid) to authenticated;
grant execute on function public.get_cycle_history(uuid) to authenticated;
grant execute on function public.ack_cycle_notices() to authenticated;
