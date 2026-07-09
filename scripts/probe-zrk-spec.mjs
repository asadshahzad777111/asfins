const r = await fetch("https://zrkgroup.com/products/2030");
const h = await r.text();

function spec(label) {
  const re = new RegExp(
    `${label}</span><span class="text-sm font-medium text-neutral-900">([^<]+)`
  );
  return h.match(re)?.[1]?.trim();
}

for (const k of [
  "Category",
  "Product Type",
  "Product Line",
  "Color",
  "Surface Finish",
  "Dimensions",
  "Thickness",
]) {
  console.log(k, spec(k));
}

const imgs = [
  ...new Set(
    [...h.matchAll(/_next\/image\?url=([^&"']+)/g)]
      .map((m) => decodeURIComponent(m[1]))
      .filter((u) => u.includes("strapi.zrkgroup.com/uploads"))
  ),
];
console.log("main img", imgs.find((u) => u.includes("/2030_")) ?? imgs[0]);
