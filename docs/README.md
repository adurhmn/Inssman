# Inssman — Developer documentation (index)

This folder is **maintainer-oriented** documentation: architecture, module design, local development, and deployment. It is written for engineers who know **React and web apps** but may be new to **browser extensions**.

## Quick map of the repository

| Package | Path | Role |
|--------|------|------|
| **Browser extension** | [`browser-extension/`](../browser-extension/) | MV3 extension: service worker, options UI (React), popup, content scripts, declarative rules |
| **Marketing / docs site** | [`web/`](../web/) | Next.js site (`inssman.com`): public docs (MDX), `/app` shell that embeds the extension UI in an iframe |
| **Tiny Express app** | [`server/`](../server/) | Minimal local server (port `4444`) for ad-hoc API testing—not required for extension or web app |
| **Root** | [`package.json`](../package.json) | Husky + commitlint only (no workspace orchestration) |

## Documentation in this folder

| Document | Contents |
|----------|----------|
| [Architecture](./ARCHITECTURE.md) | System context, MV3 concepts, how web + extension fit together, major technical choices |
| [Low-level design (LLD)](./LLD.md) | Packages, entry points, services, storage, messaging, rule pipeline |
| [Local development](./LOCAL_DEVELOPMENT.md) | Prerequisites, env files, commands, loading unpacked builds, debugging |
| [Deployment](./DEPLOYMENT.md) | Building zips, store submission outline, deploying Next.js, fork/rename checklist |

## Existing documentation (high-level pointers)

Use these sources for **product usage**, **community**, and **legal** topics; this `docs/` folder does not duplicate them in depth.

- **[Root README](../README.md)** — Project overview, feature list, link to user-facing docs.
- **[User documentation](https://inssman.com/docs/introduction)** — End-user guides (install, rule types, examples). Source lives under [`web/src/pages/docs/`](../web/src/pages/docs/) and [`web/src/components/docs/`](../web/src/components/docs/) (MDX).
- **[Web app README](../web/README.md)** — Generic Next.js starter notes; prefer [Local development](./LOCAL_DEVELOPMENT.md) for this repo.
- **[Code of Conduct](../CODE_OF_CONDUCT.md)** — Community expectations.
- **[Security policy](../SECURITY.md)** — How to report vulnerabilities.
- **[Privacy policy](../PRIVACY_POLICY.md)** — Privacy disclosures.
- **[License](../LICENSE.md)** — MIT.

## Glossary

- **MV3** — Manifest V3: Chrome’s extension model (service worker background, `chrome.scripting`, `declarativeNetRequest`, etc.).
- **Options page** — Full-page extension UI built from [`browser-extension/src/options/`](../browser-extension/src/options/); same UI can load inside the web app via iframe (see [Architecture](./ARCHITECTURE.md)).
- **Rule metadata (`IRuleMetaData`)** — User-defined rule as stored in `chrome.storage.local` (name, conditions, type, enabled flag, etc.).
- **DNR** — `chrome.declarativeNetRequest`: browser-enforced redirect/block/header/query rules.

---

*Last reviewed against repository layout: April 2026.*
