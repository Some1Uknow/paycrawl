import { describe, expect, it } from "vitest";

import {
  assertAllowedOriginUrl,
  assertSafeOriginBaseUrl,
  assertStrongSecret,
  buildOriginRequestHeaders,
  buildOriginUrl,
  sanitizeOriginResponseHeaders,
} from "../src/security.js";

describe("origin lock", () => {
  it("builds paths under the configured HTTPS origin", () => {
    expect(
      buildOriginUrl(
        "https://publisher.example/content",
        "/agent/page/article-1",
        "?lang=en",
      ).toString(),
    ).toBe("https://publisher.example/content/agent/page/article-1?lang=en");
  });

  it("rejects localhost, literal IPs, and cross-host redirects", () => {
    expect(() => assertSafeOriginBaseUrl("http://publisher.example")).toThrow();
    expect(() => assertSafeOriginBaseUrl("https://127.0.0.1")).toThrow();
    const allowed = assertSafeOriginBaseUrl("https://publisher.example");
    expect(() =>
      assertAllowedOriginUrl(new URL("https://other.example/article"), allowed),
    ).toThrow();
  });

  it("rejects missing, weak, and placeholder origin secrets", () => {
    expect(() => assertStrongSecret(undefined, "ORIGIN_TOKEN")).toThrow();
    expect(() => assertStrongSecret("undefined", "ORIGIN_TOKEN")).toThrow();
    expect(() => assertStrongSecret("short", "ORIGIN_TOKEN")).toThrow();
    expect(() => assertStrongSecret("o".repeat(40), "ORIGIN_TOKEN")).toThrow();
    expect(() =>
      assertStrongSecret(
        "0123456789abcdef0123456789abcdef0123456789abcdef",
        "ORIGIN_TOKEN",
      ),
    ).not.toThrow();
  });
});

describe("origin headers", () => {
  it("forwards only allowlisted request headers and injects the origin token", () => {
    const requestHeaders = new Headers({
      Accept: "text/html",
      Authorization: "Bearer hidden",
      Cookie: "session=hidden",
      "Payment-Signature": "hidden",
      "X-Forwarded-For": "203.0.113.1",
    });
    const originToken = "0123456789abcdef0123456789abcdef0123456789abcdef";
    const headers = buildOriginRequestHeaders(requestHeaders, originToken);

    expect(headers.get("accept")).toBe("text/html");
    expect(headers.get("x-paycrawl-origin-token")).toBe(originToken);
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("payment-signature")).toBeNull();
    expect(headers.get("x-forwarded-for")).toBeNull();
  });

  it("removes unsafe origin response headers and prevents caching", () => {
    const headers = sanitizeOriginResponseHeaders(
      new Headers({
        "Content-Type": "text/html",
        "Set-Cookie": "session=hidden",
        Connection: "keep-alive",
        "X-PayCrawl-Origin-Token": "hidden",
      }),
    );

    expect(headers.get("content-type")).toBe("text/html");
    expect(headers.get("set-cookie")).toBeNull();
    expect(headers.get("connection")).toBeNull();
    expect(headers.get("x-paycrawl-origin-token")).toBeNull();
    expect(headers.get("cache-control")).toBe("private, no-store");
    expect(headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(headers.get("cross-origin-resource-policy")).toBe("same-origin");
  });
});
