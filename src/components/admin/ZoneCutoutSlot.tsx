"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { layerHasAlphaVariation } from "@/lib/images/mask-alpha";
import { loadImageDataFromFile } from "@/lib/images/region-labeler";
import { ImageSourceInput, type ImageSourceValue } from "@/components/admin/ImageSourceInput";

interface ZoneCutoutSlotProps {
  label: string;
  hint?: string;
  value: ImageSourceValue;
  onChange: (value: ImageSourceValue) => void;
  optional?: boolean;
  existedBefore?: boolean;
  removed?: boolean;
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
  onRemove,
  onRestore,
  headerExtra,
}: ZoneCutoutSlotProps) {
  const { t } = useLanguage();
  const showsNoAlpha = useAlphaWarning(value.file);

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

  return (
    <div className="wizard-zone-slot">
      <div className="wizard-zone-slot-head">
        {headerExtra ?? (
          <p className="text-sm font-semibold text-charcoal">
            {label}
            {optional ? ` (${t("wizardOptional")})` : ""}
          </p>
        )}
        {onRemove && (
          <button type="button" className="wp-button wp-button--secondary wp-button--small" onClick={onRemove}>
            {existedBefore ? t("wizardRemoveZone") : t("wizardRemoveCabinetRow")}
          </button>
        )}
      </div>

      {existedBefore && !value.file && !value.url && (
        <p className="wizard-zone-current-badge">{t("wizardZoneCurrentlyConfigured")}</p>
      )}

      <ImageSourceInput label="" hint={hint} accept="image/png" value={value} onChange={onChange} />

      {showsNoAlpha && (
        <p className="wizard-mapper-warn">{t("wizardNoAlphaWarning")}</p>
      )}
    </div>
  );
}
