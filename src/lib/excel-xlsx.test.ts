import { describe, expect, it } from "vitest";
import { packXlsxWithEmbeddedImages } from "@/lib/excel-xlsx";

const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wAAAAD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGAA//Z",
  "base64"
);

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
});
