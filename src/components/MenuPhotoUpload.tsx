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
