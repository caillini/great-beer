export interface Beer {
  name: string;
  brewery: string;
  style: string;
  abv: number | null;
  ibu: number | null;
  rating: number | null;
  ratingCount: number | null;
  description: string;
  imageUrl: string | null;
  untappdUrl: string | null;
}

export interface Venue {
  id: string;
  name: string;
  slug: string;
  location: string;
  imageUrl: string | null;
  untappdUrl: string;
}

export interface OcrResult {
  rawText: string;
  extractedBeerNames: string[];
  confidence: number;
}

export interface MenuBeerEntry {
  brewery: string;
  beerName: string;
  style: string;
}

export interface BeerSearchResult {
  query: string;
  match: Beer | null;
  confidence: "exact" | "fuzzy" | "none";
}
