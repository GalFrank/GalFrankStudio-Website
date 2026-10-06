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
- Done so far:
  - PR #1: headline invisible on phones (`fitHeadline()` measured a `display: contents` wrapper); repo files publicly downloadable on Cloudflare; Cloudflare PR preview builds failing.
  - Live showreel in the hero:
    - The frame is 5:4, the same shape as the reel (it was 16:9 with black bars at the sides).
    - The monitor "powers on" and zooms in on load, then the reel plays muted (YouTube IFrame API). The sound button in the control bar reads "צפו עם סאונד" while it's muted; there is no big button over the picture.
    - A click turns the sound on instantly, right where the reel is (no restart, so no buffering pause). It then plays to the end, goes round once more if sound came on mid-reel, and drops back to the muted loop.
    - A click before YouTube has loaded shows a spinner at once; YouTube starts loading on the visitor's first touch or hover, not only after the page has loaded.
    - Pause / sound / full-screen controls; the timecode is the real video time; dragging the ruler or using the arrow keys seeks the video.
    - It pauses off-screen.
    - No autoplay for reduced motion or data saver; falls back to poster + play button if autoplay is refused.
  - Project videos play inside the feature frame instead of a pop-up. The pop-up (lightbox) is gone. One video with sound at a time.
    - YouTube's own controls are off (`controls: 0`) and a click layer covers the player, so YouTube's title bar and buttons don't show. The frame has the site's own small controls instead: play/pause, sound, a progress bar you can drag (or arrow keys, 5 s), time, full screen. They fade out while the video plays and come back when the mouse moves; on phones they stay visible.
    - **No YouTube interface at all (reel and projects).** Even with `controls: 0`, the 2025+ YouTube embed draws a title bar in the top ~70px of its player and share / "Watch on YouTube" buttons in the bottom ~60px, at every player size (measured inside the real embed). So each player sits in a `.vbox` with the exact shape of the video (`--ar`), and the iframe is 72px taller at each end; those strips are clipped away and the video, which YouTube letterboxes ("contain") during playback, fills the box exactly. Videos that aren't 16:9 need `ar` in `CONFIG.projects` (the FITME short is `"4/5"`); the reel box is 5:4 in CSS.
    - YouTube's buffering spinner sits in the middle of the player; the site's own spinner badge (dark disc) covers it while buffering.
    - Still possible: end-screen elements an uploader adds in YouTube Studio (last 5–20 s of a video) draw over the picture. Remove end screens on these videos in YouTube Studio if they show up.
    - Clicking the video pauses it: the frame blurs and dims under a play icon, which also hides YouTube's pause screen.
    - If the browser refuses to start a video with sound (possible on iPhone), after 4 s the frame hands taps straight to YouTube's own play button.
  - The contact form posts to `/api/contact` (`worker/index.js`), which emails the owner. Email sending is switched off until the Gmail address is verified (see 3A); until then the form falls back to WhatsApp.
  - New Hebrew hero subtitle.

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
2. **Destination Addresses**: add `GalFrankStudio@gmail.com` and click the verification link Cloudflare emails. The same verified address lets the contact form email the owner (see 3A).
3. Create a routing rule: custom address (for example `hello`) → that Gmail address. A catch-all rule is optional.
4. Test it by sending from a *different* account (some providers drop mail sent to yourself).
5. Optional: show `hello@galfrank.com` on the site instead of the Gmail address (`CONFIG.email` in index.html). Replying *from* @galfrank.com needs extra setup (Gmail "Send mail as"); forwarding only receives.

## 3. Site improvements (from the 2026-10-06 audit)

Baseline (Lighthouse on a local server): performance 73 mobile / 90 desktop, accessibility 96, best practices 96, SEO 100, desktop CLS 0.147. After the video and form work: 70 / 94, accessibility 97, CLS 0.012 mobile / 0.036 desktop. After the 5:4 reel and custom controls: 69 / 97, accessibility 97, CLS 0 mobile / 0.03–0.08 desktop (varies run to run with font timing; the centred hero text moves when the web fonts arrive).

### A. Contact form → email (built; one step left)
- `worker/index.js` handles `POST /api/contact`. It validates the fields, has spam traps (a hidden honeypot field and a "submitted in under 2 s" check), and emails the owner through the `send_email` binding.
  - Sending to a verified Email Routing destination is free on Workers Free.
  - Reply-To is the visitor's email; the email includes a wa.me link.
- The page shows "Message received" only when the Worker answers `{ ok: true }`. Otherwise (not configured, error, 12 s timeout) it offers WhatsApp with all the details.
- **Remaining step:** once `GalFrankStudio@gmail.com` is verified in Email Routing (section 2), uncomment the `send_email` line in `wrangler.jsonc`, merge, then send a real test inquiry. Cloudflare may refuse to deploy the binding before the address is verified.
- If spam shows up: add Cloudflare Turnstile.
- Tests: `node --test` (repo root) runs `tests/worker.test.mjs`.

### B. Speed and layout jump
- **Move the images out of index.html.** Done for the portrait (2026-10-06): the new photo, cut out of its studio background locally, is `img/gal-1000.webp` / `img/gal-600.webp` (67 / 30 KB, `srcset`). Still to do: the `const LOGOS = {…}` block is ~135 KB: 9 single-colour PNG masks plus an Isuzu SVG.
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
- **Animation loops.** Done for the hero (it only animates while the reel plays and is on screen). Still to do: let the custom-cursor loop idle when the pointer is still.
- **Thumbnails.** Done: the feature and hero posters try `maxresdefault` and fall back to `hqdefault` (`fixThumb()`); list thumbnails use `mqdefault`.
- **YouTube and CLS.** YouTube's player shifts its own layout while loading, and that counts toward the page's CLS in proportion to the frame's on-screen size. That's why `.viewer .reel` is `scale(.02)` until the reel is revealed; keep that if you touch the reel CSS. The player also starts only after `load` + fonts + 900 ms, so it never competes with the first paint.

### C. Visible bugs
- The contact tile breaks the email mid-word ("GalFrankStudio@gm / ail.com"). Add `<wbr>` after the `@`.
- Switching language doesn't update the mobile-menu footer. (The form's "sent" panel is fixed.)
- The footer year is hard-coded ("© 2026"). Make it dynamic.
- CSS typo `img { max-width: 100%%; }` and a stray `:root { margin: 0; }` at the top of the `<style>`.

### D. Accessibility (axe + Lighthouse)
- **Light-mode contrast.** The accent `#0479BA` on `#F1F1EC` is 4.1:1, under the 4.5:1 needed for small text (current-project title, swipe hints, role text). About `#0369A1` passes: 5.2:1 on the background, 5.9:1 with white text.
- **Accessible names don't contain the visible text.**
  - `.brand`: `aria-label="Gal Frank Studio"` vs visible "GalFrankStudio".
  - `#langBtn` (shows "EN").
  - The contact tiles' `aria-label`.
- **Keyboard focus** escapes the open mobile menu. Make the background `inert` while it's open.
- The `#svc` swipe row on mobile is scrollable but not keyboard-focusable. Add `tabindex="0"` when it's scrollable.
- **Landmarks.**
  - The WhatsApp button sits outside any landmark.
  - The footer `<nav>` and `.mnav` need unique labels.
  - The header links aren't in a `<nav>`.
- **Invalid HTML.** `aria-label` on `<ol id="list">`, and the footer `<nav>` needs a label.
- **Untranslated labels.** The chips group ("Filter") and the list ("Projects").

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

### G. Optional upgrade: self-hosted showreel file
- With the original showreel MP4, the hero could use a native `<video>` (H.264, ~720p, under Cloudflare's 25 MiB per-file limit; ffmpeg is available in the cloud sandbox). That gives frame-smooth scrubbing, no YouTube player code (~1 MB) and no YouTube branding.
- The reel code talks to the player only through `reel.player` (play, pause, seek, mute, current time), so swapping in a native video means a small adapter.

### H. Ask the owner first
- Visitor stats: Cloudflare Web Analytics is free and easy now that the site is on Cloudflare.
- Copy voice mixes "I" (About) and "we" (services, contact). Keep it, or unify?

## How Claude should test changes

- Serve locally over HTTP (`python3 -m http.server`), not file://, because the logos use CSS masks.
- Use Playwright (pre-installed in the cloud environment).
  - Widths 320, 390, 760, 820 and 1440, in Hebrew and English (`localStorage gf-lang` or `#en`), light and dark.
  - Pass criteria: no console errors and no horizontal overflow.
  - Also exercise the menu, popup, filters, form and language switch.
- Video: the cloud sandbox can't stream YouTube video (googlevideo.com is blocked). Test the reel and project players against a stand-in `window.YT` (serve a mock at `https://www.youtube.com/iframe_api` via Playwright routing) that simulates states, time, seeking and refused autoplay, and draws each video at its real shape (reel 5:4, FITME short 4:5, the rest 16:9). Also run one smoke test against the real API, which loads and reports the duration (in the sandbox it never plays, so the project frame ends in its YouTube-play-button fallback).
- Not testable from the sandbox: real playback, and whether iPhone Safari lets the site's buttons turn sound on in YouTube's player. Check those on a real phone after each video change.
- Contact Worker: `node --test` from the repo root.
- Lighthouse and axe-core can be installed with npm in a scratch folder.
- Cloud-session network allowlist used so far:
  - `developers.cloudflare.com`, `api.cloudflare.com`, `dash.cloudflare.com`
  - `galfrankstudio-website.galord01.workers.dev`, `galfrank.com`
  - `i.ytimg.com`, `www.youtube.com`
  - PR preview hosts (`<branch>-galfrankstudio-website.galord01.workers.dev`) are separate hostnames and are blocked unless added. `mcp.cloudflare.com` is blocked, so the Cloudflare plugin's MCP server can't connect.
