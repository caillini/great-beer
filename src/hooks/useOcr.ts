"use client";

import type { MenuBeerEntry } from "@/lib/types";
import { useCallback, useState } from "react";

type OcrStatus = "idle" | "processing" | "complete" | "error";

export function useOcr() {
  const [status, setStatus] = useState<OcrStatus>("idle");
  const [statusText, setStatusText] = useState("");
  const [extractedBeers, setExtractedBeers] = useState<MenuBeerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleResponse = useCallback(async (res: Response) => {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to analyze menu");
    }

    const data = await res.json();
    const beers: MenuBeerEntry[] = data.beers || [];
    setExtractedBeers(beers);
    setStatus("complete");
    setStatusText(
      beers.length > 0
        ? `Found ${beers.length} beer${beers.length !== 1 ? "s" : ""}`
        : "No beers detected. Try a clearer photo."
    );
  }, []);

  const processImage = useCallback(async (file: File) => {
    setStatus("processing");
    setStatusText("Analyzing menu with AI...");
    setError(null);
    setExtractedBeers([]);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/menu/extract", {
        method: "POST",
        body: formData,
      });

      await handleResponse(res);
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
  }, [handleResponse]);

  const processUrl = useCallback(async (url: string) => {
    setStatus("processing");
    setStatusText("Fetching menu and analyzing with AI...");
    setError(null);
    setExtractedBeers([]);

    try {
      const res = await fetch("/api/menu/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      await handleResponse(res);
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
  }, [handleResponse]);

  const reset = useCallback(() => {
    setStatus("idle");
    setStatusText("");
    setExtractedBeers([]);
    setError(null);
  }, []);

  return {
    processImage,
    processUrl,
    reset,
    status,
    progress: status === "processing" ? 50 : status === "complete" ? 100 : 0,
    statusText,
    extractedBeers,
    error,
  };
}
