import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const BEER_EXTRACT_PROMPT = `You are analyzing a photo of a bar or restaurant menu. Extract ONLY the beer names from this image.

Rules:
- Return ONLY beer names, one per line
- Include the brewery name if it appears next to the beer name (e.g. "Sierra Nevada Pale Ale" not just "Pale Ale")
- REMOVE beer style/type descriptors from the name. Strip out words like: IPA, DIPA, NEIPA, APA, Hazy IPA, West Coast IPA, Double IPA, Triple IPA, Pilsner, Lager, Stout, Porter, Ale, Pale Ale, Amber Ale, Brown Ale, Wheat, Hefeweizen, Saison, Sour, Gose, Kolsch, Blonde, Golden, Red Ale, Scotch Ale, Barleywine, ESB, Bitter, Mild, Cream Ale, Dunkel, Bock, Doppelbock, Marzen, Oktoberfest, Schwarzbier, Witbier, Tripel, Dubbel, Quad, Belgian, Farmhouse, Wild Ale, Berliner Weisse, Fruit Beer, Milkshake, Pastry, Imperial, Session
  - Example: "Firestone Pivo Pilsner" → "Firestone Pivo"
  - Example: "Elysian Space Dust IPA" → "Elysian Space Dust"
  - Example: "Modern Times Hazy IPA" → "Modern Times"
  - BUT keep style words that are part of the beer's actual proper name (e.g. "Pilsner Urquell" stays as-is, "Lagunitas IPA" stays because the beer IS called "Lagunitas IPA")
  - Use your judgment: if removing the style word leaves only a brewery name with no distinct beer name, keep the style word
- Do NOT include: prices, ABV percentages, serving sizes, descriptions, tasting notes, food items, wine, cocktails, spirits, non-alcoholic drinks, section headers, or any other text
- If you cannot identify any beers, return the single word: NONE
- Do not add any commentary, numbering, or formatting — just the beer names, one per line`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured in .env.local" },
      { status: 500 }
    );
  }

  const client = new Anthropic({ apiKey });

  const contentType = request.headers.get("content-type") || "";

  let imageContent: Anthropic.ImageBlockParam;

  if (contentType.includes("multipart/form-data")) {
    // Image file upload
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mediaType = file.type as
      | "image/jpeg"
      | "image/png"
      | "image/webp"
      | "image/gif";

    imageContent = {
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    };
  } else {
    // JSON body with URL
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: "No image URL provided" },
        { status: 400 }
      );
    }

    // Fetch the image from the URL
    try {
      const imageRes = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          Accept: "image/*,*/*",
        },
      });

      if (!imageRes.ok) {
        return NextResponse.json(
          { error: `Failed to fetch image from URL (HTTP ${imageRes.status})` },
          { status: 400 }
        );
      }

      const imageBuffer = await imageRes.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString("base64");

      // Determine media type from response or URL
      let mediaType = imageRes.headers.get("content-type") || "";
      if (!mediaType.startsWith("image/")) {
        // Try to guess from URL extension
        if (url.match(/\.png(\?|$)/i)) mediaType = "image/png";
        else if (url.match(/\.webp(\?|$)/i)) mediaType = "image/webp";
        else if (url.match(/\.gif(\?|$)/i)) mediaType = "image/gif";
        else mediaType = "image/jpeg"; // default
      }

      imageContent = {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType as
            | "image/jpeg"
            | "image/png"
            | "image/webp"
            | "image/gif",
          data: base64,
        },
      };
    } catch {
      return NextResponse.json(
        { error: "Could not fetch image from that URL. Check the link and try again." },
        { status: 400 }
      );
    }
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [imageContent, { type: "text", text: BEER_EXTRACT_PROMPT }],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    if (text.trim() === "NONE") {
      return NextResponse.json({ beerNames: [] });
    }

    const beerNames = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return NextResponse.json({ beerNames });
  } catch (error) {
    console.error("Claude vision API error:", error);
    return NextResponse.json(
      { error: "Failed to analyze menu image" },
      { status: 500 }
    );
  }
}
