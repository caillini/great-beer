"use client";

import BeerList from "@/components/BeerList";
import MenuPhotoUpload from "@/components/MenuPhotoUpload";
import { useBeerSearch } from "@/hooks/useBeerSearch";
import { useOcr } from "@/hooks/useOcr";
import { useEffect, useRef, useState } from "react";

type ViewState = "input" | "results";

export default function Home() {
  const [viewState, setViewState] = useState<ViewState>("input");

  const beerSearch = useBeerSearch();
  const ocr = useOcr();
  const hasStartedLookup = useRef(false);

  const handlePhotoSelected = (file: File) => {
    hasStartedLookup.current = false;
    ocr.processImage(file);
  };

  const handleUrlSubmitted = (url: string) => {
    hasStartedLookup.current = false;
    ocr.processUrl(url);
  };

  // Auto-lookup as soon as beers are extracted
  useEffect(() => {
    if (
      ocr.status === "complete" &&
      ocr.extractedNames.length > 0 &&
      !hasStartedLookup.current
    ) {
      hasStartedLookup.current = true;
      setViewState("results");
      beerSearch.searchBatch(ocr.extractedNames);
    }
  }, [ocr.status, ocr.extractedNames, beerSearch]);

  const handleBack = () => {
    setViewState("input");
    hasStartedLookup.current = false;
    ocr.reset();
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-amber-950/30 to-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-lg mx-auto px-4 pt-8 pb-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold">
              <span className="text-amber-400">Great</span>{" "}
              <span className="text-white">Beer</span>
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Scan a menu to find the best beers, rated by the community
            </p>
          </div>
        </div>
      </div>

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
          ocr.extractedNames.length === 0 && (
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
    </main>
  );
}
