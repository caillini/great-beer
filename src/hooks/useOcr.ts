"use client";

import { useCallback, useState } from "react";

type OcrStatus = "idle" | "processing" | "complete" | "error";

export function useOcr() {
  const [status, setStatus] = useState<OcrStatus>("idle");
  const [statusText, setStatusText] = useState("");
  const [extractedNames, setExtractedNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const processImage = useCallback(async (file: File) => {
    setStatus("processing");
    setStatusText("Analyzing menu with AI...");
    setError(null);
    setExtractedNames([]);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/menu/extract", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to analyze menu");
      }

      const { beerNames } = await res.json();
      setExtractedNames(beerNames || []);
      setStatus("complete");
      setStatusText(
        beerNames.length > 0
          ? `Found ${beerNames.length} beer${beerNames.length !== 1 ? "s" : ""}`
          : "No beers detected. Try a clearer photo."
      );
    } catch (err) {
      console.error("Menu analysis failed:", err);
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Failed to analyze menu. Please try again."
      );
      setStatusText("");
    }
  }, []);

  const processUrl = useCallback(async (url: string) => {
    setStatus("processing");
    setStatusText("Fetching menu and analyzing with AI...");
    setError(null);
    setExtractedNames([]);

    try {
      const res = await fetch("/api/menu/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to analyze menu");
      }

      const { beerNames } = await res.json();
      setExtractedNames(beerNames || []);
      setStatus("complete");
      setStatusText(
        beerNames.length > 0
          ? `Found ${beerNames.length} beer${beerNames.length !== 1 ? "s" : ""}`
          : "No beers detected. Check the URL and try again."
      );
    } catch (err) {
      console.error("Menu URL analysis failed:", err);
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Failed to analyze menu from URL. Please try again."
      );
      setStatusText("");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setStatusText("");
    setExtractedNames([]);
    setError(null);
  }, []);

  return {
    processImage,
    processUrl,
    reset,
    status,
    progress: status === "processing" ? 50 : status === "complete" ? 100 : 0,
    statusText,
    extractedNames,
    error,
  };
}
