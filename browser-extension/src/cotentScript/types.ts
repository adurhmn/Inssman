import { IRuleMetaData, PageType } from "@models/formFieldModel";

/**
 * Tagged result returned by `getMatchedRuleByUrl`.
 *
 * The shape distinguishes "rules were checked and at least one matched"
 * from "rules were checked and nothing matched" from "rules are not yet
 * available in this frame" — the third case is what the queue (Tier B)
 * is built to hold.
 *
 * The `matched` variant carries a map keyed by `PageType` because a
 * single URL can match both a `MODIFY_REQUEST_BODY` rule and a
 * `MODIFY_RESPONSE` rule simultaneously (existing semantics preserved
 * per FR-010 — see plan.md / data-model.md Entity 3).
 */
export type MatchResult =
  | {
      status: "matched";
      rules: Partial<Record<PageType, IRuleMetaData>>;
    }
  | { status: "no-match" }
  | { status: "rules-not-ready" };

/**
 * A request held by the interceptor while `window[NAMESPACE].ready === false`.
 * Lifetime: created at enqueue, removed when either `release()` (rules
 * arrived) or the queue timeout fires.
 */
export interface QueuedRequest {
  kind: "fetch" | "xhr";
  url: string;
  method: string;
  enqueuedAt: number;
}
