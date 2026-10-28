# Sportsbook Campaign Assets Dashboard

A simple list of campaigns. Each campaign is split into **sections** (e.g. *Production phases* with the PMM brief and final copies, then *Public links* with the landing page, articles and posts). Every item opens its link or file.
It uses the Digitain Sportsbook fonts (Bebas Neue + Roboto Condensed), colours and logo.

One page, one link for everyone:

- **Visitors** see a read-only campaign list with filters (campaign title, date range, channel) and Export CSV.
- **Admin:** click the small **Admin login** link at the bottom of the page and enter your username and password. Then:
  - **+ New campaign** (top) or **Edit campaign** (next to each campaign) opens the **campaign window**. Every item is a row with its own **type**, **section** (Production phases, Public links, or *+ New section…*), title, date, **visible to** (Everyone / Only me), **link or file upload**, and **channels** (tick all that apply). Use **+ Add another item** for as many items as you need, rename the campaign at the top, then **Save campaign**. ✕ removes an item.
  - On the list: per section **+ Add**, **Rename**, **↑ ↓** to reorder; per item **Edit** (opens the campaign window at that item) and **Delete**. Deleting a file item also deletes the file.
  - "Only me" items are never sent to visitors' browsers.

Every add/edit/delete is checked on the server, so nobody can change data without the login.
- No framework. Static frontend plus a few small Vercel serverless functions; one dependency (`@vercel/blob`).
- Data is stored in **Upstash Redis**, uploaded files in **Vercel Blob** (both have free tiers and connect in one click from Vercel).

---

## Deploy in 4 steps

### 1. Push to GitHub
Create a new empty repository on GitHub (for example `sportsbook-campaign-assets`), then upload this folder:
- **Easiest:** on the new repo page, click **"uploading an existing file"** and drag in everything in this folder (including the `api`, `lib`, `public` and `scripts` folders).
- **Or with git:**
  ```bash
  cd campaign-assets-dashboard
  git init && git add . && git commit -m "Campaign assets dashboard"
  git branch -M main
  git remote add origin https://github.com/<your-org>/sportsbook-campaign-assets.git
  git push -u origin main
  ```

### 2. Import into Vercel
Vercel → **Add New… → Project** → pick the repo → **Framework preset: Other** → Deploy.
(Leave the build command empty. The output directory is already set in `vercel.json`.)

### 3. Connect storage (data + files)
In the Vercel project: **Storage → Create / Connect → Upstash (Marketplace) → Redis** → choose the free plan → connect it to the project.
This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.

Then, for file uploads: **Storage → Create → Blob** → choose **Public** access → connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`.
(Files get long random URLs, so they can't be guessed. But anyone who is given a file's exact link can open it.)

### 4. Set the admin password
Project → **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `ADMIN_USERNAME` | your admin username (default `admin`) |
| `ADMIN_PASSWORD` | your admin password |
| `SESSION_SECRET` | any long random string (e.g. 40+ random characters) |
| `PUBLIC_VIEW` | `true` (anyone with the link can view) or `false` (login required to view) |

Then **Deployments → ⋯ → Redeploy**. Done. Open the site, click **Admin login** at the bottom, and start adding items.

---

## Run locally (optional)
Requires Node 18+. Run `npm install` once.
```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=test npm run dev                    # macOS / Linux
$env:ADMIN_USERNAME="admin"; $env:ADMIN_PASSWORD="test"; npm run dev   # Windows PowerShell
```
Open http://localhost:3000. Without Redis env vars, data is saved to `.data/` (local only, git-ignored). File uploads only work with a `BLOB_READ_WRITE_TOKEN` (copy it from Vercel into your local env).

## Project structure
```
api/        assets.js (list/add/edit/delete) · meta.js (section order) · upload.js (file upload tokens) · login.js · logout.js · me.js
lib/        auth.js (signed cookie) · store.js (Redis / local file) · files.js (Blob delete) · http.js
public/     index.html · app.js · vendor/blob-upload.js (bundled Vercel Blob upload client) · styles.css · fonts/ · assets/logo.svg
scripts/    dev-server.js (local preview)
```

## Customising
- **Item types (and their order inside a section):** edit `TYPES` at the top of `api/assets.js`.
- **Standard sections and channels:** `SECTIONS` and `CHANNELS` at the top of `api/assets.js`.
- **Colours / fonts:** CSS variables at the top of `public/styles.css`.

## Notes
- To change the login, update `ADMIN_USERNAME` / `ADMIN_PASSWORD` in Vercel and redeploy. Changing `SESSION_SECRET` logs everyone out.
- Only `http(s)://` links are accepted, and all text is escaped before it is shown.
- All data is one JSON list in Redis (keys `sb:campaign-assets` and `sb:campaign-meta`). That is fine for thousands of assets. Use **Export CSV** for backups.
