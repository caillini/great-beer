import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// Allow up to 60s for Claude Vision API call
export const maxDuration = 60;

const BEER_EXTRACT_PROMPT = `You are analyzing a photo of a bar or restaurant menu. Extract ONLY the beers from this image.

For each beer, identify three separate pieces of information:
1. **brewery** — the brewery/producer name (e.g. "Sierra Nevada", "Lagunitas", "Bell's")
2. **beerName** — the specific beer name WITHOUT the style (e.g. "Pale Ale", "Space Dust", "Two Hearted")
3. **style** — the beer style/type (e.g. "IPA", "Hazy IPA", "Pilsner", "Stout", "Lager", "Sour", "Porter")

Rules:
- Return ONLY a JSON array of objects with keys: brewery, beerName, style
- Separate the brewery from the beer name — do NOT combine them
- The style should be the beer category/type, NOT part of the beer name
  - Example: "Elysian Space Dust IPA" → {"brewery": "Elysian", "beerName": "Space Dust", "style": "IPA"}
  - Example: "Sierra Nevada Pale Ale" → {"brewery": "Sierra Nevada", "beerName": "Pale Ale", "style": "Pale Ale"}
  - Example: "Firestone Walker Pivo Pils" → {"brewery": "Firestone Walker", "beerName": "Pivo", "style": "Pilsner"}
  - Example: "Guinness Draught" → {"brewery": "Guinness", "beerName": "Draught", "style": "Stout"}
  - Example: "Modelo Especial" → {"brewery": "Modelo", "beerName": "Especial", "style": "Lager"}
- If the brewery name is not visible, use an empty string for brewery
- If the style is not visible, use your beer knowledge to infer it, or use an empty string
- Do NOT include: food items, wine, cocktails, spirits, non-alcoholic drinks
- If you cannot identify any beers, return an empty array: []
- Return ONLY valid JSON, no commentary or markdown formatting`;

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

    // Parse JSON array from response (strip markdown code fences if present)
    const jsonText = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

    try {
      const beers = JSON.parse(jsonText);
      if (!Array.isArray(beers)) {
        return NextResponse.json({ beers: [] });
      }
      // Validate and clean entries
      const cleaned = beers
        .filter((b: { brewery?: string; beerName?: string }) => b.beerName || b.brewery)
        .map((b: { brewery?: string; beerName?: string; style?: string }) => ({
          brewery: (b.brewery || "").trim(),
          beerName: (b.beerName || "").trim(),
          style: (b.style || "").trim(),
        }));
      return NextResponse.json({ beers: cleaned });
    } catch {
      // Fallback: treat as line-separated beer names for backwards compat
      const beerNames = text
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0 && line !== "NONE");
      const beers = beerNames.map((name: string) => ({
        brewery: "",
        beerName: name,
        style: "",
      }));
      return NextResponse.json({ beers });
    }
  } catch (error) {
    console.error("Claude vision API error:", error);
    return NextResponse.json(
      { error: "Failed to analyze menu image" },
      { status: 500 }
    );
  }
}
