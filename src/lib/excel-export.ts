import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadExcelWithOptionalImages(options: {
  filename: string;
  sheetName: string;
  rows: Record<string, string | number | null>[];
  imageUrls?: Array<string | null | undefined>;
  imageStoragePaths?: Array<string | null | undefined>;
  imageColumnLabel?: string;
  linkColumn?: string;
  linkUrls?: Array<string | null | undefined>;
  linkLabel?: string;
}) {
  const hasImages = Boolean(
    options.imageStoragePaths?.some((path) => path) || options.imageUrls?.some((url) => url)
  );
  const hasLinks = Boolean(options.linkColumn && options.linkUrls?.some((url) => url));

  if (!hasImages && !hasLinks) {
    const worksheet = XLSX.utils.json_to_sheet(options.rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName);
    XLSX.writeFile(workbook, options.filename);
    return;
  }

  const supabase = createClient();
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) {
    throw new Error("أعد تسجيل الدخول ثم جرّب سحب Excel مرة أخرى.");
  }

  const filename = options.filename.toLowerCase().endsWith(".xlsx")
    ? options.filename
    : `${options.filename.replace(/\.xls$/i, "")}.xlsx`;

  const response = await fetch("/api/reports/excel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      filename,
      sheetName: options.sheetName,
      rows: options.rows,
      imageStoragePaths: options.imageStoragePaths,
      imageUrls: options.imageUrls,
      imageColumnLabel: options.imageColumnLabel,
      linkColumn: options.linkColumn,
      linkUrls: options.linkUrls,
      linkLabel: options.linkLabel,
    }),
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error || "تعذر إنشاء ملف Excel.");
    }
    throw new Error("تعذر إنشاء ملف Excel.");
  }

  const bytes = await response.arrayBuffer();
  triggerDownload(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename
  );
}
