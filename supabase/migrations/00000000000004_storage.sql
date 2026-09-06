-- Storage bucket for reservation and GCash/bank-transfer payment proof
-- screenshots (spec 4.1 & 4.5). Public read so staff-facing pages can just
-- link to the public URL; all uploads go through the service-role client in
-- server actions, so no public write policy is needed.
insert into storage.buckets (id, name, public)
values ('payment-screenshots', 'payment-screenshots', true)
on conflict (id) do nothing;
