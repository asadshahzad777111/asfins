"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { formatPKR } from "@/lib/rates";
import type { OrderStatus, ShopOrder } from "@/lib/orders/types";

interface OrdersAdminProps {
  initialOrders: ShopOrder[];
}

const STATUSES: OrderStatus[] = ["new", "confirmed", "done", "cancelled"];

function phoneDigits(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  if (digits.length === 10) return `92${digits}`;
  return digits;
}

export function OrdersAdmin({ initialOrders }: OrdersAdminProps) {
  const { t } = useLanguage();
  const [orders, setOrders] = useState(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(id: string, status: OrderStatus) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("orderUpdateError"));
        setBusyId(null);
        return;
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? (data.order as ShopOrder) : o))
      );
    } catch {
      setError(t("orderUpdateError"));
    }
    setBusyId(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-charcoal">{t("adminOrdersTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("adminOrdersSubtitle")}</p>
      </div>

      {error && (
        <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {orders.length === 0 ? (
        <p className="rounded-sm border border-divider bg-marble p-6 text-sm text-muted">
          {t("emptyOrders")}
        </p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const digits = phoneDigits(order.phone);
            const waHref = digits
              ? `https://wa.me/${digits}?text=${encodeURIComponent(
                  `Hi — re: order ${order.orderNumber}`
                )}`
              : undefined;
            return (
              <div
                key={order.id}
                className="rounded-sm border border-divider bg-marble p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono-data text-xs text-brass">
                      {order.orderNumber} · {order.status}
                    </p>
                    <p className="mt-1 font-display text-lg text-charcoal">
                      {order.name}
                    </p>
                    <p className="text-sm text-muted">
                      {order.phone}
                      {order.city ? ` · ${order.city}` : ""}
                    </p>
                    <p className="mt-1 font-mono-data text-sm text-ink">
                      {formatPKR(order.totalPKR)} · COD
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {new Date(order.createdAt).toLocaleString("en-PK")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {waHref && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-divider px-2 py-1 text-[11px] uppercase tracking-wide hover:bg-paper"
                      >
                        WhatsApp
                      </a>
                    )}
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busyId === order.id || order.status === s}
                        onClick={() => setStatus(order.id, s)}
                        className="border border-divider px-2 py-1 text-[11px] uppercase tracking-wide hover:bg-paper disabled:opacity-40"
                      >
                        {t(
                          s === "new"
                            ? "orderStatusNew"
                            : s === "confirmed"
                              ? "orderStatusConfirmed"
                              : s === "done"
                                ? "orderStatusDone"
                                : "orderStatusCancelled"
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <ul className="mt-3 space-y-1 border-t border-divider pt-3 text-sm text-muted">
                  {order.items.map((item) => (
                    <li key={`${order.id}-${item.productId}`}>
                      {item.qty}× {item.name} — {formatPKR(item.pricePKR * item.qty)}
                    </li>
                  ))}
                </ul>
                {order.note && (
                  <p className="mt-2 text-sm text-charcoal">{order.note}</p>
                )}
                {order.stockDecremented && (
                  <p className="mt-2 font-mono-data text-[10px] uppercase tracking-wider text-brass">
                    {t("orderStockDecremented")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
