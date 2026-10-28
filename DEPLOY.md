# Deployment steps — Sportsbook Campaigns Dashboard

Takes about 15 minutes. You need a GitHub account and a Vercel account. You can sign in to Vercel with your GitHub account.

---

## Step 1 — Put the project on GitHub

1. Go to **github.com → New repository**.
2. Name it, for example `sportsbook-campaigns`. Set it to **Private**. Don't add a README. Click **Create repository**.
3. On the empty repo page, click **"uploading an existing file"**.
4. Open the `campaign-assets-dashboard` folder on your computer. Select **everything inside it** and drag it into the GitHub page:
   `api`, `lib`, `public`, `scripts`, `package.json`, `vercel.json`, `.gitignore`, `.env.example`, `README.md`, `DEPLOY.md`.
   > Files starting with a dot (`.gitignore`, `.env.example`) may be hidden in Windows Explorer. They are nice to have but not required.
5. Click **Commit changes**.

Check: the repo should show the folders `api`, `lib`, `public`, `scripts` and the file `package.json` at the top level. They must not be inside another folder.

---

## Step 2 — Import into Vercel

1. Go to **vercel.com → Add New… → Project**.
2. Find your `sportsbook-campaigns` repo and click **Import**. The first time, you may need to click "Adjust GitHub App permissions" to give Vercel access to the repo.
3. Settings:
   - **Framework Preset:** `Other`
   - **Root Directory:** leave as is (`./`)
   - **Build / Output settings:** leave empty (`vercel.json` handles it)
4. Click **Deploy**. It finishes in under a minute. The page will say *"Storage not configured"*. That's expected, so continue.

---

## Step 3 — Connect the database (stores the campaign list)

1. In your Vercel project, open the **Storage** tab.
2. Click **Create Database**. Under Marketplace, choose **Upstash → Upstash for Redis**. Click **Continue**.
3. Pick the **Free** plan and a region close to you (e.g. Frankfurt). Click **Create**.
4. When asked, **connect it to this project** and keep all environments ticked (Production, Preview, Development).

Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.

---

## Step 4 — Connect file storage (for briefs, copies and other uploads)

1. Still in the **Storage** tab, click **Create Database** again and choose **Blob**.
2. Give it a name (e.g. `sportsbook-files`) and choose **Public** access. Click **Create**.
3. **Connect it to this project**, with all environments ticked.

Vercel adds `BLOB_READ_WRITE_TOKEN` automatically.

---

## Step 5 — Set the admin login

1. Go to **Settings → Environment Variables**.
2. Add these 3 variables, with all environments ticked. Use the values from the separate **ADMIN-LOGIN.txt** file:

| Key | Value |
|---|---|
| `ADMIN_USERNAME` | *(from ADMIN-LOGIN.txt)* |
| `ADMIN_PASSWORD` | *(from ADMIN-LOGIN.txt)* |
| `SESSION_SECRET` | *(from ADMIN-LOGIN.txt)* |

3. Click **Save**.

---

## Step 6 — Redeploy (so the new settings are used)

1. Open the **Deployments** tab.
2. On the latest deployment, click **⋯ → Redeploy → Redeploy**.

---

## Step 7 — Test

1. Open your site link (shown on the project's Overview page, e.g. `https://sportsbook-campaigns.vercel.app`).
2. Scroll down and click **Admin login**. Enter the username and password.
3. Click **+ New campaign** and add a test campaign with:
   - one **link** item (e.g. Public links → Landing page),
   - one **file** item (e.g. Production phases → Brief, upload a small PDF).
4. Click **Save campaign**. Both items should appear on the page.
5. Open the site in a private/incognito window. You should see the list in read-only mode with no edit buttons. Items set to "Only me" should not appear.
6. Delete the test campaign items, and you're ready to share the link.

---

## Later

- **Change the password:** Settings → Environment Variables → edit `ADMIN_PASSWORD` → Redeploy.
- **Log everyone out:** change `SESSION_SECRET` → Redeploy.
- **Custom address (e.g. campaigns.digitain.com):** Settings → Domains → Add.
- **Code changes:** upload changed files to GitHub. Vercel redeploys automatically.
- **Backup:** use **Export CSV** on the page.

## If something goes wrong

| Message on the page | Fix |
|---|---|
| *Storage not configured…* | Step 3 not done, or not connected to this project → connect it, then Redeploy. |
| *File storage is not connected…* | Step 4 not done → connect Blob, then Redeploy. |
| *ADMIN_PASSWORD is not set…* | Step 5 not done, or no redeploy after it. |
| *Wrong username or password* | Check the values in Environment Variables. The username ignores capital letters; the password must match exactly. |
| 404 page | The files are inside a sub-folder in GitHub. `package.json` must be at the top level of the repo. |
