import { timingSafeEqual } from "node:crypto";

const MIN_ORIGIN_TOKEN_LENGTH = 32;

function configuredOriginToken(): string | null {
  const token = process.env.PAYCRAWL_DEMO_ORIGIN_TOKEN?.trim();
  return token && token.length >= MIN_ORIGIN_TOKEN_LENGTH ? token : null;
}

/**
 * The hosted demo origin is intentionally inert until its server-only token is
 * configured. The Worker supplies this header only after payment verification.
 */
export function hasValidDemoOriginToken(headers: Headers): boolean {
  const expected = configuredOriginToken();
  const received = headers.get("x-paycrawl-origin-token");
  if (!expected || !received) return false;

  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

export function unauthorizedOriginResponse(): Response {
  return new Response(null, {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Bearer realm="PayCrawl demo origin"',
    },
  });
}
