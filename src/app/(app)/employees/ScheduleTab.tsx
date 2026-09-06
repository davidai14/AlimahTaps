"use client";

import { useEffect, useState, useTransition } from "react";
import { createShift, deleteShift, getShiftsForRangeAction } from "./actions";
import type { EmployeeRow, ShiftRow } from "@/lib/domain-types";

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day + 6) % 7; // Monday as first day
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ScheduleTab({ employees }: { employees: EmployeeRow[] }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [cellPicker, setCellPicker] = useState<{ employeeId: string; date: string } | null>(null);
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
      const res = await getShiftsForRangeAction(isoDate(start), isoDate(end));
      setShifts(res);
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

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => changeWeek(-1)} className="px-3 py-2 rounded-lg bg-neutral-100">
          ← Prev
        </button>
        <span className="text-sm font-medium text-neutral-600">
          Week of {isoDate(weekStart)}
        </span>
        <button onClick={() => changeWeek(1)} className="px-3 py-2 rounded-lg bg-neutral-100">
          Next →
        </button>
        {isPending && <span className="text-xs text-neutral-400">Loading...</span>}
      </div>

      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 border-b border-neutral-100 sticky left-0 bg-white">
                Employee
              </th>
              {days.map((d, i) => (
                <th key={i} className="px-3 py-2 border-b border-neutral-100 text-center min-w-[110px]">
                  {DAY_LABELS[i]}
                  <br />
                  <span className="text-xs text-neutral-400">{isoDate(d).slice(5)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td className="px-3 py-2 border-b border-neutral-50 font-medium text-neutral-800 sticky left-0 bg-white whitespace-nowrap">
                  {emp.full_name}
                </td>
                {days.map((d, i) => {
                  const dateStr = isoDate(d);
                  const shift = shifts.find((s) => s.employee_id === emp.id && s.shift_date === dateStr);
                  return (
                    <td key={i} className="px-2 py-2 border-b border-neutral-50 text-center">
                      {shift ? (
                        <button
                          onClick={() =>
                            startTransition(async () => {
                              await deleteShift(shift.id);
                              load(weekStart);
                            })
                          }
                          className="text-xs bg-amber-100 text-amber-800 rounded-lg px-2 py-1 w-full"
                          title="Click to remove"
                        >
                          {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
                        </button>
                      ) : (
                        <button
                          onClick={() => setCellPicker({ employeeId: emp.id, date: dateStr })}
                          className="text-xs text-neutral-300 hover:text-amber-600 w-full py-1"
                        >
                          +
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cellPicker && (
        <ShiftForm
          employeeName={employees.find((e) => e.id === cellPicker.employeeId)?.full_name ?? ""}
          date={cellPicker.date}
          onClose={() => setCellPicker(null)}
          onSave={async (startTime, endTime) => {
            await createShift({
              employeeId: cellPicker.employeeId,
              shiftDate: cellPicker.date,
              startTime,
              endTime,
            });
            setCellPicker(null);
            load(weekStart);
          }}
        />
      )}
    </div>
  );
}

function ShiftForm({
  employeeName,
  date,
  onClose,
  onSave,
}: {
  employeeName: string;
  date: string;
  onClose: () => void;
  onSave: (startTime: string, endTime: string) => void;
}) {
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-xs">
        <h3 className="font-semibold text-neutral-800 mb-1">{employeeName}</h3>
        <p className="text-xs text-neutral-400 mb-3">{date}</p>
        <label className="text-xs text-neutral-500">Start</label>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mb-2"
        />
        <label className="text-xs text-neutral-500">End</label>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mb-3"
        />
        <div className="flex gap-2">
          <button
            onClick={() => onSave(startTime, endTime)}
            className="flex-1 rounded-xl bg-amber-600 text-white font-semibold py-3"
          >
            Save Shift
          </button>
          <button onClick={onClose} className="px-4 text-sm text-neutral-500">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
