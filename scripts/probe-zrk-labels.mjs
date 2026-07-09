const h = await (await fetch("https://zrkgroup.com/products/2030")).text();
const labels = [
  ...h.matchAll(
    /text-neutral-500">([^<]+)<\/span><span class="text-sm font-medium text-neutral-900">([^<]+)/g
  ),
];
console.log(labels.map((m) => `${m[1]}: ${m[2]}`));

// material category elsewhere?
const mdf = h.match(/MDF|Textured|Laminate|Chipboard/gi);
console.log("keywords", [...new Set(mdf ?? [])].slice(0, 10));
