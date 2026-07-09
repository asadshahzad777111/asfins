const r = await fetch("https://zrkgroup.com/products/2030");
const html = await r.text();
console.log("len", html.length);

const nextImg = [
  ...html.matchAll(/_next\/image\?url=([^&"']+)/g),
].map((m) => decodeURIComponent(m[1]));
console.log("next images", nextImg.slice(0, 8));

const uploads = [
  ...new Set(
    [...html.matchAll(/strapi\.zrkgroup\.com\/uploads\/[^"'\s)]+/g)].map((m) => m[0])
  ),
];
console.log("uploads", uploads);

const h1 = html.match(/<h1[^>]*>([^<]+)/);
console.log("h1", h1?.[1]);

for (const kw of [
  "Thickness",
  "Dimensions",
  "Surface",
  "Product Type",
  "Color",
  "Palette",
  "Product Line",
  "Vibrant",
]) {
  const i = html.indexOf(kw);
  if (i > -1) console.log(kw, ":", html.slice(i, i + 150).replace(/\s+/g, " "));
}

// card hover text from listing
const lr = await fetch("https://zrkgroup.com/products?producttype=MDF&page=1");
const listHtml = await lr.text();
const cardSnippet = listHtml.indexOf("/products/2030");
console.log("card around 2030:", listHtml.slice(cardSnippet - 200, cardSnippet + 800).replace(/\s+/g, " "));

// pagination - total pages
const pageLinks = [...listHtml.matchAll(/page=(\d+)/g)].map((m) => Number(m[1]));
console.log("max page", Math.max(...pageLinks));
const countMatch = listHtml.match(/Showing\s+(\d+)\s+products/i);
console.log("count", countMatch?.[1]);
