import { writeFile } from "fs/promises";

const r = await fetch("https://zrkgroup.com/products?producttype=MDF&page=1");
const html = await r.text();

// Save snippet around strapi
const idx = html.indexOf("strapi");
console.log("strapi context:", html.slice(Math.max(0, idx - 200), idx + 400));

// Find script src
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
console.log("scripts", scripts.slice(0, 15));

// product detail links
const productLinks = [...new Set([...html.matchAll(/href="(\/products\/[^"]+)"/g)].map((m) => m[1]))];
console.log("product links", productLinks.length, productLinks.slice(0, 10));

// 2030 pattern
const codes = [...html.matchAll(/>(\d{4})</g)].map((m) => m[1]);
console.log("4-digit codes", [...new Set(codes)].slice(0, 30));

// fetch one product page
if (productLinks[0]) {
  const pr = await fetch("https://zrkgroup.com" + productLinks[0]);
  const phtml = await pr.text();
  const uploads = [...phtml.matchAll(/https:\/\/strapi\.zrkgroup\.com\/uploads\/[^"'\s)]+/g)];
  console.log("product page", productLinks[0], "uploads", uploads.slice(0, 3).map((m) => m[0]));
  const title = phtml.match(/<title>([^<]+)/)?.[1];
  console.log("title", title);
}

// try internal fetch patterns in js bundles
const jsUrl = scripts.find((s) => s.includes("_app") || s.includes("main") || s.includes("chunk"));
if (jsUrl) {
  const full = jsUrl.startsWith("http") ? jsUrl : "https://zrkgroup.com" + jsUrl;
  console.log("fetching js", full);
  const jr = await fetch(full);
  const js = await jr.text();
  const apiMatches = [...new Set([...js.matchAll(/strapi\.zrkgroup\.com[^"'\s]*/g)].map((m) => m[0]))];
  console.log("js strapi refs", apiMatches.slice(0, 20));
  const endpoints = [...new Set([...js.matchAll(/\/api\/[a-zA-Z0-9_-]+/g)].map((m) => m[0]))];
  console.log("js api endpoints", endpoints.slice(0, 30));
}

await writeFile("scripts/zrk-page-sample.html", html.slice(0, 50000));
