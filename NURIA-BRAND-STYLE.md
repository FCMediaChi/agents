# Nuria AI brand style (applies to every Nuria app)

Owner direction (2026-11-06): the business is **Nuria AI**, and the house
typography is **Poppins Bold for headings, DM Sans for everything else**. This
is house style for every Nuria site, so it applies to the three shipped apps —
`blueprint-app`, `audit-app` and `pipeline-app` — as well as the apex marketing
site (`/home/team/shared/site`).

## Typography

Each app carries **one shared, byte-identical stylesheet**:

```
blueprint-app/src/styles/nuria-fonts.css
audit-app/src/styles/nuria-fonts.css
pipeline-app/src/styles/nuria-fonts.css
```

It is imported once, directly after Tailwind, from each app's `src/index.css`:

```css
@import "tailwindcss";
@import "./styles/nuria-fonts.css";
```

The file does two things:

1. Declares `@font-face` for **Poppins** (400/500/600/700) and **DM Sans**
   (variable, 100–900). The font files are bundled in each app's `public/fonts/`
   and served from `/fonts/*` by Vite in dev and by the Express static handler in
   production. **No Google Fonts / external CDN at runtime** — do not add
   `fonts.googleapis.com` links back to `index.html`.
2. Pins headings to Poppins Bold with an **unlayered** rule:

```css
h1, h2, h3, h4, h5, h6 {
  font-family: "Poppins", ...;
  font-weight: 700;
}
```

The rule is deliberately outside `@layer base`: a layered rule loses to Tailwind
utilities such as `font-semibold` / `font-extrabold`, so headings would keep
rendering at the utility weight. Unlayered rules beat every layered one, which is
what makes `getComputedStyle(h1)` report Poppins + 700 in the browser. **Do not
move it into a layer, and do not "fix" a heading by removing its weight
utility** — the utility can stay, the unlayered rule wins.

Body and UI text (paragraphs, labels, buttons, table cells, inputs) stays on
DM Sans via `body { font-family: var(--font-body) }`, and each app's `@theme`
block also maps `--font-sans` to DM Sans so `font-sans` utilities agree.

## Editing the fonts

When changing the block, edit one copy and copy it to the other two so all three
stay identical:

```bash
cp blueprint-app/src/styles/nuria-fonts.css audit-app/src/styles/nuria-fonts.css
cp blueprint-app/src/styles/nuria-fonts.css pipeline-app/src/styles/nuria-fonts.css
```

Source font files on the build machine live in `/home/team/shared/fonts/`
(Poppins `.ttf` + `fonts/dmsans/DM-Sans-latin.woff2`).

## Brand name

- The **brand** is **Nuria AI**. Page titles read `<Product> | Nuria AI`, and the
  header/wordmark renders `Nuria AI` followed by the muted product name.
- The **products** are not renamed: *Nuria Website Blueprint*, *Nuria Website
  Audit*, *Nuria Client Pipeline*. Never blind-replace `Nuria` → `Nuria AI`, or
  you get "Nuria AI Website Blueprint".

## Verifying after a deploy

In a browser console on each live app:

```js
getComputedStyle(document.querySelector('h1')).fontFamily   // contains Poppins
getComputedStyle(document.querySelector('h1')).fontWeight   // "700"
getComputedStyle(document.body).fontFamily                  // contains "DM Sans"
```

Network tab should show `/fonts/Poppins-Bold.ttf` and `/fonts/dm-sans-latin.woff2`
returning 200, with no requests to `fonts.googleapis.com` / `fonts.gstatic.com`.
