import { jsonError, requireWriter } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeFilename(name: string) {
  const base = name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "report.xlsx";
  return base.toLowerCase().endsWith(".xlsx") ? base : `${base.replace(/\.xls$/i, "")}.xlsx`;
}

export async function GET() {
  return Response.json({ ok: true, format: "xlsx" });
}

export async function POST(request: Request) {
  const writer = await requireWriter(request);
  if (!writer.ok) return jsonError(writer.error, writer.status);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("طلب غير صالح.", 400);
  }

  if (!Array.isArray(body.rows)) {
    return jsonError("بيانات التقرير غير صالحة.", 400);
  }

  try {
    const { buildExcelWithImagesBuffer } = await import("@/lib/excel-export.server");
    const file = await buildExcelWithImagesBuffer(writer.adminClient, body as never);
    const filename = safeFilename(typeof body.filename === "string" ? body.filename : "report.xlsx");
    return new Response(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إنشاء ملف Excel.";
    return jsonError(message, 500);
  }
}
