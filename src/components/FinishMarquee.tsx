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
      className={`finish-marquee relative overflow-hidden border-y border-white/8 py-3 ${className}`}
      aria-hidden
    >
      <div className="finish-marquee__track flex w-max gap-10">
        {loop.map((code, i) => (
          <span
            key={`${code}-${i}`}
            className="font-mono-data text-[11px] uppercase tracking-[0.35em] text-marble/35"
          >
            {code}
            <span className="ml-10 text-brass/50">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}
