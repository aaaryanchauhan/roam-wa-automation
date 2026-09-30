-- When the "Sent" counter on Quick Send was last reset; it counts messages marked sent after this.
-- Applied to project dvfkktqonymradyybjqv on 2026-09-26, and to roam-outreach (wcoqabveynbnyhbfcxwc) on 2026-09-30.
alter table public.wa_settings add column counter_reset_at timestamptz;
