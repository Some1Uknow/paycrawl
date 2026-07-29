import { CELO_NETWORK, isForbiddenPublicHostname } from "@paycrawl/shared";
import { ExactEvmScheme } from "@x402/evm";
import {
  wrapFetchWithPayment,
  x402Client,
  x402HTTPClient,
  type PaymentRequired,
} from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, erc20Abi, http } from "viem";
import { celo } from "viem/chains";

import { formatUsdc, type SpendBudget } from "./budget.js";
import {
  inspectPaymentRequired,
  validateAndReservePayment,
  validatePaymentRequired,
  type ValidatedQuote,
} from "./payment.js";

const MAX_SAFE_NETWORK_RETRIES = 2;
export const DEFAULT_CRAWL_TIMEOUT_MS = 12_000;
export const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export type CrawlTargetResult = {
  url: string;
  status: number;
  receipt?: unknown;
  content: string;
};

export type CrawlOptions = {
  url: string;
  privateKey: `0x${string}`;
  /**
   * Legacy static restriction. Prefer resolvePayoutAllowlist so new publishers
   * can be explicitly approved and stored by the caller's local policy.
   */
  payoutAllowlist?: Set<string>;
  resolvePayoutAllowlist?: (
    quote: ValidatedQuote,
  ) => Promise<Set<string>> | Set<string>;
  budget: SpendBudget;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
  usdcBalanceOf?: (address: `0x${string}`) => Promise<bigint>;
};

const CELO_RPC_URL = "https://forno.celo.org";

export async function readCeloUsdcBalance(
  address: `0x${string}`,
): Promise<bigint> {
  const client = createPublicClient({
    chain: celo,
    transport: http(process.env.PAYCRAWL_RPC_URL ?? CELO_RPC_URL),
  });
  return client.readContract({
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
}

function assertCrawlUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    isForbiddenPublicHostname(url.hostname)
  ) {
    throw new Error(
      "Paid crawl URLs must use a public HTTPS hostname without credentials",
    );
  }
  if (!url.pathname.startsWith("/agent/")) {
    throw new Error("PayCrawl URLs must use a protected /agent/ route");
  }
  return url;
}

function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error && error.name === "AbortError")
  );
}

async function fetchInitialChallenge(
  input: URL,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_SAFE_NETWORK_RETRIES; attempt += 1) {
    try {
      return await fetchWithTimeout(
        input,
        { method: "GET", redirect: "error" },
        fetchImpl,
        timeoutMs,
      );
    } catch (error) {
      lastError = error;
      if (!isNetworkError(error) || attempt === MAX_SAFE_NETWORK_RETRIES) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to fetch payment challenge");
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function hasPaymentSignature(request: Request): boolean {
  return (
    request.headers.has("payment-signature") || request.headers.has("x-payment")
  );
}

async function retryUnsignedRequest(
  request: Request,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_SAFE_NETWORK_RETRIES; attempt += 1) {
    try {
      return await fetchWithTimeout(request.clone(), {}, fetchImpl, timeoutMs);
    } catch (error) {
      lastError = error;
      if (!isNetworkError(error) || attempt === MAX_SAFE_NETWORK_RETRIES) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to fetch unsigned request");
}

function contentLengthExceedsLimit(
  headers: Headers,
  maxResponseBytes: number,
): boolean {
  const raw = headers.get("content-length");
  if (!raw) return false;
  const length = Number(raw);
  return Number.isFinite(length) && length > maxResponseBytes;
}

async function readChunkWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (signal.aborted) throw new Error("Response body timed out");

  let removeAbortListener: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    const abort = () => reject(new Error("Response body timed out"));
    signal.addEventListener("abort", abort, { once: true });
    removeAbortListener = () => signal.removeEventListener("abort", abort);
  });

  try {
    return await Promise.race([reader.read(), aborted]);
  } finally {
    removeAbortListener?.();
  }
}

async function readResponseTextWithinLimit(
  response: Response,
  maxResponseBytes: number,
  timeoutMs: number,
): Promise<string> {
  if (contentLengthExceedsLimit(response.headers, maxResponseBytes)) {
    await response.body?.cancel();
    throw new Error(
      `Response exceeds the ${maxResponseBytes}-byte content limit`,
    );
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (;;) {
      const { done, value } = await readChunkWithTimeout(
        reader,
        controller.signal,
      );
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxResponseBytes) {
        await reader.cancel();
        throw new Error(
          `Response exceeds the ${maxResponseBytes}-byte content limit`,
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function decodeChallenge(
  response: Response,
  httpClient: x402HTTPClient,
): PaymentRequired {
  try {
    return httpClient.getPaymentRequiredResponse((name) =>
      response.headers.get(name),
    );
  } catch (error) {
    throw new Error(
      `Unable to decode the 402 payment challenge: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

async function resolvePayoutAllowlist(
  options: CrawlOptions,
  quote: ValidatedQuote,
): Promise<Set<string>> {
  const resolved = options.resolvePayoutAllowlist
    ? await options.resolvePayoutAllowlist(quote)
    : options.payoutAllowlist;
  if (!resolved || resolved.size === 0) {
    throw new Error(
      "No publisher approval is available for this 402 quote. Review the publisher and approve it before signing",
    );
  }
  return resolved;
}

export async function crawlOne(
  options: CrawlOptions,
): Promise<CrawlTargetResult> {
  const url = assertCrawlUrl(options.url);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_CRAWL_TIMEOUT_MS;
  const maxResponseBytes =
    options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
    throw new Error("timeoutMs must be a positive integer");
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0) {
    throw new Error("maxResponseBytes must be a positive integer");
  }
  const initial = await fetchInitialChallenge(url, fetchImpl, timeoutMs);

  if (initial.status !== 402) {
    return {
      url: url.toString(),
      status: initial.status,
      content: await readResponseTextWithinLimit(
        initial,
        maxResponseBytes,
        timeoutMs,
      ),
    };
  }

  // Validate the exact challenge shown to the agent before it can sign. The
  // same policy is registered below as a pre-sign hook because the wrapper
  // performs its own fresh unpaid request before sending PAYMENT-SIGNATURE.
  const account = privateKeyToAccount(options.privateKey);
  const httpClient = new x402HTTPClient(new x402Client());
  let preflightChallenge: PaymentRequired;
  try {
    preflightChallenge = decodeChallenge(initial, httpClient);
  } finally {
    await initial.body?.cancel().catch(() => undefined);
  }
  const inspectedQuote = inspectPaymentRequired(preflightChallenge, url);
  const payoutAllowlist = await resolvePayoutAllowlist(options, inspectedQuote);
  const validatedQuote = validatePaymentRequired(
    preflightChallenge,
    url,
    payoutAllowlist,
  );
  const balanceOf = options.usdcBalanceOf ?? readCeloUsdcBalance;
  const balance = await balanceOf(account.address);
  if (balance < validatedQuote.amountAtomic) {
    throw new Error(
      `Payer wallet ${account.address} needs at least ${formatUsdc(validatedQuote.amountAtomic)} USDC on Celo mainnet before it can sign. Fund this wallet once, then run the crawl again`,
    );
  }

  const client = new x402Client((_version, requirements) => {
    const challenge: PaymentRequired = {
      x402Version: 2,
      resource: { url: url.toString() },
      accepts: requirements,
    };
    return validatePaymentRequired(challenge, url, payoutAllowlist)
      .requirements;
  }).register(CELO_NETWORK, new ExactEvmScheme(account));
  const paidHttpClient = new x402HTTPClient(client);

  client.onBeforePaymentCreation(async ({ paymentRequired }) => {
    validateAndReservePayment(
      paymentRequired,
      url,
      payoutAllowlist,
      options.budget,
    );
  });

  const retrySafeFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    // The wrapped client's first call is another unsigned challenge request.
    // It may be retried safely. Once PAYMENT-SIGNATURE is present, do exactly
    // one network attempt and preserve an ambiguous outcome in the budget.
    return hasPaymentSignature(request)
      ? fetchWithTimeout(request, {}, fetchImpl, timeoutMs)
      : retryUnsignedRequest(request, fetchImpl, timeoutMs);
  };
  const paidFetch = wrapFetchWithPayment(retrySafeFetch, paidHttpClient);
  let response: Response;
  try {
    response = await paidFetch(url, { method: "GET", redirect: "error" });
  } catch (error) {
    // Once a signature may have been sent, the transaction state is ambiguous.
    // Deliberately do not retry: the reservation remains charged to the budget.
    throw new Error(
      `Paid request has an unknown outcome and was not retried: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  let receipt: unknown;
  const receiptHeader = response.headers.get("payment-response");
  if (receiptHeader) {
    receipt = paidHttpClient.getPaymentSettleResponse((name) =>
      response.headers.get(name),
    );
  }

  return {
    url: url.toString(),
    status: response.status,
    receipt,
    content: await readResponseTextWithinLimit(
      response,
      maxResponseBytes,
      timeoutMs,
    ),
  };
}

export function formatResult(result: CrawlTargetResult): string {
  const lines = [`${result.status} ${result.url}`];
  if (result.receipt) {
    const receipt = result.receipt as { transaction?: string; amount?: string };
    if (receipt.transaction) lines.push(`transaction: ${receipt.transaction}`);
    if (receipt.amount)
      lines.push(`settled: ${formatUsdc(BigInt(receipt.amount))} USDC`);
    lines.push(`PAYMENT-RESPONSE: ${JSON.stringify(result.receipt)}`);
  }
  return lines.join("\n");
}
