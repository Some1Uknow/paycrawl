import { describe, expect, it } from "vitest";

import {
  gatewayConfigSchema,
  normalizeProtectedPath,
  pathMatchesPattern,
} from "../src/index.js";

const validConfig = {
  originBaseUrl: "https://publisher.example/content",
  payTo: "0x5287c8e5017edeec5f733fa926676c21ffcb8b65",
  protectedRoutes: [
    { pattern: "/agent/page/*", amountAtomic: "1000" },
    { pattern: "/agent/feed/*", amountAtomic: "10000" },
    { pattern: "/agent/export/*", amountAtomic: "100000" },
  ],
  facilitatorUrl: "https://api.x402.celo.org",
  network: "eip155:42220",
};

describe("gateway configuration", () => {
  it("accepts explicit atomic Celo route prices", () => {
    expect(gatewayConfigSchema.parse(validConfig)).toMatchObject(validConfig);
  });

  it("rejects a non-HTTPS origin and invalid atomic price", () => {
    expect(() =>
      gatewayConfigSchema.parse({
        ...validConfig,
        originBaseUrl: "http://publisher.example",
      }),
    ).toThrow();
    expect(() =>
      gatewayConfigSchema.parse({
        ...validConfig,
        originBaseUrl: "https://127.0.0.1",
      }),
    ).toThrow();
    expect(() =>
      gatewayConfigSchema.parse({
        ...validConfig,
        originBaseUrl: "https://publisher.example/content%2fprivate",
      }),
    ).toThrow(/encoded separators/);
    expect(() =>
      gatewayConfigSchema.parse({
        ...validConfig,
        originHealthPath: "//healthz",
      }),
    ).toThrow(/start with one/);
    expect(() =>
      gatewayConfigSchema.parse({
        ...validConfig,
        originHealthPath: "/%2e%2e/private",
      }),
    ).toThrow();
    expect(() =>
      gatewayConfigSchema.parse({
        ...validConfig,
        protectedRoutes: [{ pattern: "/agent/page/*", amountAtomic: "0.001" }],
      }),
    ).toThrow();
    expect(() =>
      gatewayConfigSchema.parse({
        ...validConfig,
        protectedRoutes: [
          { pattern: "/agent/page/*", amountAtomic: "1000" },
          { pattern: "/agent/page/*", amountAtomic: "1000" },
        ],
      }),
    ).toThrow(/unique/);
    expect(() =>
      gatewayConfigSchema.parse({
        ...validConfig,
        payTo: "0x0000000000000000000000000000000000000000",
      }),
    ).toThrow(/zero address/);
    expect(() =>
      gatewayConfigSchema.parse({
        ...validConfig,
        protectedRoutes: [
          { pattern: "/agent/page/*", amountAtomic: "1000000000000001" },
        ],
      }),
    ).toThrow(/must not exceed/);
  });
});

describe("protected path normalization", () => {
  it("normalizes safe protected paths", () => {
    expect(normalizeProtectedPath("/agent/page/article-1")).toBe(
      "/agent/page/article-1",
    );
    expect(normalizeProtectedPath("/agent/feed//today.xml")).toBe(
      "/agent/feed/today.xml",
    );
  });

  it("rejects traversal and encoded separators", () => {
    expect(normalizeProtectedPath("/agent/page/../admin")).toBeNull();
    expect(normalizeProtectedPath("/agent/page/a%2Fb")).toBeNull();
    expect(normalizeProtectedPath("/private/article")).toBeNull();
  });

  it("matches a configured wildcard without broadening it", () => {
    expect(pathMatchesPattern("/agent/page/article-1", "/agent/page/*")).toBe(
      true,
    );
    expect(pathMatchesPattern("/agent/feed/today", "/agent/page/*")).toBe(
      false,
    );
  });
});
