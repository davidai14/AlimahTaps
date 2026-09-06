-- Phase 2 sample data: reservations, waitlist, and a few attendance records
-- so the new Reservations, Waitlist, Attendance, and Payroll screens have
-- something to show immediately. Run this once, AFTER seed.sql — it's
-- separate from seed.sql (rather than appended to it) so re-running it
-- doesn't collide with orders/employees you already seeded on a live
-- project via a duplicate-key error.
--
-- Safe to run more than once: every insert here is guarded with
-- on conflict do nothing against the literal ids used below.

begin;

-- ----------------------------------------------------------------------------
-- Reservations
-- ----------------------------------------------------------------------------
insert into reservations (
  id, store_id, customer_name, contact_number, party_size, reservation_date,
  reservation_time, status, table_id, down_payment_amount, payment_reference,
  notes
) values
  (
    '00000000-0000-0000-000b-000000000001', '00000000-0000-0000-0000-000000000001',
    'Marivic Santos', '09181112222', 6, current_date + 2, '19:00', 'pending',
    null, 300, 'GC-2026090601122',
    'Birthday celebration, requested a quiet corner'
  ),
  (
    '00000000-0000-0000-000b-000000000002', '00000000-0000-0000-0000-000000000001',
    'Ramon Cruz', '09221234567', 4, current_date + 1, '12:30', 'confirmed',
    '00000000-0000-0000-0006-000000000004', null, null, null
  ),
  (
    '00000000-0000-0000-000b-000000000003', '00000000-0000-0000-0000-000000000001',
    'Precious Aquino', '09331234567', 2, current_date - 1, '18:00', 'completed',
    '00000000-0000-0000-0006-000000000002', null, null, null
  )
on conflict (id) do nothing;

update reservations
  set verified_by = '00000000-0000-0000-0001-000000000003', verified_at = now()
  where id = '00000000-0000-0000-000b-000000000002' and verified_at is null;

-- ----------------------------------------------------------------------------
-- Walk-in waitlist
-- ----------------------------------------------------------------------------
insert into waitlist (id, store_id, customer_name, contact_number, party_size, status, queue_position, estimated_wait_minutes)
values
  ('00000000-0000-0000-000c-000000000001', '00000000-0000-0000-0000-000000000001', 'Bench Reyes', '09441234567', 3, 'waiting', 1, 15),
  ('00000000-0000-0000-000c-000000000002', '00000000-0000-0000-0000-000000000001', 'Grace Manalo', null, 2, 'waiting', 2, 25)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Attendance — a few completed shifts this week for hourly/daily staff so
-- payroll generation has real hours to compute against.
-- ----------------------------------------------------------------------------
insert into attendance (id, store_id, employee_id, clock_in, clock_out)
values
  (
    '00000000-0000-0000-000d-000000000001', '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0001-000000000003',
    (current_date - 1) + time '08:02', (current_date - 1) + time '17:05'
  ),
  (
    '00000000-0000-0000-000d-000000000002', '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0001-000000000003',
    current_date + time '08:10', current_date + time '17:00'
  ),
  (
    '00000000-0000-0000-000d-000000000003', '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0001-000000000005',
    (current_date - 1) + time '07:00', (current_date - 1) + time '16:00'
  )
on conflict (id) do nothing;

commit;
