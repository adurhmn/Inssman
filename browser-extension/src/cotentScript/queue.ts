import { NAMESPACE } from "@options/constant";
import { PostMessageAction } from "@/models/postMessageActionModel";
import type { QueuedRequest } from "./types";

/**
 * Default timeout (ms) a queued request will wait for `ready` before
 * being released to the network with a structured warning.
 *
 * Derived from typical `document_start` → first XHR latencies on dev
 * machines (commonly 30–80 ms; budget 1500 ms covers SW cold-start
 * worst case). See research.md R6.
 */
export const QUEUE_TIMEOUT_MS = 1500;

/**
 * Thrown when callers of the queue helpers are reached before the
 * page-MAIN-world bootstrap script has run. Should be unreachable on
 * MV3 with the static `bootstrap.js` content_scripts entry in place,
 * but is surfaced explicitly so the failure mode is observable
 * (FR-008) instead of silent.
 */
export class NamespaceNotInitializedError extends Error {
  constructor() {
    super(
      `[Inssman] window["${NAMESPACE}"] not initialised — bootstrap script did not run before the interceptor.`
    );
    this.name = "NamespaceNotInitializedError";
  }
}

interface InssmanNamespace {
  rules: any[];
  runtimeId: string;
  ready: boolean;
  __queue: QueuedRequest[];
  __readyPromise: Promise<void>;
  __resolveReady?: () => void;
}

export const getNamespace = (): InssmanNamespace => {
  // @ts-ignore — page-world global
  const ns = window[NAMESPACE] as InssmanNamespace | undefined;
  if (!ns || !ns.__readyPromise) {
    throw new NamespaceNotInitializedError();
  }
  return ns;
};

export const awaitReady = (): Promise<void> => {
  return getNamespace().__readyPromise;
};

/**
 * Push `request` into the per-frame queue and await one of:
 *  - `"ready"`  — the rule push from the SW lands within `QUEUE_TIMEOUT_MS`
 *  - `"timeout"` — neither tier delivers rules in time; caller should
 *    bypass interception and fall through to the network with a warning.
 *
 * The entry is removed from `__queue` before this function resolves so
 * the queue length is an honest indicator of in-flight held requests.
 *
 * The timeout half is finalised in T017 (Phase 4 / US2). For now,
 * timeout still resolves cleanly so US1 callers behave correctly even
 * if the rule push never arrives — they bypass interception instead of
 * hanging.
 */
export const enqueue = async (request: QueuedRequest): Promise<"ready" | "timeout"> => {
  const ns = getNamespace();
  ns.__queue.push(request);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const outcome = await Promise.race<"ready" | "timeout">([
      ns.__readyPromise.then<"ready">(() => "ready"),
      new Promise<"timeout">((resolve) => {
        timeoutId = setTimeout(() => resolve("timeout"), QUEUE_TIMEOUT_MS);
      }),
    ]);

    if (outcome === "timeout") {
      // Per FR-008, this MUST surface — never silent. Falling through to
      // the network is acceptable as a backstop, but the developer needs
      // to know why their mock didn't apply.
      // eslint-disable-next-line no-console
      console.warn(
        "[Inssman] Queued request timed out after %dms waiting for rules — falling back to network. URL: %s",
        QUEUE_TIMEOUT_MS,
        request.url
      );
      reportInterceptorError({
        url: request.url,
        method: request.method,
        kind: request.kind,
        message: `queue timeout after ${QUEUE_TIMEOUT_MS}ms`,
      });
    }

    return outcome;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    const idx = ns.__queue.indexOf(request);
    if (idx !== -1) ns.__queue.splice(idx, 1);
  }
};

/**
 * Snapshot of the page-MAIN-world namespace state, embedded in
 * `InterceptorError` payloads so the SW (and any future telemetry sink)
 * can correlate failures with rules-availability state.
 */
const snapshotNamespaceState = () => {
  // @ts-ignore
  const ns: any = window[NAMESPACE];
  return {
    hasNamespace: typeof ns !== "undefined",
    hasRules: Array.isArray(ns?.rules),
    ready: ns?.ready === true,
    ruleCount: Array.isArray(ns?.rules) ? ns.rules.length : -1,
  };
};

interface ReportArgs {
  url: string;
  method: string;
  kind: "fetch" | "xhr";
  message: string;
  stack?: string;
}

/**
 * Best-effort diagnostic to the SW per `contracts/postMessageActions.md`
 * — never throws, never blocks the request flow, never retries.
 */
export const reportInterceptorError = (args: ReportArgs): void => {
  // @ts-ignore
  const ns: any = window[NAMESPACE];
  const runtimeId: string | undefined = ns?.runtimeId;
  if (!runtimeId) return;
  try {
    chrome.runtime.sendMessage(runtimeId, {
      action: PostMessageAction.InterceptorError,
      data: {
        url: args.url,
        method: args.method,
        kind: args.kind,
        message: args.message,
        stack: args.stack,
        namespaceState: snapshotNamespaceState(),
      },
    });
  } catch (_) {
    /* SW may be suspended; diagnostic is best-effort */
  }
};
