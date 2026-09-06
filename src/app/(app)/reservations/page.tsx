import { requireModule } from "@/lib/auth/rbac";
import { getReservations, getWaitlist, getReservationTables } from "./data";
import { ReservationsClient } from "./ReservationsClient";

export default async function ReservationsPage() {
  await requireModule("reservations");
  const [reservations, waitlist, tables] = await Promise.all([
    getReservations(),
    getWaitlist(),
    getReservationTables(),
  ]);

  return <ReservationsClient reservations={reservations} waitlist={waitlist} tables={tables} />;
}
