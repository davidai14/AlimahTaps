import "server-only";
import ExcelJS from "exceljs";
import type { MenuItemFull } from "./menu-data";
import type { InventoryItemRow } from "@/lib/domain-types";

const UNIT_FAMILY: Record<string, "weight" | "volume" | "count"> = {
  g: "weight",
  kg: "weight",
  mL: "volume",
  L: "volume",
  pc: "count",
};
const VALID_UNITS = Object.keys(UNIT_FAMILY);

const ITEMS_HEADERS = ["Category", "Item Name", "Description", "Price", "Active (Y/N)"];
const VARIANTS_HEADERS = ["Item Name", "Variant Name", "Price Delta"];
const COMPONENTS_HEADERS = ["Item Name", "Variant Name (blank = base item)", "Inventory Item Name", "Quantity", "Unit"];

// Export the store's current menu as the starting point for an edit — this
// doubles as a backup and as the bulk-add/bulk-edit template, so the owner
// never has to retype what already exists.
export async function buildMenuWorkbook(
  items: MenuItemFull[],
  inventoryItems: InventoryItemRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const instructions = workbook.addWorksheet("Instructions");
  instructions.columns = [{ width: 100 }];
  [
    "Alimah menu import",
    "",
    "This file is your current menu, exported so you can edit it here and re-upload.",
    "",
    "Items sheet: one row per item for sale. Category is created automatically if it",
    "doesn't exist yet. Active (Y/N) — leave blank for Y (shown on the POS).",
    "",
    "Variants sheet: optional. One row per size/add-on choice (e.g. \"Large\", +30).",
    "Item Name must match a row in the Items sheet exactly.",
    "",
    "Components sheet: which inventory items (and how much of each) this menu item",
    "uses up when sold — this drives automatic stock deduction. One row per",
    "ingredient. Leave Variant Name blank for the base item, or fill it in for an",
    "ingredient that only applies to that variant (e.g. extra rice on \"Large\").",
    "Inventory Item Name must exactly match a name on the reference sheet — the item",
    "must already exist in Inventory before you can use it here.",
    "",
    "IMPORTANT: re-uploading replaces the full component list for every item that",
    "appears in the Components sheet. If you remove a row, that ingredient is",
    "removed from the recipe. Items you don't mention at all are left untouched.",
    "",
    "Inventory Items (reference) sheet: read-only list of valid inventory item names",
    "and their units, for typing into the Components sheet.",
  ].forEach((line) => instructions.addRow([line]));

  const itemsSheet = workbook.addWorksheet("Items");
  itemsSheet.addRow(ITEMS_HEADERS);
  itemsSheet.getRow(1).font = { bold: true };
  for (const item of items) {
    itemsSheet.addRow([item.category_name ?? "", item.name, item.description ?? "", item.price, item.is_active ? "Y" : "N"]);
  }
  itemsSheet.columns.forEach((c) => (c.width = 22));

  const variantsSheet = workbook.addWorksheet("Variants");
  variantsSheet.addRow(VARIANTS_HEADERS);
  variantsSheet.getRow(1).font = { bold: true };
  for (const item of items) {
    for (const v of item.variants) {
      variantsSheet.addRow([item.name, v.name, v.price_delta]);
    }
  }
  variantsSheet.columns.forEach((c) => (c.width = 22));

  const componentsSheet = workbook.addWorksheet("Components");
  componentsSheet.addRow(COMPONENTS_HEADERS);
  componentsSheet.getRow(1).font = { bold: true };
  for (const item of items) {
    for (const c of item.components) {
      componentsSheet.addRow([item.name, c.variant_name ?? "", c.inventory_item_name, c.quantity, c.unit]);
    }
  }
  componentsSheet.columns.forEach((c) => (c.width = 26));

  const refSheet = workbook.addWorksheet("Inventory Items (reference)");
  refSheet.addRow(["Inventory Item Name", "Unit"]);
  refSheet.getRow(1).font = { bold: true };
  for (const i of inventoryItems) refSheet.addRow([i.name, i.unit]);
  refSheet.columns.forEach((c) => (c.width = 26));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function cellText(row: ExcelJS.Row, col: number): string {
  const v = row.getCell(col).value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text ?? "");
  if (typeof v === "object" && "result" in v) return String((v as { result: unknown }).result ?? "");
  return String(v).trim();
}

export type RawItemRow = { rowNumber: number; category: string; name: string; description: string; price: string; active: string };
export type RawVariantRow = { rowNumber: number; itemName: string; variantName: string; priceDelta: string };
export type RawComponentRow = {
  rowNumber: number;
  itemName: string;
  variantName: string;
  inventoryItemName: string;
  quantity: string;
  unit: string;
};

export async function parseMenuWorkbook(buffer: Buffer): Promise<{
  items: RawItemRow[];
  variants: RawVariantRow[];
  components: RawComponentRow[];
  error?: string;
}> {
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs's own .d.ts shadows the global Node `Buffer` with a local
    // `Buffer extends ArrayBuffer` type, so a real Buffer needs this cast —
    // a known upstream typing bug, not a runtime issue.
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { items: [], variants: [], components: [], error: "Could not read this file. Make sure it's the .xlsx template." };
  }

  const items: RawItemRow[] = [];
  const itemsSheet = workbook.getWorksheet("Items");
  itemsSheet?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = cellText(row, 2);
    if (!name && !cellText(row, 1) && !cellText(row, 4)) return; // fully blank row
    items.push({
      rowNumber,
      category: cellText(row, 1),
      name,
      description: cellText(row, 3),
      price: cellText(row, 4),
      active: cellText(row, 5),
    });
  });

  const variants: RawVariantRow[] = [];
  const variantsSheet = workbook.getWorksheet("Variants");
  variantsSheet?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const itemName = cellText(row, 1);
    const variantName = cellText(row, 2);
    if (!itemName && !variantName) return;
    variants.push({ rowNumber, itemName, variantName, priceDelta: cellText(row, 3) });
  });

  const components: RawComponentRow[] = [];
  const componentsSheet = workbook.getWorksheet("Components");
  componentsSheet?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const itemName = cellText(row, 1);
    const inventoryItemName = cellText(row, 3);
    if (!itemName && !inventoryItemName) return;
    components.push({
      rowNumber,
      itemName,
      variantName: cellText(row, 2),
      inventoryItemName,
      quantity: cellText(row, 4),
      unit: cellText(row, 5),
    });
  });

  return { items, variants, components };
}

export type ImportPayloadItem = {
  category: string | null;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  variants: { name: string; price_delta: number }[];
  components: { variant: string | null; inventory_item: string; quantity: number; unit: string }[];
};

// Cross-references the three sheets against each other and against the
// store's real inventory items, returning either a ready-to-send payload or
// a full list of row-level problems — nothing is written to the database
// unless every row validates.
export function validateAndBuildPayload(
  parsed: { items: RawItemRow[]; variants: RawVariantRow[]; components: RawComponentRow[] },
  inventoryItems: InventoryItemRow[]
): { payload: { items: ImportPayloadItem[] } | null; errors: string[] } {
  const errors: string[] = [];
  const inventoryByName = new Map(inventoryItems.map((i) => [i.name.toLowerCase(), i]));

  const itemsByName = new Map<string, ImportPayloadItem>();
  const seenItemNames = new Set<string>();

  for (const row of parsed.items) {
    if (!row.name) {
      errors.push(`Items row ${row.rowNumber}: Item Name is required.`);
      continue;
    }
    const key = row.name.toLowerCase();
    if (seenItemNames.has(key)) {
      errors.push(`Items row ${row.rowNumber}: duplicate item name "${row.name}" — each item can only appear once.`);
      continue;
    }
    seenItemNames.add(key);

    const price = Number(row.price);
    if (row.price === "" || !Number.isFinite(price) || price < 0) {
      errors.push(`Items row ${row.rowNumber} ("${row.name}"): Price must be a number of 0 or more.`);
      continue;
    }

    const activeToken = row.active.trim().toLowerCase();
    const is_active = !["n", "no", "false", "0"].includes(activeToken);

    itemsByName.set(key, {
      category: row.category || null,
      name: row.name,
      description: row.description || null,
      price,
      is_active,
      variants: [],
      components: [],
    });
  }

  const variantKeySet = new Set<string>(); // `${itemKey}::${variantKey}`
  for (const row of parsed.variants) {
    if (!row.itemName || !row.variantName) {
      errors.push(`Variants row ${row.rowNumber}: Item Name and Variant Name are both required.`);
      continue;
    }
    const item = itemsByName.get(row.itemName.toLowerCase());
    if (!item) {
      errors.push(`Variants row ${row.rowNumber}: item "${row.itemName}" not found in the Items sheet.`);
      continue;
    }
    const priceDelta = Number(row.priceDelta);
    if (row.priceDelta === "" || !Number.isFinite(priceDelta)) {
      errors.push(`Variants row ${row.rowNumber} ("${row.itemName}" / "${row.variantName}"): Price Delta must be a number.`);
      continue;
    }
    const vKey = `${row.itemName.toLowerCase()}::${row.variantName.toLowerCase()}`;
    if (variantKeySet.has(vKey)) {
      errors.push(`Variants row ${row.rowNumber}: duplicate variant "${row.variantName}" for item "${row.itemName}".`);
      continue;
    }
    variantKeySet.add(vKey);
    item.variants.push({ name: row.variantName, price_delta: priceDelta });
  }

  for (const row of parsed.components) {
    if (!row.itemName || !row.inventoryItemName) {
      errors.push(`Components row ${row.rowNumber}: Item Name and Inventory Item Name are both required.`);
      continue;
    }
    const item = itemsByName.get(row.itemName.toLowerCase());
    if (!item) {
      errors.push(`Components row ${row.rowNumber}: item "${row.itemName}" not found in the Items sheet.`);
      continue;
    }
    if (row.variantName) {
      const vKey = `${row.itemName.toLowerCase()}::${row.variantName.toLowerCase()}`;
      if (!variantKeySet.has(vKey)) {
        errors.push(
          `Components row ${row.rowNumber}: variant "${row.variantName}" not found for item "${row.itemName}" in the Variants sheet.`
        );
        continue;
      }
    }
    const invItem = inventoryByName.get(row.inventoryItemName.toLowerCase());
    if (!invItem) {
      errors.push(
        `Components row ${row.rowNumber}: inventory item "${row.inventoryItemName}" doesn't exist — add it in Inventory first, or check the spelling against the reference sheet.`
      );
      continue;
    }
    const quantity = Number(row.quantity);
    if (row.quantity === "" || !Number.isFinite(quantity) || quantity <= 0) {
      errors.push(`Components row ${row.rowNumber} ("${row.itemName}"): Quantity must be a number greater than 0.`);
      continue;
    }
    const unit = row.unit.trim();
    if (!VALID_UNITS.includes(unit)) {
      errors.push(`Components row ${row.rowNumber} ("${row.itemName}"): Unit must be one of ${VALID_UNITS.join(", ")}.`);
      continue;
    }
    if (UNIT_FAMILY[unit] !== UNIT_FAMILY[invItem.unit]) {
      errors.push(
        `Components row ${row.rowNumber} ("${row.itemName}"): unit "${unit}" isn't compatible with "${invItem.name}", which is stocked in "${invItem.unit}".`
      );
      continue;
    }

    item.components.push({
      variant: row.variantName || null,
      inventory_item: row.inventoryItemName,
      quantity,
      unit,
    });
  }

  if (errors.length > 0) return { payload: null, errors };
  return { payload: { items: [...itemsByName.values()] }, errors: [] };
}
