const r = await fetch("https://zrkgroup.com/products/2030");
const html = await r.text();

// image via next/image
const imgs = [
  ...new Set(
    [...html.matchAll(/_next\/image\?url=([^&"']+)/g)]
      .map((m) => decodeURIComponent(m[1]))
      .filter((u) => u.includes("strapi.zrkgroup.com/uploads"))
  ),
];
console.log("imgs", imgs);

// all label/value pairs
const specs = [
  ...html.matchAll(
    /<span class="text-xs uppercase tracking-wider text-neutral-500">([^<]+)<\/span><span class="text-sm font-medium text-neutral-900">([^<]+)<\/span>/g
  ),
];
console.log("specs", specs.map((m) => [m[1], m[2]]));

// palette block
const pal = html.match(/"Palette":(\[[\s\S]*?\])\s*,\s*"/);
if (pal) {
  try {
    console.log("palette", JSON.parse(pal[1])[0]);
  } catch (e) {
    console.log("palette raw", pal[1].slice(0, 300));
  }
}

// find total pages for MDF
let prev = 0;
for (let p = 14; p <= 20; p++) {
  const lr = await fetch(`https://zrkgroup.com/products?producttype=MDF&page=${p}`);
  const h = await lr.text();
  const n = new Set([...h.matchAll(/href="(\/products\/\d+)"/g)].map((m) => m[1])).size;
  console.log("page", p, "unique", n, "delta", n - prev);
  prev = n;
  if (p === 17) {
    const lastCodes = [...h.matchAll(/href="(\/products\/(\d+))"/g)].slice(-5);
    console.log("last on 17", lastCodes.map((m) => m[2]));
  }
}
