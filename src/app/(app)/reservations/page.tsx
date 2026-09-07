import { requireModule } from "@/lib/auth/rbac";
import { getEffectiveStoreId } from "@/lib/auth/store-scope";
import { getReservations, getWaitlist, getReservationTables } from "./data";
import { ReservationsClient } from "./ReservationsClient";

export default async function ReservationsPage() {
  const session = await requireModule("reservations");
  const storeId = await getEffectiveStoreId(session);
  const [reservations, waitlist, tables] = await Promise.all([
    getReservations(storeId),
    getWaitlist(storeId),
    getReservationTables(storeId),
  ]);

  return <ReservationsClient reservations={reservations} waitlist={waitlist} tables={tables} />;
}
