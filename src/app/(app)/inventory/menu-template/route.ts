import { requireModule } from "@/lib/auth/rbac";
import { getEffectiveStoreId } from "@/lib/auth/store-scope";
import { getInventoryItems } from "../data";
import { getMenuItemsFull } from "../menu-data";
import { buildMenuWorkbook } from "../menu-xlsx";

export async function GET() {
  const session = await requireModule("inventory");
  const storeId = await getEffectiveStoreId(session);

  const [items, inventoryItems] = await Promise.all([
    getMenuItemsFull(storeId),
    getInventoryItems(storeId),
  ]);
  const buffer = await buildMenuWorkbook(items, inventoryItems);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="alimah-menu.xlsx"',
    },
  });
}
