import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

type ImageExtension = "jpeg" | "png" | "gif";

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function detectImageExtension(buffer: ArrayBuffer): ImageExtension | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
  return null;
}

async function fetchImageBase64(url: string) {
  const response = await fetch(url);
  if (!response.ok) return null;
  const buffer = await response.arrayBuffer();
  const extension = detectImageExtension(buffer);
  if (!extension) return null;
  return { base64: arrayBufferToBase64(buffer), extension };
}

function triggerDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadExcelWithOptionalImages(options: {
  filename: string;
  sheetName: string;
  rows: Record<string, string | number | null>[];
  imageUrls?: Array<string | null | undefined>;
  imageColumnLabel?: string;
}) {
  const { filename, sheetName, rows, imageUrls, imageColumnLabel = "صورة" } = options;
  const hasImages = Boolean(imageUrls?.some((url) => url));

  if (!hasImages) {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, filename);
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const headers = [...columns, imageColumnLabel];

  worksheet.addRow(headers);
  worksheet.getRow(1).font = { bold: true };
  worksheet.getColumn(columns.length + 1).width = 14;

  for (let index = 0; index < rows.length; index += 1) {
    const values = columns.map((column) => rows[index][column] ?? "");
    values.push("");
    worksheet.addRow(values);

    const imageUrl = imageUrls?.[index];
    if (!imageUrl) continue;

    const image = await fetchImageBase64(imageUrl);
    if (!image) continue;

    const rowNumber = index + 2;
    worksheet.getRow(rowNumber).height = 54;

    const imageId = workbook.addImage({
      base64: image.base64,
      extension: image.extension,
    });

    worksheet.addImage(imageId, {
      tl: { col: columns.length, row: rowNumber - 1 },
      ext: { width: 72, height: 52 },
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, filename);
}
