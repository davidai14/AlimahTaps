"use client";

import { useEffect, useState, useTransition } from "react";
import { getAttendanceForRangeAction, getShiftsForRangeAction, upsertManualAttendance } from "./actions";
import type { AttendanceRow, EmployeeRow, ShiftRow } from "@/lib/domain-types";

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LATE_GRACE_MINUTES = 15;

export function AttendanceTab({ employees }: { employees: EmployeeRow[] }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [editing, setEditing] = useState<{ employeeId: string; date: string; record: AttendanceRow | null } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  function load(start: Date) {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    startTransition(async () => {
      const [s, a] = await Promise.all([
        getShiftsForRangeAction(isoDate(start), isoDate(end)),
        getAttendanceForRangeAction(isoDate(start), isoDate(end)),
      ]);
      setShifts(s);
      setAttendance(a);
    });
  }

  useEffect(() => {
    load(weekStart);
  }, [weekStart]);

  function changeWeek(delta: number) {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta * 7);
    setWeekStart(next);
  }

  const activeEmployees = employees.filter((e) => e.is_active);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => changeWeek(-1)} className="px-3 py-2 rounded-lg bg-neutral-100">
          ← Prev
        </button>
        <span className="text-sm font-medium text-neutral-600">Week of {isoDate(weekStart)}</span>
        <button onClick={() => changeWeek(1)} className="px-3 py-2 rounded-lg bg-neutral-100">
          Next →
        </button>
        {isPending && <span className="text-xs text-neutral-400">Loading...</span>}
      </div>

      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 border-b border-neutral-100 sticky left-0 bg-white">Employee</th>
              {days.map((d, i) => (
                <th key={i} className="px-3 py-2 border-b border-neutral-100 text-center min-w-[130px]">
                  {DAY_LABELS[i]}
                  <br />
                  <span className="text-xs text-neutral-400">{isoDate(d).slice(5)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeEmployees.map((emp) => (
              <tr key={emp.id}>
                <td className="px-3 py-2 border-b border-neutral-50 font-medium text-neutral-800 sticky left-0 bg-white whitespace-nowrap">
                  {emp.full_name}
                </td>
                {days.map((d, i) => {
                  const dateStr = isoDate(d);
                  const isPast = dateStr < isoDate(new Date());
                  const shift = shifts.find((s) => s.employee_id === emp.id && s.shift_date === dateStr);
                  const record = attendance.find(
                    (a) => a.employee_id === emp.id && a.clock_in && a.clock_in.slice(0, 10) === dateStr
                  );

                  let badge: { label: string; className: string } | null = null;
                  if (record?.clock_in) {
                    if (shift) {
                      const [sh, sm] = shift.start_time.split(":").map(Number);
                      const shiftStart = new Date(d);
                      shiftStart.setHours(sh, sm, 0, 0);
                      const late =
                        new Date(record.clock_in).getTime() - shiftStart.getTime() > LATE_GRACE_MINUTES * 60000;
                      badge = late
                        ? { label: "Late", className: "bg-amber-100 text-amber-700" }
                        : { label: "On time", className: "bg-green-100 text-green-700" };
                    }
                  } else if (shift && isPast) {
                    badge = { label: "Absent", className: "bg-red-100 text-red-700" };
                  }

                  return (
                    <td key={i} className="px-2 py-2 border-b border-neutral-50 text-center align-top">
                      {shift && (
                        <p className="text-xs text-neutral-400 mb-1">
                          Sched {shift.start_time.slice(0, 5)}-{shift.end_time.slice(0, 5)}
                        </p>
                      )}
                      {record?.clock_in && (
                        <p className="text-xs text-neutral-700">
                          {timeOnly(record.clock_in)}
                          {record.clock_out ? ` - ${timeOnly(record.clock_out)}` : " (open)"}
                        </p>
                      )}
                      {badge && (
                        <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.className}`}>
                          {badge.label}
                        </span>
                      )}
                      <button
                        onClick={() => setEditing({ employeeId: emp.id, date: dateStr, record: record ?? null })}
                        className="block mx-auto mt-1 text-[10px] text-amber-700 underline"
                      >
                        {record ? "Edit" : "+ Add"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ManualEntryForm
          employeeName={activeEmployees.find((e) => e.id === editing.employeeId)?.full_name ?? ""}
          employeeId={editing.employeeId}
          date={editing.date}
          record={editing.record}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load(weekStart);
          }}
        />
      )}
    </div>
  );
}

function ManualEntryForm({
  employeeName,
  employeeId,
  date,
  record,
  onClose,
  onSaved,
}: {
  employeeName: string;
  employeeId: string;
  date: string;
  record: AttendanceRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clockInTime, setClockInTime] = useState(record?.clock_in ? record.clock_in.slice(11, 16) : "08:00");
  const [clockOutTime, setClockOutTime] = useState(record?.clock_out ? record.clock_out.slice(11, 16) : "");
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await upsertManualAttendance({
        attendanceId: record?.id,
        employeeId,
        date,
        clockInTime,
        clockOutTime: clockOutTime || null,
        notes: notes || null,
      });
      if (res.error) setError(res.error);
      else onSaved();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-xs">
        <h3 className="font-semibold text-neutral-800 mb-1">{employeeName}</h3>
        <p className="text-xs text-neutral-400 mb-3">{date} — manager override</p>

        <label className="text-xs text-neutral-500">Clock in</label>
        <input
          type="time"
          value={clockInTime}
          onChange={(e) => setClockInTime(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mb-2"
        />
        <label className="text-xs text-neutral-500">Clock out (optional)</label>
        <input
          type="time"
          value={clockOutTime}
          onChange={(e) => setClockOutTime(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mb-2"
        />
        <label className="text-xs text-neutral-500">Reason / notes</label>
        <input
          placeholder="e.g. forgot to clock in"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mb-3"
        />

        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

        <div className="flex gap-2">
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
