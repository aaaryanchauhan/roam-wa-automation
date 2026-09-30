-- Opening WhatsApp now counts as sent; a message can instead be marked "not on WhatsApp".
-- Applied to roam-outreach (wcoqabveynbnyhbfcxwc) on 2026-09-30.
alter table public.wa_outreach drop constraint if exists wa_outreach_status_check;
alter table public.wa_outreach add constraint wa_outreach_status_check
  check (status in ('opened', 'sent', 'no_whatsapp'));

-- Leads whose number turned out not to be on WhatsApp.
alter table public.wa_contacts add column no_whatsapp boolean not null default false;
