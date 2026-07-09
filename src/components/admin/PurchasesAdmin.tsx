"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Purchase } from "@/lib/purchases/types";

interface PurchasesAdminProps {
  initialPurchases: Purchase[];
}

export function PurchasesAdmin({ initialPurchases }: PurchasesAdminProps) {
  const { t } = useLanguage();
  const [purchases, setPurchases] = useState(initialPurchases);
  const [supplierName, setSupplierName] = useState("");
  const [itemName, setItemName] = useState("");
  const [amountPKR, setAmountPKR] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/admin/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierName,
        itemName,
        amountPKR: Number(amountPKR),
        notes,
        status: "ordered",
      }),
    });
    const data = await res.json();

    if (res.ok) {
      setMessage({ type: "ok", text: t("purchaseSaveSuccess", { name: supplierName }) });
      setPurchases((p) => [data.purchase, ...p]);
      setSupplierName("");
      setItemName("");
      setAmountPKR("");
      setNotes("");
    } else {
      setMessage({ type: "err", text: data.error ?? "Save fail" });
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm(t("deletePurchaseConfirm"))) return;
    const res = await fetch(`/api/admin/purchases?id=${id}`, { method: "DELETE" });
    if (res.ok) setPurchases((p) => p.filter((x) => x.id !== id));
  }

  return (
    <>
      {message && (
        <div
          className={`wp-notice${
            message.type === "ok" ? " wp-notice--success" : " wp-notice--error"
          }`}
          style={{ marginBottom: "1rem" }}
        >
          {message.text}
        </div>
      )}

      <div className="wp-postbox">
        <div className="wp-postbox-head">{t("newPurchase")}</div>
        <div className="wp-postbox-body">
          <form onSubmit={handleSubmit} className="wizard-form-grid">
            <label className="form-group">
              <span>{t("purchaseSupplier")}</span>
              <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required />
            </label>
            <label className="form-group">
              <span>{t("purchaseItem")}</span>
              <input value={itemName} onChange={(e) => setItemName(e.target.value)} required />
            </label>
            <label className="form-group">
              <span>{t("priceLabel")}</span>
              <input
                type="number"
                value={amountPKR}
                onChange={(e) => setAmountPKR(e.target.value)}
                required
              />
            </label>
            <label className="form-group" style={{ gridColumn: "1 / -1" }}>
              <span>{t("description")}</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </label>
            <div>
              <button type="submit" className="wp-button" disabled={loading}>
                {loading ? t("saving") : t("addPurchase")}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="wp-postbox">
        <div className="wp-postbox-head">{t("purchasesList", { count: purchases.length })}</div>
        <div className="wp-postbox-body">
          {purchases.length === 0 ? (
            <p className="wp-empty">{t("emptyPurchases")}</p>
          ) : (
            <div className="wp-table-wrap">
              <table className="wp-table">
                <thead>
                  <tr>
                    <th>{t("purchaseSupplier")}</th>
                    <th>{t("purchaseItem")}</th>
                    <th>{t("priceLabel")}</th>
                    <th>{t("purchaseStatus")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id}>
                      <td className="wp-row-title">{p.supplierName}</td>
                      <td>{p.itemName}</td>
                      <td>Rs {p.amountPKR.toLocaleString()}</td>
                      <td>{p.status}</td>
                      <td>
                        <button
                          type="button"
                          className="wp-button wp-button--link wp-button--small"
                          onClick={() => void handleDelete(p.id)}
                        >
                          {t("delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
