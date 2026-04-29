import { NAMESPACE } from "@options/constant";

/**
 * Bootstrap script — runs in the page MAIN world at `document_start`,
 * BEFORE `interceptor.js`. Initialises `window[NAMESPACE]` so that the
 * interceptor (and any rule-push from the service worker) always sees
 * a well-formed namespace object.
 *
 * Idempotent — safe to run twice (e.g. once via the static manifest entry
 * and once via the dynamic-registration fallback). See
 * `specs/005-fix-mock-hard-reload/contracts/window-namespace.md`
 * "Bootstrap script contract".
 */
(function bootstrapInssmanNamespace(ns: string) {
  // @ts-ignore — page-world global
  const w: any = window;
  const existing = w[ns] || {};

  if (!Array.isArray(existing.rules)) {
    existing.rules = [];
  }
  if (typeof existing.runtimeId !== "string") {
    existing.runtimeId = "";
  }
  if (typeof existing.ready !== "boolean") {
    existing.ready = false;
  }
  if (!Array.isArray(existing.__queue)) {
    existing.__queue = [];
  }
  if (!existing.__readyPromise) {
    let resolveRef: (() => void) | null = null;
    existing.__readyPromise = new Promise<void>((resolve) => {
      resolveRef = resolve;
    });
    existing.__resolveReady = function () {
      existing.ready = true;
      if (resolveRef) {
        resolveRef();
        resolveRef = null;
      }
    };
  }

  w[ns] = existing;
})(NAMESPACE);
