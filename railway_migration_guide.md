# Complete Guide: How to Migrate Railway Accounts & Reconnect to Vercel

If your Railway account runs out of trial credits and you need to switch to a new Gmail/Railway account, follow this step-by-step guide to get your Question Editor & Link Slayer platform back online without changing your GitHub or Vercel accounts.

## Phase 1: Deploying the Backend on a New Railway Account

1. **Create the Project:**
   - Log into your new Railway account.
   - Click **+ New** and select **Deploy from GitHub repo**.
   - Connect your GitHub account and select your repository (e.g., `Question-Editor`).
   - Click **Deploy Now**. *(Note: The first build will fail—this is normal!)*

2. **Fix the Build Folder:**
   Because your project contains both frontend and backend code, you must tell Railway to only look at the backend.
   - Click on your project card, then click on the specific **Service box** (the one with the GitHub icon).
   - Go to the **Settings** tab on the right menu.
   - Scroll down to the **Source** or **Build** section.
   - Look for **Root Directory** (it defaults to `/`).
   - Change it to exactly: `/backend`
   - Press Enter to save.

3. **Set the PORT Variable:**
   Railway assigns random ports, but your domain will look for port 8000. You need to force them to match.
   - Go to the **Variables** tab at the top.
   - Click **+ New Variable**.
   - Set **Variable Name** to: `PORT`
   - Set **Value** to: `8000`
   - Click **Add**. 
   - *This will automatically restart your server.*

4. **Generate the Public URL:**
   - Go back to the **Settings** tab and scroll to **Networking**.
   - Click **Generate Domain**.
   - If a popup asks for a port, type **`8000`** and confirm.
   - Railway will give you a public URL (e.g., `question-editor-production...up.railway.app`).
   - **Copy this URL!**

> [!IMPORTANT]
> Wait until your Railway deployment has a solid **Green Dot (Active)** before moving to Phase 2.

---

## Phase 2: Connecting the New Backend to Vercel

Now you need to tell your live website where the new backend lives.

1. **Update Environment Variables:**
   - Log into your **Vercel** dashboard.
   - Click on your project (`question-editor-five`).
   - Go to the **Settings** tab at the top, then click **Environment Variables** on the left menu.
   - Find the variable named `NEXT_PUBLIC_BACKEND_URL`.
   - Click the three dots `...` next to it and select **Edit**.
   - Paste the new Railway URL you copied earlier.

> [!WARNING]
> The URL **must** start with `https://` and it **must not** have a slash at the end.
> ✅ Correct: `https://question-editor-production-b815.up.railway.app`
> ❌ Wrong: `question-editor-production-b815.up.railway.app`
> ❌ Wrong: `https://question-editor-production-b815.up.railway.app/`

2. **Redeploy the Frontend:**
   - Updating variables doesn't affect the live site immediately. You must redeploy.
   - Go to the **Deployments** tab in Vercel.
   - Find your most recent deployment at the top of the list.
   - Click the three dots `...` on the right side and click **Redeploy**.
   - Leave the default settings on the popup and click the black **Redeploy** button.

3. **Test the Site:**
   - Wait about 60 seconds for Vercel to finish building.
   - Once it says **Ready**, open your live website.
   - Test the Link Slayer tool. It should now successfully connect to your new backend without any errors!
