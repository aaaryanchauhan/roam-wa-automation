-- Roam WhatsApp outreach console. Every row belongs to the signed-in user (RLS).
-- Applied to project dvfkktqonymradyybjqv on 2026-09-26.

create table public.wa_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  category text not null default '',
  body text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.wa_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  phone text not null check (phone ~ '^[0-9]{8,15}$'),
  name text not null default '',
  property_name text not null default '',
  country text not null default '',
  city text not null default '',
  property_type text not null default '',
  website text not null default '',
  instagram text not null default '',
  email text not null default '',
  notes text not null default '',
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_opened_at timestamptz,
  last_sent_at timestamptz,
  follow_up_due date,
  follow_up_template_id uuid,
  follow_up_created_at timestamptz,
  unique (user_id, phone)
);

create table public.wa_outreach (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id uuid,
  phone text not null,
  contact_name text not null default '',
  property_name text not null default '',
  template_id uuid,
  template_name text not null default '',
  message text not null default '',
  status text not null default 'opened' check (status in ('opened', 'sent')),
  opened_at timestamptz not null default now(),
  sent_at timestamptz,
  is_follow_up boolean not null default false
);

create table public.wa_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  default_country_code text not null default '',
  open_mode text not null default 'auto' check (open_mode in ('auto', 'web', 'app', 'wa')),
  last_template_id uuid,
  updated_at timestamptz not null default now()
);

create index wa_templates_user_idx on public.wa_templates (user_id);
create index wa_contacts_user_idx on public.wa_contacts (user_id);
create index wa_contacts_follow_up_idx on public.wa_contacts (user_id, follow_up_due) where follow_up_due is not null;
create index wa_outreach_user_opened_idx on public.wa_outreach (user_id, opened_at desc);
create index wa_outreach_contact_idx on public.wa_outreach (contact_id);

alter table public.wa_templates enable row level security;
alter table public.wa_contacts enable row level security;
alter table public.wa_outreach enable row level security;
alter table public.wa_settings enable row level security;

create policy "own templates" on public.wa_templates for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own contacts" on public.wa_contacts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own outreach" on public.wa_outreach for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own settings" on public.wa_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Signed-out visitors get nothing.
revoke all on public.wa_templates, public.wa_contacts, public.wa_outreach, public.wa_settings from anon;
