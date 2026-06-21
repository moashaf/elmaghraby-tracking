/**
 * One-off import: 0000.xlsx → shipment ACID 4354258461016210018
 * Append-only: no deletes, no total_cartons update.
 */
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const XLSX_PATH = "c:/Users/hp/OneDrive/Desktop/0000.xlsx";
const SHIPMENT_ID = "e1adeb1b-90ce-4635-86f4-38ea541e1943";
const SUPABASE_URL = "https://qwlhsgxxekltqjheobna.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CATEGORIES = {
  diffuser: { id: "3fdef2d6-c0c4-4062-b777-7fb19510e21b", label: "فواحة" },
  bag: { id: "99ecb26c-4351-44ef-9f04-e3a97e04cac7", label: "شنطة + محفظة" },
  lantern: { id: "68e8978a-bb65-40d0-9ab5-82eef106c61c", label: "فانوس ميدالية" },
  fan: { id: "9acb521a-b243-4199-8804-48ff9426e820", label: "مروحة" },
};

function safeStorageFileName(originalName) {
  const trimmed = originalName.trim() || "file";
  const dot = trimmed.lastIndexOf(".");
  const ext = dot > 0 ? trimmed.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  const base = trimmed
    .slice(0, dot > 0 ? dot : trimmed.length)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${Date.now()}-${base || "file"}${ext || ""}`;
}

function productImagePath(productId, fileName) {
  return `products/${productId}/${safeStorageFileName(fileName)}`;
}

function resolveCategory(name) {
  if (/فانوس|ميدال/i.test(name)) return CATEGORIES.lantern;
  if (/شنطة|محفظة|كرات/i.test(name)) return CATEGORIES.bag;
  if (/مروحة/i.test(name)) return CATEGORIES.fan;
  if (/فواح/i.test(name)) return CATEGORIES.diffuser;
  throw new Error(`Unknown category for: ${name}`);
}

function buildSku(name, excelRow, usedSkus) {
  const paren = name.match(/\(([A-Za-z0-9-]+)\)/);
  let base = paren?.[1] ?? null;
  if (!base) {
    const last = name.trim().split(/\s+/).pop() ?? "";
    if (/^[A-Za-z0-9-]+$/.test(last)) base = last;
  }
  if (!base) base = `R${excelRow}`;

  const ml = name.match(/(\d+(?:\.\d+)?)\s*مل/i);
  const liter = name.match(/(\d+(?:\.\d+)?)\s*لتر/i);
  let sku = base;
  if (ml) sku = `${base}-${ml[1]}ML`;
  else if (liter) sku = `${base}-${liter[1]}L`;

  if (paren && /قماش/.test(name)) sku = `${paren[1]}-Q`;
  else if (paren && /جلد/.test(name) && /شنطة/.test(name)) sku = `${paren[1]}-J`;

  let final = sku;
  let suffix = 2;
  while (usedSkus.has(final)) {
    final = `${sku}-V${suffix}`;
    suffix += 1;
  }
  usedSkus.add(final);
  return final;
}

function mimeForExt(ext) {
  if (ext === "jpeg" || ext === "jpg") return "image/jpeg";
  return "image/png";
}

async function loadSheetRows() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const ws = wb.getWorksheet("Sheet2") ?? wb.worksheets[0];

  const imageByRow = new Map();
  for (const img of ws.getImages()) {
    const excelRow = img.range.tl.nativeRow + 1;
    const media = wb.getImage(img.imageId);
    if (imageByRow.has(excelRow)) {
      throw new Error(`Multiple images on Excel row ${excelRow}`);
    }
    imageByRow.set(excelRow, {
      buffer: media.buffer,
      ext: media.extension,
      mime: mimeForExt(media.extension),
    });
  }

  const rows = [];
  for (let excelRow = 2; excelRow <= ws.rowCount; excelRow += 1) {
    const name = String(ws.getRow(excelRow).getCell(2).value ?? "").trim();
    const cartons = Number(ws.getRow(excelRow).getCell(3).value ?? 0);
    const unitQty = Number(ws.getRow(excelRow).getCell(4).value ?? 0);
    if (!name) continue;

    const image = imageByRow.get(excelRow);
    if (!image) throw new Error(`Missing image for Excel row ${excelRow}: ${name}`);

    rows.push({ excelRow, name, cartons, unitQty, image });
  }

  if (rows.length !== 35) throw new Error(`Expected 35 rows, got ${rows.length}`);
  if (imageByRow.size !== 35) throw new Error(`Expected 35 images, got ${imageByRow.size}`);
  return rows;
}

async function main() {
  if (!SERVICE_KEY) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY");

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const rows = await loadSheetRows();
  const usedSkus = new Set();
  const results = [];

  const { count: beforeCount } = await sb
    .from("shipment_products")
    .select("id", { count: "exact", head: true })
    .eq("shipment_id", SHIPMENT_ID);

  console.log(`Shipment products before: ${beforeCount}`);

  for (const row of rows) {
    const category = resolveCategory(row.name);
    const sku = buildSku(row.name, row.excelRow, usedSkus);
    const quantity = row.cartons * row.unitQty;

    const { data: product, error: productError } = await sb
      .from("products")
      .insert({
        sku,
        name_ar: row.name,
        name_en: null,
        category_id: category.id,
        category: category.label,
        barcode: null,
        unit: "piece",
        is_active: true,
      })
      .select("id,sku,name_ar")
      .single();

    if (productError) throw new Error(`Product ${sku}: ${productError.message}`);

    const fileName = `img.${row.image.ext}`;
    const storagePath = productImagePath(product.id, fileName);
    const { error: uploadError } = await sb.storage.from("product-images").upload(storagePath, row.image.buffer, {
      contentType: row.image.mime,
      upsert: true,
    });
    if (uploadError) throw new Error(`Upload ${sku}: ${uploadError.message}`);

    const { error: imageUpdateError } = await sb.from("products").update({ image_url: storagePath }).eq("id", product.id);
    if (imageUpdateError) throw new Error(`Image URL ${sku}: ${imageUpdateError.message}`);

    const { error: lineError } = await sb.from("shipment_products").insert({
      shipment_id: SHIPMENT_ID,
      product_id: product.id,
      quantity,
      cartons_count: row.cartons,
      notes: null,
      is_new_incoming_product: false,
      is_disassembled: false,
    });
    if (lineError) throw new Error(`Shipment line ${sku}: ${lineError.message}`);

    results.push({
      excelRow: row.excelRow,
      sku,
      name: row.name,
      category: category.label,
      cartons: row.cartons,
      unitQty: row.unitQty,
      quantity,
      imageRow: row.excelRow,
      storagePath,
    });

    console.log(`OK row ${row.excelRow}: ${sku} | ${row.name.slice(0, 40)}... | img row ${row.excelRow}`);
  }

  const { count: afterCount } = await sb
    .from("shipment_products")
    .select("id", { count: "exact", head: true })
    .eq("shipment_id", SHIPMENT_ID);

  const { data: shipment } = await sb.from("shipments").select("total_cartons,acid").eq("id", SHIPMENT_ID).single();

  console.log("\nDone.");
  console.log(`Shipment products after: ${afterCount} (+${afterCount - beforeCount})`);
  console.log(`total_cartons unchanged: ${shipment?.total_cartons}`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error("IMPORT FAILED:", error.message);
  process.exit(1);
});
