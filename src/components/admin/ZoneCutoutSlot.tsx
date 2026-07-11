"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { layerHasAlphaVariation } from "@/lib/images/mask-alpha";
import { loadImageDataFromFile } from "@/lib/images/region-labeler";
import {
  ImageSourceInput,
  emptyImageSource,
  type ImageSourceValue,
} from "@/components/admin/ImageSourceInput";

interface ZoneCutoutSlotProps {
  label: string;
  hint?: string;
  value: ImageSourceValue;
  onChange: (value: ImageSourceValue) => void;
  optional?: boolean;
  existedBefore?: boolean;
  removed?: boolean;
  /** Clear the current upload (or restore existing preview). Prefer this for mistaken PNGs. */
  onClear?: () => void;
  /** Remove the zone entirely (edit) or delete a cabinet row. */
  onRemove?: () => void;
  onRestore?: () => void;
  /** Extra controls rendered next to the label (e.g. a name input for cabinet rows). */
  headerExtra?: React.ReactNode;
}

/** True once the file has been checked and found to have no real alpha transparency. */
function useAlphaWarning(file: File | null): boolean | null {
  const [warn, setWarn] = useState<boolean | null>(null);
  // Reset synchronously when the file identity changes (React "adjust state during render" pattern).
  const [prevFile, setPrevFile] = useState(file);
  if (prevFile !== file) {
    setPrevFile(file);
    setWarn(null);
  }

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    loadImageDataFromFile(file)
      .then(({ data, width, height }) => {
        if (cancelled) return;
        const hasAlpha = layerHasAlphaVariation(data, width * height);
        setWarn(!hasAlpha);
      })
      .catch(() => {
        if (!cancelled) setWarn(null);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  return warn;
}

export function ZoneCutoutSlot({
  label,
  hint,
  value,
  onChange,
  optional,
  existedBefore,
  removed,
  onClear,
  onRemove,
  onRestore,
  headerExtra,
}: ZoneCutoutSlotProps) {
  const { t } = useLanguage();
  const showsNoAlpha = useAlphaWarning(value.file);
  const hasUpload = Boolean(value.file || value.url || value.preview);

  if (removed) {
    return (
      <div className="wizard-zone-slot wizard-zone-slot--removed">
        <p className="text-sm text-muted">
          {label} — {t("wizardZoneRemovedNote")}
        </p>
        {onRestore && (
          <button type="button" className="wp-button wp-button--secondary wp-button--small" onClick={onRestore}>
            {t("wizardRestoreZone")}
          </button>
        )}
      </div>
    );
  }

  function handleClear() {
    if (onClear) {
      onClear();
      return;
    }
    onChange(emptyImageSource());
  }

  return (
    <div className="wizard-zone-slot">
      <div className="wizard-zone-slot-head">
        {headerExtra ?? (
          <p className="text-sm font-semibold text-charcoal">
            {label}
            {optional ? ` (${t("wizardOptional")})` : ""}
          </p>
        )}
        <div className="wizard-zone-slot-actions">
          {hasUpload && (
            <button
              type="button"
              className="wp-button wp-button--secondary wp-button--small"
              onClick={handleClear}
            >
              {t("wizardClearCutout")}
            </button>
          )}
          {onRemove && (
            <button type="button" className="wp-button wp-button--secondary wp-button--small" onClick={onRemove}>
              {existedBefore ? t("wizardRemoveZone") : t("wizardRemoveCabinetRow")}
            </button>
          )}
        </div>
      </div>

      {existedBefore && !value.file && !value.url && (
        <p className="wizard-zone-current-badge">{t("wizardZoneCurrentlyConfigured")}</p>
      )}

      <ImageSourceInput
        label=""
        hint={hint}
        accept="image/png"
        value={value}
        onChange={onChange}
        allowClear={false}
      />

      {showsNoAlpha && (
        <p className="wizard-mapper-warn">{t("wizardNoAlphaWarning")}</p>
      )}
    </div>
  );
}
