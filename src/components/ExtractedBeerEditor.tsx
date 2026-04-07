"use client";

import { useState } from "react";

interface ExtractedBeerEditorProps {
  beerNames: string[];
  onConfirm: (names: string[]) => void;
  onCancel: () => void;
}

export default function ExtractedBeerEditor({
  beerNames,
  onConfirm,
  onCancel,
}: ExtractedBeerEditorProps) {
  const [names, setNames] = useState<string[]>(beerNames);
  const [newBeer, setNewBeer] = useState("");

  const removeBeer = (index: number) => {
    setNames((prev) => prev.filter((_, i) => i !== index));
  };

  const updateBeer = (index: number, value: string) => {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  };

  const addBeer = () => {
    if (newBeer.trim()) {
      setNames((prev) => [...prev, newBeer.trim()]);
      setNewBeer("");
    }
  };

  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">
          Detected Beers ({names.length})
        </h3>
        <p className="text-xs text-zinc-400">Edit names for better results</p>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {names.map((name, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => updateBeer(i, e.target.value)}
              className="flex-1 bg-zinc-900/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={() => removeBeer(i)}
              className="text-zinc-500 hover:text-red-400 transition-colors p-1"
              aria-label="Remove beer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newBeer}
          onChange={(e) => setNewBeer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBeer())}
          placeholder="Add a beer manually..."
          className="flex-1 bg-zinc-900/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
        />
        <button
          onClick={addBeer}
          className="text-amber-400 hover:text-amber-300 transition-colors px-3 py-2 text-sm font-medium"
        >
          + Add
        </button>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onConfirm(names.filter((n) => n.trim()))}
          disabled={names.filter((n) => n.trim()).length === 0}
          className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-semibold rounded-xl py-3 transition-colors"
        >
          Look Up Ratings ({names.filter((n) => n.trim()).length})
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-3 text-zinc-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
