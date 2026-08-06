"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useCart } from "@/lib/cart/CartContext";
import { formatPKR } from "@/lib/rates";
import { SITE } from "@/lib/site";
import { whatsappUrl } from "@/lib/share";

export function CartCheckoutClient() {
  const { t } = useLanguage();
  const { items, totalPKR, setQty, removeItem, clear } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Lahore");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ orderNumber: string } | null>(null);

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          city,
          note,
          items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("orderError"));
        setLoading(false);
        return;
      }
      const orderNumber = data.order?.orderNumber as string;
      setDone({ orderNumber });
      clear();
    } catch {
      setError(t("orderError"));
    }
    setLoading(false);
  }

  if (done) {
    const waMsg = [
      `Hi ${SITE.shortName} — Order ${done.orderNumber}`,
      `Name: ${name}`,
      `Phone: ${phone}`,
      city ? `City: ${city}` : "",
      "Payment: COD",
    ]
      .filter(Boolean)
      .join("\n");

    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <p className="font-mono-data text-xs uppercase tracking-[0.3em] text-brass">
          {t("orderSuccessEyebrow")}
        </p>
        <h1 className="font-display mt-4 text-3xl text-charcoal">
          {t("orderSuccessTitle")}
        </h1>
        <p className="mt-3 text-muted">
          {t("orderSuccessBody", { order: done.orderNumber })}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href={whatsappUrl(waMsg)}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-ink px-6 py-3 text-sm text-paper"
          >
            {t("chatOnWhatsApp")}
          </a>
          <Link
            href="/products"
            className="border border-ink/20 px-6 py-3 text-sm text-ink"
          >
            {t("continueShopping")}
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-3xl text-charcoal">{t("cartTitle")}</h1>
        <p className="mt-4 text-muted">{t("cartEmpty")}</p>
        <Link
          href="/products"
          className="mt-8 inline-block bg-ink px-6 py-3 text-sm text-paper"
        >
          {t("browseShop")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-3xl text-charcoal sm:text-4xl">
        {t("cartTitle")}
      </h1>
      <p className="mt-2 text-muted">{t("cartSubtitle")}</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <ul className="space-y-4">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex gap-4 border border-divider bg-paper p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image || "/products/placeholder.svg"}
                alt=""
                className="h-20 w-20 shrink-0 object-cover"
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/products/${item.productId}`}
                  className="font-display text-base text-charcoal hover:text-brass"
                >
                  {item.name}
                </Link>
                <p className="mt-1 font-mono-data text-sm text-ink">
                  {formatPKR(item.pricePKR)}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-muted">
                    {t("qty")}
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={item.qty}
                      onChange={(e) =>
                        setQty(item.productId, Number(e.target.value) || 1)
                      }
                      className="w-16 border border-divider bg-base px-2 py-1 text-ink"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="text-xs text-red-700"
                  >
                    {t("remove")}
                  </button>
                </div>
              </div>
              <p className="shrink-0 font-mono-data text-sm text-ink">
                {formatPKR(item.pricePKR * item.qty)}
              </p>
            </li>
          ))}
        </ul>

        <form
          onSubmit={placeOrder}
          className="h-fit space-y-4 border border-divider bg-paper p-6"
        >
          <h2 className="font-display text-xl text-charcoal">
            {t("checkoutTitle")}
          </h2>
          <p className="text-sm text-muted">{t("checkoutCodNote")}</p>

          <label className="block">
            <span className="text-sm font-medium">{t("quoteFormName")}</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full border border-divider bg-base px-3 py-2.5"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t("quoteFormPhone")}</span>
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full border border-divider bg-base px-3 py-2.5"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t("checkoutCity")}</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full border border-divider bg-base px-3 py-2.5"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t("quoteFormMessage")}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 w-full border border-divider bg-base px-3 py-2.5"
            />
          </label>

          <div className="flex items-center justify-between border-t border-divider pt-4">
            <span className="text-sm text-muted">{t("cartTotal")}</span>
            <span className="font-mono-data text-lg text-ink">
              {formatPKR(totalPKR)}
            </span>
          </div>

          {error && (
            <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink py-3 text-sm text-paper disabled:opacity-50"
          >
            {loading ? t("orderPlacing") : t("placeOrder")}
          </button>
        </form>
      </div>
    </div>
  );
}
