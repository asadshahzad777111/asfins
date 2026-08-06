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
      <div className="mx-auto max-w-lg px-5 py-20 text-center pb-mobile-nav">
        <p className="label-caps text-brass">{t("orderSuccessEyebrow")}</p>
        <h1 className="font-display mt-4 text-[40px] text-ink">
          {t("orderSuccessTitle")}
        </h1>
        <p className="mt-3 text-muted">
          {t("orderSuccessBody", { order: done.orderNumber })}
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href={whatsappUrl(waMsg)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-atelier"
          >
            {t("chatOnWhatsApp")}
          </a>
          <Link href="/products" className="btn-atelier-outline">
            {t("continueShopping")}
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center pb-mobile-nav">
        <h1 className="font-display text-[40px] text-ink">{t("cartTitle")}</h1>
        <p className="mt-4 text-muted">{t("cartEmpty")}</p>
        <Link href="/products" className="btn-atelier mt-10 inline-flex">
          {t("browseShop")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-16 px-5 py-16 pb-mobile-nav md:px-0 md:py-20">
      <div className="text-center">
        <h1 className="font-display text-[40px] tracking-tight text-ink md:text-[64px]">
          {t("checkoutTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base text-muted">
          {t("cartSubtitle")}
        </p>
      </div>

      {/* Order summary */}
      <section className="border border-stone bg-paper">
        <div className="flex items-center justify-between border-b border-stone p-6">
          <h2 className="font-display text-[28px] text-ink">{t("orderSummary")}</h2>
          <span className="label-caps text-muted">
            {items.length} {items.length === 1 ? "Item" : "Items"}
          </span>
        </div>
        <ul className="divide-y divide-stone">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex flex-col items-start gap-6 p-6 sm:flex-row sm:items-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image || "/products/placeholder.svg"}
                alt=""
                className="h-24 w-24 shrink-0 border border-stone object-cover"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex w-full items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/products/${item.productId}`}
                      className="text-lg uppercase text-ink hover:text-brass"
                    >
                      {item.name}
                    </Link>
                    <p className="label-caps mt-1 text-muted">
                      {formatPKR(item.pricePKR)}
                    </p>
                  </div>
                  <span className="text-lg text-ink">
                    {formatPKR(item.pricePKR * item.qty)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-muted">
                    {t("qty")}
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={item.qty}
                      onChange={(e) =>
                        setQty(item.productId, Number(e.target.value) || 1)
                      }
                      className="w-16 border border-stone bg-base px-2 py-1 text-ink"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="label-caps text-[10px] text-red-700"
                  >
                    {t("remove")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 bg-[#f3f3f3] p-6">
          <div className="flex justify-between text-base text-muted">
            <span>{t("cartTotal")}</span>
            <span>{formatPKR(totalPKR)}</span>
          </div>
          <div className="flex justify-between text-base text-muted">
            <span>{t("shippingTbd")}</span>
            <span>TBD</span>
          </div>
          <div className="mt-4 flex justify-between border-t border-stone pt-4 font-display text-[28px] text-ink">
            <span>{t("totalEstimated")}</span>
            <span>{formatPKR(totalPKR)}</span>
          </div>
        </div>
      </section>

      {/* Delivery form */}
      <section>
        <h2 className="mb-8 font-display text-[28px] text-ink">
          {t("deliveryDetails")}
        </h2>
        <form onSubmit={placeOrder} className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="label-caps text-ink">{t("quoteFormName")} *</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("quoteFormName")}
                className="input-atelier"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="label-caps text-ink">{t("quoteFormPhone")} *</span>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="03XX-XXXXXXX"
                className="input-atelier"
              />
            </label>
          </div>
          <label className="flex flex-col gap-2">
            <span className="label-caps text-ink">{t("checkoutCity")} *</span>
            <input
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Lahore, Karachi, Islamabad…"
              className="input-atelier"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="label-caps text-ink">
              {t("quoteFormMessage")} ({t("optional")})
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full resize-none border border-stone bg-transparent p-4 text-base text-ink outline-none focus:border-ink"
              placeholder={t("orderNotePlaceholder")}
            />
          </label>

          <div className="mt-2 flex items-start gap-4 border border-stone bg-base p-6">
            <span className="mt-0.5 text-ink" aria-hidden>
              ✓
            </span>
            <div>
              <h4 className="label-caps mb-2 text-ink">{t("paymentMethod")}</h4>
              <p className="text-base text-muted">{t("checkoutCodNote")}</p>
            </div>
          </div>

          {error && (
            <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-atelier w-full py-6 disabled:opacity-50"
          >
            {loading ? t("orderPlacing") : t("placeOrder")}
          </button>
        </form>
      </section>
    </div>
  );
}
