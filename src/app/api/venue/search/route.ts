import { searchVenues } from "@/lib/scraper/untappd";
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
    const venues = await searchVenues(q.trim());
    return NextResponse.json({ venues });
  } catch {
    return NextResponse.json(
      { error: "Failed to search venues" },
      { status: 500 }
    );
  }
}
