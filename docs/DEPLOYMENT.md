# Deployment

This document covers **shipping your own build**: extension packages (Chrome/Edge), the Next.js site, and a **fork/rename** checklist. It stays high level; store policies change over time—verify current vendor requirements before submission.

## 1. Browser extension — production build

From `browser-extension/`:

```bash
npm run build
```

This runs **`build:chrome`** and **`build:edge`** sequentially (each sets `BROWSER` and uses `webpack.production.js`). Outputs:

- `browser-extension/dist/chrome/`
- `browser-extension/dist/edge/`

`manifest.json` **version** is injected from `browser-extension/package.json` at build time ([`webpack.common.js`](../browser-extension/webpack/webpack.common.js)).

### Release zip (maintainer script)

```bash
cd browser-extension
npm run release
```

- `clear:dist` → `build` → `create:zip`
- Zips each `dist/<browser>` into `browser-extension/release/inssman-<browser>-<version>.zip` ([`scripts/createZip.js`](../browser-extension/scripts/createZip.js)).

Upload the zip to **Chrome Web Store** / **Edge Add-ons** as your packaging workflow requires.

## 2. Store submission (outline)

Typical assets and steps:

- **Zip** of the `dist/<browser>` folder (not the monorepo root).
- **Listing copy**, screenshots, privacy policy URL (you have [`PRIVACY_POLICY.md`](../PRIVACY_POLICY.md) in-repo—hosts usually want a **hosted** URL).
- **Permissions justification** — this extension requests broad capabilities (`host_permissions` `*://*/*`, `webRequest`, `scripting`, `declarativeNetRequest`, etc.). Be prepared to explain **why** each is needed for HTTP interception.
- **Single purpose / data usage** disclosures per store questionnaires.

Security contact: [SECURITY.md](../SECURITY.md).

## 3. Next.js site (`web/`) deployment

Standard Next.js 14 deployment:

```bash
cd web
npm run build
npm run start
```

Most teams host on **Vercel**, **Netlify**, or a container behind a reverse proxy. See Next.js docs for [deployment](https://nextjs.org/docs/deployment).

### Environment-specific configuration

- **Firebase / analytics**: replace hardcoded config in [`web/src/config/firebase.ts`](../web/src/config/firebase.ts) with env-driven config for your project before production use.
- **MDX docs**: live under [`web/src/pages/docs/`](../web/src/pages/docs/); sitemap and navigation may need updates when adding pages.

## 4. Forking under a new name (checklist)

Use this when deploying a **renamed** product for internal or public use.

### Branding & assets

- Extension **name** / **description** in [`browser-extension/src/manifest.json`](../browser-extension/src/manifest.json).
- **Icons** under [`browser-extension/src/assets/images/icons/`](../browser-extension/src/assets/images/icons/).
- **Popup/options copy** and links (Chrome Web Store URLs in [`installExtension.tsx`](../web/src/components/installExtension/installExtension.tsx), uninstall URL in [`options/constant`](../browser-extension/src/options/constant/index.ts)).

### Technical identifiers

- **`NAMESPACE`** (`INSSMAN` on `window`) — change consistently in extension **and** any host pages that read `globalThis.INSSMAN` ([`web/src/pages/app/app.tsx`](../web/src/pages/app/app.tsx)).
- **PostMessage `source` prefixes** (`inssman:setup`, `inssman:iframe`, etc.) in [`setupContentConfig.ts`](../browser-extension/src/cotentScript/setupContentConfig.ts) and [`iframeContentScript.ts`](../browser-extension/src/iframeContentScript/iframeContentScript.ts) — keep page + extension in sync.
- **`manifest.json` `content_scripts` matches** — must list your real web dashboard origin(s) for iframe embedding.
- **`externally_connectable`** — tighten from wildcard IDs to your published extension ID(s) and known web origins.

### Build metadata

- `browser-extension/package.json` — `name`, `version`, `author`, `description` (used for keywords / release zip naming).

### Analytics & backend

- Remove or reconfigure **Amplitude**, **Mixpanel**, **Firebase**, **rrweb** if you do not want telemetry or cloud features.
- Provide your own `.env` at repo root for Webpack-injected keys.

### Legal

- Update **LICENSE** attribution if you fork (MIT allows forks; retain license text as required).
- Replace or host **PRIVACY_POLICY** content matching your data practices.

## 5. `server/` package

The Express app is **not** required for extension or web deployment. Deploy it only if you use it as a demo backend (container, VM, etc.).

## 6. See also

- [Architecture](./ARCHITECTURE.md)
- [LLD](./LLD.md)
- [Local development](./LOCAL_DEVELOPMENT.md)
- [Documentation index](./README.md)
