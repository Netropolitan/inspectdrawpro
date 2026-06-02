# InspectDraw Pro — website

Static marketing site for **inspectdrawpro.com** (a BeyondXR product).
Built with Vite + three.js. Two pages, no blog, no events. Deploys to GitHub Pages on push to `main`.

## Pages

- `index.html` — main marketing page: hero, problem, solution, workflow, features,
  pricing, origin, FAQ (10 questions, mirrored in FAQPage JSON-LD; SoftwareApplication
  schema also in `<head>`), contact.
- `app.html` — App Tour: four in-app screen-recording videos in alternating split rows,
  plus problem/solution cards and a closing CTA. **New pages must be registered in
  `vite.config.js` under `build.rollupOptions.input` or they will not be built.**

## Assets

- `public/downloads/` — the two A4 PDFs (Tick-Box Test, Gary's Open Letter), linked from
  the problem, origin and contact sections.
- `public/videos/` — four App Tour mp4s (search/mark/inspect/export), compressed from the
  raw ZBook screen recordings with `ffmpeg -vf scale=1280:-2 -crf 30 -an -movflags +faststart`.

## Develop

```bash
npm install
npm run dev
```

## Build (static output in `dist/`)

```bash
npm run build
```

## Brand

Electric blue `#116DFF`, Space Grotesk light + Inter,
near-black. Five three.js scenes share one lazy-init engine in `src/main.js`: hero
(orbiting wireframe blueprint + marker drops), problem (field-tool pile of drifting
sheets), solution, workflow storyboard, deployment estate. No em/en dashes in copy.
