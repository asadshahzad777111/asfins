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
| `NEXT_PUBLIC_WHATSAPP` | `92XXXXXXXXXX` (apna number) |
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

## Step 3 — MongoDB Atlas (free 512MB)

1. [mongodb.com/atlas](https://www.mongodb.com/atlas) → free M0 cluster
2. Database user + password banao
3. Network Access → `0.0.0.0/0` (Vercel ke liye)
4. Connect → URI copy karo, database name: **`asfins`**
5. Local se seed (optional):

```bash
cd color-configurator
set MONGODB_URI=mongodb+srv://...
node scripts/seed-mongo.mjs
```

Vercel par `MONGODB_URI` set karo — live site MongoDB use karegi.

---

## Step 4 — Cloudflare R2 (product images, optional)

1. Cloudflare → **R2** → Create bucket `asfins-textures`
2. **Public access** enable → `pub-xxxx.r2.dev` URL milega
3. Local se images upload:

```bash
npm run mirror-zrk
```

4. Baad mein custom domain: `cdn.asfins.com` → R2 bucket

---

## Step 5 — Admin panel

- URL: `https://asfins.com/admin`
- Password: jo `ADMIN_PASSWORD` set kiya
- Catalogs → ZRK sync / bulk import
- Scenes → kitchen rooms upload

---

## Step 6 — WhatsApp & email

`.env` / Vercel mein update karo:
- `NEXT_PUBLIC_WHATSAPP` = apna dealer line number
- `NEXT_PUBLIC_CONTACT_EMAIL` = `hello@asfins.com` (Cloudflare Email Routing free)

---

## Daily commands

```bash
npm run dev              # local test
npm run scrape-zrk-mdf:import   # new ZRK products
npm run mirror-zrk       # images local/CDN
npm run sync-zrk         # incremental ZRK sync
npm run seed-mongo       # JSON → MongoDB
```

---

## Checklist

- [ ] Vercel deploy OK
- [ ] asfins.com DNS → Vercel
- [ ] MongoDB connected
- [ ] ADMIN_PASSWORD changed
- [ ] WhatsApp number updated
- [ ] Products/catalog seeded
- [ ] `https://asfins.com/studio` test

---

*ASFins · Aspire Interiors · Founded by Asad Shahzad*
