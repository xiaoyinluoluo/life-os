create table public.life_records (
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('profile','goal','project','task','review','note','message','decision','setting')),
 id text not null check (length(id) between 1 and 200),
 data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 1048576),
 version bigint not null default 1,
 updated_at timestamptz not null default now(),
 deleted_at timestamptz,
 primary key(user_id,kind,id)
);
alter table public.life_records enable row level security;
revoke all on public.life_records from anon, authenticated;
grant select,insert,update on public.life_records to authenticated;
create policy life_records_own on public.life_records for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create index life_records_changes on public.life_records(user_id,updated_at,kind,id);
create function public.life_record_version() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if new.user_id <> old.user_id or new.kind <> old.kind or new.id <> old.id then raise exception 'identity cannot change'; end if;
  if new.version <> old.version then raise exception 'version conflict' using errcode='40001'; end if;
  new.version := old.version+1;
 else new.version := 1;
 end if;
 new.updated_at := clock_timestamp();
 return new;
end; $$;
create trigger life_record_version before insert or update on public.life_records for each row execute function public.life_record_version();
revoke all on function public.life_record_version() from public;
