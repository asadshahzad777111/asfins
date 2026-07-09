"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ROOM_CATEGORIES } from "@/lib/rooms";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { roomLabel } from "@/lib/i18n/translations";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { Catalog } from "@/lib/catalogs/types";
import type { ZonePalette } from "@/lib/scenes/types";
import {
  getZoneQuestions,
  wizardProgress,
  type WizardStep,
} from "@/lib/scenes/zone-wizard";
import {
  getUnmappedRegionIds,
  loadImageDataFromFile,
  parseTransparentRegions,
  type ParsedCutout,
} from "@/lib/images/region-labeler";
import {
  ImageSourceInput,
  emptyImageSource,
  type ImageSourceValue,
} from "@/components/admin/ImageSourceInput";
import { CutoutZoneMapper } from "@/components/admin/CutoutZoneMapper";

interface SceneSetupWizardProps {
  catalogs: Catalog[];
  onComplete: () => void;
  onCancel: () => void;
}

function hasImageSource(source: ImageSourceValue): boolean {
  return Boolean(source.file || source.url);
}

function appendImageSource(form: FormData, key: string, source: ImageSourceValue) {
  if (source.file) {
    form.append(key, source.file);
  } else if (source.url) {
    form.append(`${key}Url`, source.url);
  }
}

export function SceneSetupWizard({ catalogs, onComplete, onCancel }: SceneSetupWizardProps) {
  const router = useRouter();
  const { lang, t } = useLanguage();

  const [step, setStep] = useState<WizardStep>("info");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("kitchen");
  const [basePhoto, setBasePhoto] = useState<ImageSourceValue>(emptyImageSource());
  const [cutout, setCutout] = useState<ImageSourceValue>(emptyImageSource());
  const [parsed, setParsed] = useState<ParsedCutout | null>(null);
  const [assignments, setAssignments] = useState<Record<string, number[]>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [enabledZones, setEnabledZones] = useState<Set<string>>(() => new Set());
  const [selectedCatalogs, setSelectedCatalogs] = useState<string[]>(catalogs.map((c) => c.id));
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err" | "warn"; text: string } | null>(null);
  const [editSkippedMode, setEditSkippedMode] = useState(false);

  const questions = useMemo(() => getZoneQuestions(category as "kitchen"), [category]);

  useEffect(() => {
    const qs = getZoneQuestions(category as "kitchen");
    const defaults = new Set(qs.filter((q) => !q.optional || q.id === "floor").map((q) => q.id));
    if (category === "kitchen") {
      [
        "floor",
        "upper-cabinet-left",
        "upper-cabinet-mid",
        "upper-cabinet-right",
        "lower-cabinet-left",
        "lower-cabinet-mid",
        "lower-cabinet-right",
        "island",
      ].forEach((id) => defaults.add(id));
    }
    setEnabledZones(defaults);
    setSkipped(new Set());
    setAssignments({});
    setQuestionIndex(0);
  }, [category]);

  const activeQuestions = useMemo(
    () =>
      questions.filter(
        (q) =>
          enabledZones.has(q.id) && (!skipped.has(q.id) || editSkippedMode)
      ),
    [questions, enabledZones, skipped, editSkippedMode]
  );
  const currentQuestion = step === "mapping" ? activeQuestions[questionIndex] : null;
  const progress = wizardProgress(step, questionIndex, questions.length);

  const regionToZone = useMemo(() => {
    const map: Record<number, string> = {};
    for (const [zoneId, regionIds] of Object.entries(assignments)) {
      for (const rid of regionIds) map[rid] = zoneId;
    }
    return map;
  }, [assignments]);

  const parseCutout = useCallback(async (source: ImageSourceValue) => {
    if (!source.file && !source.preview) return;
    setParsing(true);
    setMessage(null);
    try {
      let data: Uint8ClampedArray;
      let width: number;
      let height: number;
      if (source.file) {
        const loaded = await loadImageDataFromFile(source.file);
        data = loaded.data;
        width = loaded.width;
        height = loaded.height;
      } else if (source.preview) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("load fail"));
          img.src = source.preview!;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        data = imageData.data;
        width = canvas.width;
        height = canvas.height;
      } else {
        return;
      }

      const result = parseTransparentRegions(data, width, height);
      if (result.regions.length === 0) {
        setMessage({ type: "err", text: t("wizardNoRegionsFound") });
        setParsed(null);
      } else {
        setParsed(result);
        setAssignments({});
        setSkipped(new Set());
      }
    } catch {
      setMessage({ type: "err", text: t("wizardParseError") });
    } finally {
      setParsing(false);
    }
  }, [t]);

  useEffect(() => {
    if (cutout.file || cutout.preview) {
      void parseCutout(cutout);
    }
  }, [cutout, parseCutout]);

  function goToMapping() {
    setStep("mapping");
    setQuestionIndex(0);
    setEditSkippedMode(false);
  }

  function handleAssignRegionToZone(regionId: number, zoneId: string) {
    if (!zoneId) {
      setAssignments((prev) => {
        const next = { ...prev };
        for (const [zid, ids] of Object.entries(next)) {
          next[zid] = ids.filter((id) => id !== regionId);
          if (next[zid].length === 0) delete next[zid];
        }
        return next;
      });
      return;
    }

    setAssignments((prev) => {
      const next = { ...prev };
      for (const [zid, ids] of Object.entries(next)) {
        next[zid] = ids.filter((id) => id !== regionId);
        if (next[zid].length === 0) delete next[zid];
      }
      next[zoneId] = [...(next[zoneId] ?? []), regionId];
      return next;
    });
    setSkipped((s) => {
      const n = new Set(s);
      n.delete(zoneId);
      return n;
    });
  }

  function handleAssignRegion(regionId: number) {
    if (!currentQuestion) return;
    const zoneId = currentQuestion.id;

    setAssignments((prev) => {
      const next = { ...prev };
      for (const [zid, ids] of Object.entries(next)) {
        next[zid] = ids.filter((id) => id !== regionId);
        if (next[zid].length === 0) delete next[zid];
      }
      next[zoneId] = [...(next[zoneId] ?? []), regionId];
      return next;
    });
    setSkipped((s) => {
      const n = new Set(s);
      n.delete(zoneId);
      return n;
    });
  }

  function handleSkip() {
    if (!currentQuestion) return;
    setSkipped((s) => new Set(s).add(currentQuestion.id));
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[currentQuestion.id];
      return next;
    });
    advanceQuestion();
  }

  function advanceQuestion() {
    if (questionIndex < activeQuestions.length - 1) {
      setQuestionIndex((i) => i + 1);
    } else if (!editSkippedMode && skipped.size > 0) {
      setEditSkippedMode(true);
      setQuestionIndex(0);
    } else {
      setStep("review");
      setEditSkippedMode(false);
    }
  }

  function handleBack() {
    if (step === "review") {
      setStep("mapping");
      setQuestionIndex(Math.max(0, activeQuestions.length - 1));
      return;
    }
    if (step === "mapping") {
      if (questionIndex > 0) {
        setQuestionIndex((i) => i - 1);
      } else {
        setStep("zones");
      }
      return;
    }
    if (step === "zones") {
      setStep("cutout");
      return;
    }
    if (step === "cutout") {
      setStep("info");
      return;
    }
  }

  function jumpToSkipped(zoneId: string) {
    const idx = activeQuestions.findIndex((q) => q.id === zoneId);
    if (idx >= 0) {
      setStep("mapping");
      setEditSkippedMode(true);
      setQuestionIndex(idx);
    }
  }

  async function handleSave(force = false) {
    if (!parsed) return;

    const unmapped = getUnmappedRegionIds(parsed.regions, assignments);
    if (unmapped.length > 0 && !force) {
      setMessage({
        type: "warn",
        text: t("wizardUnmappedWarning", { count: unmapped.length }),
      });
      return;
    }

    const mappedZones = Object.entries(assignments).filter(([, ids]) => ids.length > 0);
    if (mappedZones.length === 0) {
      setMessage({ type: "err", text: t("wizardNoZonesMapped") });
      return;
    }

    setLoading(true);
    setMessage(null);

    const form = new FormData();
    form.append("wizardMode", "region");
    form.append("name", name);
    form.append("description", description);
    form.append("category", category);
    appendImageSource(form, "basePhoto", basePhoto);
    appendImageSource(form, "masterCutout", cutout);
    form.append("catalogIds", selectedCatalogs.join(","));
    form.append("regionMappings", JSON.stringify(assignments));
    form.append("zoneCount", String(mappedZones.length));

    mappedZones.forEach(([zoneId, _regionIds], i) => {
      const q = questions.find((q) => q.id === zoneId);
      form.append(`zone_${i}_id`, zoneId);
      form.append(`zone_${i}_label`, q ? t(q.labelKey as TranslationKey) : zoneId);
      form.append(`zone_${i}_palette`, (q?.palette ?? "wood") as ZonePalette);
    });

    const res = await fetch("/api/admin/scenes", { method: "POST", body: form });
    const data = await res.json();

    if (res.ok) {
      setMessage({ type: "ok", text: t("saveSuccess", { name }) });
      router.refresh();
      onComplete();
    } else {
      setMessage({ type: "err", text: data.error ?? "Upload fail" });
    }
    setLoading(false);
  }

  function paletteLabel(palette: ZonePalette) {
    if (palette === "wood") return t("paletteWood");
    if (palette === "tile") return t("paletteTile");
    return t("palettePaint");
  }

  return (
    <div className="wp-postbox">
      <div className="wp-postbox-head wizard-postbox-head">
        <span>{t("wizardTitle")}</span>
        <span className="wizard-progress">
          {t("wizardStepOf", { current: progress.current, total: progress.total })}
        </span>
      </div>

      <div className="wp-postbox-body">
        {message && (
          <div
            className={`wp-notice${
              message.type === "ok"
                ? " wp-notice--success"
                : message.type === "warn"
                  ? ""
                  : " wp-notice--error"
            }`}
            style={{ marginBottom: "1rem" }}
          >
            {message.text}
            {message.type === "warn" && (
              <div className="wizard-warn-actions">
                <button type="button" className="wp-button wp-button--small" onClick={() => void handleSave(true)}>
                  {t("wizardSaveAnyway")}
                </button>
                <button
                  type="button"
                  className="wp-button wp-button--secondary wp-button--small"
                  onClick={() => setMessage(null)}
                >
                  {t("wizardGoBackMap")}
                </button>
              </div>
            )}
          </div>
        )}

        {step === "info" && (
          <div className="wizard-step space-y-4">
            <p className="wizard-step-desc">{t("wizardStep1Desc")}</p>
            <div className="wizard-form-grid">
              <label className="form-group">
                <span>{t("kitchenName")}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Modern L-Kitchen"
                  required
                />
              </label>
              <label className="form-group">
                <span>{t("roomCategory")}</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {ROOM_CATEGORIES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {roomLabel(lang, r.id)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="form-group">
              <span>{t("descriptionOptional")}</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <ImageSourceInput
              label={t("kitchenFullPhoto")}
              hint={t("wizardStep1PhotoHint")}
              accept="image/jpeg,image/png,image/webp"
              value={basePhoto}
              onChange={setBasePhoto}
              required
            />
          </div>
        )}

        {step === "cutout" && (
          <div className="wizard-step space-y-4">
            <p className="wizard-step-desc">{t("wizardStep2Desc")}</p>
            <ImageSourceInput
              label={t("wizardMasterCutout")}
              hint={t("wizardMasterCutoutHint")}
              accept="image/png"
              value={cutout}
              onChange={setCutout}
              required
            />
            {parsing && <p className="wp-loading">{t("wizardParsingRegions")}</p>}
            {parsed && (
              <p className="wp-notice wp-notice--success">
                {t("wizardRegionsFound", { count: parsed.regions.length })}
              </p>
            )}
          </div>
        )}

        {step === "zones" && (
          <div className="wizard-step space-y-4">
            <p className="wizard-step-desc">{t("wizardZoneChecklistDesc")}</p>
            <p className="wizard-mapper-warn">{t("wizardTouchingRegionsHint")}</p>
            <div className="wizard-zone-checklist">
              <p className="wp-menu-heading" style={{ padding: 0, marginBottom: "0.5rem" }}>
                {t("wizardZoneChecklist")}
              </p>
              {questions.map((q) => (
                <label key={q.id} className="wizard-zone-check">
                  <input
                    type="checkbox"
                    checked={enabledZones.has(q.id)}
                    disabled={q.id === "floor"}
                    onChange={(e) => {
                      setEnabledZones((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(q.id);
                        else next.delete(q.id);
                        return next;
                      });
                      if (!e.target.checked) {
                        setAssignments((prev) => {
                          const next = { ...prev };
                          delete next[q.id];
                          return next;
                        });
                      }
                    }}
                  />
                  <span>
                    {t(q.labelKey as TranslationKey)}
                    {q.optional ? ` (${t("wizardOptional")})` : ""}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === "mapping" && parsed && currentQuestion && (
          <div className="wizard-step space-y-4">
            <div className="wizard-question-card">
              <p className="wizard-question-label">{t("wizardZoneQuestion")}</p>
              <h3 className="wizard-question-title">
                {t(currentQuestion.labelKey as TranslationKey)}
              </h3>
              <p className="wizard-question-meta">
                {paletteLabel(currentQuestion.palette)}
                {currentQuestion.optional && ` · ${t("wizardOptional")}`}
              </p>
            </div>
            <CutoutZoneMapper
              basePreviewUrl={basePhoto.preview}
              cutoutPreviewUrl={cutout.preview!}
              parsed={parsed}
              assignments={assignments}
              regionToZone={regionToZone}
              currentZoneId={currentQuestion.id}
              currentZoneLabel={t(currentQuestion.labelKey as TranslationKey)}
              onAssignRegion={handleAssignRegion}
              zoneOptions={activeQuestions.map((q) => ({
                id: q.id,
                label: t(q.labelKey as TranslationKey),
              }))}
              onAssignRegionToZone={handleAssignRegionToZone}
            />
          </div>
        )}

        {step === "review" && parsed && (
          <div className="wizard-step space-y-4">
            <p className="wizard-step-desc">{t("wizardReviewDesc")}</p>
            <div className="wp-table-wrap">
              <table className="wp-table">
                <thead>
                  <tr>
                    <th>{t("zoneNameLabel")}</th>
                    <th>{t("category")}</th>
                    <th>{t("wizardRegions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(assignments).map(([zoneId, regionIds]) => {
                    const q = questions.find((q) => q.id === zoneId);
                    return (
                      <tr key={zoneId}>
                        <td>{q ? t(q.labelKey as TranslationKey) : zoneId}</td>
                        <td>{q ? paletteLabel(q.palette) : "—"}</td>
                        <td>{regionIds.map((id) => `#${id + 1}`).join(", ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {skipped.size > 0 && (
              <div className="wizard-skipped">
                <p className="wp-menu-heading" style={{ padding: 0 }}>
                  {t("wizardSkippedZones")}
                </p>
                <div className="wizard-skipped-list">
                  {Array.from(skipped).map((zoneId) => {
                    const q = questions.find((q) => q.id === zoneId);
                    return (
                      <button
                        key={zoneId}
                        type="button"
                        className="wp-button wp-button--secondary wp-button--small"
                        onClick={() => jumpToSkipped(zoneId)}
                      >
                        {t("wizardEditSkipped")}: {q ? t(q.labelKey as TranslationKey) : zoneId}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {getUnmappedRegionIds(parsed.regions, assignments).length > 0 && (
              <p className="wizard-mapper-warn">{t("wizardUnmappedWarning", { count: getUnmappedRegionIds(parsed.regions, assignments).length })}</p>
            )}
          </div>
        )}

        {catalogs.length > 0 && step === "review" && (
          <div className="wizard-catalogs">
            <p className="text-sm font-medium">{t("companyCatalogsOptional")}</p>
            <div className="wizard-catalog-checks">
              {catalogs.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={selectedCatalogs.includes(c.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCatalogs((ids) => [...ids, c.id]);
                      } else {
                        setSelectedCatalogs((ids) => ids.filter((id) => id !== c.id));
                      }
                    }}
                  />
                  {c.companyName}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="wizard-actions">
          <button type="button" className="wp-button wp-button--secondary" onClick={onCancel}>
            {t("cancel")}
          </button>
          {step !== "info" && (
            <button type="button" className="wp-button wp-button--secondary" onClick={handleBack}>
              {t("wizardBack")}
            </button>
          )}
          {step === "info" && (
            <button
              type="button"
              className="wp-button"
              disabled={!name || !hasImageSource(basePhoto)}
              onClick={() => setStep("cutout")}
            >
              {t("wizardNext")}
            </button>
          )}
          {step === "cutout" && (
            <button
              type="button"
              className="wp-button"
              disabled={!hasImageSource(cutout) || !parsed || parsing}
              onClick={() => setStep("zones")}
            >
              {t("wizardNext")}
            </button>
          )}
          {step === "zones" && (
            <button
              type="button"
              className="wp-button"
              disabled={enabledZones.size === 0}
              onClick={goToMapping}
            >
              {t("wizardStartMapping")}
            </button>
          )}
          {step === "mapping" && (
            <>
              {currentQuestion?.optional && (
                <button type="button" className="wp-button wp-button--secondary" onClick={handleSkip}>
                  {t("wizardSkipZone")}
                </button>
              )}
              <button type="button" className="wp-button" onClick={advanceQuestion}>
                {questionIndex < activeQuestions.length - 1 || (!editSkippedMode && skipped.size > 0)
                  ? t("wizardNext")
                  : t("wizardReview")}
              </button>
            </>
          )}
          {step === "review" && (
            <button
              type="button"
              className="wp-button"
              disabled={loading}
              onClick={() => void handleSave()}
            >
              {loading ? t("uploading") : t("saveKitchen")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
