create table if not exists public.life_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  version bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.life_accounts enable row level security;
revoke all on table public.life_accounts from anon, authenticated;
grant select, insert, update, delete on table public.life_accounts to authenticated;

create policy "life_accounts_select_own" on public.life_accounts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "life_accounts_insert_own" on public.life_accounts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "life_accounts_update_own" on public.life_accounts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "life_accounts_delete_own" on public.life_accounts for delete to authenticated
  using ((select auth.uid()) = user_id);
