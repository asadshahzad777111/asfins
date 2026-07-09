"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Product } from "@/lib/products/types";

interface ProductsAdminProps {
  initialProducts: Product[];
}

const EMPTY_ZRK = {
  productCode: "",
  surfaceFinish: "",
  colorDescription: "",
  dimensions: "",
  thickness: "",
  idealApplications: "",
  brandName: "",
  technicalSheetUrl: "",
  imageUrl: "",
};

export function ProductsAdmin({ initialProducts }: ProductsAdminProps) {
  const { t } = useLanguage();
  const [products, setProducts] = useState(initialProducts);
  const [name, setName] = useState("");
  const [pricePKR, setPricePKR] = useState("");
  const [category, setCategory] = useState("wood-laminate");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [zrk, setZrk] = useState(EMPTY_ZRK);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function updateZrk(field: keyof typeof EMPTY_ZRK, value: string) {
    setZrk((prev) => ({ ...prev, [field]: value }));
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
    for (const [key, val] of Object.entries(zrk)) {
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
      setZrk(EMPTY_ZRK);
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
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">{t("productCodeLabel")}</span>
            <input
              value={zrk.productCode}
              onChange={(e) => updateZrk("productCode", e.target.value)}
              placeholder="3001"
              className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t("brandNameLabel")}</span>
            <input
              value={zrk.brandName}
              onChange={(e) => updateZrk("brandName", e.target.value)}
              placeholder="ZRK Group"
              className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">{t("surfaceFinishLabel")}</span>
            <input
              value={zrk.surfaceFinish}
              onChange={(e) => updateZrk("surfaceFinish", e.target.value)}
              placeholder="High Gloss Elite"
              className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t("colorDescriptionLabel")}</span>
            <input
              value={zrk.colorDescription}
              onChange={(e) => updateZrk("colorDescription", e.target.value)}
              placeholder="Reddish Brown"
              className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">{t("dimensionsLabel")}</span>
            <input
              value={zrk.dimensions}
              onChange={(e) => updateZrk("dimensions", e.target.value)}
              placeholder="2440 × 1220 mm"
              className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t("thicknessLabel")}</span>
            <input
              value={zrk.thickness}
              onChange={(e) => updateZrk("thickness", e.target.value)}
              placeholder="16 mm"
              className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium">{t("idealApplicationsLabel")}</span>
          <input
            value={zrk.idealApplications}
            onChange={(e) => updateZrk("idealApplications", e.target.value)}
            placeholder="Kitchen Cabinets"
            className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">{t("category")}</span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={t("categoryPlaceholder")}
            className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">{t("description")}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
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
              value={zrk.imageUrl}
              onChange={(e) => updateZrk("imageUrl", e.target.value)}
              placeholder="/catalog/3001.png"
              className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium">{t("technicalSheetUrlLabel")}</span>
          <input
            value={zrk.technicalSheetUrl}
            onChange={(e) => updateZrk("technicalSheetUrl", e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5"
          />
        </label>

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
            <div className="flex-1 min-w-0">
              {p.productCode && (
                <p className="font-mono-data text-[10px] text-brass">{p.productCode}</p>
              )}
              <p className="font-display text-sm truncate">{p.name}</p>
              <p className="font-mono-data text-brass text-xs">Rs {p.pricePKR.toLocaleString()}</p>
              {p.surfaceFinish && (
                <p className="text-xs text-muted">{p.surfaceFinish}</p>
              )}
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
