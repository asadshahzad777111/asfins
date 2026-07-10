"use client";

const CODES = [
  "3001",
  "8062",
  "Walnut Elite",
  "High Gloss",
  "UV Lux",
  "Charcoal Matt",
  "Honey Oak",
  "Calacatta",
  "Sage Green",
  "Pure White",
];

export function FinishMarquee({ className = "" }: { className?: string }) {
  const loop = [...CODES, ...CODES];

  return (
    <div
      className={`finish-marquee relative overflow-hidden border-y border-ink py-4 ${className}`}
      aria-hidden
    >
      <div className="finish-marquee__track flex w-max gap-12">
        {loop.map((code, i) => (
          <span
            key={`${code}-${i}`}
            className="text-[12px] uppercase tracking-[0.28em] text-ink/40"
          >
            {code}
            <span className="ml-12 text-ink/25">—</span>
          </span>
        ))}
      </div>
    </div>
  );
}
