# Bag – a guessing game for little ones

Static web app (no backend). Works offline and installs to the home screen on iPhone and Android.

## Files
- `index.html` – the whole game (items and questions are lists at the top of the script)
- `manifest.webmanifest` – makes it installable as an app
- `sw.js` – offline support (bump `VERSION` after every change)
- `icons/` – home-screen icons

## Deploy on GitHub Pages
1. Create a public repository, e.g. `bag`.
2. Upload all these files to the root of the repository (Add file → Upload files).
3. Settings → Pages → Source: "Deploy from a branch", Branch: `main`, folder `/ (root)` → Save.
4. After a minute it is live at `https://<your-username>.github.io/bag/`.

## Install on a phone
- iPhone: open the link in Safari → Share → Add to Home Screen.
- Android: open the link in Chrome → ⋮ menu → Install app (or Add to Home screen).
