import { NextResponse } from "next/server";
import { fetchFxBoard } from "@/lib/fx-board";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const board = await fetchFxBoard();
    return NextResponse.json(board, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر جلب أسعار العملات." },
      { status: 502 }
    );
  }
}
