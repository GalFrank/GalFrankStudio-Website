# GalFrankStudio website

Portfolio site for Gal Frank Studio (video editing, motion graphics, AI content).

- **Start with `TODO.md`.** It has the current status, the domain/email plan and the prioritized improvement list. Update it as work lands.
- The whole site is `index.html`: Hebrew/English, RTL-aware, with inline CSS and JS. Content lives in the `CONFIG` block (contact details, showreel, client logos, projects) and the `T` translations object.
- **Hosting is Cloudflare Workers static assets** (`wrangler.jsonc`), deployed automatically from `main`. PRs get preview URLs from the Cloudflare bot.
  - Every file in the repo root is published unless listed in `.assetsignore`. Add any new non-site file there.
- Work on a branch, open a PR, check the Cloudflare preview, then merge.
- The owner is new to GitHub and Cloudflare. Explain steps plainly, one at a time, and say what each change does on the live site.
