-- Phase 2: reservations get a manual "customer notified" marker instead of
-- automated SMS/Messenger (owner instruction — no notification automation
-- in Phase 2; staff call/message the customer themselves and just log it).
alter table reservations add column notified_at timestamptz;
