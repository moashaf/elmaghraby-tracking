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

export async function packXlsxWithEmbeddedImages(options: {
  sheetName: string;
  rows: ExcelSheetRow[];
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
  const columns = rows.length ? Object.keys(rows[0] ?? {}) : [];
  const headers = hasImages ? [...columns, imageColumnLabel] : columns;

  worksheet.addRow(headers);
  worksheet.getRow(1).font = { bold: true };
  if (hasImages) worksheet.getColumn(columns.length + 1).width = 12;

  const imageIdByFingerprint = new Map<string, number>();

  for (let index = 0; index < rows.length; index += 1) {
    const values = columns.map((column) => rows[index]?.[column] ?? "");
    if (hasImages) values.push("");
    const rowNumber = worksheet.addRow(values).number;

    if (linkColumn) {
      const linkIndex = columns.indexOf(linkColumn);
      const url = linkUrls?.[index];
      if (linkIndex >= 0 && url) {
        const cell = worksheet.getCell(rowNumber, linkIndex + 1);
        cell.value = { text: linkLabel, hyperlink: url };
        cell.font = { color: { argb: "FF0563C1" }, underline: true };
      }
    }

    const image = imagesByRow?.[index];
    if (!image?.length) continue;

    const fingerprint = `${image.length}:${image[0]}:${image[1]}:${image[2]}:${image[10] ?? 0}:${image[20] ?? 0}`;
    let imageId = imageIdByFingerprint.get(fingerprint);
    if (imageId == null) {
      imageId = workbook.addImage({
        base64: uint8ToBase64(image),
        extension: "jpeg",
      });
      imageIdByFingerprint.set(fingerprint, imageId);
    }

    worksheet.getRow(rowNumber).height = 48;
    worksheet.addImage(imageId, {
      tl: { col: columns.length, row: rowNumber - 1 },
      ext: { width: 64, height: 46 },
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
