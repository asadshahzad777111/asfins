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
  applyCabinetPreset,
  buildInitialSimpleZoneRows,
  buildSimpleZoneSubmissions,
  CABINET_CUSTOM_VALUE,
  CABINET_ZONE_PRESETS,
  cabinetPresetSelectValue,
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
  compressImageSourceFile,
  MAX_REQUEST_BYTES,
} from "@/lib/images/compress-upload";
import {
  formatFetchFailure,
  readApiErrorMessage,
} from "@/lib/admin/parse-api-error";
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

/** Don't leave the Save button stuck forever if the server/proxy hangs. */
const SAVE_TIMEOUT_MS = 120_000;

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
  const [loadingLabel, setLoadingLabel] = useState<TranslationKey>("uploading");
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

  async function postSceneForm(form: FormData): Promise<{ id?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
    try {
      const res = await fetch("/api/admin/scenes", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await readApiErrorMessage(res, t("wizardSaveFailed"));
        throw new Error(detail);
      }
      const data = (await res.json().catch(() => ({}))) as { scene?: { id?: string } };
      return { id: data.scene?.id };
    } finally {
      clearTimeout(timer);
    }
  }

  async function compressSource(
    source: ImageSourceValue,
    kind: "photo" | "png"
  ): Promise<ImageSourceValue> {
    if (!source.file) return source;
    const file = await compressImageSourceFile(source.file, kind);
    return { ...source, file };
  }

  async function handleSaveSimple() {
    const submissions = buildSimpleZoneSubmissions(simpleRows, t);
    if (submissions.length === 0) {
      setMessage({ type: "err", text: t("wizardNoZonesMapped") });
      return;
    }

    setLoading(true);
    setLoadingLabel("wizardSavingCompressing");
    setMessage({ type: "warn", text: t("wizardSavingCompressing") });

    try {
      const compressedBase = await compressSource(basePhoto, "photo");
      const compressedSubs: typeof submissions = [];
      for (const sub of submissions) {
        compressedSubs.push({
          ...sub,
          source: sub.keepExisting
            ? sub.source
            : await compressSource(sub.source, "png"),
        });
      }

      type FileSlot =
        | { kind: "base"; file: File }
        | { kind: "zone"; index: number; file: File };

      const slots: FileSlot[] = [];
      if (compressedBase.file) slots.push({ kind: "base", file: compressedBase.file });
      compressedSubs.forEach((sub, i) => {
        if (!sub.keepExisting && sub.source.file) {
          slots.push({ kind: "zone", index: i, file: sub.source.file });
        }
      });

      // Batch files so each multipart POST stays under Vercel's ~4.5MB body limit.
      const batches: FileSlot[][] = [];
      let current: FileSlot[] = [];
      let currentBytes = 0;
      for (const slot of slots) {
        if (current.length > 0 && currentBytes + slot.file.size > MAX_REQUEST_BYTES) {
          batches.push(current);
          current = [];
          currentBytes = 0;
        }
        // Single file still over budget — send alone (server will downscale / error clearly).
        if (slot.file.size > MAX_REQUEST_BYTES && current.length === 0) {
          batches.push([slot]);
          continue;
        }
        current.push(slot);
        currentBytes += slot.file.size;
      }
      if (current.length) batches.push(current);
      if (batches.length === 0) batches.push([]);

      // Never POST a base-only first batch on create — API requires ≥1 zone.
      if (
        batches.length > 1 &&
        batches[0].every((s) => s.kind === "base") &&
        batches[1].some((s) => s.kind === "zone")
      ) {
        const zoneIdx = batches[1].findIndex((s) => s.kind === "zone");
        if (zoneIdx >= 0) {
          const pulled = batches[1].splice(zoneIdx, 1)[0];
          // Avoid TS narrowing batches[0] to base-only from the .every() check above.
          (batches[0] as FileSlot[]).push(pulled);
          if (batches[1].length === 0) batches.splice(1, 1);
        }
      }

      let sceneId = existingScene?.id;
      const uploadedZoneIndexes = new Set<number>();

      for (let b = 0; b < batches.length; b++) {
        setLoadingLabel("wizardSavingUploading");
        setMessage({
          type: "warn",
          text:
            batches.length > 1
              ? `${t("wizardSavingUploading")} (${b + 1}/${batches.length})`
              : t("wizardSavingUploading"),
        });

        const batch = batches[b];
        const batchHasBase = batch.some((s) => s.kind === "base");
        const batchZoneIndexes = new Set(
          batch.filter((s): s is Extract<FileSlot, { kind: "zone" }> => s.kind === "zone").map(
            (s) => s.index
          )
        );

        const form = new FormData();
        form.append("wizardMode", "simple");
        form.append("name", name);
        form.append("description", description);
        form.append("category", category);
        if (sceneId) form.append("id", sceneId);

        if (batchHasBase && compressedBase.file) {
          form.append("basePhoto", compressedBase.file);
        } else if (compressedBase.url && !sceneId) {
          form.append("basePhotoUrl", compressedBase.url);
        }

        form.append("catalogIds", collectSceneCatalogIds(simpleRows).join(","));

        const isLast = b === batches.length - 1;
        // Only include zones we can satisfy now (file in this batch, or already on disk).
        const indexes = compressedSubs
          .map((_, i) => i)
          .filter((i) => {
            if (batchZoneIndexes.has(i) || uploadedZoneIndexes.has(i)) return true;
            const sub = compressedSubs[i];
            if (sub.keepExisting) return true;
            if (isLast && sub.source.url) return true;
            return false;
          });

        if (indexes.length === 0) {
          throw new Error(t("wizardNoZonesMapped"));
        }

        form.append("zoneCount", String(indexes.length));
        if (isLast) {
          const removed = collectRemovedZoneIds(simpleRows);
          if (removed.length) form.append("removedZoneIds", removed.join(","));
        }

        indexes.forEach((srcIndex, i) => {
          const sub = compressedSubs[srcIndex];
          if (sub.id) form.append(`zone_${i}_id`, sub.id);
          form.append(`zone_${i}_label`, sub.label);
          form.append(`zone_${i}_palette`, sub.palette);

          if (batchZoneIndexes.has(srcIndex) && sub.source.file) {
            form.append(`zone_${i}_file`, sub.source.file);
          } else if (sub.source.url && !uploadedZoneIndexes.has(srcIndex) && !sub.keepExisting) {
            form.append(`zone_${i}_fileUrl`, sub.source.url);
          } else {
            form.append(`zone_${i}_keepExisting`, "true");
          }
        });

        const result = await postSceneForm(form);
        if (result.id) sceneId = result.id;
        for (const idx of batchZoneIndexes) uploadedZoneIndexes.add(idx);
      }

      setMessage({ type: "ok", text: t("saveSuccess", { name }) });
      router.refresh();
      onComplete();
    } catch (err) {
      const isAbort =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");
      if (isAbort) {
        setMessage({
          type: "err",
          text: t("wizardSaveHttpError", {
            status: "timeout",
            detail: "Save timed out after 2 minutes — try smaller PNGs.",
          }),
        });
      } else {
        setMessage({
          type: "err",
          text: formatFetchFailure(err, t("wizardSaveNetworkError")),
        });
      }
    } finally {
      setLoading(false);
      setLoadingLabel("uploading");
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
    setLoadingLabel("wizardSavingCompressing");
    setMessage({ type: "warn", text: t("wizardSavingCompressing") });

    try {
      const compressedBase = await compressSource(basePhoto, "photo");
      const compressedCutout = await compressSource(cutout, "png");

      setLoadingLabel("wizardSavingUploading");
      setMessage({ type: "warn", text: t("wizardSavingUploading") });

      const form = new FormData();
      form.append("wizardMode", "region");
      form.append("name", name);
      form.append("description", description);
      form.append("category", category);
      if (existingScene) form.append("id", existingScene.id);
      appendImageSource(form, "basePhoto", compressedBase);
      appendImageSource(form, "masterCutout", compressedCutout);
      form.append("catalogIds", selectedCatalogs.join(","));
      form.append("regionMappings", JSON.stringify(assignments));
      form.append("zoneCount", String(mappedZones.length));

      mappedZones.forEach(([zoneId], i) => {
        const q = questions.find((q) => q.id === zoneId);
        form.append(`zone_${i}_id`, zoneId);
        form.append(`zone_${i}_label`, q ? t(q.labelKey as TranslationKey) : zoneId);
        form.append(`zone_${i}_palette`, (q?.palette ?? "wood") as ZonePalette);
      });

      const totalBytes =
        (compressedBase.file?.size ?? 0) + (compressedCutout.file?.size ?? 0);
      if (totalBytes > MAX_REQUEST_BYTES) {
        // Sequential: base first (with a dummy? region mode needs master cutout).
        // Region mode requires both in one go for mask build — re-compress harder.
        throw new Error(t("wizardSaveTooLarge"));
      }

      await postSceneForm(form);
      setMessage({ type: "ok", text: t("saveSuccess", { name }) });
      router.refresh();
      onComplete();
    } catch (err) {
      const isAbort =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");
      if (isAbort) {
        setMessage({
          type: "err",
          text: t("wizardSaveHttpError", {
            status: "timeout",
            detail: "Save timed out after 2 minutes — try smaller PNGs.",
          }),
        });
      } else {
        setMessage({
          type: "err",
          text: formatFetchFailure(err, t("wizardSaveNetworkError")),
        });
      }
    } finally {
      setLoading(false);
      setLoadingLabel("uploading");
    }
  }

  function handleCabinetPresetChange(row: SimpleZoneRow, value: string) {
    if (value === CABINET_CUSTOM_VALUE) {
      replaceSimpleRow(
        row.key,
        applyCabinetPreset(row, CABINET_CUSTOM_VALUE, row.label || "", existingScene)
      );
      return;
    }
    const preset = CABINET_ZONE_PRESETS.find((p) => p.id === value);
    if (!preset) return;
    const taken = simpleRows.some((r) => r.key !== row.key && r.id === preset.id);
    if (taken) {
      setMessage({ type: "err", text: t("wizardZoneTypeTaken") });
      return;
    }
    replaceSimpleRow(
      row.key,
      applyCabinetPreset(row, preset.id, t(preset.labelKey), existingScene)
    );
  }

  function cabinetNameFields(row: SimpleZoneRow) {
    const selectValue = cabinetPresetSelectValue(row) || "cabinets";
    const showCustom = selectValue === CABINET_CUSTOM_VALUE;
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <label className="form-group" style={{ margin: 0 }}>
          <span>{t("zoneNameLabel")}</span>
          <select
            value={selectValue}
            onChange={(e) => handleCabinetPresetChange(row, e.target.value)}
          >
            {CABINET_ZONE_PRESETS.map((p) => {
              const taken = simpleRows.some((r) => r.key !== row.key && r.id === p.id);
              return (
                <option key={p.id} value={p.id} disabled={taken}>
                  {t(p.labelKey)}
                  {taken ? ` (${t("wizardZoneInUse")})` : ""}
                </option>
              );
            })}
            <option value={CABINET_CUSTOM_VALUE}>{t("zoneCabinetCustom")}</option>
          </select>
        </label>
        {showCustom && (
          <input
            value={row.label}
            onChange={(e) => updateSimpleRow(row.key, { label: e.target.value, id: undefined })}
            placeholder={t("wizardCabinetNamePlaceholder")}
          />
        )}
      </div>
    );
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
                    headerExtra={cabinetNameFields(row)}
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
                      {row.kind === "single" &&
                      row.id &&
                      singleZoneOptions.some((q) => q.id === row.id) ? (
                        <label className="form-group">
                          <span>{t("zoneNameLabel")}</span>
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
                        </label>
                      ) : row.kind === "cabinet" ? (
                        cabinetNameFields(row)
                      ) : (
                        <label className="form-group">
                          <span>{t("zoneNameLabel")}</span>
                          <input
                            value={row.label}
                            onChange={(e) =>
                              updateSimpleRow(row.key, { label: e.target.value })
                            }
                            placeholder={t("wizardCabinetNamePlaceholder")}
                          />
                        </label>
                      )}

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
              {loading ? t(loadingLabel) : t("saveKitchen")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
