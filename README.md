# IG Cleanup

**Clean up your Instagram following list and cancel old follow requests, without giving your password to anyone.**

IG Cleanup is a single web page that runs entirely in your own browser. You open Instagram's official data export in it, choose who to remove, and it gives you a small script that unfollows those accounts slowly in your own logged-in Instagram tab. There's no server, no login and no third-party app.

![IG Cleanup: choose who to remove](docs/lists-light.png)

## What it does

- **Finds who doesn't follow you back.** Compares your following and followers lists.
- **Finds old follow requests.** Lists every request you sent to a private account that was never accepted, even from years ago.
- **Unfollows or cancels in safe batches.** Opens each profile and clicks **Requested → Unfollow** or **Following → Unfollow**, with random pauses so it behaves like a person.
- **Remembers your progress.** Mark accounts to *keep* (never removed) or *done*. Everything is saved in your browser, so you can do a few batches a day.
- **Private by design.** The page is blocked by the browser from connecting to the internet (Content Security Policy), and it never asks for your password.

## How to use it

### Option 1: Use the online version (easiest)

Open **https://mahmooodsaeed.github.io/Instagram-Cleanup-Tool/** and follow the steps on the page.

Your files are still read only on your own computer. The page is just delivered from GitHub, and it can't send anything back.

### Option 2: Download it and open it from your computer

1. Click the green **Code** button at the top of this page → **Download ZIP**.
2. Unzip it, open the **`Instagram-Cleanup-Tool-main`** folder and double-click **`index.html`**. It opens in your browser.
3. Follow the steps on the page.

It works without an internet connection.

### The steps, in short

| Step | What you do |
|---|---|
| **1. Get your data** | Instagram → Settings → Accounts Center → Your information and permissions → **Download your information** → *Some of your information* → **Followers and following**. Choose **All time** and **JSON**. |
| **2. Open it** | Drop the ZIP file Instagram emails you onto the page. |
| **3. Choose** | Browse "Don't follow back" or "Pending requests", protect anyone you want to keep, and click **Select the next 50**. |
| **4. Run** | Click **Copy cleanup script**. On instagram.com (desktop Chrome or Edge), open the Console (`Ctrl+Shift+J`, or `Cmd+Option+J` on Mac), paste, press Enter, then click **Start** in the box that appears. |
| **5. Tick off** | Paste the finished usernames back into the page so it knows where you left off. |

The page explains each step in detail, with help for common problems.

![Dark mode](docs/lists-dark.png)

## Staying safe

Instagram limits how fast anyone can unfollow. Going too fast gets you a temporary **"Try Again Later"** block.

- Use the **Balanced** speed (20–40 seconds between accounts) or **Careful** speed.
- Do **40–60 accounts per run** and **2–3 runs a day**.
- The script stops by itself if Instagram shows a warning. If that happens, stop for the day.

> ⚠️ Automating actions is against Instagram's Terms of Use. This tool keeps things slow and human-like, but use it at your own risk. For zero risk, use the lists to unfollow by hand.

## Privacy

- The whole tool is one file, [`index.html`](index.html). You can read every line.
- A Content Security Policy (`default-src 'none'`) stops the page from making **any** network request, so your export can't be uploaded even by accident.
- The cleanup script runs inside your own Instagram tab, using the login you already have. It doesn't read your password, cookies or messages, and it doesn't send data anywhere else.
- Your lists and Keep/Done marks are saved in your browser's local storage on your computer. Use **Clear loaded lists** to remove them.

## Supported export formats

Instagram changes its export format from time to time. IG Cleanup reads:

- the classic format (`string_list_data` with `value` / `href`)
- the newer format where the username is in `title`
- the 2026 format with `label_values` (`Username`, `URL`)
- ZIP files, unzipped folders, or individual JSON files (renamed copies like `following (1).json` work too)

If your export doesn't load, please [open an issue](../../issues) and include the message the page shows. **Don't upload your actual export file.**

## Try it without your own data

Click **"Try it with made-up sample data"** in step 2, or load the files in [`sample-data/`](sample-data/). All names in them are made up.

## For developers

No build step and no dependencies: just edit `index.html`.

An end-to-end test (Node.js 20.15 or newer) loads the sample data and a generated export ZIP, copies the script, and runs it against a mock Instagram page. It never touches the real site.

```bash
npm install
npx playwright install chromium
npm test
```

### Hosting your own copy on GitHub Pages

Fork the repository, then go to **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**. Your copy is published at `https://<your-username>.github.io/Instagram-Cleanup-Tool/`.

## License

[MIT](LICENSE). Free to use, change and share.

*Not affiliated with, endorsed by or connected to Instagram or Meta. "Instagram" is a trademark of Meta Platforms, Inc.*
