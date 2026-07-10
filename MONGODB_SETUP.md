# ASFins — MongoDB Atlas Setup (database: `asfins`)

Use a **new** free Atlas cluster for **asfins.com only**.  
Do **not** reuse any asplygear / other project URI.

App code already expects:

- `MONGODB_URI` — Atlas connection string  
- `MONGODB_DB_NAME=asfins` (default in `src/lib/db/client.ts` if unset)

Local JSON already has the full catalog: **ZRK Group = 340 swatches** + **340 products** in `data/*.json`. Seed those into Mongo so production has the full set.

---

## 1. Create Atlas free cluster (M0)

1. Open [https://cloud.mongodb.com](https://cloud.mongodb.com) and sign in (or create an account).
2. **Create** → **Build a Database** (or **Create Cluster**).
3. Choose **M0 Free** / Shared.
4. Cloud provider + region: any nearby (e.g. AWS / Google, closest to you or Vercel).
5. Cluster name: e.g. `asfins` (optional).
6. Click **Create Deployment** / **Create Cluster**. Wait until it is ready.

---

## 2. Database user

1. When prompted (or **Database Access** → **Add New Database User**):
2. Authentication: **Password**.
3. Username: e.g. `asfins_app`.
4. Password: generate a strong one → **copy and save it** (you will paste into the URI).
5. Privileges: **Atlas admin** or **Read and write to any database**.
6. **Add User**.

---

## 3. Network Access (required for Vercel)

1. **Network Access** → **Add IP Address**.
2. Click **Allow Access from Anywhere** → `0.0.0.0/0`.
3. Confirm / **Add Entry**.  
   (Hobby Vercel has dynamic IPs; `0.0.0.0/0` is the usual approach.)

---

## 4. Copy connection URI

1. **Database** → **Connect** on your cluster.
2. Choose **Drivers** (or **Connect your application**).
3. Copy the URI. It looks like:

   `mongodb+srv://asfins_app:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

4. Replace `<password>` with the real password (URL-encode special characters if needed).
5. Optionally set the DB path to `asfins`:

   `mongodb+srv://USER:PASSWORD@HOST/asfins?retryWrites=true&w=majority`

   The app still uses `MONGODB_DB_NAME=asfins` even if the path is `/`.

---

## 5. Local `.env.local` (for seed)

In `color-configurator/.env.local` add (do not commit this file):

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/asfins?retryWrites=true&w=majority
MONGODB_DB_NAME=asfins
```

Then seed full JSON → Mongo:

```bash
cd color-configurator
npm run seed-mongo
```

Expected output includes:

- `Connected: asfins`
- `OK catalogs: 4 documents` (ZRK has **340** swatches inside)
- `OK products: 340 documents`
- `Seed complete.`

If `MONGODB_URI` is missing, the script exits with: `Set MONGODB_URI in environment first.`

---

## 6. Vercel environment variables

Vercel → your **asfins** project → **Settings** → **Environment Variables** → add for **Production** (and Preview if you want):

| Name | Value |
|------|--------|
| `MONGODB_URI` | your `mongodb+srv://...` string (same as local) |
| `MONGODB_DB_NAME` | `asfins` |

Then **Redeploy** (Deployments → … → Redeploy), or push a commit.

After deploy, open `https://asfins.com` (or your Vercel URL) and hard-refresh. Catalogs/products should load from Mongo; if Mongo were stale with fewer swatches, the app prefers richer `data/catalogs.json` and can re-sync — still seed the **full** JSON so Mongo starts correct.

---

## Checklist

- [ ] New M0 cluster (ASFins only — not asplygear)
- [ ] DB user + password saved
- [ ] Network Access `0.0.0.0/0`
- [ ] URI copied (password substituted)
- [ ] `.env.local` has `MONGODB_URI` + `MONGODB_DB_NAME=asfins`
- [ ] `npm run seed-mongo` succeeded (340 ZRK + 340 products)
- [ ] Same vars on Vercel → Redeploy → refresh site

---

## Wait-ready commands (after you paste the URI)

```bash
cd C:\Users\asads\Projects\color-configurator
npm run seed-mongo
```

PowerShell one-off (if you prefer not to put URI in `.env.local` yet):

```powershell
$env:MONGODB_URI="mongodb+srv://USER:PASSWORD@HOST/asfins?retryWrites=true&w=majority"
$env:MONGODB_DB_NAME="asfins"
npm run seed-mongo
```

Tell the agent when Atlas + Vercel vars are set so seed/connectivity can be verified (without printing secrets).
