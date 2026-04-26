# Local development

## 1. Prerequisites

- **Node.js** — LTS recommended; match whatever your team standardizes (extension uses Webpack 5 + TypeScript).
- **npm** — each package has its own `package.json` (no root workspaces). Install dependencies **per package**.
- **Chromium browser** — Chrome or Edge for loading unpacked extensions.

Optional:

- **Git** hooks: root `prepare` runs Husky ([`package.json`](../package.json)).

## 2. Clone and install

From the repository root:

```bash
cd browser-extension && npm install
cd ../web && npm install
cd ../server && npm install
```

Root `npm install` only installs commit tooling unless you add more.

## 3. Environment variables

Webpack loads **repo-root** [`.env`](../.env) via `dotenv-webpack` in [`webpack.common.js`](../browser-extension/webpack/webpack.common.js) (path resolves to `../../.env` from the webpack folder).

Copy [`.env.example`](../.env.example) to `.env` at the **repository root** and fill values if your build expects API keys (analytics, Firebase, etc.). Some features may degrade silently without keys.

The **Next.js** app may use its own env conventions for Firebase or analytics—check `web/` for `process.env` usage when enabling those features.

## 4. Browser extension — development build

```bash
cd browser-extension
npm run dev
```

- Sets `BROWSER=chrome`, runs Webpack in **watch** mode with `webpack.development.js`.
- Output: `browser-extension/dist/chrome/` (or the browser you set).

### Load unpacked in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. **Load unpacked** → select `browser-extension/dist/chrome` (the folder containing `manifest.json`).

After code changes, Webpack rebuilds; press **Reload** on the extension card to pick up service worker / page changes.

### Edge

Use `edge://extensions` and the same `dist/edge` folder if you build with `BROWSER=edge`.

## 5. Options page-only testing

You can open the options page directly:

- From extensions page → **Details** → extension options, or
- `chrome-extension://<extension-id>/options/options.html`

Routing uses **HashRouter** (`#/…` paths).

## 6. Web app (`web/`) — local Next.js

```bash
cd web
npm run dev
```

- Default: [http://localhost:3000](http://localhost:3000)

### Testing `/app` with the extension

1. Build/load the extension from step 4.
2. Ensure [`manifest.json` content_scripts](../browser-extension/src/manifest.json) include your origin if you **do not** use `localhost:3000` (currently `http://localhost:3000/app/*` is listed).
3. Visit `http://localhost:3000/app` — the MAIN-world script should set `INSSMAN.isExtensionInstalled` and embed the options iframe.

If you change the **production domain**, update:

- `iframeContentScript` matches in `manifest.json`
- [`APP_URL` / host checks](../browser-extension/src/options/constant/index.ts) (e.g. `ToggleExtensionService` tabs query uses `https://*.inssman.com/*`)

## 7. Optional local API server

```bash
cd server
npm run dev
```

- Serves a small HTML page and sample `GET`/`POST` endpoints on port **4444** ([`server/index.js`](../server/index.js)).

Useful for manual testing redirects or modify-response rules against a known backend.

## 8. Tailwind / options styles

The extension `package.json` includes:

```bash
npm run style
```

This runs Tailwind CLI for options CSS (`src/options/input.css` → `dist/options/style.css`) in watch mode. Run it alongside Webpack if you are editing Tailwind classes and the extracted stylesheet is part of your workflow.

## 9. Debugging tips (for web developers new to extensions)

- **Service worker logs**: `chrome://extensions` → your extension → **Service worker** link (opens DevTools for background context).
- **Options / popup DevTools**: right-click inside the UI → Inspect.
- **Content script / page world**: use DevTools on the **tab** being intercepted; look for `INSSMAN` on `window` after navigation commits.
- **Reload after manifest changes**: any edit to `manifest.json` requires removing/reloading the unpacked extension or using a tool that handles it.

## 10. See also

- [Architecture](./ARCHITECTURE.md)
- [LLD](./LLD.md)
- [Deployment](./DEPLOYMENT.md)
