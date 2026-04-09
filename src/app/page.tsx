"use client";

import BeerList from "@/components/BeerList";
import MenuPhotoUpload from "@/components/MenuPhotoUpload";
import { useBeerSearch } from "@/hooks/useBeerSearch";
import { useOcr } from "@/hooks/useOcr";
import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

type ViewState = "input" | "results";

function HomeContent() {
  const [viewState, setViewState] = useState<ViewState>("input");
  const searchParams = useSearchParams();

  const beerSearch = useBeerSearch();
  const ocr = useOcr();
  const hasStartedLookup = useRef(false);
  const hasProcessedShare = useRef(false);

  const handlePhotoSelected = useCallback(
    (file: File) => {
      hasStartedLookup.current = false;
      ocr.processImage(file);
    },
    [ocr]
  );

  const handleUrlSubmitted = useCallback(
    (url: string) => {
      hasStartedLookup.current = false;
      ocr.processUrl(url);
    },
    [ocr]
  );

  // Handle shared image from Web Share Target (Android)
  useEffect(() => {
    const shared = searchParams.get("shared");
    const token = searchParams.get("token");

    if (shared === "1" && token && !hasProcessedShare.current) {
      hasProcessedShare.current = true;

      fetch(`/share?token=${token}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.dataUrl) {
            return fetch(data.dataUrl);
          }
          throw new Error("No image data");
        })
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], "shared-menu.jpg", {
            type: blob.type,
          });
          handlePhotoSelected(file);
        })
        .catch(() => {
          // Silently fail — user can still upload manually
        });

      window.history.replaceState({}, "", "/");
    }
  }, [searchParams, handlePhotoSelected]);

  // Auto-lookup as soon as beers are extracted
  useEffect(() => {
    if (
      ocr.status === "complete" &&
      ocr.extractedBeers.length > 0 &&
      !hasStartedLookup.current
    ) {
      hasStartedLookup.current = true;
      setViewState("results");
      beerSearch.searchBatch(ocr.extractedBeers);
    }
  }, [ocr.status, ocr.extractedBeers, beerSearch]);

  const handleBack = () => {
    setViewState("input");
    hasStartedLookup.current = false;
    ocr.reset();
  };

  return (
    <>
      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {viewState === "results" && (
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Scan another menu
          </button>
        )}

        {/* Menu input */}
        {viewState === "input" && (
          <MenuPhotoUpload
            onImageSelected={handlePhotoSelected}
            onUrlSubmitted={handleUrlSubmitted}
            processing={ocr.status === "processing"}
            progress={ocr.progress}
            statusText={ocr.statusText}
          />
        )}

        {ocr.error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
            {ocr.error}
          </div>
        )}

        {ocr.status === "complete" &&
          ocr.extractedBeers.length === 0 && (
            <div className="text-center py-8 text-zinc-400">
              <p className="text-lg mb-2">No beers detected</p>
              <p className="text-sm">
                Try a clearer photo or check that the URL links directly to a
                menu image.
              </p>
            </div>
          )}

        {/* Beer Results */}
        {viewState === "results" && (
          <>
            {beerSearch.loading && (
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Looking up ratings...</span>
                  <span className="text-amber-400 font-medium">
                    {beerSearch.progress.done} / {beerSearch.progress.total}
                  </span>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${beerSearch.progress.total > 0 ? (beerSearch.progress.done / beerSearch.progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}
            <BeerList
              beers={beerSearch.beers}
              emptyMessage={
                beerSearch.loading
                  ? "Searching for beers..."
                  : "No matching beers found on Untappd."
              }
            />
            {beerSearch.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                {beerSearch.error}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-amber-950/30 to-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-lg mx-auto px-4 pt-8 pb-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold">
              <span className="text-amber-400">Drink</span>{" "}
              <span className="text-white">Good Beer</span>
            </h1>
            <p className="text-zinc-400 text-sm mt-1 italic">
              Life is too short
            </p>
          </div>
        </div>
      </div>

      <Suspense>
        <HomeContent />
      </Suspense>
    </main>
  );
}
