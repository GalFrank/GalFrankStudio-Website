# GalFrankStudio website: status and to-do

Last updated 2026-10-06. Keep this file current: tick items off and add new findings.

## Where things stand

- **Hosting: Cloudflare Workers (static assets).** Worker name `galfrankstudio-website`, connected to this GitHub repo.
  - Merging into `main` deploys production to https://galfrankstudio-website.galord01.workers.dev in about 15 seconds.
  - Pull requests get their own preview URL, posted by the `cloudflare-workers-and-pages` bot as a PR comment. Preview builds run `npx wrangler preview`, which needs the `"previews": {}` block in `wrangler.jsonc`.
  - `wrangler.jsonc` publishes the repo root. `.assetsignore` keeps repo files (`.git`, README, CLAUDE.md, this file, config) from being published. **Add any new non-site file to `.assetsignore`.**
- **galfrank.com is live on Cloudflare (2026-10-06).**
  - Nameservers: `porter`/`tricia.ns.cloudflare.com`.
  - Custom Domain attached to the Worker (Production only, no subdomain).
  - Let's Encrypt certificate.
  - Some DNS caches still pointed at the old WordPress server (46.202.158.123) for a while; those responses have no `cf-ray` header. Keep the old hosting running for a day or two until that clears.
  - `www.galfrank.com`: proxied A record plus a 301 redirect to the root, with Always Use HTTPS on (set up 2026-10-06). DNS is verified. The redirect itself is untested from the cloud sandbox, which blocks www and plain http.
- Netlify is not used. Ignore older notes that mention Netlify or Netlify Forms.
- Done so far (PR #1, merged): headline invisible on phones (`fitHeadline()` measured a `display: contents` wrapper); repo files publicly downloadable on Cloudflare; Cloudflare PR preview builds failing.

## 1. Domain move (done 2026-10-06)

1. Save anything worth keeping from the old WordPress site (texts, images). It stops being visible on galfrank.com after the switch.
2. Cloudflare dashboard → add the domain `galfrank.com` (Free plan) → check the imported DNS records → at the registrar where the domain was bought, replace the nameservers with the two Cloudflare shows → wait until Cloudflare says the domain is **Active**.
3. **Workers & Pages** → `galfrankstudio-website` → **Settings** → **Domains & Routes** → **Add** → **Custom Domain** → `galfrank.com`.
   - A Custom Domain can't be created on a hostname that already has a CNAME record. If Cloudflare complains, delete the old record for that name (the old A record pointed at 46.202.158.123).
4. **www:** Custom Domains match one exact hostname, so `www.galfrank.com` needs two things:
   - a proxied DNS `A` record: name `www`, IPv4 `192.0.2.0`, proxied (orange cloud);
   - a redirect rule from the template "Redirect from WWW to root": request URL `https://www.*` → target `https://${1}`, status 301, preserve query string.

   Also make sure **SSL/TLS → Edge Certificates → Always Use HTTPS** is on, so `http://` addresses get upgraded first.
5. If the domain was bought from the same company that hosts the old WordPress site, **keep the domain renewal paid** before cancelling any hosting plan.
6. Then ask Claude to check galfrank.com end to end. The site's canonical and og:url tags already say `https://galfrank.com/`.

## 2. Email forwarding (after the domain is Active on Cloudflare)

The owner doesn't use an @galfrank.com mailbox but wants forwarding, e.g. `hello@galfrank.com` → `GalFrankStudio@gmail.com`. Cloudflare Email Routing is free:

1. Dashboard → **Compute** → **Email Service** → **Email Routing**. Enable it for galfrank.com and let it add its DNS records (MX, SPF, DKIM).
2. **Destination Addresses**: add `GalFrankStudio@gmail.com` and click the verification link Cloudflare emails.
3. Create a routing rule: custom address (for example `hello`) → that Gmail address. A catch-all rule is optional.
4. Test it by sending from a *different* account (some providers drop mail sent to yourself).
5. Optional: show `hello@galfrank.com` on the site instead of the Gmail address (`CONFIG.email` in index.html). Replying *from* @galfrank.com needs extra setup (Gmail "Send mail as"); forwarding only receives.

## 3. Site improvements (from the 2026-10-06 audit)

Baseline (Lighthouse on a local server): performance 73 mobile / 90 desktop, accessibility 96, best practices 96, SEO 100, desktop CLS 0.147.

### A. Contact form should reach the owner by email
- Today `CONFIG.formEndpoint` is empty, so the form only builds a WhatsApp message. A visitor who doesn't tap "Send on WhatsApp" is a lost lead.
- On Cloudflare there are two options:
  - (a) A small Worker endpoint (e.g. `/api/contact`) that sends the email with Cloudflare Email Service to the verified destination. This needs a `main` script and `assets.run_worker_first` for `/api/*` in `wrangler.jsonc`, plus spam protection (Turnstile or a honeypot).
  - (b) A third-party endpoint (Formspree/Web3Forms). The existing JSON POST code already supports it.
- Keep the WhatsApp fallback.
- Only show "Message received" on a verified success.
- Run the "Exporting…" button animation at the same time as the request, not after it, and add a ~10s timeout.

### B. Speed and layout jump
- **Move the images out of index.html.** The base64 portrait is ~72 KB (`<img src="data:image/webp…` in `#portrait`). The `const LOGOS = {…}` block is ~135 KB: 9 single-colour PNG masks plus an Isuzu SVG.
  - Logos as lossless WebP measured 95 KB → 54 KB.
  - CSS `mask-image` needs same-origin URLs: fine on Cloudflare, but it fails when opening the file locally via file://.
- **Self-host the fonts.** The Google Fonts CSS blocks first paint (~1.5 s on slow mobile). Only Hebrew and Latin subsets are needed:
  - Karantina 700 (400 is unused);
  - IBM Plex Sans Hebrew 400/500/600;
  - IBM Plex Mono 400/500 (Latin only).
  - Use inline `@font-face` and preload Karantina (Hebrew and Latin) and Plex Hebrew 400. Fonts are OFL.
- **Layout jump.** Before the JS runs, the static `<h1>` wraps to 3–4 lines, then snaps to 2 when `renderStatic()` wraps the lines in `.w` spans.
  - Put the same `.w` spans in the static HTML.
  - Cap the h1 size around 6.1rem so `fitHeadline()` rarely has to resize.
  - Reserve height for the client-logo bar.
- **Animation loops.** The hero timecode `requestAnimationFrame` loop runs forever and re-filters a blurred layer every frame. Pause it when the hero is off-screen (IntersectionObserver). Let the custom-cursor loop idle when the pointer is still.
- **Thumbnails.**
  - The featured project and the hero use YouTube `hqdefault` (480 px) stretched to ~690 px, so they look soft. Use `maxresdefault` and fall back to hqdefault when `naturalWidth <= 120` (YouTube's "missing" placeholder).
  - The small list thumbnails can use `mqdefault` (320×180, no black bars).

### C. Visible bugs
- The contact tile breaks the email mid-word ("GalFrankStudio@gm / ail.com"). Add `<wbr>` after the `@`.
- Video popup on phones: the 20 px padding on `.lb-stage` shrinks the video. Make the iframe fill the stage (`position:absolute; inset:0`).
- Switching language doesn't update the form's "sent" panel (stays Hebrew) or the mobile-menu footer.
- The footer year is hard-coded ("© 2026"). Make it dynamic.
- CSS typo `img { max-width: 100%%; }` and a stray `:root { margin: 0; }` at the top of the `<style>`.

### D. Accessibility (axe + Lighthouse)
- **Light-mode contrast.** The accent `#0479BA` on `#F1F1EC` is 4.1:1, under the 4.5:1 needed for small text (current-project title, swipe hints, role text). About `#0369A1` passes: 5.2:1 on the background, 5.9:1 with white text.
- **Accessible names don't contain the visible text.**
  - `.brand`: `aria-label="Gal Frank Studio"` vs visible "GalFrankStudio".
  - `#langBtn` (shows "EN").
  - `#viewer`: an English "Play showreel" label on the Hebrew page, vs visible "שואוריל 2026".
  - The contact tiles' `aria-label`.
- **Keyboard focus** escapes the open mobile menu and the video popup. Make the background `inert` while they're open.
- **Form.**
  - Errors aren't announced (add `aria-describedby` and `aria-invalid`).
  - Focus is lost after submitting (move it to `#doneTitle`).
  - `#f-name` is missing `type="text"`.
- The `#svc` swipe row on mobile is scrollable but not keyboard-focusable. Add `tabindex="0"` when it's scrollable.
- **Landmarks.**
  - The WhatsApp button sits outside any landmark.
  - The footer `<nav>` and `.mnav` need unique labels.
  - The header links aren't in a `<nav>`.
- **Invalid HTML.** `<div>` inside `<button>` (`#viewer`, feature card), and `aria-label` on `<ol id="list">`.
- **Untranslated labels.** The chips group ("Filter"), the list ("Projects"), the viewer.

### E. Sharing and search
- The `og:image` is a 480×360 YouTube thumbnail.
  - Make a branded 1200×630 image (dark background, colour bars, Karantina headline, portrait cutout).
  - Add og:image width/height/alt and twitter tags.
- **Search details.**
  - A more descriptive `<title>`.
  - JSON-LD (ProfessionalService / Person, sameAs Instagram).
  - `robots.txt` and `sitemap.xml`.
  - Real favicon files plus `apple-touch-icon.png`. The current favicon is a data URI, which Google may not crawl.
  - `theme-color` for both light and dark.
- After the domain move: optionally verify in Google Search Console.

### F. Cloudflare and repo
- A `_headers` file (supported by Workers static assets):
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: SAMEORIGIN`
  - long cache for `/assets/fonts/*` once fonts are self-hosted
- Branded 404 page plus `"not_found_handling": "404-page"` under `assets` in `wrangler.jsonc`.
- www → root redirect (see section 1).

### G. Ask the owner first
- Visitor stats: Cloudflare Web Analytics is free and easy now that the site is on Cloudflare.
- Copy voice mixes "I" (About) and "we" (services, contact). Keep it, or unify?

## How Claude should test changes

- Serve locally over HTTP (`python3 -m http.server`), not file://, because the logos use CSS masks.
- Use Playwright (pre-installed in the cloud environment).
  - Widths 320, 390, 760, 820 and 1440, in Hebrew and English (`localStorage gf-lang` or `#en`), light and dark.
  - Pass criteria: no console errors and no horizontal overflow.
  - Also exercise the menu, popup, filters, form and language switch.
- Lighthouse and axe-core can be installed with npm in a scratch folder.
- Cloud-session network allowlist used so far:
  - `developers.cloudflare.com`, `api.cloudflare.com`, `dash.cloudflare.com`
  - `galfrankstudio-website.galord01.workers.dev`, `galfrank.com`
  - `i.ytimg.com`, `www.youtube.com`
  - PR preview hosts (`<branch>-galfrankstudio-website.galord01.workers.dev`) are separate hostnames and are blocked unless added. `mcp.cloudflare.com` is blocked, so the Cloudflare plugin's MCP server can't connect.
