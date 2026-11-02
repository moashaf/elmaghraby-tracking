import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { packXlsxWithEmbeddedImages } from "@/lib/excel-xlsx";

const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wAAAAD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGAA//Z",
  "base64"
);

async function loadSheet(bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  // exceljs types a Node Buffer with extra fields that @types/node 20 Buffer lacks
  await workbook.xlsx.load(Buffer.from(bytes) as never);
  return workbook.worksheets[0];
}

function rowTexts(row: ExcelJS.Row) {
  const values = row.values as Array<string | number | null | undefined>;
  return (values ?? []).slice(1).map((value) => String(value ?? ""));
}

describe("packXlsxWithEmbeddedImages", () => {
  it("writes a zip xlsx with media, never HTML", async () => {
    const file = await packXlsxWithEmbeddedImages({
      sheetName: "منتجات",
      rows: [{ SKU: "010001", المنتج: "فرن" }],
      imagesByRow: [TINY_JPEG],
    });

    const text = Buffer.from(file).toString("latin1");
    expect(text.slice(0, 2)).toBe("PK");
    expect(text.includes("xl/media/")).toBe(true);
    expect(text.includes("<html")).toBe(false);
    expect(text.includes("vnd.ms-excel")).toBe(false);
  });

  it("keeps product dates and quantities when a section header is the first row", async () => {
    const file = await packXlsxWithEmbeddedImages({
      sheetName: "منتجات واردة",
      rows: [
        { SKU: "في البحر" },
        {
          SKU: "060017",
          المنتج: "مسدس مساج",
          التصنيف: "عناية",
          "01-11-2026": "2 كرتونة (8 قطعة) — كامل",
          "إجمالي الكرتين": 2,
          "إجمالي القطع": 8,
        },
      ],
      imagesByRow: [undefined, TINY_JPEG],
    });

    const sheet = await loadSheet(file);
    expect(rowTexts(sheet.getRow(1))).toEqual([
      "SKU",
      "المنتج",
      "التصنيف",
      "01-11-2026",
      "إجمالي الكرتين",
      "إجمالي القطع",
      "صورة",
    ]);
    expect(rowTexts(sheet.getRow(3)).slice(0, 6)).toEqual([
      "060017",
      "مسدس مساج",
      "عناية",
      "2 كرتونة (8 قطعة) — كامل",
      "2",
      "8",
    ]);
    expect(sheet.getImages()).toHaveLength(1);
    expect(sheet.getImages()[0]?.range.tl.nativeRow).toBe(2);
  });
});
