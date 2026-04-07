const SECTION_HEADERS = new Set([
  "draft",
  "drafts",
  "on tap",
  "tap",
  "taps",
  "bottles",
  "bottle",
  "bottled",
  "cans",
  "can",
  "wine",
  "wines",
  "cocktails",
  "cocktail",
  "spirits",
  "food",
  "appetizers",
  "entrees",
  "desserts",
  "sides",
  "salads",
  "soups",
  "starters",
  "mains",
  "red",
  "white",
  "rose",
  "sparkling",
  "non-alcoholic",
  "na",
  "mixed drinks",
  "seltzers",
  "cider",
  "ciders",
  "mead",
]);

const PRICE_PATTERN = /\$?\d+\.?\d{0,2}\s*$/;
const ABV_PATTERN = /\s*[\d.]+%\s*(abv)?/gi;
const SIZE_PATTERN = /\s*\d+\s*(oz|ml|cl|pt|pint)\b/gi;
const PURE_NUMBER_PATTERN = /^\$?\d+\.?\d{0,2}$/;
const BULLET_PATTERN = /^[\s•\-–—*·]+/;

export function extractBeerNames(rawText: string): string[] {
  const lines = rawText.split("\n");
  const beerNames: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    let line = rawLine.trim();

    // Skip empty lines
    if (!line) continue;

    // Skip very short lines
    if (line.length < 3) continue;

    // Skip lines that are just numbers/prices
    if (PURE_NUMBER_PATTERN.test(line)) continue;

    // Skip section headers
    if (SECTION_HEADERS.has(line.toLowerCase().replace(/[:\s]/g, ""))) continue;

    // Remove leading bullets/dashes
    line = line.replace(BULLET_PATTERN, "").trim();

    // Remove trailing price
    line = line.replace(PRICE_PATTERN, "").trim();

    // Remove ABV patterns
    line = line.replace(ABV_PATTERN, "").trim();

    // Remove size patterns
    line = line.replace(SIZE_PATTERN, "").trim();

    // Remove trailing punctuation
    line = line.replace(/[,;:.\-–—]+$/, "").trim();

    // Skip if too short after cleaning
    if (line.length < 3) continue;

    // Skip if it looks like a description (too many words, starts with common desc words)
    const wordCount = line.split(/\s+/).length;
    if (wordCount > 8) continue;

    // Skip common non-beer lines
    const lower = line.toLowerCase();
    if (
      lower.startsWith("ask your server") ||
      lower.startsWith("please") ||
      lower.startsWith("happy hour") ||
      lower.startsWith("daily special") ||
      lower.includes("available") ||
      lower.includes("rotating")
    ) {
      continue;
    }

    const normalized = lower.replace(/\s+/g, " ");
    if (!seen.has(normalized)) {
      seen.add(normalized);
      beerNames.push(line);
    }
  }

  return beerNames;
}
