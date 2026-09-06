"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEmployee, updateEmployee } from "./actions";
import type { EmployeeRow } from "@/lib/domain-types";
import type { StaffRole } from "@/lib/auth/session";

const ROLES: StaffRole[] = ["owner", "manager", "cashier", "kitchen", "server", "encoder"];
const PIN_ROLES: StaffRole[] = ["cashier", "kitchen", "server", "encoder"];

export function DirectoryTab({
  employees,
  canSeePayRate,
}: {
  employees: EmployeeRow[];
  canSeePayRate: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-neutral-800">Employees</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium"
        >
          + Add Employee
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500 border-b border-neutral-100">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Hire Date</th>
              {canSeePayRate && <th className="px-4 py-3">Pay</th>}
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className={`border-b border-neutral-50 ${!e.is_active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-medium text-neutral-800">{e.full_name}</td>
                <td className="px-4 py-3 capitalize">{e.role}</td>
                <td className="px-4 py-3 text-neutral-500">{e.contact_number || e.email || "—"}</td>
                <td className="px-4 py-3 text-neutral-500">{e.hire_date || "—"}</td>
                {canSeePayRate && (
                  <td className="px-4 py-3">
                    ₱{e.pay_rate.toFixed(2)} <span className="text-neutral-400">/{e.pay_type}</span>
                  </td>
                )}
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      e.is_active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-500"
                    }`}
                  >
                    {e.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setEditing(e)} className="text-amber-700 text-xs font-medium underline">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && <AddEmployeeModal onClose={() => setShowAdd(false)} />}
      {editing && <EditEmployeeModal employee={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AddEmployeeModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<StaffRole>("cashier");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [payType, setPayType] = useState<"daily" | "hourly" | "monthly">("daily");
  const [payRate, setPayRate] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const needsPin = PIN_ROLES.includes(role);
  const needsAuth = role === "owner" || role === "manager";

  function submit() {
    startTransition(async () => {
      const res = await createEmployee({
        fullName,
        role,
        contactNumber: contactNumber || null,
        email: email || null,
        hireDate: hireDate || null,
        payType,
        payRate: Number(payRate) || 0,
        pin: needsPin ? pin : null,
      });
      if (res.error) setError(res.error);
      else if (res.temporaryPassword) {
        setTempPassword(res.temporaryPassword);
        router.refresh();
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  if (tempPassword) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm text-center">
          <h3 className="font-semibold text-neutral-800 mb-2">Account Created</h3>
          <p className="text-sm text-neutral-500 mb-3">
            Share this temporary password with {fullName}. They should change it after first login.
          </p>
          <p className="font-mono bg-neutral-100 rounded-lg px-3 py-2 mb-4">{tempPassword}</p>
          <button onClick={onClose} className="w-full rounded-xl bg-amber-600 text-white font-semibold py-3">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm my-8 space-y-2">
        <h3 className="font-semibold text-neutral-800 mb-2">Add Employee</h3>
        <input
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm capitalize"
        >
          {ROLES.map((r) => (
            <option key={r} value={r} className="capitalize">
              {r}
            </option>
          ))}
        </select>
        <input
          placeholder="Contact number"
          value={contactNumber}
          onChange={(e) => setContactNumber(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder={needsAuth ? "Email (required — used to log in)" : "Email (optional)"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={hireDate}
          onChange={(e) => setHireDate(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <select
            value={payType}
            onChange={(e) => setPayType(e.target.value as "daily" | "hourly" | "monthly")}
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="daily">Daily rate</option>
            <option value="hourly">Hourly rate</option>
            <option value="monthly">Monthly salary</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Pay rate (₱)"
            value={payRate}
            onChange={(e) => setPayRate(e.target.value)}
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        {needsPin && (
          <input
            placeholder="4-6 digit login PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button
            onClick={submit}
            disabled={isPending || !fullName.trim()}
            className="flex-1 rounded-xl bg-amber-600 text-white font-semibold py-3 disabled:opacity-40"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          <button onClick={onClose} className="px-4 text-sm text-neutral-500">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function EditEmployeeModal({ employee, onClose }: { employee: EmployeeRow; onClose: () => void }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(employee.full_name);
  const [contactNumber, setContactNumber] = useState(employee.contact_number ?? "");
  const [hireDate, setHireDate] = useState(employee.hire_date ?? "");
  const [payType, setPayType] = useState(employee.pay_type);
  const [payRate, setPayRate] = useState(employee.pay_rate.toString());
  const [isActive, setIsActive] = useState(employee.is_active);
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await updateEmployee(employee.id, {
        fullName,
        contactNumber: contactNumber || null,
        hireDate: hireDate || null,
        payType,
        payRate: Number(payRate) || 0,
        isActive,
        newPin: newPin || null,
      });
      if (res.error) setError(res.error);
      else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm my-8 space-y-2">
        <h3 className="font-semibold text-neutral-800 mb-2">
          Edit {employee.full_name} <span className="text-neutral-400 text-sm capitalize">({employee.role})</span>
        </h3>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Contact number"
          value={contactNumber}
          onChange={(e) => setContactNumber(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={hireDate}
          onChange={(e) => setHireDate(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <select
            value={payType}
            onChange={(e) => setPayType(e.target.value as "daily" | "hourly" | "monthly")}
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="daily">Daily rate</option>
            <option value="hourly">Hourly rate</option>
            <option value="monthly">Monthly salary</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            value={payRate}
            onChange={(e) => setPayRate(e.target.value)}
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        {PIN_ROLES.includes(employee.role as StaffRole) && (
          <input
            placeholder="Reset PIN (leave blank to keep current)"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        )}
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active employee
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button
            onClick={submit}
            disabled={isPending}
            className="flex-1 rounded-xl bg-amber-600 text-white font-semibold py-3 disabled:opacity-40"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          <button onClick={onClose} className="px-4 text-sm text-neutral-500">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
