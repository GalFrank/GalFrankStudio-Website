# GalFrankStudio website

Source for [galfrank.com](https://galfrank.com) — video editing, motion graphics and AI-assisted content by Gal Frank.

- Single self-contained page: `index.html` (Hebrew/English, RTL-aware).
- Content lives in the `CONFIG` block near the top of the `<script>`: contact details, showreel, client logos list, and portfolio projects (YouTube link, length, category).
- Contact form: `worker/index.js` (Cloudflare Worker, `POST /api/contact`) emails each inquiry; tests run with `node --test`.
- Hosted on Cloudflare Workers (static assets, see `wrangler.jsonc`); every push to `main` deploys automatically. Files listed in `.assetsignore` are not published.
- Status and to-do list: `TODO.md`.
