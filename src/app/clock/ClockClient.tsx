"use client";

import { useState, useTransition } from "react";
import { clockInOrOut, type ClockStaff, type ClockResult } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  cashier: "Cashier",
  kitchen: "Kitchen",
  server: "Server",
  encoder: "Encoder",
};

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function ClockClient({ staff }: { staff: ClockStaff[] }) {
  const [selected, setSelected] = useState<ClockStaff | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ person: ClockStaff; res: ClockResult } | null>(null);
  const [isPending, startTransition] = useTransition();

  function chooseStaff(person: ClockStaff) {
    setSelected(person);
    setPin("");
    setError(null);
    setResult(null);
  }

  function pressDigit(d: string) {
    if (pin.length >= 6) return;
    setPin((p) => p + d);
    setError(null);
  }

  function submit(finalPin: string) {
    if (!selected) return;
    startTransition(async () => {
      const res = await clockInOrOut(selected.id, finalPin);
      if (res.error) {
        setError(res.error);
        setPin("");
      } else {
        setResult({ person: selected, res });
        setSelected(null);
        setPin("");
      }
    });
  }

  if (result) {
    const { person, res } = result;
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow p-8 text-center">
          <div className={`text-5xl mb-4 ${res.action === "in" ? "text-green-600" : "text-amber-600"}`}>
            {res.action === "in" ? "✓" : "👋"}
          </div>
          <h1 className="text-2xl font-bold text-neutral-800 mb-1">
            {person.fullName}, you&apos;re clocked {res.action === "in" ? "in" : "out"}
          </h1>
          <p className="text-neutral-500 mb-4">
            {res.timestamp &&
              new Date(res.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {res.action === "out" && res.workedMinutes != null && (
              <> — worked {formatDuration(res.workedMinutes)}</>
            )}
          </p>
          <button
            onClick={() => setResult(null)}
            className="w-full rounded-xl bg-neutral-800 text-white font-semibold py-4"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-neutral-800 mb-1">Alimah</h1>
        <p className="text-center text-neutral-500 mb-8">Time Clock</p>

        {!selected && (
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="grid grid-cols-2 gap-3">
              {staff.map((person) => (
                <button
                  key={person.id}
                  onClick={() => chooseStaff(person)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-neutral-200 bg-neutral-50 hover:bg-amber-50 hover:border-amber-300 active:scale-95 transition p-5 min-h-[96px]"
                >
                  <span className="text-lg font-semibold text-neutral-800">{person.fullName}</span>
                  <span className="text-sm text-neutral-500">{ROLE_LABEL[person.role] ?? person.role}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selected && (
          <div className="bg-white rounded-2xl shadow p-6">
            <button onClick={() => setSelected(null)} className="text-sm text-neutral-500 mb-4">
              ← Not {selected.fullName}?
            </button>
            <p className="text-center text-neutral-700 font-medium mb-2">Hi, {selected.fullName}</p>
            <p className="text-center text-sm text-neutral-400 mb-4">Enter your PIN to clock in/out</p>

            <div className="flex justify-center gap-3 mb-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-4 w-4 rounded-full border-2 ${
                    i < pin.length ? "bg-amber-500 border-amber-500" : "border-neutral-300"
                  }`}
                />
              ))}
            </div>

            {error && <p className="text-center text-red-600 text-sm mb-4">{error}</p>}

            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  onClick={() => pressDigit(d)}
                  disabled={isPending}
                  className="text-2xl font-semibold rounded-xl bg-neutral-100 hover:bg-amber-100 active:scale-95 transition py-5"
                >
                  {d}
                </button>
              ))}
              <button
                onClick={() => {
                  setPin("");
                  setError(null);
                }}
                className="text-sm font-medium rounded-xl bg-neutral-100 hover:bg-neutral-200 py-5"
              >
                Clear
              </button>
              <button
                onClick={() => pressDigit("0")}
                disabled={isPending}
                className="text-2xl font-semibold rounded-xl bg-neutral-100 hover:bg-amber-100 active:scale-95 transition py-5"
              >
                0
              </button>
              <button
                onClick={() => setPin((p) => p.slice(0, -1))}
                className="text-sm font-medium rounded-xl bg-neutral-100 hover:bg-neutral-200 py-5"
              >
                ⌫
              </button>
            </div>

            <button
              onClick={() => submit(pin)}
              disabled={pin.length < 4 || isPending}
              className="mt-4 w-full rounded-xl bg-amber-600 text-white text-lg font-semibold py-4 disabled:opacity-40"
            >
              {isPending ? "Checking..." : "Clock In / Out"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
