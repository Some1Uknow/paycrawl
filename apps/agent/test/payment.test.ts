import { describe, expect, it } from "vitest";

import type { PaymentRequired } from "@x402/fetch";

import { SpendBudget } from "../src/budget.js";
import {
  parsePayToAllowlist,
  validateAndReservePayment,
  validatePaymentRequired,
} from "../src/payment.js";

const payTo = "0x5287c8e5017edeec5f733fa926676c21ffcb8b65";
const url = new URL("https://gateway.example/agent/page/article-1");
const challenge: PaymentRequired = {
  x402Version: 2,
  resource: { url: url.toString() },
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

describe("payment challenge policy", () => {
  it("allows only configured Celo USDC requirements", () => {
    const allowlist = parsePayToAllowlist(payTo);
    expect(
      validatePaymentRequired(challenge, url, allowlist).amountAtomic,
    ).toBe(1000n);
  });

  it("rejects an unapproved payee before reserving budget", () => {
    const allowlist = parsePayToAllowlist(
      "0x1111111111111111111111111111111111111111",
    );
    expect(() => validatePaymentRequired(challenge, url, allowlist)).toThrow(
      /approved Celo USDC/,
    );
  });

  it("rejects the zero address in a local payout allowlist", () => {
    expect(() =>
      parsePayToAllowlist("0x0000000000000000000000000000000000000000"),
    ).toThrow(/Invalid payout address/);
  });

  it("reserves the validated amount before a signature is created", () => {
    const budget = new SpendBudget(2000n, 1500n);
    validateAndReservePayment(
      challenge,
      url,
      parsePayToAllowlist(payTo),
      budget,
    );
    expect(budget.authorized).toBe(1000n);
  });
});
