import { listClockStaff } from "./actions";
import { ClockClient } from "./ClockClient";

export const dynamic = "force-dynamic";

export default async function ClockPage() {
  const staff = await listClockStaff();
  return <ClockClient staff={staff} />;
}
