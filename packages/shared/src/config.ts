import { z } from "zod";

import {
  CELO_NETWORK,
  CELO_USDC,
  DEFAULT_ROUTE_PRICES,
  FACILITATOR_URL,
  PROTECTED_ROUTE_PREFIXES,
} from "./constants";

export const ZERO_EVM_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;
// A publisher can price an export meaningfully without exposing an agent to a
// typo-sized authorization. 1,000 USDC is the hard per-request ceiling.
const MAX_ROUTE_AMOUNT_ATOMIC = 1_000_000_000n;

const evmAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Expected a 20-byte EVM address")
  .refine(
    (value) => value.toLowerCase() !== ZERO_EVM_ADDRESS,
    "The zero address cannot receive payments",
  );

export function isForbiddenPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
    host.includes(":")
  );
}

function hasUnsafeUrlPath(pathname: string): boolean {
  if (pathname.startsWith("//") || /%2f|%5c/i.test(pathname)) return true;
  try {
    const decoded = decodeURIComponent(pathname);
    return (
      decoded.includes("\\") ||
      decoded.includes("\u0000") ||
      decoded.split("/").includes("..")
    );
  } catch {
    return true;
  }
}

const httpsOrigin = z
  .string()
  .url()
  .transform((value) => new URL(value))
  .superRefine((url, context) => {
    if (url.protocol !== "https:") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "originBaseUrl must use HTTPS",
      });
    }
    if (url.username || url.password || url.search || url.hash) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "originBaseUrl must not include credentials, query, or fragment",
      });
    }
    if (isForbiddenPublicHostname(url.hostname)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "originBaseUrl must use a public DNS hostname, not localhost or an IP address",
      });
    }
    if (hasUnsafeUrlPath(url.pathname)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "originBaseUrl must not include traversal or encoded separators",
      });
    }
  })
  .transform((url) => url.toString().replace(/\/$/, ""));

const protectedRouteSchema = z
  .object({
    pattern: z
      .string()
      .refine(
        (value) =>
          PROTECTED_ROUTE_PREFIXES.some((prefix) => value.startsWith(prefix)),
        "pattern must be below /agent/page/, /agent/feed/, or /agent/export/",
      )
      .refine(
        (value) =>
          value.endsWith("*") && value.indexOf("*") === value.length - 1,
        "pattern must contain one trailing *",
      )
      .refine(
        (value) => !hasUnsafeUrlPath(value),
        "pattern must not contain traversal or encoded separators",
      ),
    amountAtomic: z
      .string()
      .regex(/^[1-9]\d*$/, "amountAtomic must be a positive atomic USDC value")
      .refine(
        (value) => BigInt(value) <= MAX_ROUTE_AMOUNT_ATOMIC,
        `amountAtomic must not exceed ${MAX_ROUTE_AMOUNT_ATOMIC.toString()}`,
      ),
  })
  .strict();

const originHealthPath = z
  .string()
  .regex(/^\/(?!\/)/, "originHealthPath must start with one /")
  .refine(
    (value) =>
      !hasUnsafeUrlPath(value) &&
      !value.includes("?") &&
      !value.includes("#") &&
      !value.includes("\u0000"),
    "originHealthPath must not contain traversal, query, fragment, or encoded separators",
  )
  .default("/healthz");

export const gatewayConfigSchema = z
  .object({
    originBaseUrl: httpsOrigin,
    originHealthPath,
    payTo: evmAddress,
    protectedRoutes: z
      .array(protectedRouteSchema)
      .min(1)
      .superRefine((routes, context) => {
        const seen = new Set<string>();
        routes.forEach((route, index) => {
          if (seen.has(route.pattern)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: "protected route patterns must be unique",
              path: [index, "pattern"],
            });
          }
          seen.add(route.pattern);
        });
      }),
    facilitatorUrl: z.literal(FACILITATOR_URL),
    network: z.literal(CELO_NETWORK),
  })
  .strict();

export type GatewayConfig = z.infer<typeof gatewayConfigSchema>;
export type ProtectedRoute = GatewayConfig["protectedRoutes"][number];

export const gatewayConfigExample = {
  originBaseUrl: "https://publisher.example",
  originHealthPath: "/healthz",
  payTo: "0x1111111111111111111111111111111111111111",
  protectedRoutes: Object.entries(DEFAULT_ROUTE_PRICES).map(
    ([pattern, amountAtomic]) => ({
      pattern,
      amountAtomic,
    }),
  ),
  facilitatorUrl: FACILITATOR_URL,
  network: CELO_NETWORK,
} satisfies GatewayConfig;

export function parseGatewayConfig(raw: string): GatewayConfig {
  return gatewayConfigSchema.parse(JSON.parse(raw));
}

export function isEvmAddress(value: string): value is `0x${string}` {
  return evmAddress.safeParse(value).success;
}

export const celoPaymentAsset = {
  address: CELO_USDC,
  amount: "0",
  extra: {
    name: "USDC",
    version: "2",
  },
} as const;
