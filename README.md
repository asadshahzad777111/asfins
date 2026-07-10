# Artisan Interiors — 2D Color Configurator

Photorealistic **2D image-based** kitchen/room color visualizer. Canvas multiply masking — no 3D.

## Quick start (local, bina MongoDB)

```bash
npm install
npm run generate-assets    # placeholder kitchen-1 masks
npm run dev
```

Open **http://localhost:3000** → Gallery → Kitchen → Configurator

**Admin:** http://localhost:3000/admin/login — password: `artisan-admin`

---

## Cabinet layer → mask → colour flow

Yeh pipeline sirf lakri ke cabinets par colour lagata hai:

```
1. Kitchen full photo (base.jpg)     → poori kitchen (background, unchanged)
2. Cabinet layer (layer-cabinets.png) → sirf cabinets cutout, black/transparent bg
3. Auto mask (mask-cabinets.png)     → base photo ki lighting/grain cabinet shape ke andar
4. Customer: zone "Cabinets (Lakri)" → company catalog colour → multiply blend
5. Canvas: base + coloured cabinet layer composite
```

**Best practice:** Cabinet layer mein sirf lakri ke cabinet doors/panels hon. Handles, countertop, appliances alag hon to behtar. Advanced option: direct `mask-*.png` upload.

### Real kitchen photos (kitchen-real)

```bash
# public/scenes/kitchen-real/ mein rakhein:
#   base.png           — poori kitchen
#   layer-cabinets.png — cabinets cutout (black bg)
npm run process-real-kitchen
npm run dev
# → /configurator/kitchen-real
```

---

## Admin upload steps (Urdu + English)

1. **http://localhost:3000/admin/login** — password `artisan-admin`
2. Tab **Scenes / Kitchens**
3. **Kitchen full photo** upload karein (poori kitchen)
4. Zone name: **Cabinets (Lakri)** — wood/laminate palette
5. **Cabinet layer** upload karein — sirf lakri cabinets cutout PNG
   - *"Yeh woh layer hai jisme sirf cabinets hain — isi par colour change hoga"*
6. **Save Kitchen + Generate Masks** — mask auto-ban jayega
7. **Catalogs** tab: company colours (Artisan Laminates, Greenply, etc.)
8. **Products** tab: finish packages for sale
9. Gallery mein room category se dikhega

### Customer flow

```
/gallery → Kitchen album → kitchen photo → /configurator/[id]
  1. Zone strip: "Cabinets (Lakri)" click (brass highlight)
  2. Company catalog select (sidebar)
  3. Colour click → instant apply on cabinets only
  4. Finish, price estimate, WhatsApp, download PNG
```

---

## MongoDB (ASFins Atlas — database `asfins`)

**Do not reuse asplygear or any other project URI.**  
Full steps: **[MONGODB_SETUP.md](./MONGODB_SETUP.md)** · also in **[DEPLOY.md](./DEPLOY.md)** Step 3.

Database name: **`asfins`**

1. [cloud.mongodb.com](https://cloud.mongodb.com) → **M0 Free** cluster
2. **Database Access** → user + password
3. **Network Access** → `0.0.0.0/0`
4. **Connect** → copy URI → set path `/asfins?...`
5. `.env.local` + Vercel:

```
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/asfins?retryWrites=true&w=majority
MONGODB_DB_NAME=asfins
```

6. Seed full JSON (340 ZRK swatches + 340 products):

```bash
npm run seed-mongo
```

**Without MongoDB:** App uses `data/*.json` automatically.


## Render free deploy

`render.yaml` included. Steps:

1. Push repo to GitHub
2. **render.com** → New **Blueprint** → connect repo
3. Render reads `render.yaml` → creates web service (free tier)
4. Dashboard → **Environment** → add:

| Variable | Value |
|----------|-------|
| `MONGODB_URI` | Your **NEW** Atlas URI (database **`asfins`**) |
| `MONGODB_DB_NAME` | `asfins` |
| `ADMIN_PASSWORD` | `artisan-admin` (change in production) |
| `ADMIN_JWT_SECRET` | Long random string |
| `NODE_ENV` | `production` (auto from render.yaml) |

5. Deploy → URL: `https://artisan-color-configurator.onrender.com`

**Note:** Uploaded scene images live in `public/scenes/` on disk. On Render free tier, disk is ephemeral — re-upload via admin after redeploy, or later move assets to cloud storage.

---

## URLs

| Page | URL |
|------|-----|
| Homepage | `/` |
| Gallery (room albums) | `/gallery` |
| Kitchen album | `/gallery/kitchen` |
| Configurator | `/configurator/[scene-id]` |
| Products | `/products` |
| Admin login | `/admin/login` |
| Admin scenes | `/admin/scenes` |
| Admin catalogs | `/admin/catalogs` |
| Admin products | `/admin/products` |
| Admin inquiries | `/admin/inquiries` |

**Default admin password:** `artisan-admin` (set `ADMIN_PASSWORD` in `.env.local`)

---

## Test commands

```bash
npm run generate-assets      # kitchen-1 placeholder scene
npm run process-real-kitchen # kitchen-real from your photos
npm run build                # must pass
npm run dev                  # local test
```

---

## Design tokens

- Base `#EDE7DD`, Walnut `#2A1F18`, Brass `#A67C3D`, Marble `#F7F5F1`
- Fonts: Fraunces (display), Inter (body), IBM Plex Mono (prices)

## WhatsApp

Update business number in `src/lib/constants.ts` → `SHOP.whatsapp`
