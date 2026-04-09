import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Web Share Target sends the shared image as multipart form data.
  // We store it temporarily and redirect to the home page with a flag
  // to process the shared image.
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      // No image shared — just redirect home
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Convert file to base64 and pass via URL fragment (stays client-side)
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Redirect to home with the image data encoded in a query param
    // For large images, we use a temporary storage approach instead
    const url = new URL("/", request.url);
    url.searchParams.set("shared", "1");
    url.searchParams.set("imageType", file.type);

    // Store in a simple in-memory cache with a short-lived token
    const token = Math.random().toString(36).substring(2, 15);
    sharedImages.set(token, { dataUrl, expires: Date.now() + 60_000 });
    url.searchParams.set("token", token);

    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/", request.url));
  }
}

// Simple in-memory store for shared images (short-lived)
const sharedImages = new Map<
  string,
  { dataUrl: string; expires: number }
>();

// Also expose a GET endpoint to retrieve the shared image
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 400 });
  }

  const entry = sharedImages.get(token);
  if (!entry || Date.now() > entry.expires) {
    sharedImages.delete(token || "");
    return NextResponse.json({ error: "Expired" }, { status: 404 });
  }

  // Clean up after retrieval
  sharedImages.delete(token);
  return NextResponse.json({ dataUrl: entry.dataUrl });
}
