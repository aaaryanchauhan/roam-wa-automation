-- Named folders for organizing leads. A lead is in at most one folder.
-- Applied to project dvfkktqonymradyybjqv on 2026-09-26.
create table public.wa_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  created_at timestamptz not null default now()
);

create index wa_folders_user_idx on public.wa_folders (user_id);

alter table public.wa_folders enable row level security;
create policy "own folders" on public.wa_folders for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.wa_folders from anon;

-- No foreign key on purpose: a device that was offline may still reference a folder deleted
-- elsewhere, and the app treats an unknown folder as "No folder" instead of failing to sync.
alter table public.wa_contacts add column folder_id uuid;
create index wa_contacts_folder_idx on public.wa_contacts (user_id, folder_id);
