"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Sale } from "@/lib/sales/types";

interface SalesAdminProps {
  initialSales: Sale[];
}

export function SalesAdmin({ initialSales }: SalesAdminProps) {
  const { t } = useLanguage();
  const [sales, setSales] = useState(initialSales);
  const [customerName, setCustomerName] = useState("");
  const [productName, setProductName] = useState("");
  const [amountPKR, setAmountPKR] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/admin/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName,
        productName,
        amountPKR: Number(amountPKR),
        notes,
        status: "pending",
      }),
    });
    const data = await res.json();

    if (res.ok) {
      setMessage({ type: "ok", text: t("saleSaveSuccess", { name: customerName }) });
      setSales((s) => [data.sale, ...s]);
      setCustomerName("");
      setProductName("");
      setAmountPKR("");
      setNotes("");
    } else {
      setMessage({ type: "err", text: data.error ?? "Save fail" });
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm(t("deleteSaleConfirm"))) return;
    const res = await fetch(`/api/admin/sales?id=${id}`, { method: "DELETE" });
    if (res.ok) setSales((s) => s.filter((x) => x.id !== id));
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
        <div className="wp-postbox-head">{t("newSale")}</div>
        <div className="wp-postbox-body">
          <form onSubmit={handleSubmit} className="wizard-form-grid">
            <label className="form-group">
              <span>{t("saleCustomer")}</span>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            </label>
            <label className="form-group">
              <span>{t("saleProduct")}</span>
              <input value={productName} onChange={(e) => setProductName(e.target.value)} required />
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
                {loading ? t("saving") : t("addSale")}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="wp-postbox">
        <div className="wp-postbox-head">{t("salesList", { count: sales.length })}</div>
        <div className="wp-postbox-body">
          {sales.length === 0 ? (
            <p className="wp-empty">{t("emptySales")}</p>
          ) : (
            <div className="wp-table-wrap">
              <table className="wp-table">
                <thead>
                  <tr>
                    <th>{t("saleCustomer")}</th>
                    <th>{t("saleProduct")}</th>
                    <th>{t("priceLabel")}</th>
                    <th>{t("saleStatus")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id}>
                      <td className="wp-row-title">{s.customerName}</td>
                      <td>{s.productName}</td>
                      <td>Rs {s.amountPKR.toLocaleString()}</td>
                      <td>{s.status}</td>
                      <td>
                        <button
                          type="button"
                          className="wp-button wp-button--link wp-button--small"
                          onClick={() => void handleDelete(s.id)}
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
