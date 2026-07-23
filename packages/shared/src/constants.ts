/** Celo mainnet in CAIP-2 form, as required by x402 v2. */
export const CELO_NETWORK = "eip155:42220" as const;

/** Native USDC on Celo mainnet. Values are atomic (6 decimal places). */
export const CELO_USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as const;

export const FACILITATOR_URL = "https://api.x402.celo.org" as const;

export const PAYMENT_SCHEME = "exact" as const;
export const X402_VERSION = 2 as const;

export const PROTECTED_ROUTE_PREFIXES = [
  "/agent/page/",
  "/agent/feed/",
  "/agent/export/",
] as const;

export const DEFAULT_ROUTE_PRICES = {
  "/agent/page/*": "1000",
  "/agent/feed/*": "10000",
  "/agent/export/*": "100000",
} as const;

export const ATOMIC_USDC_DECIMALS = 6;
