"use client";

import { useState, useTransition } from "react";
import { submitReservation, uploadReservationScreenshot } from "./actions";

export function ReserveClient({ storeId }: { storeId: string }) {
  const [customerName, setCustomerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [reservationDate, setReservationDate] = useState("");
  const [reservationTime, setReservationTime] = useState("");
  const [notes, setNotes] = useState("");
  const [downPaymentAmount, setDownPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);

  function submit() {
    setError(null);
    startTransition(async () => {
      let screenshotUrl: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.set("file", file);
        const res = await uploadReservationScreenshot(storeId, fd);
        if (res.error) {
          setError(res.error);
          return;
        }
        screenshotUrl = res.url ?? null;
      }

      const res = await submitReservation({
        storeId,
        customerName,
        contactNumber,
        partySize: Number(partySize),
        reservationDate,
        reservationTime,
        notes: notes || null,
        downPaymentAmount: downPaymentAmount ? Number(downPaymentAmount) : null,
        paymentReference: paymentReference || null,
        paymentScreenshotUrl: screenshotUrl,
      });

      if (res.error) setError(res.error);
      else setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-5xl mb-4 text-green-600">✓</div>
          <h1 className="text-2xl font-bold text-neutral-800 mb-2">Reservation received!</h1>
          <p className="text-neutral-500">
            We&apos;ll contact you at the number you provided to confirm your table. Thank you for choosing Alimah!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col items-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-neutral-800 mb-1">Alimah</h1>
        <p className="text-center text-neutral-500 mb-8">Reserve a Table</p>

        <div className="bg-white rounded-2xl shadow p-6 space-y-3">
          <div>
            <label className="text-xs text-neutral-500">Your name</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Contact number</label>
            <input
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="09XX XXX XXXX"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500">Party size</label>
              <input
                type="number"
                min="1"
                value={partySize}
                onChange={(e) => setPartySize(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Date</label>
              <input
                type="date"
                min={today}
                value={reservationDate}
                onChange={(e) => setReservationDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-neutral-500">Time</label>
            <input
              type="time"
              value={reservationTime}
              onChange={(e) => setReservationTime(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special requests, occasion, etc."
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
            />
          </div>

          <div className="pt-2 border-t border-neutral-100">
            <p className="text-sm font-medium text-neutral-600 mb-1">
              Down payment (optional — GCash or bank transfer)
            </p>
            <p className="text-xs text-neutral-400 mb-2">
              If asked to provide a down payment, send it to our GCash/bank details (shared when you call to book)
              and upload proof of payment here. Staff will verify it and confirm your reservation.
            </p>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount sent (₱)"
              value={downPaymentAmount}
              onChange={(e) => setDownPaymentAmount(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base mb-2"
            />
            <input
              placeholder="Reference number"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base mb-2"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={submit}
            disabled={
              isPending || !customerName || !contactNumber || !reservationDate || !reservationTime
            }
            className="w-full rounded-xl bg-amber-600 text-white text-lg font-semibold py-4 disabled:opacity-40"
          >
            {isPending ? "Submitting..." : "Request Reservation"}
          </button>
        </div>
      </div>
    </div>
  );
}
