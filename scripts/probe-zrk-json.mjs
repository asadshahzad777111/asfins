const h = await (await fetch("https://zrkgroup.com/products/2030")).text();
const idx = h.indexOf("Textured");
console.log("context", h.slice(idx - 100, idx + 200));

const idx2 = h.indexOf("Leather");
console.log("leather ctx", h.slice(idx2 - 80, idx2 + 120));

// breadcrumb or tags
const tags = [...h.matchAll(/rounded-full[^>]*>([^<]{2,40})</g)].map((m) => m[1]);
console.log("tags", tags.slice(0, 15));
