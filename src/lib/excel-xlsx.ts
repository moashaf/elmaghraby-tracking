import ExcelJS from "exceljs";

export type ExcelSheetRow = Record<string, string | number | null>;

export async function packXlsxWithEmbeddedImages(options: {
  sheetName: string;
  rows: ExcelSheetRow[];
  imageColumnLabel?: string;
  imagesByRow?: Array<Buffer | null | undefined>;
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
  const worksheet = workbook.addWorksheet(sheetName || "Report");
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

    const fingerprint = `${image.length}:${image.subarray(0, 24).toString("hex")}`;
    let imageId = imageIdByFingerprint.get(fingerprint);
    if (imageId == null) {
      imageId = workbook.addImage({
        base64: image.toString("base64"),
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

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error("Excel workbook did not produce an .xlsx zip.");
  }
  if (hasImages && !buffer.includes(Buffer.from("xl/media/"))) {
    throw new Error("Excel workbook is missing embedded image media.");
  }
  return buffer;
}
