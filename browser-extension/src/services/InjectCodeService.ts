import StorageService from "@services/StorageService";
import MatcherService from "@services/MatcherService";
import BaseService from "@services/BaseService";
import { ListenerType } from "@services/ListenerService/ListenerService";
import { NAMESPACE } from "@options/constant";
import { PostMessageAction } from "@models/postMessageActionModel";
import {
  PageType,
  InjectFileTagMap,
  InjectFileType,
  InjectFileTypeMap,
  InjectFileSource,
  IRuleMetaData,
} from "@models/formFieldModel";

import ExecutionWorld = chrome.scripting.ExecutionWorld;
import InjectionResult = chrome.scripting.InjectionResult;

/**
 * Trailing-debounce window used by `refreshInterceptorRules` to coalesce
 * rapid storage-change bursts (e.g. one user "save" can flip several
 * keys in quick succession). 100ms is short enough to feel instant
 * during edit-reload workflows and long enough to merge a typical save
 * into a single re-registration + tab-fanout. Implementation per T021.
 */
const REFRESH_INTERCEPTOR_DEBOUNCE_MS = 100;

class InjectCodeService extends BaseService {
  rulesData: IRuleMetaData[] = [];
  isRegisteredListener: boolean = false;
  private refreshInterceptorTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.init();
    // without removeListener
    // temp should add removeListener
    this.addListener(ListenerType.ON_CHANGE_STORAGE, this.onChangeStorage);
  }

  init = async () => {
    this.rulesData = await this.getInjectFileRules();
    if (this.rulesData.length) {
      this.isRegisteredListener = true;
      this.addListener(ListenerType.ON_COMMITTED, this.onChangeNavigation);
    }
  };

  onChangeNavigation = (transation): void => {
    this.rulesData.forEach((ruleMetaData: IRuleMetaData) => {
      if (ruleMetaData.pageType === PageType.INJECT_FILE) {
        ruleMetaData.conditions.forEach((condition) => {
          if (MatcherService.isUrlsMatch(condition.source, transation.url, condition.matchType)) {
            if (InjectFileTagMap[ruleMetaData.editorLang as string] === InjectFileTagMap[InjectFileType.HTML]) {
              this.injectHTML(
                transation.tabId,
                ruleMetaData.editorValue,
                ruleMetaData.tagSelector,
                ruleMetaData.tagSelectorOperator
              );
              StorageService.updateRuleTimestamp(String(ruleMetaData.id));
              return;
            }
            if (ruleMetaData.fileSourceType === InjectFileSource.URL) {
              if (InjectFileTagMap[ruleMetaData.editorLang as string] === InjectFileTagMap[InjectFileType.JAVASCRIPT]) {
                this.injectExternalScript(transation.tabId, ruleMetaData.fileSource);
              } else {
                this.injectExternalStyle(transation.tabId, ruleMetaData.fileSource);
              }
            } else {
              this.injectInternalScript(
                transation.tabId,
                ruleMetaData.editorValue,
                InjectFileTagMap[ruleMetaData.editorLang as string]
              );
            }
            StorageService.updateRuleTimestamp(String(ruleMetaData.id));
          }
        });
      }
    });
  };

  /**
   * `pageType` values whose changes must trigger an interceptor refresh
   * — i.e. anything the page-MAIN-world `window[NAMESPACE].rules` array
   * is consumed for. Keep in sync with `interceptorRuleFilters` above.
   */
  private static readonly INTERCEPTOR_PAGE_TYPES: ReadonlySet<PageType> = new Set([
    PageType.MODIFY_REQUEST_BODY,
    PageType.MODIFY_RESPONSE,
  ]);

  onChangeStorage = (changes) => {
    const changesArr: any = Object.values(changes);
    let interceptorAffected = false;

    changesArr.forEach(async ({ newValue, oldValue }) => {
      if (newValue?.pageType === PageType.INJECT_FILE || oldValue?.pageType === PageType.INJECT_FILE) {
        this.rulesData = await this.getInjectFileRules();
        if (this.isRegisteredListener && !this.rulesData.length) {
          this.isRegisteredListener = false;
          this.removeListener(ListenerType.ON_COMMITTED, this.onChangeNavigation);
        }
        if (!this.isRegisteredListener && this.rulesData.length) {
          this.isRegisteredListener = true;
          this.addListener(ListenerType.ON_COMMITTED, this.onChangeNavigation);
        }
      }

      // US3: react to interceptor-relevant rule changes so that newly
      // enabled / edited / disabled rules take effect on the next page
      // navigation without requiring a hard refresh.
      const newPageType = newValue?.pageType as PageType | undefined;
      const oldPageType = oldValue?.pageType as PageType | undefined;
      if (
        (newPageType !== undefined && InjectCodeService.INTERCEPTOR_PAGE_TYPES.has(newPageType)) ||
        (oldPageType !== undefined && InjectCodeService.INTERCEPTOR_PAGE_TYPES.has(oldPageType))
      ) {
        interceptorAffected = true;
      }
    });

    if (interceptorAffected) {
      this.scheduleInterceptorRefresh();
    }
  };

  /**
   * Trailing-debounce wrapper around `refreshInterceptorRules`. A single
   * "save" in the rule editor frequently writes multiple keys back to
   * `chrome.storage.local`; debouncing collapses the burst into one
   * re-registration + one tab-fanout. T021.
   */
  private scheduleInterceptorRefresh = (): void => {
    if (this.refreshInterceptorTimer !== undefined) {
      clearTimeout(this.refreshInterceptorTimer);
    }
    this.refreshInterceptorTimer = setTimeout(() => {
      this.refreshInterceptorTimer = undefined;
      this.refreshInterceptorRules().catch(() => {
        /* refresh is best-effort; failures are not fatal */
      });
    }, REFRESH_INTERCEPTOR_DEBOUNCE_MS);
  };

  /**
   * Re-register the dynamic content scripts so future navigations get
   * the updated rule set baked in (research.md R5 step 2), then push
   * the new rules into every currently-open http(s) tab so live pages
   * see the change too.
   */
  refreshInterceptorRules = async (): Promise<void> => {
    try {
      await chrome.scripting.unregisterContentScripts({ ids: ["interceptor", "bootstrap"] });
    } catch (_) {
      /* nothing was registered yet — safe to ignore */
    }
    await this.registerContentScripts();
    await this.injectRulesIntoOpenTabs();
  };

  async getInjectFileRules(): Promise<IRuleMetaData[]> {
    const filters = [
      [
        { key: "pageType", value: PageType.INJECT_FILE },
        { key: "enabled", value: true },
      ],
    ];
    return await StorageService.getFilteredRules(filters);
  }

  /**
   * Filter pair used by the interceptor injection path — must mirror
   * `serviceWorker.ts` `onCommitted` so all rule pushes see the same
   * active set.
   */
  static interceptorRuleFilters = [
    [
      { key: "pageType", value: PageType.MODIFY_REQUEST_BODY },
      { key: "enabled", value: true },
    ],
    [
      { key: "pageType", value: PageType.MODIFY_RESPONSE },
      { key: "enabled", value: true },
    ],
  ];

  async getInterceptorRules(): Promise<IRuleMetaData[]> {
    return await StorageService.getFilteredRules(InjectCodeService.interceptorRuleFilters);
  }

  /**
   * Push the current interceptor rule set into every currently-open
   * http(s) tab. Used by:
   *  - `onStartup` in serviceWorker.ts (T014) — covers the
   *    SW-suspended-during-wake case where `onCommitted` already fired.
   *  - `refreshInterceptorRules` (T020) — covers live rule edits.
   */
  injectRulesIntoOpenTabs = async (): Promise<void> => {
    let rules: IRuleMetaData[];
    try {
      rules = await this.getInterceptorRules();
    } catch (_) {
      return;
    }
    let tabs: chrome.tabs.Tab[] = [];
    try {
      tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
    } catch (_) {
      return;
    }
    await Promise.all(
      tabs.map((tab) => (typeof tab.id === "number" ? this.injectRules(tab.id, rules) : Promise.resolve()))
    );
  };

  injectHTML(tabId, code, selector, operator) {
    const replacedCode = code.replaceAll("'", "\\'");
    chrome.scripting.executeScript({
      target: { tabId },
      // this code runs in the browser tab
      func: (code, selector, operator) => {
        const element = document.createElement("script");
        element.textContent = `(() => {
          const element = ${selector || "document.body"};
          if('${operator}' === 'innerhtml') {
            element.innerHTML = '${code}';
            return;
          }
          element.insertAdjacentHTML('${operator}', '${code}');
        })();`;
        element.className = `inssman_html`;
        document.head.appendChild(element);
      },
      args: [replacedCode, selector, operator],
      world: "MAIN",
      //@ts-ignore
      injectImmediately: true,
    });
  }

  injectExternalScript(tabId, url, shouldRemove = false): void {
    chrome.scripting.executeScript({
      target: { tabId },
      // this code runs in the browser tab
      func: (url, shouldRemove) => {
        try {
          const element = document.createElement("script");
          element.type = "text/javascript";
          element.className = "inssman_script";
          element.src = url;
          document.head.appendChild(element);

          if (shouldRemove) {
            element.remove();
          }
        } catch (error) {}
      },
      args: [url, shouldRemove],
      world: "MAIN",
      //@ts-ignore
      injectImmediately: true,
    });
  }

  injectExternalStyle(tabId, url, shouldRemove = false): void {
    chrome.scripting.executeScript({
      target: { tabId },
      // this code runs in the browser tab
      func: (url, shouldRemove) => {
        const element = document.createElement("link");
        element.type = "type/css";
        element.className = "inssman_style";
        element.href = url;
        document.head.appendChild(element);

        if (shouldRemove) {
          element.remove();
        }
      },
      args: [url, shouldRemove],
      world: "MAIN",
      //@ts-ignore
      injectImmediately: true,
    });
  }

  injectInternalScript(tabId, code, tag, shouldRemove = false, world = "MAIN" as ExecutionWorld): void {
    chrome.scripting.executeScript({
      target: { tabId },
      // this code runs in the browser tab
      func: (code, tag, type, shouldRemove) => {
        const element = document.createElement(tag);
        element.textContent = code;
        element.type = type || "";
        element.className = `inssman_${tag}`;
        document.head.appendChild(element);

        if (shouldRemove) {
          element.remove();
        }
      },
      args: [code, tag, InjectFileTypeMap[tag], shouldRemove],
      world,
      //@ts-ignore
      injectImmediately: true,
    });
  }

  async injectInternalScriptToDocument(
    tabId,
    code,
    shouldRemove = false,
    world = "MAIN" as ExecutionWorld
  ): Promise<InjectionResult[]> {
    return chrome.scripting.executeScript({
      target: { tabId },
      // this code runs in the browser tab
      func: (code, tag, type, shouldRemove) => {
        const element = document.createElement(tag);
        element.textContent = code;
        element.type = type || "";
        element.className = `inssman_${tag}`;
        document.documentElement.appendChild(element);

        if (shouldRemove) {
          element.remove();
        }
      },
      args: [code, "script", "text/javascript", shouldRemove],
      world,
      //@ts-ignore
      injectImmediately: true,
    });
  }

  injectFile = async (tabId, path) => {
    chrome.scripting
      .executeScript({
        target: { tabId },
        files: [path],
        world: "MAIN",
        // @ts-ignore
        injectImmediately: true,
      })
      .catch((error) => {
        // should be tracking here
      });
  };

  injectRules = async (tabId, rules) => {
    await chrome.scripting
      .executeScript({
        target: { tabId, allFrames: true },
        // Page-MAIN-world rule push. Follows the "Rule-push script contract"
        // in specs/005-fix-mock-hard-reload/contracts/window-namespace.md:
        //  - replace `rules` by reference (never push/splice in place — avoids torn reads)
        //  - resolve `__readyPromise` exactly once via `__resolveReady` so any held
        //    queued requests are released
        //  - degrade safely when the bootstrap hasn't run yet
        //  - optional `RulesReceived` diagnostic to the SW (best-effort)
        func: (
          rules: IRuleMetaData[],
          NAMESPACE: string,
          runtimeId: string,
          rulesReceivedAction: number
        ) => {
          const ns: any = (window[NAMESPACE] = window[NAMESPACE] || {});
          ns.rules = rules;
          ns.runtimeId = runtimeId;
          if (typeof ns.__resolveReady === "function") {
            ns.__resolveReady();
          } else {
            ns.ready = true;
          }
          try {
            chrome.runtime.sendMessage(runtimeId, {
              action: rulesReceivedAction,
              data: { count: rules.length, receivedAt: Date.now() },
            });
          } catch (_) {
            /* SW may be suspended; diagnostic is best-effort */
          }
        },
        world: "MAIN",
        args: [rules, NAMESPACE, chrome.runtime.id, PostMessageAction.RulesReceived],
        // @ts-ignore
        injectImmediately: true,
      })
      .catch((error) => {
        // should be tracking here
      });
  };

  registerContentScripts = async () => {
    return await chrome.scripting
      .registerContentScripts([
        {
          // Tier A backup: dynamic registration of the bootstrap covers
          // installs that haven't yet refreshed the static manifest entry
          // added in this fix. Bootstrap is idempotent so dual delivery
          // (static + dynamic) is safe — see contracts/window-namespace.md.
          id: "bootstrap",
          js: ["bootstrap/bootstrap.js"],
          world: "MAIN",
          allFrames: true,
          persistAcrossSessions: false,
          matches: ["http://*/*", "https://*/*"],
          runAt: "document_start",
        },
        {
          id: "interceptor",
          js: ["interceptor/interceptor.js"],
          world: "MAIN",
          allFrames: true,
          persistAcrossSessions: false,
          matches: ["http://*/*", "https://*/*"],
          runAt: "document_start",
        },
      ])
      .then(() => {
        console.log("[registerClientScript]");
        chrome.scripting
          .getRegisteredContentScripts()
          .then((scripts) => console.log("[registerClientScript]", "registered content scripts", scripts));
      })
      .catch((err) => console.warn("[unregisterClientScript]", "unexpected error", err));
  };
}

export default new InjectCodeService();
