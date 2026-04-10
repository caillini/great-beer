import Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";
import { NextRequest, NextResponse } from "next/server";

// Allow up to 60s for Claude API call
export const maxDuration = 60;

const BEER_EXTRACT_PROMPT_IMAGE = `You are analyzing a photo of a bar or restaurant menu. Extract ONLY the beers from this image.

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
- Do NOT include: food items, wine, cocktails, spirits, ciders, hard seltzers, hard kombucha, CBD drinks, sparkling water, non-alcoholic (NA) beverages, or any non-beer drinks
- Do NOT include generic/vague entries like "Assorted Styles", "Assorted Flavors", or "Gluten Free Beer" without a specific beer name
- Do NOT include bottled or canned beers — ONLY include draft/tap beers
- ONLY include items that are clearly a specific, named BEER (not cider, not seltzer, not NA)
- ONLY include beers that are explicitly listed on the menu — do NOT infer, guess, or add beers that are not written on the menu
- If you cannot identify any beers, return an empty array: []
- Return ONLY valid JSON, no commentary or markdown formatting`;

const BEER_EXTRACT_PROMPT_TEXT = `You are analyzing text from a bar or restaurant menu. Extract ONLY the draft/tap beers from this text.

For each beer, identify three separate pieces of information:
1. **brewery** — the brewery/producer name (e.g. "Sierra Nevada", "Lagunitas", "Bell's")
2. **beerName** — the specific beer name WITHOUT the style (e.g. "Pale Ale", "Space Dust", "Two Hearted")
3. **style** — the beer style/type (e.g. "IPA", "Hazy IPA", "Pilsner", "Stout", "Lager", "Sour", "Porter")

Rules:
- Return ONLY a JSON array of objects with keys: brewery, beerName, style
- Separate the brewery from the beer name — do NOT combine them
- The style should be the beer category/type, NOT part of the beer name
- If the brewery name is not visible, use an empty string for brewery
- If the style is not visible, use your beer knowledge to infer it, or use an empty string
- Do NOT include: food items, appetizers, entrees, desserts, sides, wine, cocktails, spirits, ciders, hard seltzers, hard kombucha, CBD drinks, sparkling water, non-alcoholic (NA) beverages, or any non-beer drinks
- Do NOT include generic/vague entries like "Assorted Styles" or "Ask your server"
- Do NOT include bottled or canned beers — ONLY include draft/tap beers
- ONLY include items that are clearly a specific, named BEER
- ONLY include beers that are explicitly listed in the text — do NOT infer, guess, or add beers not mentioned
- If you cannot identify any beers, return an empty array: []
- Return ONLY valid JSON, no commentary or markdown formatting`;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function parseBeersFromResponse(text: string) {
  const jsonText = text
    .replace(/```json?\n?/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    const beers = JSON.parse(jsonText);
    if (!Array.isArray(beers)) return [];
    return beers
      .filter(
        (b: { brewery?: string; beerName?: string }) =>
          b.beerName || b.brewery
      )
      .map((b: { brewery?: string; beerName?: string; style?: string }) => ({
        brewery: (b.brewery || "").trim(),
        beerName: (b.beerName || "").trim(),
        style: (b.style || "").trim(),
      }));
  } catch {
    // Fallback: line-separated beer names
    const lines = text
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0 && l !== "NONE");
    return lines.map((name: string) => ({
      brewery: "",
      beerName: name,
      style: "",
    }));
  }
}

/**
 * Fetch a URL and determine if it's an image, PDF, or HTML page.
 */
async function fetchUrl(url: string): Promise<{
  type: "image" | "pdf" | "html";
  buffer: ArrayBuffer;
  contentType: string;
  html?: string;
}> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/*,*/*;q=0.8",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const ct = res.headers.get("content-type") || "";
  const buffer = await res.arrayBuffer();

  if (ct.startsWith("image/")) {
    return { type: "image", buffer, contentType: ct };
  }
  if (ct.includes("pdf")) {
    return { type: "pdf", buffer, contentType: ct };
  }

  // Check URL extension as fallback
  if (url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)) {
    return { type: "image", buffer, contentType: ct };
  }
  if (url.match(/\.pdf(\?|$)/i)) {
    return { type: "pdf", buffer, contentType: ct };
  }

  const html = new TextDecoder().decode(buffer);
  return { type: "html", buffer, contentType: ct, html };
}

/**
 * Extract text from HTML, focusing on menu-relevant content.
 */
function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);

  // Remove scripts, styles, nav, footer, headers
  $("script, style, nav, footer, header, noscript, iframe").remove();

  // Get text content
  const text = $("body").text();

  // Clean up whitespace
  return text
    .replace(/\s+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 15000); // Limit to ~15k chars for Claude
}

/**
 * Find PDF links in HTML that look like menus.
 */
function findPdfLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const pdfs: string[] = [];

  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().toLowerCase();

    if (href.match(/\.pdf(\?|$)/i)) {
      // Resolve relative URLs
      try {
        const fullUrl = new URL(href, baseUrl).toString();
        const combined = (href + " " + text).toLowerCase();
        // Skip brunch, spirits, happy hour, catering, wine, dessert PDFs
        const isExcluded =
          combined.includes("brunch") ||
          combined.includes("spirit") ||
          combined.includes("happy hour") ||
          combined.includes("catering") ||
          combined.includes("wine list") ||
          combined.includes("dessert");
        // Prioritize main menu / beer / drink / tap PDFs
        const isMenu =
          combined.includes("menu") ||
          combined.includes("beer") ||
          combined.includes("drink") ||
          combined.includes("tap") ||
          combined.includes("f&b") ||
          combined.includes("fb") ||
          combined.includes("food");
        if (isExcluded) {
          pdfs.push(fullUrl); // Low priority
        } else if (isMenu) {
          pdfs.unshift(fullUrl); // High priority
        } else {
          pdfs.push(fullUrl);
        }
      } catch {
        // Skip invalid URLs
      }
    }
  });

  // Also check for PDFs in image sources or embedded objects
  $("embed[src], object[data], iframe[src]").each((_i, el) => {
    const src = $(el).attr("src") || $(el).attr("data") || "";
    if (src.match(/\.pdf(\?|$)/i)) {
      try {
        pdfs.push(new URL(src, baseUrl).toString());
      } catch {
        // Skip
      }
    }
  });

  return [...new Set(pdfs)]; // Deduplicate
}

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

  // ── Image file upload (multipart form) ──
  if (contentType.includes("multipart/form-data")) {
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

    return analyzeImage(client, base64, mediaType);
  }

  // ── JSON body with URL ──
  const body = await request.json();
  const { url } = body;

  if (!url) {
    return NextResponse.json(
      { error: "No URL provided" },
      { status: 400 }
    );
  }

  try {
    const fetched = await fetchUrl(url);

    if (fetched.type === "image") {
      const base64 = Buffer.from(fetched.buffer).toString("base64");
      let mediaType = fetched.contentType;
      if (!mediaType.startsWith("image/")) {
        if (url.match(/\.png(\?|$)/i)) mediaType = "image/png";
        else if (url.match(/\.webp(\?|$)/i)) mediaType = "image/webp";
        else if (url.match(/\.gif(\?|$)/i)) mediaType = "image/gif";
        else mediaType = "image/jpeg";
      }
      return analyzeImage(
        client,
        base64,
        mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif"
      );
    }

    if (fetched.type === "pdf") {
      const base64 = Buffer.from(fetched.buffer).toString("base64");
      return analyzePdf(client, base64);
    }

    // ── HTML page ──
    const html = fetched.html || "";

    // Strategy 1: Extract text from the page and look for beers
    const pageText = extractTextFromHtml(html);
    if (pageText.length > 100) {
      console.log(
        `[extract] Page text: ${pageText.length} chars, trying text extraction...`
      );
      const beers = await analyzeText(client, pageText);
      if (beers.length > 0) {
        return NextResponse.json({ beers });
      }
    }

    // Strategy 2: Find linked PDFs (common for restaurant menus)
    const pdfLinks = findPdfLinks(html, url);
    if (pdfLinks.length > 0) {
      console.log(
        `[extract] Found ${pdfLinks.length} PDF link(s): ${pdfLinks.slice(0, 3).join(", ")}`
      );

      // Try the first menu-related PDF
      for (const pdfUrl of pdfLinks.slice(0, 2)) {
        try {
          console.log(`[extract] Fetching PDF: ${pdfUrl}`);
          const pdfRes = await fetch(pdfUrl, {
            headers: { "User-Agent": UA },
          });
          if (pdfRes.ok) {
            const pdfBuffer = await pdfRes.arrayBuffer();
            const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");
            const result = await analyzePdf(client, pdfBase64);
            const data = await result.json();
            if (data.beers && data.beers.length > 0) {
              return NextResponse.json(data);
            }
          }
        } catch (err) {
          console.error(`[extract] PDF fetch failed: ${err}`);
        }
      }
    }

    // Strategy 3: Nothing worked
    return NextResponse.json({
      beers: [],
      error:
        "No beers found on this page. Try uploading a photo of the menu instead.",
    });
  } catch (err) {
    console.error("URL fetch/parse error:", err);
    return NextResponse.json(
      {
        error:
          "Could not load that URL. Check the link and try again, or upload a photo instead.",
      },
      { status: 400 }
    );
  }
}

// ── Claude API helpers ──

async function analyzeImage(
  client: Anthropic,
  base64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"
) {
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: BEER_EXTRACT_PROMPT_IMAGE },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const beers = parseBeersFromResponse(text);
    return NextResponse.json({ beers });
  } catch (error) {
    console.error("Claude Vision API error:", error);
    return NextResponse.json(
      { error: "Failed to analyze menu image" },
      { status: 500 }
    );
  }
}

async function analyzePdf(client: Anthropic, base64: string) {
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            { type: "text", text: BEER_EXTRACT_PROMPT_IMAGE },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const beers = parseBeersFromResponse(text);
    return NextResponse.json({ beers });
  } catch (error) {
    console.error("Claude PDF API error:", error);
    return NextResponse.json(
      { error: "Failed to analyze menu PDF" },
      { status: 500 }
    );
  }
}

async function analyzeText(
  client: Anthropic,
  text: string
): Promise<{ brewery: string; beerName: string; style: string }[]> {
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Here is the text content from a restaurant/bar menu page:\n\n${text}\n\n${BEER_EXTRACT_PROMPT_TEXT}`,
            },
          ],
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";
    return parseBeersFromResponse(responseText);
  } catch (error) {
    console.error("Claude text API error:", error);
    return [];
  }
}
