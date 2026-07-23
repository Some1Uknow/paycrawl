import { describe, expect, it } from "vitest";

import { fetchProtectedOrigin, probeOrigin } from "../src/proxy.js";

const config = {
  originBaseUrl: "https://publisher.example",
  originHealthPath: "/healthz",
  payTo: "0x5287c8e5017edeec5f733fa926676c21ffcb8b65",
  protectedRoutes: [{ pattern: "/agent/page/*", amountAtomic: "1000" }],
  facilitatorUrl: "https://api.x402.celo.org" as const,
  network: "eip155:42220" as const,
};
const originFixtureValue = [
  "amber",
  "cedar",
  "dawn",
  "frost",
  "garden",
  "harbor",
].join("-");

describe("fixed-origin redirects", () => {
  it("follows a same-origin redirect", async () => {
    let calls = 0;
    const result = await fetchProtectedOrigin(
      new Request("https://gateway.example/agent/page/article-1"),
      config,
      originFixtureValue,
      async () => {
        calls += 1;
        return calls === 1
          ? new Response(null, {
              status: 302,
              headers: { Location: "/agent/page/article-2" },
            })
          : new Response("article", { status: 200 });
      },
    );

    expect(calls).toBe(2);
    expect(await result.text()).toBe("article");
  });

  it("fails closed on a cross-origin redirect", async () => {
    await expect(
      fetchProtectedOrigin(
        new Request("https://gateway.example/agent/page/article-1"),
        config,
        originFixtureValue,
        async () =>
          new Response(null, {
            status: 302,
            headers: { Location: "https://evil.example/" },
          }),
      ),
    ).rejects.toThrow();
  });

  it("fails closed on traversal in an otherwise same-origin redirect", async () => {
    await expect(
      fetchProtectedOrigin(
        new Request("https://gateway.example/agent/page/article-1"),
        config,
        originFixtureValue,
        async () =>
          new Response(null, {
            status: 302,
            headers: { Location: "/agent/page/../private" },
          }),
      ),
    ).rejects.toThrow(/unsafe redirect path/);
  });

  it("fails closed when a redirect escapes a non-root origin base path", async () => {
    await expect(
      fetchProtectedOrigin(
        new Request("https://gateway.example/agent/page/article-1"),
        { ...config, originBaseUrl: "https://publisher.example/content" },
        originFixtureValue,
        async () =>
          new Response(null, {
            status: 302,
            headers: { Location: "/admin/private" },
          }),
      ),
    ).rejects.toThrow(/protected origin path/);
  });

  it("rejects an origin response declared above the byte ceiling", async () => {
    await expect(
      fetchProtectedOrigin(
        new Request("https://gateway.example/agent/page/article-1"),
        config,
        originFixtureValue,
        async () =>
          new Response(null, {
            status: 200,
            headers: { "Content-Length": "4194305" },
          }),
      ),
    ).rejects.toThrow(/maximum allowed size/);
  });
});

describe("origin health", () => {
  it("requires the dedicated authenticated health endpoint to return 204", async () => {
    await expect(
      probeOrigin(
        config,
        originFixtureValue,
        async () => new Response(null, { status: 204 }),
      ),
    ).resolves.toBe(true);
    await expect(
      probeOrigin(
        config,
        originFixtureValue,
        async () => new Response(null, { status: 401 }),
      ),
    ).resolves.toBe(false);
    await expect(
      probeOrigin(
        config,
        originFixtureValue,
        async () => new Response(null, { status: 403 }),
      ),
    ).resolves.toBe(false);
    await expect(
      probeOrigin(
        config,
        originFixtureValue,
        async () => new Response(null, { status: 404 }),
      ),
    ).resolves.toBe(false);
  });

  it("keeps the health probe under a configured non-root base path", async () => {
    let seenRequest: Request | undefined;
    await expect(
      probeOrigin(
        { ...config, originBaseUrl: "https://publisher.example/content" },
        originFixtureValue,
        async (input, init) => {
          seenRequest = new Request(input, init);
          return new Response(null, { status: 204 });
        },
      ),
    ).resolves.toBe(true);

    expect(seenRequest?.url).toBe("https://publisher.example/content/healthz");
    expect(seenRequest?.method).toBe("HEAD");
    expect(seenRequest?.headers.get("x-paycrawl-origin-token")).toBe(
      originFixtureValue,
    );
  });
});
