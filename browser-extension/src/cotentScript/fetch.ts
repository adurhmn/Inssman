import { PageType } from "@/models/formFieldModel";
import { ModificationType } from "@/options/pages/forms/modifyResponse/generateModifyResponseRules";
import {
  getAbsoluteUrl,
  isContentTypeJSON,
  isPromise,
  jsonifyValidJSONString,
  getMatchedRuleByUrl,
} from "@utils/contentScript";
import { enqueue, reportInterceptorError } from "./queue";
import type { MatchResult } from "./types";

export const initFetchInterceptor = () => {
  const _fetch = fetch;

  /**
   * Apply the matched mock/modification rules to `request` and return
   * the final `Response`. Identical to the existing pre-fix behaviour
   * — extracted so it can be invoked from both the fast path and the
   * post-enqueue retry path without duplicating logic.
   */
  const applyRules = async (
    request: Request,
    initOptions: any,
    rules: Partial<Record<PageType, any>>,
    getOriginalResponse: () => Promise<Response>
  ): Promise<Response> => {
    const url = getAbsoluteUrl(request.url);
    const method = request.method;

    const requestRule = rules[PageType.MODIFY_REQUEST_BODY];
    const responseRule = rules[PageType.MODIFY_RESPONSE];

    const canRequestBodyBeSent = !["GET", "HEAD"].includes(method);

    let workingRequest = request;

    if (requestRule && canRequestBodyBeSent) {
      const originalRequestBody = await workingRequest.text();
      let requestBody = requestRule.editorValue;

      if (requestRule.modificationType === ModificationType.DYNAMIC) {
        requestBody = new Function("args", `return (${requestRule.editorValue})(args);`)({
          body: originalRequestBody,
          method: initOptions.method,
          url: workingRequest.url,
        });
      }

      workingRequest = new Request(workingRequest.url, {
        method,
        body: requestBody,
        headers: workingRequest.headers,
        referrer: workingRequest.referrer,
        referrerPolicy: workingRequest.referrerPolicy,
        mode: workingRequest.mode,
        credentials: workingRequest.credentials,
        cache: workingRequest.cache,
        redirect: workingRequest.redirect,
        integrity: workingRequest.integrity,
      });
    }

    if (!responseRule) {
      // Only a request-body modification applies — perform the
      // (modified) request and return the upstream response unchanged.
      return _fetch(workingRequest);
    }

    let requestData;
    if (canRequestBodyBeSent) {
      requestData = jsonifyValidJSONString(await workingRequest.clone().text());
    }

    let responseHeaders;
    let fetchedResponse;

    try {
      const headersObject = {};
      workingRequest?.headers?.forEach((value, key) => {
        headersObject[key] = value;
      });

      if (requestRule) {
        fetchedResponse = await _fetch(workingRequest);
      } else {
        fetchedResponse = await getOriginalResponse();
      }

      responseHeaders = fetchedResponse?.headers;
    } catch (error) {
      // Static-mock path can still return the configured body even when
      // the upstream fetch failed; only re-throw if there is no
      // response rule to fall back to.
      if (!responseRule) {
        return Promise.reject(error);
      }
    }

    let customResponse;
    if (responseRule.modificationType === ModificationType.DYNAMIC) {
      const requestHeaders =
        workingRequest.headers &&
        // @ts-ignore
        Array.from(workingRequest.headers).reduce((obj, [key, val]) => {
          // @ts-ignore
          obj[key] = val;
          return obj;
        }, {});

      let responseArgs: any = {
        method,
        url,
        requestHeaders,
        requestData,
      };

      if (fetchedResponse) {
        const fetchedResponseData = await fetchedResponse.text();
        const responseType = fetchedResponse.headers.get("content-type");
        const fetchedResponseDataAsJson = jsonifyValidJSONString(fetchedResponseData, true);

        responseArgs = {
          ...responseArgs,
          responseType,
          response: fetchedResponseData,
          responseJSON: fetchedResponseDataAsJson,
        };
      }

      customResponse = new Function("args", `return (${responseRule.editorValue})(args);`)(responseArgs);

      if (typeof customResponse === "undefined") {
        return fetchedResponse as Response;
      }

      if (isPromise(customResponse)) {
        customResponse = await customResponse;
      }

      if (typeof customResponse === "object" && isContentTypeJSON(responseArgs?.responseType)) {
        customResponse = JSON.stringify(customResponse);
      }
    } else {
      customResponse = responseRule.editorValue;
    }

    const finalStatusCode = fetchedResponse?.status || 200;
    const requiresNullResponseBody = [204, 205, 304].includes(finalStatusCode);

    return new Response(requiresNullResponseBody ? null : new Blob([customResponse]), {
      status: finalStatusCode,
      statusText: fetchedResponse?.statusText,
      headers: responseHeaders,
    });
  };

  // @ts-ignore
  fetch = async (...args) => {
    const [resource, initOptions = {}] = args;
    // @ts-ignore
    const getOriginalResponse = () => _fetch(...args);

    let request: Request;
    if (resource instanceof Request) {
      request = resource.clone();
    } else {
      request = new Request(resource.toString(), initOptions);
    }

    const url = getAbsoluteUrl(request.url);
    const method = request.method;

    try {
      let match: MatchResult = getMatchedRuleByUrl(url);

      if (match.status === "rules-not-ready") {
        // Tier B: hold the request until the SW rule push lands or the
        // queue timeout fires. Re-evaluate exactly once after release —
        // recursive enqueue is forbidden (bounded latency, see
        // data-model.md invariants I3 / I4).
        await enqueue({ kind: "fetch", url, method, enqueuedAt: performance.now() });
        match = getMatchedRuleByUrl(url);
      }

      if (match.status === "matched") {
        return await applyRules(request, initOptions, match.rules, getOriginalResponse);
      }

      // "no-match" or still "rules-not-ready" after the queue resolved
      // (e.g. timeout): bypass interception cleanly. The queue itself
      // already logged a `[Inssman] Queued request timed out` warning
      // for the timeout case; nothing to do here.
      return await getOriginalResponse();
    } catch (err: any) {
      // Per FR-008, internal errors MUST NOT silently fall through.
      // Surface a developer-visible warning AND a best-effort
      // `InterceptorError` to the SW, then fall back to the network
      // so the page does not hang or break.
      // eslint-disable-next-line no-console
      console.warn(
        "[Inssman] Interceptor error — request fell through to network. URL: %s",
        url,
        err
      );
      reportInterceptorError({
        url,
        method,
        kind: "fetch",
        message: String(err?.message ?? err),
        stack: err?.stack,
      });
      return await getOriginalResponse();
    }
  };
};

initFetchInterceptor();
