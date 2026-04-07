import { getVenueBeers } from "@/lib/scraper/untappd";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const slug = request.nextUrl.searchParams.get("slug");

  if (!slug) {
    return NextResponse.json(
      { error: "slug query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const beers = await getVenueBeers(slug, id);
    return NextResponse.json({ beers });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch venue beers" },
      { status: 500 }
    );
  }
}
