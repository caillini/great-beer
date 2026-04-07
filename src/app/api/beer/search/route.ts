import { searchBeer } from "@/lib/scraper/untappd";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    const beer = await searchBeer(q.trim());
    return NextResponse.json({ beer });
  } catch {
    return NextResponse.json(
      { error: "Failed to search beer" },
      { status: 500 }
    );
  }
}
