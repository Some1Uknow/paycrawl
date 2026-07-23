import type { GatewayConfig } from "@paycrawl/shared";

import {
  assertAllowedOriginUrl,
  assertSafeOriginBaseUrl,
  buildOriginHealthUrl,
  buildOriginRequestHeaders,
  buildOriginUrl,
  UnsafeOriginError,
} from "./security.js";

const MAX_REDIRECTS = 3;
export const ORIGIN_FETCH_TIMEOUT_MS = 12_000;
export const MAX_ORIGIN_RESPONSE_BYTES = 4 * 1024 * 1024;

export class OriginFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OriginFetchError";
  }
}

function isRedirect(response: Response): boolean {
  return response.status >= 300 && response.status < 400;
}

function hasUnsafeRedirectPath(location: string): boolean {
  const rawPath = location.split(/[?#]/, 1)[0] ?? "";
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return true;
  }

  return (
    decoded.includes("\\") ||
    decoded.split("/").includes("..") ||
    /%2f|%5c/i.test(rawPath)
  );
}

type TimedOriginResponse = {
  response: Response;
  signal: AbortSignal;
  dispose: () => void;
};

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<TimedOriginResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ORIGIN_FETCH_TIMEOUT_MS);

  try {
    const response = await fetchImpl(input, {
      ...init,
      signal: controller.signal,
    });
    return {
      response,
      signal: controller.signal,
      dispose: () => clearTimeout(timeout),
    };
  } catch (error) {
    clearTimeout(timeout);
    if (controller.signal.aborted) {
      throw new OriginFetchError("Publisher origin timed out");
    }
    throw error;
  }
}

function contentLengthExceedsLimit(headers: Headers): boolean {
  const raw = headers.get("content-length");
  if (!raw) return false;
  const length = Number(raw);
  return Number.isFinite(length) && length > MAX_ORIGIN_RESPONSE_BYTES;
}

async function readChunkWithAbort(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (signal.aborted) throw new OriginFetchError("Publisher origin timed out");

  let removeAbortListener: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    const abort = () =>
      reject(new OriginFetchError("Publisher origin timed out"));
    signal.addEventListener("abort", abort, { once: true });
    removeAbortListener = () => signal.removeEventListener("abort", abort);
  });

  try {
    return await Promise.race([reader.read(), aborted]);
  } finally {
    removeAbortListener?.();
  }
}

async function bufferResponseWithinLimit(
  response: Response,
  signal: AbortSignal,
): Promise<Response> {
  if (contentLengthExceedsLimit(response.headers)) {
    await response.body?.cancel();
    throw new OriginFetchError(
      "Publisher origin response exceeds the maximum allowed size",
    );
  }

  if (!response.body) {
    return new Response(null, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await readChunkWithAbort(reader, signal);
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > MAX_ORIGIN_RESPONSE_BYTES) {
        await reader.cancel();
        throw new OriginFetchError(
          "Publisher origin response exceeds the maximum allowed size",
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (error instanceof OriginFetchError) throw error;
    throw new OriginFetchError(
      "Publisher origin response could not be read safely",
    );
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * Fetch a resource only from the fixed, validated publisher origin. Redirects
 * are followed manually and only when they stay under the configured protected
 * base path on the same HTTPS hostname and port.
 */
export async function fetchProtectedOrigin(
  request: Request,
  config: GatewayConfig,
  originToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const incomingUrl = new URL(request.url);
  const allowedOrigin = assertSafeOriginBaseUrl(config.originBaseUrl);
  let target = buildOriginUrl(
    config.originBaseUrl,
    incomingUrl.pathname,
    incomingUrl.search,
  );
  const headers = buildOriginRequestHeaders(request.headers, originToken);

  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount += 1
  ) {
    let timedResponse: TimedOriginResponse;
    try {
      timedResponse = await fetchWithTimeout(
        target,
        {
          method: "GET",
          headers,
          redirect: "manual",
        },
        fetchImpl,
      );
    } catch (error) {
      if (error instanceof OriginFetchError) throw error;
      throw new OriginFetchError("Publisher origin could not be reached");
    }
    const { response } = timedResponse;

    if (!isRedirect(response)) {
      try {
        return await bufferResponseWithinLimit(response, timedResponse.signal);
      } finally {
        timedResponse.dispose();
      }
    }

    try {
      const location = response.headers.get("location");
      if (!location) {
        throw new OriginFetchError(
          "Publisher origin returned a malformed redirect",
        );
      }
      if (hasUnsafeRedirectPath(location)) {
        throw new OriginFetchError(
          "Publisher origin returned an unsafe redirect path",
        );
      }

      try {
        target = assertAllowedOriginUrl(
          new URL(location, target),
          allowedOrigin,
        );
      } catch (error) {
        if (error instanceof UnsafeOriginError) {
          throw error;
        }
        throw new OriginFetchError(
          "Publisher origin returned an invalid redirect",
        );
      }
    } finally {
      await response.body?.cancel().catch(() => undefined);
      timedResponse.dispose();
    }
  }

  throw new OriginFetchError("Publisher origin exceeded the redirect limit");
}

export async function probeOrigin(
  config: GatewayConfig,
  originToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const origin = buildOriginHealthUrl(
      config.originBaseUrl,
      config.originHealthPath,
    );
    const timedResponse = await fetchWithTimeout(
      origin,
      {
        method: "HEAD",
        headers: buildOriginRequestHeaders(new Headers(), originToken),
        redirect: "manual",
      },
      fetchImpl,
    );
    try {
      return timedResponse.response.status === 204;
    } finally {
      await timedResponse.response.body?.cancel().catch(() => undefined);
      timedResponse.dispose();
    }
  } catch {
    return false;
  }
}
