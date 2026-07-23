import {
  isForbiddenPublicHostname,
  normalizeProtectedPath,
} from "@paycrawl/shared";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const BLOCKED_RESPONSE_HEADERS = new Set([
  ...HOP_BY_HOP_HEADERS,
  "set-cookie",
  "set-cookie2",
  "x-paycrawl-origin-token",
]);

const SAFE_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "user-agent",
] as const;
const MIN_SECRET_LENGTH = 32;
const FORBIDDEN_SECRET_VALUES = new Set(["undefined", "null", "changeme"]);
const PLACEHOLDER_MARKERS = [
  "replace",
  "placeholder",
  "example",
  "set-me",
  "your-",
];

export const INTERNAL_LATENCY_HEADER = "x-paycrawl-internal-latency";

export class UnsafeOriginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeOriginError";
  }
}

function hasUnsafeOriginPath(pathname: string): boolean {
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

function assertSafeOriginHealthPath(healthPath: string): void {
  if (
    !healthPath.startsWith("/") ||
    healthPath.startsWith("//") ||
    healthPath.includes("?") ||
    healthPath.includes("#") ||
    hasUnsafeOriginPath(healthPath)
  ) {
    throw new UnsafeOriginError("Origin health path is not safe");
  }
}

export function assertStrongSecret(
  value: unknown,
  label: string,
): asserts value is string {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase() : "";
  const uniqueCharacters = new Set(normalized).size;
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    normalized.length < MIN_SECRET_LENGTH ||
    uniqueCharacters < 8 ||
    FORBIDDEN_SECRET_VALUES.has(normalized) ||
    PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker))
  ) {
    throw new UnsafeOriginError(
      `${label} must be a non-placeholder, high-entropy secret of at least ${MIN_SECRET_LENGTH} characters`,
    );
  }
}

export function isForbiddenOriginHost(hostname: string): boolean {
  return isForbiddenPublicHostname(hostname);
}

export function assertSafeOriginBaseUrl(originBaseUrl: string): URL {
  const origin = new URL(originBaseUrl);
  if (
    origin.protocol !== "https:" ||
    isForbiddenOriginHost(origin.hostname) ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    hasUnsafeOriginPath(origin.pathname)
  ) {
    throw new UnsafeOriginError(
      "The configured origin is not an allowed HTTPS hostname",
    );
  }
  return origin;
}

export function buildOriginUrl(
  originBaseUrl: string,
  path: string,
  search: string,
): URL {
  const normalizedPath = normalizeProtectedPath(path);
  if (!normalizedPath) {
    throw new UnsafeOriginError(
      "The requested path is not a valid protected path",
    );
  }

  const origin = assertSafeOriginBaseUrl(originBaseUrl);
  const basePath = origin.pathname.replace(/\/$/, "");
  const target = new URL(origin.origin);
  target.pathname = `${basePath}${normalizedPath}`;
  target.search = search;

  return assertAllowedOriginUrl(target, origin);
}

export function buildOriginHealthUrl(
  originBaseUrl: string,
  healthPath: string,
): URL {
  const origin = assertSafeOriginBaseUrl(originBaseUrl);
  assertSafeOriginHealthPath(healthPath);
  const basePath = origin.pathname.replace(/\/$/, "");
  const target = new URL(origin.origin);
  target.pathname = `${basePath}${healthPath}`;

  if (!target.pathname.startsWith(basePath || "/")) {
    throw new UnsafeOriginError(
      "Origin health path is outside the configured origin base path",
    );
  }

  return target;
}

export function assertAllowedOriginUrl(
  candidate: URL,
  allowedOrigin: URL,
): URL {
  const basePath =
    allowedOrigin.pathname === "/"
      ? ""
      : allowedOrigin.pathname.replace(/\/$/, "");
  const relativePath = basePath
    ? candidate.pathname.slice(basePath.length) || "/"
    : candidate.pathname;

  if (
    candidate.protocol !== "https:" ||
    isForbiddenOriginHost(candidate.hostname) ||
    candidate.hostname.toLowerCase() !== allowedOrigin.hostname.toLowerCase() ||
    candidate.port !== allowedOrigin.port ||
    candidate.username ||
    candidate.password ||
    (basePath && !candidate.pathname.startsWith(`${basePath}/`)) ||
    !normalizeProtectedPath(relativePath)
  ) {
    throw new UnsafeOriginError(
      "Origin redirect is outside the configured protected origin path",
    );
  }

  return candidate;
}

export function buildOriginRequestHeaders(
  requestHeaders: Headers,
  originToken: string,
): Headers {
  assertStrongSecret(originToken, "ORIGIN_TOKEN");
  const headers = new Headers();

  for (const name of SAFE_REQUEST_HEADERS) {
    const value = requestHeaders.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  headers.set("X-PayCrawl-Origin-Token", originToken);
  headers.set("X-PayCrawl-Request-Id", crypto.randomUUID());
  return headers;
}

export function sanitizeOriginResponseHeaders(originHeaders: Headers): Headers {
  const headers = new Headers();

  for (const [name, value] of originHeaders) {
    if (!BLOCKED_RESPONSE_HEADERS.has(name.toLowerCase())) {
      headers.set(name, value);
    }
  }

  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  );
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  return headers;
}

export function isHopByHopHeader(name: string): boolean {
  return HOP_BY_HOP_HEADERS.has(name.toLowerCase());
}
