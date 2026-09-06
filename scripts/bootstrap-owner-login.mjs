#!/usr/bin/env node
// One-time setup: creates Supabase Auth accounts for the owner and manager
// seeded in supabase/seed/seed.sql, and links them via employees.auth_user_id
// so they can sign in with email + password (spec 3: "Email/password for
// owner/manager roles"). Run this once after `supabase db push` + seeding.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/bootstrap-owner-login.mjs
//
// Or just fill in .env.local and run: node -r dotenv/config scripts/bootstrap-owner-login.mjs dotenv_config_path=.env.local

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const ACCOUNTS = [
  {
    employeeId: "00000000-0000-0000-0001-000000000001",
    name: "Alimah dela Cruz (owner)",
    email: "owner@alimah.local",
    password: "ChangeMe123!",
  },
  {
    employeeId: "00000000-0000-0000-0001-000000000002",
    name: "Marites Santos (manager)",
    email: "manager@alimah.local",
    password: "ChangeMe123!",
  },
];

for (const acct of ACCOUNTS) {
  const { data, error } = await admin.auth.admin.createUser({
    email: acct.email,
    password: acct.password,
    email_confirm: true,
  });

  if (error) {
    console.error(`✗ ${acct.name}: ${error.message}`);
    continue;
  }

  const { error: linkError } = await admin
    .from("employees")
    .update({ auth_user_id: data.user.id, email: acct.email })
    .eq("id", acct.employeeId);

  if (linkError) {
    console.error(`✗ Linked auth user but failed to update employee row for ${acct.name}: ${linkError.message}`);
    continue;
  }

  console.log(`✓ ${acct.name}: log in with ${acct.email} / ${acct.password} (change this password after first login)`);
}
