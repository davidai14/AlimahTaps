"use client";

import { useState, useTransition } from "react";
import { pinLogin, ownerManagerLogin, type StaffTile } from "@/lib/auth/actions";

const ROLE_LABEL: Record<string, string> = {
  cashier: "Cashier",
  kitchen: "Kitchen",
  server: "Server",
  encoder: "Encoder",
};

type Mode = "pick_staff" | "pin_pad" | "owner_login";

export function LoginClient({ staff }: { staff: StaffTile[] }) {
  const [mode, setMode] = useState<Mode>("pick_staff");
  const [selected, setSelected] = useState<StaffTile | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function chooseStaff(person: StaffTile) {
    setSelected(person);
    setPin("");
    setError(null);
    setMode("pin_pad");
  }

  function pressDigit(d: string) {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setError(null);
  }

  function submitPin(finalPin: string) {
    if (!selected) return;
    startTransition(async () => {
      const res = await pinLogin(selected.id, finalPin);
      if (res?.error) {
        setError(res.error);
        setPin("");
      }
    });
  }

  function backspace() {
    setPin((p) => p.slice(0, -1));
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-neutral-800 mb-1">Alimah</h1>
        <p className="text-center text-neutral-500 mb-8">Staff Login</p>

        {mode === "pick_staff" && (
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
            <button
              onClick={() => setMode("owner_login")}
              className="mt-5 w-full text-center text-sm text-amber-700 underline underline-offset-2 py-2"
            >
              Owner / Manager login
            </button>
          </div>
        )}

        {mode === "pin_pad" && selected && (
          <div className="bg-white rounded-2xl shadow p-6">
            <button
              onClick={() => setMode("pick_staff")}
              className="text-sm text-neutral-500 mb-4"
            >
              ← Not {selected.fullName}?
            </button>
            <p className="text-center text-neutral-700 font-medium mb-2">
              Hi, {selected.fullName}
            </p>
            <p className="text-center text-sm text-neutral-400 mb-4">Enter your PIN</p>

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
                onClick={backspace}
                className="text-sm font-medium rounded-xl bg-neutral-100 hover:bg-neutral-200 py-5"
              >
                ⌫
              </button>
            </div>

            <button
              onClick={() => submitPin(pin)}
              disabled={pin.length < 4 || isPending}
              className="mt-4 w-full rounded-xl bg-amber-600 text-white text-lg font-semibold py-4 disabled:opacity-40"
            >
              {isPending ? "Checking..." : "Log In"}
            </button>
          </div>
        )}

        {mode === "owner_login" && (
          <OwnerLoginForm onBack={() => setMode("pick_staff")} />
        )}
      </div>
    </div>
  );
}

function OwnerLoginForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await ownerManagerLogin(email, password);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl shadow p-6 space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-neutral-500">
        ← Back to staff login
      </button>
      <h2 className="text-lg font-semibold text-neutral-800">Owner / Manager Login</h2>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div>
        <label className="block text-sm text-neutral-600 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-base"
        />
      </div>
      <div>
        <label className="block text-sm text-neutral-600 mb-1">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-base"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-amber-600 text-white text-lg font-semibold py-4 disabled:opacity-40"
      >
        {isPending ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
