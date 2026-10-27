-- Aprende+: uma empresa por projeto Supabase. Executar uma vez no SQL Editor.
begin;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 full_name text not null default '',
 role text not null default 'colaborador' check(role in ('colaborador','rh')),
 job_title text not null default '',department text not null default '',career_goal text not null default '',
 known_skills jsonb not null default '[]'::jsonb,
 weekly_minutes integer not null default 120 check(weekly_minutes between 15 and 240),
 created_at timestamptz not null default now()
);
create table if not exists public.learning_plans (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 goal text not null,plan jsonb not null,status text not null default 'active' check(status in ('active','paused','completed')),
 total_minutes integer not null check(total_minutes>=0),pending_minutes integer not null default 0 check(pending_minutes>=0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint aprende_completion_requires_no_pending check(status <> 'completed' or pending_minutes = 0)
);
create index if not exists learning_plans_user_created on public.learning_plans(user_id,created_at desc);
create or replace function public.aprende_create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,email,full_name,role) values(new.id,new.email,coalesce(left(new.raw_user_meta_data->>'full_name',120),''),'colaborador') on conflict(id) do nothing;
 return new;
end;$$;
drop trigger if exists aprende_profile_on_signup on auth.users;
create trigger aprende_profile_on_signup after insert on auth.users for each row execute procedure public.aprende_create_profile();
insert into public.profiles(id,email,full_name) select id,email,coalesce(left(raw_user_meta_data->>'full_name',120),'') from auth.users on conflict(id) do nothing;
create or replace function public.aprende_is_hr() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role='rh');
$$;
revoke all on function public.aprende_create_profile() from public,anon,authenticated;
revoke all on function public.aprende_is_hr() from public,anon,authenticated;
grant execute on function public.aprende_is_hr() to authenticated;
alter table public.profiles enable row level security;
alter table public.learning_plans enable row level security;
revoke all on table public.profiles,public.learning_plans from anon,authenticated;
grant select on public.profiles to authenticated;
grant update(full_name,job_title,department,career_goal,known_skills,weekly_minutes) on public.profiles to authenticated;
grant select,insert on public.learning_plans to authenticated;
grant update(status,updated_at) on public.learning_plans to authenticated;
drop policy if exists aprende_profiles_read on public.profiles;
create policy aprende_profiles_read on public.profiles for select to authenticated using(id=(select auth.uid()) or (select public.aprende_is_hr()));
drop policy if exists aprende_profiles_update on public.profiles;
create policy aprende_profiles_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
drop policy if exists aprende_plans_read on public.learning_plans;
create policy aprende_plans_read on public.learning_plans for select to authenticated using(user_id=(select auth.uid()) or (select public.aprende_is_hr()));
drop policy if exists aprende_plans_insert on public.learning_plans;
create policy aprende_plans_insert on public.learning_plans for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists aprende_plans_update on public.learning_plans;
create policy aprende_plans_update on public.learning_plans for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
commit;
-- Para dar acesso RH, depois de criar e confirmar a conta, executar como administrador:
-- update public.profiles set role='rh' where email='email-do-rh@empresa.pt';
-- Nunca conceder UPDATE(role) ou INSERT em profiles ao papel authenticated.
