"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ROOM_CATEGORIES } from "@/lib/rooms";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { roomLabel } from "@/lib/i18n/translations";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { Catalog } from "@/lib/catalogs/types";
import { catalogsForPalette } from "@/lib/catalogs/materials";
import type { RoomCategory, SceneRecord, ZonePalette } from "@/lib/scenes/types";
import {
  getSingleInstanceZoneQuestions,
  getZoneQuestions,
  wizardProgress,
  type WizardFlow,
  type WizardStep,
} from "@/lib/scenes/zone-wizard";
import {
  anyZoneConfigured,
  buildInitialSimpleZoneRows,
  buildSimpleZoneSubmissions,
  clearRowUpload,
  collectRemovedZoneIds,
  collectSceneCatalogIds,
  isRowConfigured,
  newCabinetRow,
  reassignRowToZoneType,
  rowHasClearableUpload,
  syncRowCatalogsForPalette,
  type SimpleZoneRow,
} from "@/lib/scenes/simple-upload";
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
import { ZoneCutoutSlot } from "@/components/admin/ZoneCutoutSlot";

interface SceneSetupWizardProps {
  catalogs: Catalog[];
  onComplete: () => void;
  onCancel: () => void;
  /** When set, the wizard edits this existing scene in place instead of creating a new one. */
  existingScene?: SceneRecord;
}

/** An existing preview (already-saved photo/cutout) counts as "has an image" too —
 *  editing a scene shouldn't force a re-upload of files that aren't being replaced. */
function hasImageSource(source: ImageSourceValue): boolean {
  return Boolean(source.file || source.url || source.preview);
}

function defaultZonesForCategory(category: string): Set<string> {
  const qs = getZoneQuestions(category as "kitchen");
  const defaults = new Set(
    qs.filter((q) => !q.optional && q.zoneGroup === "wood").map((q) => q.id)
  );
  if (category === "kitchen") {
    [
      "upper-cabinet-left",
      "upper-cabinet-mid",
      "upper-cabinet-right",
      "lower-cabinet-left",
      "lower-cabinet-mid",
      "lower-cabinet-right",
      "island",
    ].forEach((id) => defaults.add(id));
  }
  return defaults;
}

function appendImageSource(form: FormData, key: string, source: ImageSourceValue) {
  if (source.file) {
    form.append(key, source.file);
  } else if (source.url) {
    form.append(`${key}Url`, source.url);
  }
}

function defaultFlowForScene(existing?: SceneRecord): WizardFlow {
  // Existing region-mapped scenes open in advanced so admins can keep tagging.
  // Everything else (new scenes + layer-based scenes) uses the simple per-zone uploads.
  if (existing?.regionMappings) return "advanced";
  return "simple";
}

const PALETTE_OPTIONS: ZonePalette[] = ["paint", "wood", "tile"];

export function SceneSetupWizard({
  catalogs,
  onComplete,
  onCancel,
  existingScene,
}: SceneSetupWizardProps) {
  const router = useRouter();
  const { lang, t } = useLanguage();
  const isEditing = Boolean(existingScene);

  const [flow, setFlow] = useState<WizardFlow>(() => defaultFlowForScene(existingScene));
  const [step, setStep] = useState<WizardStep>("info");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [name, setName] = useState(existingScene?.name ?? "");
  const [description, setDescription] = useState(existingScene?.description ?? "");
  const [category, setCategory] = useState<RoomCategory>(existingScene?.category ?? "kitchen");
  const [basePhoto, setBasePhoto] = useState<ImageSourceValue>(() =>
    existingScene
      ? { file: null, url: "", preview: existingScene.basePhoto, mode: "upload" }
      : emptyImageSource()
  );
  const [cutout, setCutout] = useState<ImageSourceValue>(() =>
    existingScene?.regionMappings
      ? {
          file: null,
          url: "",
          preview: `/scenes/${existingScene.id}/master-cutout.png`,
          mode: "upload",
        }
      : emptyImageSource()
  );
  const [parsed, setParsed] = useState<ParsedCutout | null>(null);
  const [assignments, setAssignments] = useState<Record<string, number[]>>({});
  const [assignmentsHydrated, setAssignmentsHydrated] = useState(false);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [enabledZones, setEnabledZones] = useState<Set<string>>(() =>
    existingScene ? new Set(existingScene.zones.map((z) => z.id)) : defaultZonesForCategory(category)
  );
  const [simpleRows, setSimpleRows] = useState<SimpleZoneRow[]>(() =>
    buildInitialSimpleZoneRows(
      (existingScene?.category ?? "kitchen") as RoomCategory,
      existingScene,
      catalogs
    )
  );
  const [selectedCatalogs, setSelectedCatalogs] = useState<string[]>(
    () => existingScene?.catalogIds ?? catalogs.map((c) => c.id)
  );
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err" | "warn"; text: string } | null>(null);
  const [editSkippedMode, setEditSkippedMode] = useState(false);

  const questions = useMemo(() => getZoneQuestions(category as "kitchen"), [category]);
  const singleZoneOptions = useMemo(
    () => getSingleInstanceZoneQuestions(category as RoomCategory),
    [category]
  );

  // Reset zone selections/mapping when the category actually changes — React's
  // documented "adjust state when a prop changes" pattern (state tracker, not a
  // ref). Doesn't fire on mount, so an edit session's pre-populated zones/
  // assignments (hydrated above from the existing scene) aren't clobbered.
  const [prevCategory, setPrevCategory] = useState(category);
  if (prevCategory !== category) {
    setPrevCategory(category);
    setEnabledZones(defaultZonesForCategory(category));
    setSkipped(new Set());
    setAssignments({});
    setAssignmentsHydrated(true);
    setQuestionIndex(0);
    setSimpleRows(buildInitialSimpleZoneRows(category as RoomCategory, undefined, catalogs));
  }

  // Once the existing cutout has been re-parsed into regions, restore the
  // scene's saved region→zone assignments (parseCutout itself clears
  // `assignments` as part of a fresh parse). Adjust during render — React's
  // documented pattern — so we don't trip react-hooks/set-state-in-effect.
  if (parsed && !assignmentsHydrated && existingScene?.regionMappings) {
    setAssignments(existingScene.regionMappings);
    setAssignmentsHydrated(true);
  }

  const activeQuestions = useMemo(
    () =>
      questions.filter(
        (q) =>
          enabledZones.has(q.id) && (!skipped.has(q.id) || editSkippedMode)
      ),
    [questions, enabledZones, skipped, editSkippedMode]
  );
  const currentQuestion = step === "mapping" ? activeQuestions[questionIndex] : null;
  const progress = wizardProgress(step, questionIndex, questions.length, flow);

  const regionToZone = useMemo(() => {
    const map: Record<number, string> = {};
    for (const [zoneId, regionIds] of Object.entries(assignments)) {
      for (const rid of regionIds) map[rid] = zoneId;
    }
    return map;
  }, [assignments]);

  const singleRows = useMemo(
    () => simpleRows.filter((r) => r.kind === "single"),
    [simpleRows]
  );
  const cabinetRows = useMemo(
    () => simpleRows.filter((r) => r.kind === "cabinet"),
    [simpleRows]
  );
  const reviewRows = useMemo(
    () => simpleRows.filter(isRowConfigured),
    [simpleRows]
  );

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
    if (flow !== "advanced") return;
    if (cutout.file || cutout.preview) {
      // External image decode → parse regions; setState happens in the async
      // callback path inside parseCutout (and its sync "parsing" flag).
      // eslint-disable-next-line react-hooks/set-state-in-effect -- image load side-effect
      void parseCutout(cutout);
    }
  }, [cutout, parseCutout, flow]);

  function switchFlow(next: WizardFlow) {
    setFlow(next);
    setStep("info");
    setMessage(null);
    if (next === "simple") {
      setSimpleRows(
        buildInitialSimpleZoneRows(category as RoomCategory, existingScene, catalogs)
      );
    }
  }

  function goToMapping() {
    setStep("mapping");
    setQuestionIndex(0);
    setEditSkippedMode(false);
  }

  function updateSimpleRow(key: string, patch: Partial<SimpleZoneRow>) {
    setSimpleRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function replaceSimpleRow(key: string, next: SimpleZoneRow) {
    setSimpleRows((rows) => rows.map((r) => (r.key === key ? next : r)));
  }

  async function handleZoneTypeChange(row: SimpleZoneRow, zoneId: string) {
    if (row.id === zoneId) return;
    const taken = simpleRows.some(
      (r) => r.key !== row.key && !r.removed && r.id === zoneId && isRowConfigured(r)
    );
    if (taken) {
      setMessage({ type: "err", text: t("wizardZoneTypeTaken") });
      return;
    }
    let next = reassignRowToZoneType(row, zoneId, category, catalogs, existingScene);
    if (!next) return;

    // Changing Floor → Curtains etc. must not "keepExisting" under the new id.
    // If we only had the old mask preview, re-attach it as a new upload for the new id.
    const hadOnlyExistingPreview =
      row.existedBefore &&
      !row.source.file &&
      !row.source.url &&
      Boolean(row.source.preview) &&
      row.id !== zoneId;

    if (hadOnlyExistingPreview && row.source.preview) {
      try {
        const res = await fetch(row.source.preview);
        if (!res.ok) throw new Error("mask fetch failed");
        const blob = await res.blob();
        const file = new File([blob], `${zoneId}.png`, { type: blob.type || "image/png" });
        const preview = URL.createObjectURL(file);
        next = {
          ...next,
          existedBefore: false,
          source: { file, url: "", preview, mode: "upload" },
        };
      } catch {
        next = { ...next, source: emptyImageSource(), existedBefore: false };
        setMessage({
          type: "warn",
          text: t("wizardEditReuseHint"),
        });
      }
    }

    setMessage(null);
    replaceSimpleRow(row.key, next);
  }

  function handlePaletteChange(row: SimpleZoneRow, palette: ZonePalette) {
    replaceSimpleRow(row.key, syncRowCatalogsForPalette(row, palette, catalogs));
  }

  function toggleRowCatalog(row: SimpleZoneRow, catalogId: string, checked: boolean) {
    const catalogIds = checked
      ? [...row.catalogIds, catalogId]
      : row.catalogIds.filter((id) => id !== catalogId);
    updateSimpleRow(row.key, { catalogIds });
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
    if (flow === "simple") {
      if (step === "review") {
        setStep("simpleZones");
        return;
      }
      if (step === "simpleZones") {
        setStep("info");
        return;
      }
      return;
    }

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

  async function handleSaveSimple() {
    const submissions = buildSimpleZoneSubmissions(simpleRows, t);
    if (submissions.length === 0) {
      setMessage({ type: "err", text: t("wizardNoZonesMapped") });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const form = new FormData();
      form.append("wizardMode", "simple");
      form.append("name", name);
      form.append("description", description);
      form.append("category", category);
      if (existingScene) form.append("id", existingScene.id);
      appendImageSource(form, "basePhoto", basePhoto);
      const catalogIds = collectSceneCatalogIds(simpleRows);
      form.append("catalogIds", catalogIds.join(","));
      form.append("zoneCount", String(submissions.length));

      const removed = collectRemovedZoneIds(simpleRows);
      if (removed.length) form.append("removedZoneIds", removed.join(","));

      submissions.forEach((sub, i) => {
        if (sub.id) form.append(`zone_${i}_id`, sub.id);
        form.append(`zone_${i}_label`, sub.label);
        form.append(`zone_${i}_palette`, sub.palette);
        if (sub.keepExisting) {
          form.append(`zone_${i}_keepExisting`, "true");
        } else {
          appendImageSource(form, `zone_${i}_file`, sub.source);
        }
      });

      const res = await fetch("/api/admin/scenes", { method: "POST", body: form });
      let data: { error?: string } = {};
      try {
        data = (await res.json()) as { error?: string };
      } catch {
        data = { error: t("wizardSaveNetworkError") };
      }

      if (res.ok) {
        setMessage({ type: "ok", text: t("saveSuccess", { name }) });
        router.refresh();
        onComplete();
      } else {
        setMessage({ type: "err", text: data.error ?? t("wizardSaveFailed") });
      }
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : t("wizardSaveNetworkError"),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAdvanced(force = false) {
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

    try {
      const form = new FormData();
      form.append("wizardMode", "region");
      form.append("name", name);
      form.append("description", description);
      form.append("category", category);
      if (existingScene) form.append("id", existingScene.id);
      appendImageSource(form, "basePhoto", basePhoto);
      appendImageSource(form, "masterCutout", cutout);
      form.append("catalogIds", selectedCatalogs.join(","));
      form.append("regionMappings", JSON.stringify(assignments));
      form.append("zoneCount", String(mappedZones.length));

      mappedZones.forEach(([zoneId], i) => {
        const q = questions.find((q) => q.id === zoneId);
        form.append(`zone_${i}_id`, zoneId);
        form.append(`zone_${i}_label`, q ? t(q.labelKey as TranslationKey) : zoneId);
        form.append(`zone_${i}_palette`, (q?.palette ?? "wood") as ZonePalette);
      });

      const res = await fetch("/api/admin/scenes", { method: "POST", body: form });
      let data: { error?: string } = {};
      try {
        data = (await res.json()) as { error?: string };
      } catch {
        data = { error: t("wizardSaveNetworkError") };
      }

      if (res.ok) {
        setMessage({ type: "ok", text: t("saveSuccess", { name }) });
        router.refresh();
        onComplete();
      } else {
        setMessage({ type: "err", text: data.error ?? t("wizardSaveFailed") });
      }
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : t("wizardSaveNetworkError"),
      });
    } finally {
      setLoading(false);
    }
  }

  function paletteLabel(palette: ZonePalette) {
    if (palette === "wood") return t("paletteWood");
    if (palette === "tile") return t("paletteTile");
    return t("palettePaint");
  }

  function rowDisplayLabel(row: SimpleZoneRow): string {
    if (row.kind === "single" && row.labelKey) return t(row.labelKey);
    return row.label || t("defaultZoneLabel");
  }

  return (
    <div className="wp-postbox">
      <div className="wp-postbox-head wizard-postbox-head">
        <span>
          {isEditing ? t("wizardEditTitle", { name: existingScene!.name }) : t("wizardTitle")}
        </span>
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
            {message.type === "warn" && flow === "advanced" && (
              <div className="wizard-warn-actions">
                <button
                  type="button"
                  className="wp-button wp-button--small"
                  onClick={() => void handleSaveAdvanced(true)}
                >
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
            {isEditing && <p className="wizard-mapper-warn">{t("wizardEditReuseHint")}</p>}
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
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RoomCategory)}
                >
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
            <p className="wizard-flow-toggle">
              {flow === "simple" ? (
                <>
                  {t("wizardSimpleFlowActive")}{" "}
                  <button
                    type="button"
                    className="wizard-flow-link"
                    onClick={() => switchFlow("advanced")}
                  >
                    {t("wizardSwitchToAdvanced")}
                  </button>
                </>
              ) : (
                <>
                  {t("wizardAdvancedFlowActive")}{" "}
                  <button
                    type="button"
                    className="wizard-flow-link"
                    onClick={() => switchFlow("simple")}
                  >
                    {t("wizardSwitchToSimple")}
                  </button>
                </>
              )}
            </p>
          </div>
        )}

        {flow === "simple" && step === "simpleZones" && (
          <div className="wizard-step space-y-4">
            <p className="wizard-step-desc">{t("wizardSimpleZonesDesc")}</p>
            {isEditing && <p className="wizard-mapper-warn">{t("wizardEditReuseHint")}</p>}

            <div className="wizard-simple-section">
              <p className="wp-menu-heading" style={{ padding: 0, marginBottom: "0.75rem" }}>
                {t("wizardSectionSurfaces")}
              </p>
              <div className="wizard-simple-slots">
                {singleRows.map((row) => (
                  <ZoneCutoutSlot
                    key={row.key}
                    label={rowDisplayLabel(row)}
                    hint={t("wizardPerZoneCutoutHint")}
                    value={row.source}
                    optional={row.optional}
                    existedBefore={row.existedBefore}
                    removed={row.removed}
                    onChange={(source) => updateSimpleRow(row.key, { source })}
                    onClear={() => replaceSimpleRow(row.key, clearRowUpload(row, existingScene))}
                    onRemove={
                      row.existedBefore
                        ? () =>
                            updateSimpleRow(row.key, {
                              removed: true,
                              source: emptyImageSource(),
                            })
                        : undefined
                    }
                    onRestore={() => updateSimpleRow(row.key, { removed: false })}
                  />
                ))}
              </div>
            </div>

            <div className="wizard-simple-section">
              <p className="wp-menu-heading" style={{ padding: 0, marginBottom: "0.75rem" }}>
                {t("wizardCabinetsSection")}
              </p>
              <p className="text-xs text-muted" style={{ marginBottom: "0.75rem" }}>
                {t("wizardCabinetsSectionHint")}
              </p>
              <div className="wizard-simple-slots">
                {cabinetRows.map((row) => (
                  <ZoneCutoutSlot
                    key={row.key}
                    label={rowDisplayLabel(row)}
                    hint={t("wizardPerZoneCutoutHint")}
                    value={row.source}
                    existedBefore={row.existedBefore}
                    removed={row.removed}
                    onChange={(source) => updateSimpleRow(row.key, { source })}
                    onClear={() => replaceSimpleRow(row.key, clearRowUpload(row, existingScene))}
                    onRemove={() => {
                      if (row.existedBefore) {
                        updateSimpleRow(row.key, { removed: true, source: emptyImageSource() });
                      } else {
                        setSimpleRows((rows) => rows.filter((r) => r.key !== row.key));
                      }
                    }}
                    onRestore={() => updateSimpleRow(row.key, { removed: false })}
                    headerExtra={
                      <label className="form-group" style={{ flex: 1, margin: 0 }}>
                        <span>{t("zoneNameLabel")}</span>
                        <input
                          value={row.label}
                          onChange={(e) => updateSimpleRow(row.key, { label: e.target.value })}
                          placeholder={t("wizardCabinetNamePlaceholder")}
                        />
                      </label>
                    }
                  />
                ))}
              </div>
              <button
                type="button"
                className="wp-button wp-button--secondary"
                style={{ marginTop: "0.75rem" }}
                onClick={() => setSimpleRows((rows) => [...rows, newCabinetRow(catalogs)])}
              >
                {t("wizardAddCabinetCutout")}
              </button>
            </div>
          </div>
        )}

        {flow === "advanced" && step === "cutout" && (
          <div className="wizard-step space-y-4">
            <p className="wizard-step-desc">{t("wizardStep2Desc")}</p>
            {isEditing && (
              <p className="wizard-mapper-warn">
                {existingScene?.regionMappings
                  ? t("wizardEditReuseHint")
                  : t("wizardEditLegacyCutoutHint")}
              </p>
            )}
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

        {flow === "advanced" && step === "zones" && (
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

        {flow === "advanced" && step === "mapping" && parsed && currentQuestion && (
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
              <p className="wizard-mapper-warn" style={{ marginTop: "0.5rem" }}>
                {t("wizardTouchingRegionsHint")}
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
              regionListFirst
            />
          </div>
        )}

        {step === "review" && flow === "simple" && (
          <div className="wizard-step space-y-4">
            <p className="wizard-step-desc">{t("wizardReviewDesc")}</p>
            <p className="text-xs text-muted">{t("wizardReviewPerZoneHint")}</p>
            <div className="wizard-review-rows">
              {reviewRows.map((row) => {
                const paletteCatalogs = catalogsForPalette(catalogs, row.palette);
                return (
                  <div key={row.key} className="wizard-review-row">
                    <div className="wizard-review-row-grid">
                      <label className="form-group">
                        <span>{t("zoneNameLabel")}</span>
                        {row.kind === "single" && row.id && singleZoneOptions.some((q) => q.id === row.id) ? (
                          <select
                            value={row.id}
                            onChange={(e) => void handleZoneTypeChange(row, e.target.value)}
                          >
                            {singleZoneOptions.map((q) => {
                              const taken = reviewRows.some(
                                (r) => r.key !== row.key && r.id === q.id
                              );
                              return (
                                <option key={q.id} value={q.id} disabled={taken}>
                                  {t(q.labelKey)}
                                  {taken ? ` (${t("wizardZoneInUse")})` : ""}
                                </option>
                              );
                            })}
                          </select>
                        ) : (
                          <input
                            value={row.label}
                            onChange={(e) => updateSimpleRow(row.key, { label: e.target.value })}
                            placeholder={t("wizardCabinetNamePlaceholder")}
                          />
                        )}
                      </label>

                      <label className="form-group">
                        <span>{t("wizardPaletteLabel")}</span>
                        <select
                          value={row.palette}
                          onChange={(e) =>
                            handlePaletteChange(row, e.target.value as ZonePalette)
                          }
                        >
                          {PALETTE_OPTIONS.map((p) => (
                            <option key={p} value={p}>
                              {paletteLabel(p)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="form-group">
                        <span>{t("wizardCutoutFile")}</span>
                        <div className="wizard-review-file">
                          <span className="text-xs text-muted">
                            {row.source.file?.name ||
                              (row.existedBefore ? t("wizardKeepExistingFile") : "—")}
                          </span>
                          {(rowHasClearableUpload(row) ||
                            (!row.existedBefore && row.source.preview)) && (
                            <button
                              type="button"
                              className="wp-button wp-button--secondary wp-button--small"
                              onClick={() =>
                                replaceSimpleRow(row.key, clearRowUpload(row, existingScene))
                              }
                            >
                              {t("wizardClearCutout")}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {paletteCatalogs.length > 0 && (
                      <div className="wizard-review-catalogs">
                        <p className="text-xs font-medium">{t("wizardZoneCatalogs")}</p>
                        <div className="wizard-catalog-checks">
                          {paletteCatalogs.map((c) => (
                            <label key={c.id}>
                              <input
                                type="checkbox"
                                checked={row.catalogIds.includes(c.id)}
                                onChange={(e) =>
                                  toggleRowCatalog(row, c.id, e.target.checked)
                                }
                              />
                              {c.companyName}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === "review" && flow === "advanced" && (
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
            {parsed && getUnmappedRegionIds(parsed.regions, assignments).length > 0 && (
              <p className="wizard-mapper-warn">
                {t("wizardUnmappedWarning", {
                  count: getUnmappedRegionIds(parsed.regions, assignments).length,
                })}
              </p>
            )}
          </div>
        )}

        {catalogs.length > 0 && step === "review" && flow === "advanced" && (
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
            <button
              type="button"
              className="wp-button wp-button--secondary"
              onClick={handleBack}
              disabled={loading}
            >
              {t("wizardBack")}
            </button>
          )}
          {step === "info" && (
            <button
              type="button"
              className="wp-button"
              disabled={!name || !hasImageSource(basePhoto)}
              onClick={() => setStep(flow === "simple" ? "simpleZones" : "cutout")}
            >
              {t("wizardNext")}
            </button>
          )}
          {flow === "simple" && step === "simpleZones" && (
            <button
              type="button"
              className="wp-button"
              disabled={!anyZoneConfigured(simpleRows)}
              onClick={() => setStep("review")}
            >
              {t("wizardReview")}
            </button>
          )}
          {flow === "advanced" && step === "cutout" && (
            <button
              type="button"
              className="wp-button"
              disabled={!hasImageSource(cutout) || !parsed || parsing}
              onClick={() => setStep("zones")}
            >
              {t("wizardNext")}
            </button>
          )}
          {flow === "advanced" && step === "zones" && (
            <button
              type="button"
              className="wp-button"
              disabled={enabledZones.size === 0}
              onClick={goToMapping}
            >
              {t("wizardStartMapping")}
            </button>
          )}
          {flow === "advanced" && step === "mapping" && (
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
              disabled={loading || (flow === "simple" && reviewRows.length === 0)}
              onClick={() =>
                void (flow === "simple" ? handleSaveSimple() : handleSaveAdvanced())
              }
            >
              {loading ? t("uploading") : t("saveKitchen")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
