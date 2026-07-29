import { CELO_NETWORK, CELO_USDC, isEvmAddress } from "@paycrawl/shared";
import type { PaymentRequired, PaymentRequirements } from "@x402/fetch";

import { parseUsdc, type SpendBudget } from "./budget.js";

export type ValidatedQuote = {
  requirements: PaymentRequirements;
  amountAtomic: bigint;
};

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

/**
 * Optional hard restriction for deployments that want to permit only a known
 * set of payout wallets. Normal agent use relies on the persistent publisher
 * policy instead; this is an extra guard, not the primary UX.
 */
export function parsePayToAllowlist(raw: string | undefined): Set<string> {
  const values =
    raw
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  if (values.length === 0) {
    throw new Error(
      "PAYCRAWL_ALLOWED_PAY_TO must contain at least one payout address when set",
    );
  }

  const allowlist = new Set<string>();
  for (const value of values) {
    if (!isEvmAddress(value)) {
      throw new Error(
        `Invalid payout address in PAYCRAWL_ALLOWED_PAY_TO: ${value}`,
      );
    }
    allowlist.add(normalizeAddress(value));
  }
  return allowlist;
}

function isExpectedRequirement(requirement: PaymentRequirements): boolean {
  return (
    requirement.scheme === "exact" &&
    requirement.network === CELO_NETWORK &&
    requirement.asset.toLowerCase() === CELO_USDC.toLowerCase() &&
    requirement.extra.name === "USDC" &&
    requirement.extra.version === "2" &&
    isEvmAddress(requirement.payTo)
  );
}

function assertExpectedResource(
  paymentRequired: PaymentRequired,
  requestedUrl: URL,
): void {
  const resource = new URL(paymentRequired.resource.url);
  if (
    resource.protocol !== requestedUrl.protocol ||
    resource.hostname.toLowerCase() !== requestedUrl.hostname.toLowerCase() ||
    resource.port !== requestedUrl.port ||
    resource.pathname !== requestedUrl.pathname ||
    resource.search !== requestedUrl.search
  ) {
    throw new Error("402 resource does not match the requested URL");
  }
}

/**
 * Decode the protocol terms which are invariant for every PayCrawl payer.
 * Publisher approval deliberately happens after this step so an agent can
 * present the exact, validated payout terms before it persists consent.
 */
export function inspectPaymentRequired(
  paymentRequired: PaymentRequired,
  requestedUrl: URL,
): ValidatedQuote {
  if (paymentRequired.x402Version !== 2) {
    throw new Error("Only x402 v2 payments are accepted");
  }

  assertExpectedResource(paymentRequired, requestedUrl);
  const allowed = paymentRequired.accepts.filter((requirement) =>
    isExpectedRequirement(requirement),
  );

  // A single unambiguous Celo USDC option is required. This avoids silently
  // selecting an unexpected payment route from a multi-option challenge.
  if (allowed.length !== 1) {
    throw new Error(
      "402 challenge does not contain exactly one Celo USDC payment option",
    );
  }

  const requirements = allowed[0];
  if (!requirements) {
    throw new Error("402 challenge has no approved payment option");
  }

  return { requirements, amountAtomic: parseUsdcAtomic(requirements.amount) };
}

/** Decode a 402 and reject every payment term outside the approved policy. */
export function validatePaymentRequired(
  paymentRequired: PaymentRequired,
  requestedUrl: URL,
  payoutAllowlist: Set<string>,
): ValidatedQuote {
  const quote = inspectPaymentRequired(paymentRequired, requestedUrl);
  if (!payoutAllowlist.has(normalizeAddress(quote.requirements.payTo))) {
    throw new Error("402 payout address is not approved by the local policy");
  }
  return quote;
}

function parseUsdcAtomic(amount: string): bigint {
  if (!/^[1-9]\d*$/.test(amount)) {
    throw new Error("402 quote must use a positive atomic USDC amount");
  }
  return BigInt(amount);
}

export function validateAndReservePayment(
  paymentRequired: PaymentRequired,
  requestedUrl: URL,
  payoutAllowlist: Set<string>,
  budget: SpendBudget,
): PaymentRequirements {
  const quote = validatePaymentRequired(
    paymentRequired,
    requestedUrl,
    payoutAllowlist,
  );
  budget.reserve(quote.amountAtomic);
  return quote.requirements;
}

// Kept as a public conversion boundary for callers that work with human USDC.
export { parseUsdc };
