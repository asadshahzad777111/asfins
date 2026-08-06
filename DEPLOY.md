# ASFins.com — Live Setup Guide

Domain: **asfins.com** · Brand: **Aspire Interiors (ASFins)**

---

## Step 1 — Vercel par site deploy

1. GitHub par repo push karo (`color-configurator` folder)
2. [vercel.com](https://vercel.com) → **Add New Project** → repo select
3. Root Directory: project folder
4. **Environment Variables** add karo (`.env.example` se):

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_SITE_URL` | `https://asfins.com` |
| `NEXT_PUBLIC_WHATSAPP` | `923039227000` (same shop number as AsFix) |
| `SHOP_WHATSAPP_INTL` | `923039227000` (optional server alias) |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | Optional Meta Cloud API for inquiry alerts |
| `RESEND_API_KEY` | From [resend.com](https://resend.com) → API Keys (same account OK) |
| `RESEND_FROM` | `"ASFins" <noreply@asfins.com>` after domain verify (or `onboarding@resend.dev` for tests) |
| `ADMIN_NOTIFY_EMAIL` | Staff inbox for new quote emails (e.g. `hello@asfins.com`) |
| `ADMIN_PASSWORD` | strong password |
| `ADMIN_JWT_SECRET` | long random string |
| `MONGODB_URI` | Atlas connection string |
| `MONGODB_DB_NAME` | `asfins` |

5. **Deploy** click karo — URL milega jaise `asfins-xxx.vercel.app`

---

## Step 2 — Cloudflare DNS (asfins.com → Vercel)

Cloudflare → **asfins.com** → **DNS** → **Records**:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| `A` | `@` | `76.76.21.21` | DNS only (grey cloud) |
| `CNAME` | `www` | `cname.vercel-dns.com` | DNS only |

Phir **Vercel** → Project → **Settings** → **Domains**:
- Add `asfins.com`
- Add `www.asfins.com`

5–30 min wait — site `https://asfins.com` par live.

---

## Step 3 — MongoDB Atlas (free M0) — database **`asfins` only**

Full click-by-click guide: **[MONGODB_SETUP.md](./MONGODB_SETUP.md)**  
Do **not** reuse asplygear or any other project URI.

1. [cloud.mongodb.com](https://cloud.mongodb.com) → **Build a Database** → **M0 Free**
2. **Database Access** → user + password (save password)
3. **Network Access** → **Allow Access from Anywhere** → `0.0.0.0/0`
4. **Connect** → Drivers → copy URI → replace `<password>`  
   Prefer path `/asfins?...` and always set env `MONGODB_DB_NAME=asfins`
5. Vercel → **Settings** → **Environment Variables**:
   - `MONGODB_URI` = `mongodb+srv://...`
   - `MONGODB_DB_NAME` = `asfins`
6. Seed full catalogs (340 ZRK swatches) + products from local JSON:

```bash
cd color-configurator
# put MONGODB_URI + MONGODB_DB_NAME=asfins in .env.local first
npm run seed-mongo
```

7. Vercel → **Redeploy**, then hard-refresh the live site.

---

## Step 4 — Cloudflare R2 (product images, optional)

1. Cloudflare → **R2** → Create bucket `asfins-textures`
2. **Public access** enable → `pub-xxxx.r2.dev` URL milega
3. **CORS (required for Design Studio canvas)** — R2 → bucket → **Settings** → **CORS policy**:

```json
[
  {
    "AllowedOrigins": ["https://asfins.com", "https://www.asfins.com", "http://localhost:3000"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Type"],
    "MaxAgeSeconds": 86400
  }
]
```

Without CORS, browsers block `crossOrigin="anonymous"` texture loads and the studio cannot paint wood grain onto cabinets. The app also proxies textures via `/api/texture` as a fallback so Studio works even if R2 CORS is missing.

4. Local se images upload:

```bash
npm run mirror-zrk
```

5. Baad mein custom domain: `cdn.asfins.com` → R2 bucket

---

## Step 5 — Admin panel (shop-first)

- URL: `https://asfins.com/admin`
- Password: jo `ADMIN_PASSWORD` set kiya
- **Products** → sheets + kitchen accessories (name, photo, category, rate, stock)
- **Orders** → website cart COD orders; Confirm = stock decrement
- Sales / Purchases → manual ledgers (optional)
- Scenes / Catalogs → legacy colour studio (hidden from public nav)

---

## Step 6 — WhatsApp & email

`.env` / Vercel mein update karo:
- `NEXT_PUBLIC_WHATSAPP` = apna dealer line number
- `NEXT_PUBLIC_CONTACT_EMAIL` = `hello@asfins.com` (Cloudflare Email Routing free)
- Optional Meta Cloud API: order + inquiry alerts shop WhatsApp pe

---

## Daily commands

```bash
npm run dev              # local test
npm run seed-accessories # starter handles/hardware/sinks → data/products.json
npm run scrape-zrk-mdf:import   # new ZRK products
npm run mirror-zrk       # images local/CDN
npm run sync-zrk         # incremental ZRK sync
npm run seed-mongo       # JSON → MongoDB `asfins` (alag DB — gear URI mat use karo)
```

Public shop smoke test after deploy:
1. `/` shop home → `/products` filter + rates
2. Product → Add to cart → `/cart` COD order
3. `/admin/orders` mein order dikhe

---

## Checklist

- [ ] Vercel deploy OK
- [ ] asfins.com DNS → Vercel
- [ ] MongoDB connected (`MONGODB_DB_NAME=asfins`)
- [ ] ADMIN_PASSWORD changed
- [ ] WhatsApp number updated
- [ ] Products seeded (`seed-accessories` + sheets)
- [ ] `https://asfins.com/products` + cart order test

---

*ASFins · Aspire Interiors · Founded by Asad Shahzad*
