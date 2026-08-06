"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  ADMIN_CATEGORY_OPTIONS,
  isSheetCategory,
} from "@/lib/products/categories";
import type { Product } from "@/lib/products/types";

interface ProductsAdminProps {
  initialProducts: Product[];
}

const EMPTY_EXTRA = {
  productCode: "",
  surfaceFinish: "",
  colorDescription: "",
  dimensions: "",
  thickness: "",
  idealApplications: "",
  brandName: "",
  technicalSheetUrl: "",
  imageUrl: "",
  materialCategory: "",
  substrate: "",
  stock: "1",
  lowStockAt: "5",
};

export function ProductsAdmin({ initialProducts }: ProductsAdminProps) {
  const { t } = useLanguage();
  const [products, setProducts] = useState(initialProducts);
  const [name, setName] = useState("");
  const [pricePKR, setPricePKR] = useState("");
  const [category, setCategory] = useState("accessories");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [extra, setExtra] = useState(EMPTY_EXTRA);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const sheetFields = isSheetCategory(category);

  function updateExtra(field: keyof typeof EMPTY_EXTRA, value: string) {
    setExtra((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const form = new FormData();
    form.append("name", name);
    form.append("pricePKR", pricePKR);
    form.append("category", category);
    form.append("description", description);
    form.append("active", "true");
    if (image) form.append("image", image);
    for (const [key, val] of Object.entries(extra)) {
      if (val) form.append(key, val);
    }

    const res = await fetch("/api/admin/products", { method: "POST", body: form });
    const data = await res.json();

    if (res.ok) {
      setMessage({ type: "ok", text: t("productSaveSuccess", { name }) });
      setProducts((p) => [...p, data.product]);
      setName("");
      setPricePKR("");
      setDescription("");
      setImage(null);
      setExtra(EMPTY_EXTRA);
    } else {
      setMessage({ type: "err", text: data.error ?? "Save fail" });
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm(t("deleteProductConfirm"))) return;
    const res = await fetch(`/api/admin/products?id=${id}`, { method: "DELETE" });
    if (res.ok) setProducts((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-charcoal">{t("adminProductsTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("adminProductsSubtitle")}</p>
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

      <form onSubmit={handleSubmit} className="space-y-4 rounded-sm border border-divider bg-marble p-6">
        <h2 className="font-display text-lg">{t("newProduct")}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">{t("productName")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t("priceLabel")}</span>
            <input
              type="number"
              value={pricePKR}
              onChange={(e) => setPricePKR(e.target.value)}
              className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
              required
              min={1}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">{t("category")}</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
            >
              {ADMIN_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.id === "marble"
                    ? `${t(opt.labelKey)} (marble)`
                    : opt.id === "wood-laminate"
                      ? `${t(opt.labelKey)} (laminate)`
                      : t(opt.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t("brandNameLabel")}</span>
            <input
              value={extra.brandName}
              onChange={(e) => updateExtra("brandName", e.target.value)}
              placeholder="ASFins"
              className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">{t("stockLabel")}</span>
            <input
              type="number"
              min={0}
              value={extra.stock}
              onChange={(e) => updateExtra("stock", e.target.value)}
              className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t("lowStockAtLabel")}</span>
            <input
              type="number"
              min={0}
              value={extra.lowStockAt}
              onChange={(e) => updateExtra("lowStockAt", e.target.value)}
              className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium">{t("description")}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">{t("productImage")}</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t("imageUrlLabel")}</span>
            <input
              value={extra.imageUrl}
              onChange={(e) => updateExtra("imageUrl", e.target.value)}
              placeholder="/products/handle.jpg"
              className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
            />
          </label>
        </div>

        {sheetFields && (
          <div className="space-y-4 border-t border-divider pt-4">
            <p className="font-mono-data text-[10px] uppercase tracking-wider text-muted">
              {t("sheetFieldsOptional")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">{t("productCodeLabel")}</span>
                <input
                  value={extra.productCode}
                  onChange={(e) => updateExtra("productCode", e.target.value)}
                  className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">{t("materialCategory")}</span>
                <input
                  value={extra.materialCategory}
                  onChange={(e) => updateExtra("materialCategory", e.target.value)}
                  placeholder="UV Lux"
                  className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">{t("surfaceFinishLabel")}</span>
                <input
                  value={extra.surfaceFinish}
                  onChange={(e) => updateExtra("surfaceFinish", e.target.value)}
                  className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">{t("substrate")}</span>
                <select
                  value={extra.substrate}
                  onChange={(e) => updateExtra("substrate", e.target.value)}
                  className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
                >
                  <option value="">—</option>
                  <option value="mdf">{t("substrateMdf")}</option>
                  <option value="chipboard">{t("substrateChipboard")}</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">{t("dimensionsLabel")}</span>
                <input
                  value={extra.dimensions}
                  onChange={(e) => updateExtra("dimensions", e.target.value)}
                  className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">{t("thicknessLabel")}</span>
                <input
                  value={extra.thickness}
                  onChange={(e) => updateExtra("thickness", e.target.value)}
                  className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
                />
              </label>
            </div>
          </div>
        )}

        {!sheetFields && (
          <label className="block">
            <span className="text-sm font-medium">{t("productCodeLabel")}</span>
            <input
              value={extra.productCode}
              onChange={(e) => updateExtra("productCode", e.target.value)}
              placeholder="SKU / code"
              className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-sm bg-brass px-8 py-3 text-sm text-marble disabled:opacity-50"
        >
          {loading ? t("saving") : t("addProduct")}
        </button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((p) => (
          <div key={p.id} className="flex gap-4 rounded-sm border border-divider bg-marble p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image} alt={p.name} className="h-24 w-24 shrink-0 rounded-sm object-cover" />
            <div className="min-w-0 flex-1">
              <p className="font-mono-data text-[10px] uppercase text-brass">
                {p.category}
                {p.productCode ? ` · ${p.productCode}` : ""}
              </p>
              <p className="font-display text-sm truncate">{p.name}</p>
              <p className="font-mono-data text-brass text-xs">
                Rs {p.pricePKR.toLocaleString()}
                {p.stock != null ? ` · stock ${p.stock}` : ""}
              </p>
              <p className="text-xs text-muted line-clamp-2">{p.description}</p>
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                className="mt-2 text-xs text-red-600"
              >
                {t("delete")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
