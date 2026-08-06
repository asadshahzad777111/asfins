import fs from "fs";

const p = "D:/Projects/color-configurator/src/app/globals.css";
let s = fs.readFileSync(p, "utf8");

if (s.includes(".label-caps")) {
  console.log("already patched");
  process.exit(0);
}

const oldBlock = `.font-display {
  font-family: var(--font-display), system-ui, sans-serif;
  font-weight: 400;
  font-optical-sizing: auto;
}

.font-mono-data {
  font-family: var(--font-body), system-ui, sans-serif;
  font-weight: 400;
  letter-spacing: 0.04em;
}`;

const newBlock = `.font-display {
  font-family: var(--font-display), Georgia, "Times New Roman", serif;
  font-weight: 400;
  font-optical-sizing: auto;
}

.font-mono-data {
  font-family: var(--font-body), system-ui, sans-serif;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.label-caps {
  font-family: var(--font-body), system-ui, sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.btn-atelier {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  background: var(--color-ink);
  color: #ffffff;
  font-family: var(--font-body), system-ui, sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  border: 1px solid var(--color-ink);
  border-radius: 0;
  transition: background 0.3s ease, color 0.3s ease;
}

.btn-atelier:hover { background: #5e5e5e; }

.btn-atelier-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  background: transparent;
  color: var(--color-ink);
  font-family: var(--font-body), system-ui, sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  border: 1px solid var(--color-ink);
  border-radius: 0;
  transition: background 0.3s ease, color 0.3s ease;
}

.btn-atelier-outline:hover { background: var(--color-ink); color: #ffffff; }

.btn-atelier-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  background: transparent;
  color: #ffffff;
  font-family: var(--font-body), system-ui, sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  border: 1px solid #ffffff;
  border-radius: 0;
  transition: background 0.3s ease, color 0.3s ease;
}

.btn-atelier-ghost:hover { background: #ffffff; color: var(--color-ink); }

.input-atelier {
  width: 100%;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--color-ink);
  border-radius: 0;
  padding: 0.5rem 0;
  font-size: 1rem;
  color: var(--color-ink);
  outline: none;
}

.input-atelier:focus { border-bottom-color: var(--color-brass); }

.pb-mobile-nav { padding-bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px)); }
@media (min-width: 768px) { .pb-mobile-nav { padding-bottom: 0; } }`;

if (!s.includes(oldBlock)) {
  console.error("old block not found");
  process.exit(1);
}

s = s.replace(oldBlock, newBlock);

// Also refresh header glass to paper tone if still white
s = s.replace(
  "background: rgba(255, 255, 255, 0.92);",
  "background: rgba(249, 249, 249, 0.92);"
);
s = s.replace(
  "border-bottom: 1px solid var(--color-divider);\n  color: var(--color-ink) !important;\n}",
  "border-bottom: 1px solid var(--color-stone);\n  color: var(--color-ink) !important;\n}"
);

fs.writeFileSync(p, s);
console.log("patched globals.css ok");
