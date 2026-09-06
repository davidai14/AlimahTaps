-- Phase 2: payroll (spec 4.6). Gross pay = rate × time worked, computed from
-- the `attendance` table (added in Phase 1) against each employee's pay_type.
-- Overtime pay and all statutory deductions (SSS/PhilHealth/Pag-IBIG/tax/cash
-- advance) are manually entered per payslip, per owner instruction — no
-- automatic overtime multiplier and no government-table computation.

create type payroll_period_status as enum ('open', 'finalized');

create table payroll_periods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status payroll_period_status not null default 'open',
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index payroll_periods_store_id_idx on payroll_periods(store_id);

create table payslips (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references payroll_periods(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete restrict,
  store_id uuid not null references stores(id) on delete cascade,

  -- Regular pay: computed from attendance for the period against pay_type
  -- (daily: 1 day's rate per day with a clock_in; hourly: rate × hours
  -- worked; monthly: rate as-is for the period). Recomputable, not locked
  -- in until the period is finalized.
  regular_hours numeric(10, 2) not null default 0,
  regular_pay numeric(12, 2) not null default 0,

  -- Manually entered — no automatic overtime multiplier (owner instruction).
  overtime_hours numeric(10, 2) not null default 0,
  overtime_pay numeric(12, 2) not null default 0,

  gross_pay numeric(12, 2) not null default 0,
  total_deductions numeric(12, 2) not null default 0,
  net_pay numeric(12, 2) not null default 0,

  notes text,
  generated_by uuid references employees(id) on delete set null,
  generated_at timestamptz not null default now(),

  unique (payroll_period_id, employee_id)
);

create index payslips_store_id_idx on payslips(store_id);
create index payslips_employee_id_idx on payslips(employee_id);

-- Statutory/other deduction line items, manually entered and editable per
-- spec 3 ("manually entered, editable fields per payslip, not
-- auto-computed from government tables").
create table payslip_deductions (
  id uuid primary key default gen_random_uuid(),
  payslip_id uuid not null references payslips(id) on delete cascade,
  label text not null, -- 'SSS', 'PhilHealth', 'Pag-IBIG', 'Withholding Tax', 'Cash Advance', etc.
  amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index payslip_deductions_payslip_id_idx on payslip_deductions(payslip_id);

alter table payroll_periods enable row level security;
alter table payslips enable row level security;
alter table payslip_deductions enable row level security;

create policy "authenticated read payroll_periods" on payroll_periods for select to authenticated using (true);
create policy "authenticated read payslips" on payslips for select to authenticated using (true);
create policy "authenticated read payslip_deductions" on payslip_deductions for select to authenticated using (true);

-- No write policies: as with every other table, writes go through the
-- service-role client in server actions (see migration 00000000000002_rls.sql).
