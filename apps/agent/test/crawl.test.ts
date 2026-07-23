import {
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from "@x402/core/http";
import type { PaymentRequired } from "@x402/fetch";
import { describe, expect, it } from "vitest";

import { SpendBudget } from "../src/budget.js";
import { crawlOne } from "../src/crawl.js";

const url = "https://gateway.example/agent/page/article-1";
const payerKey = `0x${"1".repeat(64)}` as const;
const payTo = "0x5287c8e5017edeec5f733fa926676c21ffcb8b65";
const challenge: PaymentRequired = {
  x402Version: 2,
  resource: { url },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:42220",
      asset: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
      amount: "1000",
      payTo,
      maxTimeoutSeconds: 60,
      extra: { name: "USDC", version: "2" },
    },
  ],
};

function unpaidResponse(): Response {
  return new Response(JSON.stringify({}), {
    status: 402,
    headers: { "PAYMENT-REQUIRED": encodePaymentRequiredHeader(challenge) },
  });
}

function paidResponse(): Response {
  return new Response("paid article", {
    status: 200,
    headers: {
      "PAYMENT-RESPONSE": encodePaymentResponseHeader({
        success: true,
        transaction: `0x${"2".repeat(64)}`,
        network: "eip155:42220",
        payer: payTo,
        amount: "1000",
      }),
    },
  });
}

describe("network retry policy", () => {
  it("retries an unsigned challenge network error but not the signed request", async () => {
    let unsignedCalls = 0;
    let signedCalls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      if (request.headers.has("payment-signature")) {
        signedCalls += 1;
        return paidResponse();
      }
      unsignedCalls += 1;
      if (unsignedCalls === 2) throw new TypeError("temporary network error");
      return unpaidResponse();
    };

    const result = await crawlOne({
      url,
      privateKey: payerKey,
      payoutAllowlist: new Set([payTo]),
      budget: new SpendBudget(10_000n, 10_000n),
      fetchImpl,
    });

    expect(result.status).toBe(200);
    expect(unsignedCalls).toBe(3);
    expect(signedCalls).toBe(1);
  });

  it("does not retry an ambiguous signed network failure", async () => {
    let signedCalls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      if (request.headers.has("payment-signature")) {
        signedCalls += 1;
        throw new TypeError("connection closed after send");
      }
      return unpaidResponse();
    };

    await expect(
      crawlOne({
        url,
        privateKey: payerKey,
        payoutAllowlist: new Set([payTo]),
        budget: new SpendBudget(10_000n, 10_000n),
        fetchImpl,
      }),
    ).rejects.toThrow(/not retried/);

    expect(signedCalls).toBe(1);
  });

  it("rejects a private crawl target before any network request", async () => {
    let calls = 0;
    await expect(
      crawlOne({
        url: "https://127.0.0.1/agent/page/article-1",
        privateKey: payerKey,
        payoutAllowlist: new Set([payTo]),
        budget: new SpendBudget(10_000n, 10_000n),
        fetchImpl: async () => {
          calls += 1;
          return new Response("unreachable");
        },
      }),
    ).rejects.toThrow(/public HTTPS hostname/);
    expect(calls).toBe(0);
  });

  it("rejects an unsigned response that exceeds the configured content ceiling", async () => {
    await expect(
      crawlOne({
        url,
        privateKey: payerKey,
        payoutAllowlist: new Set([payTo]),
        budget: new SpendBudget(10_000n, 10_000n),
        maxResponseBytes: 4,
        fetchImpl: async () =>
          new Response("oversized", {
            status: 200,
            headers: { "Content-Length": "9" },
          }),
      }),
    ).rejects.toThrow(/content limit/);
  });

  it("times out a stalled unsigned response body", async () => {
    const stalledBody = new ReadableStream<Uint8Array>({
      start() {
        // Leave the stream open without producing a byte.
      },
    });
    await expect(
      crawlOne({
        url,
        privateKey: payerKey,
        payoutAllowlist: new Set([payTo]),
        budget: new SpendBudget(10_000n, 10_000n),
        timeoutMs: 10,
        fetchImpl: async () => new Response(stalledBody, { status: 200 }),
      }),
    ).rejects.toThrow(/timed out/);
  });
});
