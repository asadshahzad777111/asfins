"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { ColorAutocomplete } from "@/components/admin/ColorAutocomplete";
import { collectColorSuggestions } from "@/lib/catalogs/materials";
import type { Catalog, CatalogSwatch } from "@/lib/catalogs/types";

interface CatalogsAdminProps {
  initialCatalogs: Catalog[];
}

const DEFAULT_DIMENSIONS = "2440*1220";
const DEFAULT_THICKNESS = "16mm";

function emptySwatch(): CatalogSwatch {
  return {
    id: `sw-${Date.now()}`,
    name: "",
    hex: "#3D4555",
    sheetCode: "",
    pricePKR: 0,
    palette: "wood",
    dimensions: DEFAULT_DIMENSIONS,
    thickness: DEFAULT_THICKNESS,
  };
}

function withSwatchDefaults(sw: CatalogSwatch): CatalogSwatch {
  return {
    ...sw,
    dimensions: sw.dimensions?.trim() || DEFAULT_DIMENSIONS,
    thickness: sw.thickness?.trim() || DEFAULT_THICKNESS,
  };
}

function updateSwatch(
  swatches: CatalogSwatch[],
  index: number,
  patch: Partial<CatalogSwatch>
): CatalogSwatch[] {
  return swatches.map((x, idx) => (idx === index ? { ...x, ...patch } : x));
}

export function CatalogsAdmin({ initialCatalogs }: CatalogsAdminProps) {
  const { t } = useLanguage();
  const [catalogs, setCatalogs] = useState(initialCatalogs);
  const [companyName, setCompanyName] = useState("");
  const [swatches, setSwatches] = useState<CatalogSwatch[]>([emptySwatch()]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedSwatch, setExpandedSwatch] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const colorSuggestions = useMemo(
    () => collectColorSuggestions(catalogs),
    [catalogs]
  );

  function startEdit(catalog: Catalog) {
    setEditingId(catalog.id);
    setCompanyName(catalog.companyName);
    setSwatches(
      catalog.swatches.length
        ? catalog.swatches.map(withSwatchDefaults)
        : [emptySwatch()]
    );
    setExpandedSwatch(catalog.swatches[0]?.id ?? null);
  }

  function cancelEdit() {
    setEditingId(null);
    setCompanyName("");
    setSwatches([emptySwatch()]);
    setExpandedSwatch(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) {
      setMessage({ type: "err", text: t("errCompanyRequired") });
      return;
    }

    const validSwatches = swatches.filter((s) => s.name && s.hex);
    setLoading(true);
    setMessage(null);

    const body = {
      id: editingId ?? undefined,
      companyName: companyName.trim(),
      swatches: validSwatches.map((s, i) => withSwatchDefaults({
        ...s,
        id: s.id || `sw-${i}`,
      })),
      global: true,
    };

    const res = await fetch("/api/admin/catalogs", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { ...body, id: editingId } : body),
    });
    const data = await res.json();

    if (res.ok) {
      setMessage({ type: "ok", text: t("catalogSaveSuccess", { name: companyName }) });
      if (editingId) {
        setCatalogs((c) => c.map((cat) => (cat.id === editingId ? data.catalog : cat)));
      } else {
        setCatalogs((c) => [...c, data.catalog]);
      }
      cancelEdit();
    } else {
      setMessage({ type: "err", text: data.error ?? "Save fail" });
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm(t("deleteCatalogConfirm"))) return;
    const res = await fetch(`/api/admin/catalogs?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setCatalogs((c) => c.filter((cat) => cat.id !== id));
      setMessage({ type: "ok", text: t("catalogDeleteSuccess") });
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-charcoal">{t("adminCatalogsTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("adminCatalogsSubtitle")}</p>
      </div>

      {message && (
        <p
          className={`rounded-sm px-4 py-3 text-sm ${
            message.type === "ok"
              ? "border border-brass/30 bg-brass/10 text-charcoal"
              : "border border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </p>
      )}

      <form onSubmit={handleSave} className="space-y-4 rounded-sm border border-divider bg-marble p-6">
        <h2 className="font-display text-lg">
          {editingId ? t("editCatalog") : t("newCatalog")}
        </h2>

        <label className="block">
          <span className="text-sm font-medium">{t("companyName")}</span>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. ZRK Group"
            className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
            required
          />
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">{t("colourSwatches")}</span>
            <button
              type="button"
              onClick={() => {
                const sw = emptySwatch();
                setSwatches((s) => [...s, sw]);
                setExpandedSwatch(sw.id);
              }}
              className="text-xs text-brass"
            >
              {t("addColour")}
            </button>
          </div>

          <div className="space-y-3">
            {swatches.map((sw, i) => {
              const open = expandedSwatch === sw.id;
              return (
                <div
                  key={sw.id}
                  className="rounded-sm border border-divider bg-base overflow-hidden"
                >
                  <div className="grid gap-2 p-3 sm:grid-cols-5">
                    <input
                      value={sw.name}
                      onChange={(e) =>
                        setSwatches((s) => updateSwatch(s, i, { name: e.target.value }))
                      }
                      placeholder={t("colourName")}
                      className="rounded-sm border border-divider px-2 py-1.5 text-sm sm:col-span-2"
                    />
                    <input
                      value={sw.sheetCode}
                      onChange={(e) =>
                        setSwatches((s) => updateSwatch(s, i, { sheetCode: e.target.value }))
                      }
                      placeholder={t("productCode")}
                      className="rounded-sm border border-divider px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      value={sw.pricePKR ?? 0}
                      onChange={(e) =>
                        setSwatches((s) =>
                          updateSwatch(s, i, { pricePKR: Number(e.target.value) })
                        )
                      }
                      placeholder={t("pricePkr")}
                      className="rounded-sm border border-divider px-2 py-1.5 text-sm"
                    />
                    <select
                      value={sw.palette}
                      onChange={(e) =>
                        setSwatches((s) =>
                          updateSwatch(s, i, {
                            palette: e.target.value as CatalogSwatch["palette"],
                          })
                        )
                      }
                      className="rounded-sm border border-divider px-2 py-1.5 text-sm"
                    >
                      <option value="wood">{t("paletteWood")}</option>
                      <option value="paint">{t("palettePaint")}</option>
                      <option value="tile">{t("paletteTile")}</option>
                    </select>
                    <input
                      value={sw.imageUrl ?? ""}
                      onChange={(e) =>
                        setSwatches((s) => updateSwatch(s, i, { imageUrl: e.target.value }))
                      }
                      placeholder={t("textureImageUrl")}
                      className="rounded-sm border border-divider px-2 py-1.5 text-sm sm:col-span-3"
                    />
                    <label className="flex cursor-pointer items-center justify-center rounded-sm border border-dashed border-brass/40 bg-brass/5 px-2 py-1.5 font-mono-data text-[9px] uppercase tracking-wider text-brass hover:bg-brass/10 sm:col-span-1">
                      {t("uploadTexture")}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          const folder =
                            ((editingId ?? companyName) || "custom")
                              .toLowerCase()
                              .replace(/[^a-z0-9-_]+/g, "-")
                              .replace(/^-|-$/g, "") || "custom";
                          const code =
                            (sw.sheetCode || sw.id || `sw-${i}`)
                              .replace(/[^a-zA-Z0-9-_]/g, "") || `sw-${Date.now()}`;
                          const fd = new FormData();
                          fd.append("file", file);
                          fd.append("folder", folder);
                          fd.append("code", code);
                          setLoading(true);
                          try {
                            const res = await fetch("/api/admin/catalog-texture", {
                              method: "POST",
                              body: fd,
                            });
                            const data = await res.json();
                            if (!res.ok) {
                              setMessage({
                                type: "err",
                                text: data.error ?? t("uploadTextureFail"),
                              });
                              return;
                            }
                            setSwatches((s) =>
                              updateSwatch(s, i, {
                                imageUrl: data.imageUrl,
                                thumbUrl: data.thumbUrl,
                              })
                            );
                            setMessage({ type: "ok", text: t("uploadTextureOk") });
                          } catch {
                            setMessage({ type: "err", text: t("uploadTextureFail") });
                          } finally {
                            setLoading(false);
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setExpandedSwatch(open ? null : sw.id)}
                      className="text-left text-xs text-brass sm:col-span-1"
                    >
                      {open ? t("hideDetails") : t("zrkDetails")} ▾
                    </button>
                  </div>

                  {open && (
                    <div className="border-t border-divider bg-marble/50 p-4">
                      <p className="mb-3 font-mono-data text-[10px] uppercase tracking-wider text-muted">
                        {t("zrkProductDetails")}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm">
                          <span className="font-medium">{t("materialCategory")}</span>
                          <input
                            value={sw.materialCategory ?? ""}
                            onChange={(e) =>
                              setSwatches((s) =>
                                updateSwatch(s, i, { materialCategory: e.target.value })
                              )
                            }
                            placeholder="e.g. Textured Laminates"
                            className="mt-1 w-full rounded-sm border border-divider px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium">{t("surfaceFinish")}</span>
                          <input
                            value={sw.surfaceFinish ?? ""}
                            onChange={(e) =>
                              setSwatches((s) =>
                                updateSwatch(s, i, { surfaceFinish: e.target.value })
                              )
                            }
                            placeholder="e.g. Leather, Matt, Gloss"
                            className="mt-1 w-full rounded-sm border border-divider px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label className="block text-sm sm:col-span-2">
                          <span className="font-medium">{t("colorDescription")}</span>
                          <div className="mt-1">
                            <ColorAutocomplete
                              value={sw.colorDescription ?? ""}
                              onChange={(v) =>
                                setSwatches((s) => updateSwatch(s, i, { colorDescription: v }))
                              }
                              suggestions={colorSuggestions}
                              placeholder="e.g. Orange — type or pick suggestion"
                              className="w-full rounded-sm border border-divider px-2 py-1.5 text-sm"
                            />
                          </div>
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium">{t("dimensions")}</span>
                          <input
                            value={sw.dimensions ?? DEFAULT_DIMENSIONS}
                            onChange={(e) =>
                              setSwatches((s) =>
                                updateSwatch(s, i, { dimensions: e.target.value })
                              )
                            }
                            className="mt-1 w-full rounded-sm border border-divider px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium">{t("thickness")}</span>
                          <input
                            value={sw.thickness ?? DEFAULT_THICKNESS}
                            onChange={(e) =>
                              setSwatches((s) =>
                                updateSwatch(s, i, { thickness: e.target.value })
                              )
                            }
                            className="mt-1 w-full rounded-sm border border-divider px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium">{t("substrate")}</span>
                          <select
                            value={sw.substrate ?? ""}
                            onChange={(e) =>
                              setSwatches((s) =>
                                updateSwatch(s, i, {
                                  substrate: (e.target.value || null) as
                                    | "mdf"
                                    | "chipboard"
                                    | null,
                                })
                              )
                            }
                            className="mt-1 w-full rounded-sm border border-divider px-2 py-1.5 text-sm"
                          >
                            <option value="">—</option>
                            <option value="mdf">{t("substrateMdf")}</option>
                            <option value="chipboard">{t("substrateChipboard")}</option>
                          </select>
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium">{t("stockLabel")}</span>
                          <input
                            type="number"
                            min={0}
                            value={sw.stock ?? ""}
                            onChange={(e) =>
                              setSwatches((s) =>
                                updateSwatch(s, i, {
                                  stock:
                                    e.target.value === ""
                                      ? undefined
                                      : Number(e.target.value),
                                })
                              )
                            }
                            className="mt-1 w-full rounded-sm border border-divider px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium">{t("lowStockAtLabel")}</span>
                          <input
                            type="number"
                            min={0}
                            value={sw.lowStockAt ?? ""}
                            onChange={(e) =>
                              setSwatches((s) =>
                                updateSwatch(s, i, {
                                  lowStockAt:
                                    e.target.value === ""
                                      ? undefined
                                      : Number(e.target.value),
                                })
                              )
                            }
                            className="mt-1 w-full rounded-sm border border-divider px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label className="block text-sm sm:col-span-2">
                          <span className="font-medium">{t("technicalSheetUrlLabel")}</span>
                          <input
                            value={sw.technicalSheetUrl ?? ""}
                            onChange={(e) =>
                              setSwatches((s) =>
                                updateSwatch(s, i, { technicalSheetUrl: e.target.value })
                              )
                            }
                            placeholder="https://..."
                            className="mt-1 w-full rounded-sm border border-divider px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label className="block text-sm sm:col-span-2">
                          <span className="font-medium">{t("description")}</span>
                          <textarea
                            value={sw.description ?? ""}
                            onChange={(e) =>
                              setSwatches((s) =>
                                updateSwatch(s, i, { description: e.target.value })
                              )
                            }
                            rows={2}
                            placeholder={t("materialDescPlaceholder")}
                            className="mt-1 w-full rounded-sm border border-divider px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label className="block text-sm sm:col-span-2">
                          <span className="font-medium">{t("idealApplications")}</span>
                          <input
                            value={sw.idealApplications ?? ""}
                            onChange={(e) =>
                              setSwatches((s) =>
                                updateSwatch(s, i, { idealApplications: e.target.value })
                              )
                            }
                            placeholder="Kitchen cabinets, wardrobes..."
                            className="mt-1 w-full rounded-sm border border-divider px-2 py-1.5 text-sm"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-sm bg-brass px-8 py-3 text-sm text-marble disabled:opacity-50"
          >
            {loading ? t("saving") : t("saveCatalog")}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-sm border border-divider px-6 py-3 text-sm"
            >
              {t("cancel")}
            </button>
          )}
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        {catalogs.map((c) => (
          <div key={c.id} className="rounded-sm border border-divider bg-marble p-4">
            <p className="font-display text-lg">{c.companyName}</p>
            <p className="font-mono-data text-xs text-muted">
              {t("coloursCount", { count: c.swatches.length })}
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {c.swatches.slice(0, 8).map((s) => (
                <span
                  key={s.id}
                  title={`${s.name} — ${s.sheetCode}`}
                  className="h-6 w-6 rounded-full border border-divider"
                  style={{ backgroundColor: s.hex }}
                />
              ))}
            </div>
            <div className="mt-3 flex gap-3">
              <button type="button" onClick={() => startEdit(c)} className="text-xs text-brass">
                {t("edit")}
              </button>
              <button type="button" onClick={() => handleDelete(c.id)} className="text-xs text-red-600">
                {t("delete")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
