"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface MenuPhotoUploadProps {
  onImageSelected: (file: File) => void;
  onUrlSubmitted: (url: string) => void;
  processing?: boolean;
  progress?: number;
  statusText?: string;
}

export default function MenuPhotoUpload({
  onImageSelected,
  onUrlSubmitted,
  processing = false,
  progress = 0,
  statusText = "",
}: MenuPhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [menuUrl, setMenuUrl] = useState("");
  const [inputMode, setInputMode] = useState<"photo" | "url">("photo");

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setPreview(URL.createObjectURL(file));
        onImageSelected(file);
      }
    },
    [onImageSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".heic"] },
    maxFiles: 1,
    disabled: processing,
  });

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = menuUrl.trim();
    if (trimmed) {
      setPreview(null);
      onUrlSubmitted(trimmed);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      {!processing && (
        <div className="flex bg-zinc-800/50 rounded-xl p-1">
          <button
            onClick={() => setInputMode("photo")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              inputMode === "photo"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Photo
          </button>
          <button
            onClick={() => setInputMode("url")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              inputMode === "url"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Menu Link
          </button>
        </div>
      )}

      {/* Photo upload mode */}
      {inputMode === "photo" && (
        <>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${isDragActive ? "border-amber-500 bg-amber-500/10" : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50"}
              ${processing ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input {...getInputProps()} />

            {preview ? (
              <div className="space-y-3">
                <img
                  src={preview}
                  alt="Menu preview"
                  className="max-h-48 mx-auto rounded-lg object-contain"
                />
                {processing ? (
                  <div className="space-y-2">
                    <div className="w-full bg-zinc-700 rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(progress, 5)}%` }}
                      />
                    </div>
                    <p className="text-sm text-amber-400">{statusText}</p>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">Tap to change photo</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-5xl">📸</div>
                <div>
                  <p className="text-white font-medium">
                    Take a photo or upload beer menu
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">
                    Drag & drop, tap to browse, or use your camera
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Camera capture button for mobile */}
          {!processing && (
            <label className="block">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPreview(URL.createObjectURL(file));
                    onImageSelected(file);
                  }
                }}
              />
              <div className="flex items-center justify-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl py-3 cursor-pointer hover:bg-amber-500/20 transition-colors">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="font-medium">Open Camera</span>
              </div>
            </label>
          )}
        </>
      )}

      {/* URL input mode */}
      {inputMode === "url" && (
        <form onSubmit={handleUrlSubmit} className="space-y-3">
          <div className="border-2 border-dashed border-zinc-700 rounded-xl p-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="text-4xl">🔗</div>
              <p className="text-white font-medium">
                Paste a link to a menu image
              </p>
              <p className="text-sm text-zinc-400">
                Works with direct image URLs (.jpg, .png, .webp)
              </p>
            </div>

            {processing ? (
              <div className="space-y-2">
                <div className="w-full bg-zinc-700 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(progress, 5)}%` }}
                  />
                </div>
                <p className="text-sm text-amber-400 text-center">
                  {statusText}
                </p>
              </div>
            ) : (
              <>
                <input
                  type="url"
                  value={menuUrl}
                  onChange={(e) => setMenuUrl(e.target.value)}
                  placeholder="https://example.com/menu.jpg"
                  className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors text-sm"
                />
                <button
                  type="submit"
                  disabled={!menuUrl.trim()}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-semibold rounded-xl py-3 transition-colors"
                >
                  Analyze Menu
                </button>
              </>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
