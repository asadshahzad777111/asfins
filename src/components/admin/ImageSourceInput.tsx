"use client";

import { useEffect, useId, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export type ImageSourceMode = "upload" | "url";

export interface ImageSourceValue {
  file: File | null;
  url: string;
  preview: string | null;
  mode: ImageSourceMode;
}

interface ImageSourceInputProps {
  label: string;
  hint?: string;
  accept?: string;
  value: ImageSourceValue;
  onChange: (value: ImageSourceValue) => void;
  required?: boolean;
}

export function emptyImageSource(): ImageSourceValue {
  return { file: null, url: "", preview: null, mode: "upload" };
}

export function ImageSourceInput({
  label,
  hint,
  accept = "image/jpeg,image/png,image/webp",
  value,
  onChange,
  required,
}: ImageSourceInputProps) {
  const { t } = useLanguage();
  const inputId = useId();
  const [urlDraft, setUrlDraft] = useState(value.url);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUrlDraft(value.url);
  }, [value.url]);

  function setMode(mode: ImageSourceMode) {
    setError(null);
    onChange({ ...value, mode });
  }

  function handleFileChange(file: File | null) {
    setError(null);
    const preview = file ? URL.createObjectURL(file) : null;
    onChange({ ...value, file, url: "", preview, mode: "upload" });
  }

  async function applyUrl() {
    const trimmed = urlDraft.trim();
    if (!trimmed) {
      setError(t("imageUrlRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/fetch-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? t("imageUrlError"));
      }

      const blob = await res.blob();
      const preview = URL.createObjectURL(blob);
      onChange({ file: null, url: trimmed, preview, mode: "url" });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("imageUrlError"));
    } finally {
      setLoading(false);
    }
  }

  const hasImage = Boolean(value.preview);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-charcoal">{label}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>

      <div className="flex gap-1 rounded-sm border border-divider bg-marble p-1">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex-1 rounded-sm px-3 py-2 text-xs font-medium transition-colors ${
            value.mode === "upload"
              ? "bg-brass text-marble shadow-sm"
              : "text-muted hover:text-charcoal"
          }`}
        >
          {t("imageSourceUpload")}
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex-1 rounded-sm px-3 py-2 text-xs font-medium transition-colors ${
            value.mode === "url"
              ? "bg-brass text-marble shadow-sm"
              : "text-muted hover:text-charcoal"
          }`}
        >
          {t("imageSourceUrl")}
        </button>
      </div>

      {value.mode === "upload" ? (
        <input
          id={inputId}
          type="file"
          accept={accept}
          required={required && !hasImage}
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          className="block w-full rounded-sm border border-dashed border-brass bg-base px-3 py-3 text-sm text-charcoal file:mr-3 file:rounded-sm file:border-0 file:bg-brass file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-marble"
        />
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void applyUrl();
              }
            }}
            placeholder={t("imageUrlPlaceholder")}
            className="min-w-0 flex-1 rounded-sm border border-divider bg-base px-3 py-2.5 text-sm text-charcoal"
          />
          <button
            type="button"
            onClick={() => void applyUrl()}
            disabled={loading}
            className="shrink-0 rounded-sm bg-brass px-4 py-2.5 text-sm font-medium text-marble disabled:opacity-50"
          >
            {loading ? t("imageUrlLoading") : t("imageUrlApply")}
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      )}

      {hasImage && (
        <div className="overflow-hidden rounded-sm border border-divider bg-base">
          <p className="border-b border-divider bg-marble px-3 py-1.5 text-xs font-medium text-charcoal">
            {t("imagePreview")}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.preview!}
            alt={label}
            className="max-h-48 w-full object-contain"
            style={{
              background:
                "repeating-conic-gradient(#d4ccc0 0% 25%, #ede7dd 0% 50%) 50% / 14px 14px",
            }}
          />
          <p className="border-t border-divider bg-marble/60 px-3 py-1.5 text-[10px] text-muted">
            {t("imagePreviewTransparencyHint")}
          </p>
        </div>
      )}
    </div>
  );
}
