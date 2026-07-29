import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from "@x402/core/http";
import type { FacilitatorClient } from "@x402/core/server";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { describe, expect, it } from "vitest";

import { createGateway } from "../src/app.js";
import type { GatewayBindings } from "../src/bindings.js";

const payTo = "0x5287c8e5017edeec5f733fa926676c21ffcb8b65";
const payer = "0x1111111111111111111111111111111111111111";
const transaction = `0x${"a".repeat(64)}`;
const originFixtureValue = [
  "amber",
  "cedar",
  "dawn",
  "frost",
  "garden",
  "harbor",
].join("-");
const analyticsFixtureValue = [
  "lilac",
  "marble",
  "orbit",
  "piano",
  "quartz",
  "river",
].join("-");

type Harness = {
  app: ReturnType<typeof createGateway>;
  originCalls: () => number;
  settleCalls: () => number;
  queuedSettlements: () => number;
};

function makeBindings(): GatewayBindings {
  const analytics = {
    prepare() {
      return {
        bind() {
          return { run: async () => ({ success: true }) };
        },
      };
    },
  } as unknown as D1Database;

  return {
    ANALYTICS: analytics,
    SETTLEMENT_QUEUE: {
      async send() {
        return;
      },
    } as unknown as Queue<never>,
    ORIGIN_TOKEN: originFixtureValue,
    ANALYTICS_HMAC_KEY: analyticsFixtureValue,
    GATEWAY_CONFIG: JSON.stringify({
      originBaseUrl: "https://publisher.example",
      originHealthPath: "/healthz",
      payTo,
      protectedRoutes: [{ pattern: "/agent/page/*", amountAtomic: "1000" }],
      facilitatorUrl: "https://api.x402.celo.org",
      network: "eip155:42220",
    }),
  };
}

function makeHarness(originStatus = 200): Harness {
  let originCount = 0;
  let settleCount = 0;
  let queuedSettlementCount = 0;
  const seenPayloads = new Set<string>();
  const facilitator: FacilitatorClient = {
    async getSupported() {
      return {
        kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:42220" }],
        extensions: [],
        signers: {},
      };
    },
    async verify(paymentPayload) {
      const key = JSON.stringify(paymentPayload.payload);
      if (seenPayloads.has(key)) {
        return { isValid: false, invalidReason: "replay" };
      }
      seenPayloads.add(key);
      return { isValid: true, payer };
    },
    async settle(_paymentPayload, requirements) {
      settleCount += 1;
      return {
        success: true,
        transaction,
        network: "eip155:42220",
        payer,
        amount: requirements.amount,
      };
    },
  };

  const bindings = makeBindings();
  bindings.SETTLEMENT_QUEUE = {
    async send() {
      queuedSettlementCount += 1;
    },
  } as unknown as Queue<never>;

  const app = createGateway(bindings, {
    facilitator,
    fetchImpl: async () => {
      originCount += 1;
      return new Response(
        originStatus === 200 ? "publisher content" : "origin error",
        { status: originStatus },
      );
    },
  });

  return {
    app,
    originCalls: () => originCount,
    settleCalls: () => settleCount,
    queuedSettlements: () => queuedSettlementCount,
  };
}

async function getChallenge(
  app: ReturnType<typeof createGateway>,
): Promise<PaymentRequirements> {
  const response = await app.request(
    "https://gateway.example/agent/page/article-1",
  );
  expect(response.status).toBe(402);
  const raw = response.headers.get("payment-required");
  expect(raw).toBeTruthy();
  const challenge = decodePaymentRequiredHeader(raw ?? "");
  expect(challenge.x402Version).toBe(2);
  expect(challenge.accepts).toHaveLength(1);
  return challenge.accepts[0] as PaymentRequirements;
}

function signedHeaders(accepted: PaymentRequirements): Headers {
  const payment: PaymentPayload = {
    x402Version: 2,
    accepted,
    payload: { authorization: "mock-valid-signature" },
  };
  return new Headers({
    "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(payment),
  });
}

describe("x402 gateway protocol", () => {
  it("permits content-free HEAD and rejects other protected-route methods", async () => {
    const harness = makeHarness();
    const head = await harness.app.request(
      "https://gateway.example/agent/page/article-1",
      { method: "HEAD" },
    );
    const post = await harness.app.request(
      "https://gateway.example/agent/page/article-1",
      { method: "POST" },
    );

    expect(head.status).toBe(204);
    expect(post.status).toBe(405);
    expect(harness.originCalls()).toBe(0);
    expect(harness.settleCalls()).toBe(0);
  });

  it("returns an explicit Celo USDC 402 challenge before contacting the origin", async () => {
    const harness = makeHarness();
    const requirement = await getChallenge(harness.app);

    expect(requirement.network).toBe("eip155:42220");
    expect(requirement.asset).toBe(
      "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    );
    expect(requirement.amount).toBe("1000");
    expect(requirement.payTo).toBe(payTo);
    expect(requirement.extra).toMatchObject({ name: "USDC", version: "2" });
    expect(harness.originCalls()).toBe(0);
    expect(harness.settleCalls()).toBe(0);
  });

  it("returns content and PAYMENT-RESPONSE after a verified successful origin GET", async () => {
    const harness = makeHarness();
    const accepted = await getChallenge(harness.app);
    const response = await harness.app.request(
      "https://gateway.example/agent/page/article-1",
      {
        headers: signedHeaders(accepted),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("publisher content");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(harness.originCalls()).toBe(1);
    expect(harness.settleCalls()).toBe(1);
    expect(harness.queuedSettlements()).toBe(1);
    expect(
      decodePaymentResponseHeader(
        response.headers.get("payment-response") ?? "",
      ).transaction,
    ).toBe(transaction);
  });

  it("rejects a replayed payment and does not deliver or settle it again", async () => {
    const harness = makeHarness();
    const accepted = await getChallenge(harness.app);
    const headers = signedHeaders(accepted);
    const first = await harness.app.request(
      "https://gateway.example/agent/page/article-1",
      { headers },
    );
    const replay = await harness.app.request(
      "https://gateway.example/agent/page/article-1",
      { headers },
    );

    expect(first.status).toBe(200);
    expect(replay.status).toBe(402);
    expect(harness.originCalls()).toBe(1);
    expect(harness.settleCalls()).toBe(1);
  });

  it("cancels verified payment work when the origin fails", async () => {
    const harness = makeHarness(500);
    const accepted = await getChallenge(harness.app);
    const response = await harness.app.request(
      "https://gateway.example/agent/page/article-1",
      {
        headers: signedHeaders(accepted),
      },
    );

    expect(response.status).toBe(502);
    expect(harness.originCalls()).toBe(1);
    expect(harness.settleCalls()).toBe(0);
  });
});
