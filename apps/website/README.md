# Comradia Website

Static public landing page for Comradia: pure HTML, CSS and JS with no build step. Open
`index.html` in a browser, or serve the folder with any static file server.

## Design

The colors, type and shapes mirror the app's design system: `docs/design-system.md`. Change a
token in `apps/mobile/constants/design-system.ts` first, then in the `:root` block of
`styles.css`. Geist is self-hosted in `fonts/` (SIL OFL, license included), so the page makes no
third-party requests.
