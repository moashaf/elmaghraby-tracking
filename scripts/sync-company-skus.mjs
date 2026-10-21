import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import pg from "pg";
import XLSX from "xlsx";

function loadEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* optional */
  }
}

function dbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  const ref = url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!url || !password || !ref) return null;
  const encoded = encodeURIComponent(password);
  const region = process.env.SUPABASE_DB_REGION || "eu-west-1";
  return `postgresql://postgres.${ref}:${encoded}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
}

/** Generated SKUs look like PRD-0007 or OVEN-0042 (prefix + 4 digits). */
function isGeneratedSku(sku) {
  return /^[A-Z][A-Z0-9]*-\d{4}$/i.test(String(sku ?? "").trim());
}

function normalizeSku(sku) {
  return String(sku ?? "").trim();
}

function collapseSpaces(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isWattToken(token) {
  return /^\d+(?:W|وات)?$/i.test(token);
}

/** Model-like tokens: SK-03088, 6020-3, (764-4), AL-948, RC002. */
function modelTokens(name) {
  const text = collapseSpaces(name).toUpperCase();
  const tokens = new Set();
  const patterns = [
    /\b[A-Z]{1,8}-\d+[A-Z0-9-]*\b/g,
    /\b[A-Z]{2,}\d{2,}[A-Z0-9]*\b/g,
    /\b[A-Z]\d{2,}[A-Z0-9]*\b/g,
    /\(\s*([A-Z0-9][A-Z0-9._-]{1,24})\s*\)/g,
  ];
  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      const token = (match[1] ?? match[0]).replace(/[()]/g, "").trim();
      if (token.length < 3 || isWattToken(token) || !/\d/.test(token)) continue;
      tokens.add(token);
    }
  }
  return [...tokens];
}

function extractModel(name) {
  const tokens = modelTokens(name);
  if (!tokens.length) return "";
  return tokens.sort((a, b) => b.length - a.length)[0];
}

function nameNumbers(name) {
  return collapseSpaces(name).match(/\d+(?:\.\d+)?/g) ?? [];
}

function eyeCount(name) {
  const match = collapseSpaces(name).match(/(\d+)\s*عين/);
  return match?.[1] ?? null;
}

function namesCompatible(a, b) {
  const eyesA = eyeCount(a);
  const eyesB = eyeCount(b);
  if (eyesA && eyesB && eyesA !== eyesB) return false;
  return true;
}

function pickUniqueSheetMatch(productName, matches) {
  const compatible = matches.filter((item) => namesCompatible(productName, item.name));
  if (compatible.length === 1) return compatible[0];
  if (!compatible.length) return null;
  const ours = nameNumbers(productName);
  const scored = compatible.map((item) => {
    const theirs = nameNumbers(item.name);
    const overlap = ours.filter((n) => theirs.includes(n)).length;
    return { item, overlap };
  });
  scored.sort((a, b) => b.overlap - a.overlap);
  if (scored[0].overlap > 0 && scored[0].overlap > (scored[1]?.overlap ?? 0)) return scored[0].item;
  return null;
}

function normalizeNameKey(name) {
  return collapseSpaces(name)
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

loadEnv();
const url = dbUrl();
if (!url) {
  console.error("Missing DB connection (SUPABASE_DB_PASSWORD).");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const sheetPath = process.argv.find((arg) => arg.endsWith(".xlsx")) ?? "C:\\Users\\hp\\Downloads\\سيستم.xlsx";

const workbook = XLSX.readFile(sheetPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

const company = [];
const seenSheetSku = new Set();
for (const row of sheetRows) {
  const sku = normalizeSku(row.SKU ?? row.sku);
  const name = collapseSpaces(row["اسم الصنف"] ?? row.name);
  const category = collapseSpaces(row["القسم"] ?? row.category);
  if (!sku || !name) continue;
  if (seenSheetSku.has(sku)) continue;
  seenSheetSku.add(sku);
  company.push({ sku, name, category, model: extractModel(name) });
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const products = (await client.query("select id, sku, name_ar, category, category_id from products")).rows;
const categories = (await client.query("select id, name_ar from product_categories where is_active is not false")).rows;

const bySku = new Map(products.map((p) => [normalizeSku(p.sku), p]));
const generated = products.filter((p) => isGeneratedSku(p.sku));

const sheetByModel = new Map();
for (const item of company) {
  for (const model of modelTokens(item.name)) {
    const list = sheetByModel.get(model) ?? [];
    list.push(item);
    sheetByModel.set(model, list);
  }
}

const skuUpdates = [];
const skippedGeneratedNoModel = [];
const skippedGeneratedAmbiguous = [];
const skippedGeneratedSkuTaken = [];

for (const product of generated) {
  const ours = modelTokens(product.name_ar);
  const candidateMap = new Map();
  for (const model of ours) {
    for (const item of sheetByModel.get(model) ?? []) {
      candidateMap.set(item.sku, item);
    }
  }
  const candidates = [...candidateMap.values()];
  if (!candidates.length) {
    skippedGeneratedNoModel.push({ ...product, models: ours });
    continue;
  }
  const hit = pickUniqueSheetMatch(product.name_ar, candidates);
  if (!hit) {
    skippedGeneratedAmbiguous.push({
      ...product,
      models: ours,
      sheetSkus: candidates.map((item) => item.sku),
    });
    continue;
  }
  const existing = bySku.get(hit.sku);
  if (existing && existing.id !== product.id) {
    skippedGeneratedSkuTaken.push({
      ...product,
      model: hit.model,
      wantedSku: hit.sku,
      takenBy: existing.name_ar,
    });
    continue;
  }
  skuUpdates.push({
    id: product.id,
    oldSku: product.sku,
    newSku: hit.sku,
    oldName: product.name_ar,
    newName: hit.name,
    model: hit.model,
  });
}

const claimedNewSku = new Map();
const skuUpdatesUnique = [];
const skippedGeneratedCollision = [];
for (const upd of skuUpdates) {
  const previous = claimedNewSku.get(upd.newSku);
  if (previous) {
    skippedGeneratedCollision.push({ ...upd, collidedWith: previous.oldSku });
    continue;
  }
  claimedNewSku.set(upd.newSku, upd);
  skuUpdatesUnique.push(upd);
}
skuUpdates.length = 0;
skuUpdates.push(...skuUpdatesUnique);

const skuAfterUpdates = new Set(products.map((p) => normalizeSku(p.sku)));
for (const upd of skuUpdates) {
  skuAfterUpdates.delete(upd.oldSku);
  skuAfterUpdates.add(upd.newSku);
}

const toInsert = company.filter((item) => !skuAfterUpdates.has(item.sku));

const categoryByName = new Map(categories.map((c) => [normalizeNameKey(c.name_ar), c]));

function resolveCategoryId(name) {
  if (!name) return null;
  return categoryByName.get(normalizeNameKey(name))?.id ?? null;
}

console.log(
  JSON.stringify(
    {
      sheetProducts: company.length,
      dbProducts: products.length,
      generatedSkus: generated.length,
      step1Updates: skuUpdates.length,
      skippedGeneratedNoModel: skippedGeneratedNoModel.length,
      skippedGeneratedAmbiguous: skippedGeneratedAmbiguous.length,
      skippedGeneratedSkuTaken: skippedGeneratedSkuTaken.length,
      skippedGeneratedCollision: skippedGeneratedCollision.length,
      step2Inserts: toInsert.length,
      apply,
    },
    null,
    2
  )
);

console.log("\n--- sample updates ---");
console.log(skuUpdates.slice(0, 15));
console.log("\n--- sample inserts ---");
console.log(toInsert.slice(0, 10));
console.log("\n--- ambiguous ---");
console.log(skippedGeneratedAmbiguous.slice(0, 10));
console.log("\n--- sku taken ---");
console.log(skippedGeneratedSkuTaken.slice(0, 10));
console.log("\n--- collisions ---");
console.log(skippedGeneratedCollision.slice(0, 10));

const report = {
  updates: skuUpdates,
  inserts: toInsert,
  skippedGeneratedNoModel,
  skippedGeneratedAmbiguous,
  skippedGeneratedSkuTaken,
  skippedGeneratedCollision,
};
writeFileSync(join("scripts", "sync-company-skus-report.json"), JSON.stringify(report, null, 2), "utf8");

if (!apply) {
  console.log("\nDry run only. Re-run with --apply to write.");
  await client.end();
  process.exit(0);
}

await client.query("begin");
try {
  for (const upd of skuUpdates) {
    await client.query("update products set sku = $1, name_ar = $2, updated_at = now() where id = $3", [
      upd.newSku,
      upd.newName,
      upd.id,
    ]);
  }
  for (const item of toInsert) {
    const categoryId = resolveCategoryId(item.category);
    await client.query(
      `insert into products (sku, name_ar, category, category_id, unit, is_active)
       values ($1, $2, $3, $4, 'piece', true)`,
      [item.sku, item.name, item.category || null, categoryId]
    );
  }
  await client.query("commit");
  console.log(`\nApplied: ${skuUpdates.length} SKU/name updates, ${toInsert.length} new products.`);
} catch (error) {
  await client.query("rollback");
  console.error("Apply failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
