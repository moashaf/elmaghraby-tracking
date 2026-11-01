import ExcelJS from "exceljs";

export type ExcelSheetRow = Record<string, string | number | null>;

function safeSheetName(name: string) {
  const cleaned = name.replace(/[\\/?*[\]:]/g, " ").trim();
  return cleaned.slice(0, 31) || "Report";
}

function uint8ToBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  const chunk = 0x2000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    const slice = bytes.subarray(offset, offset + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function toUint8(value: Uint8Array | ArrayBuffer) {
  if (value instanceof Uint8Array) return value;
  return new Uint8Array(value);
}

function looksLikeZip(bytes: Uint8Array) {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function containsMedia(bytes: Uint8Array) {
  const marker = "xl/media/";
  const text = typeof Buffer !== "undefined" ? Buffer.from(bytes).toString("latin1") : new TextDecoder("latin1").decode(bytes);
  return text.includes(marker);
}

export function collectExcelColumns(rows: ExcelSheetRow[], preferred?: string[]) {
  const keys: string[] = [];
  const seen = new Set<string>();

  const add = (key: string) => {
    if (!key || key.startsWith("_") || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };

  for (const key of preferred ?? []) add(key);
  for (const row of rows) {
    for (const key of Object.keys(row ?? {})) add(key);
  }
  return keys;
}

function columnWidth(name: string, isImage: boolean) {
  if (isImage) return 14;
  if (name === "SKU") return 14;
  if (name === "المنتج") return 32;
  if (name === "التصنيف") return 16;
  if (name.startsWith("إجمالي")) return 14;
  if (/^\d{2}-\d{2}-\d{4}$/.test(name)) return 22;
  return 16;
}

function isSectionTitleRow(row: ExcelSheetRow | undefined, columns: string[]) {
  if (!row) return false;
  const filled = columns.filter((column) => String(row[column] ?? "").trim());
  return filled.length === 1 && (filled[0] === "SKU" || filled[0] === "المنتج");
}

export async function packXlsxWithEmbeddedImages(options: {
  sheetName: string;
  rows: ExcelSheetRow[];
  columns?: string[];
  imageColumnLabel?: string;
  imagesByRow?: Array<Uint8Array | null | undefined>;
  linkColumn?: string;
  linkUrls?: Array<string | null | undefined>;
  linkLabel?: string;
}) {
  const {
    sheetName,
    rows,
    imageColumnLabel = "صورة",
    imagesByRow,
    linkColumn,
    linkUrls,
    linkLabel = "فتح الملف",
  } = options;

  const hasImages = Boolean(imagesByRow?.some((image) => image && image.length));
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(safeSheetName(sheetName));
  const columns = collectExcelColumns(rows, options.columns);
  const headers = hasImages ? [...columns, imageColumnLabel] : columns;
  const imageColIndex = hasImages ? columns.length : -1;

  worksheet.columns = headers.map((header, index) => ({
    header,
    key: `c${index}`,
    width: columnWidth(header, header === imageColumnLabel),
  }));
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = { vertical: "middle", wrapText: true };

  const imageIdByFingerprint = new Map<string, number>();

  for (let index = 0; index < rows.length; index += 1) {
    const source = rows[index] ?? {};
    const rowObject: ExcelSheetRow = {};
    headers.forEach((header, columnIndex) => {
      rowObject[`c${columnIndex}`] = header === imageColumnLabel ? "" : source[header] ?? "";
    });

    const excelRow = worksheet.addRow(rowObject);
    const rowNumber = excelRow.number;
    const sectionRow = isSectionTitleRow(source, columns);

    if (sectionRow && headers.length > 1) {
      worksheet.mergeCells(rowNumber, 1, rowNumber, headers.length);
      excelRow.font = { bold: true };
      excelRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };
    }

    if (linkColumn && !sectionRow) {
      const linkIndex = columns.indexOf(linkColumn);
      const url = linkUrls?.[index];
      if (linkIndex >= 0 && url) {
        const cell = worksheet.getCell(rowNumber, linkIndex + 1);
        cell.value = { text: linkLabel, hyperlink: url };
        cell.font = { color: { argb: "FF0563C1" }, underline: true };
      }
    }

    const image = sectionRow ? undefined : imagesByRow?.[index];
    if (!image?.length || imageColIndex < 0) continue;

    const fingerprint = `${image.length}:${image[0]}:${image[1]}:${image[2]}:${image[10] ?? 0}:${image[20] ?? 0}`;
    let imageId = imageIdByFingerprint.get(fingerprint);
    if (imageId == null) {
      imageId = workbook.addImage({
        base64: uint8ToBase64(image),
        extension: "jpeg",
      });
      imageIdByFingerprint.set(fingerprint, imageId);
    }

    excelRow.height = 58;
    worksheet.addImage(imageId, {
      tl: { col: imageColIndex, row: rowNumber - 1 },
      br: { col: imageColIndex + 1, row: rowNumber },
      editAs: "oneCell",
    });
  }

  const bytes = toUint8(await workbook.xlsx.writeBuffer() as Uint8Array | ArrayBuffer);
  if (!looksLikeZip(bytes)) {
    throw new Error("Excel workbook did not produce an .xlsx zip.");
  }
  if (hasImages && !containsMedia(bytes)) {
    throw new Error("Excel workbook is missing embedded image media.");
  }
  return bytes;
}
