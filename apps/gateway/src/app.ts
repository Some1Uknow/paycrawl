import {
  CELO_NETWORK,
  CELO_USDC,
  FACILITATOR_URL,
  normalizeProtectedPath,
  parseGatewayConfig,
  pathMatchesPattern,
  type GatewayConfig,
  type ProtectedRoute,
} from "@paycrawl/shared";
import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
  type FacilitatorClient,
  type HTTPTransportContext,
  type RoutesConfig,
} from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddlewareFromHTTPServer } from "@x402/hono";
import { Hono } from "hono";

import {
  getPublicMetrics,
  hashPayer,
  recordCanceledVerifiedPayment,
  recordSettlement,
  routeKindFromPath,
  routePatternFromPath,
} from "./analytics.js";
import type { GatewayBindings, GatewayVariables } from "./bindings.js";
import { logGatewayEvent } from "./observability.js";
import { fetchProtectedOrigin, probeOrigin } from "./proxy.js";
import {
  assertStrongSecret,
  INTERNAL_LATENCY_HEADER,
  sanitizeOriginResponseHeaders,
} from "./security.js";

type GatewayApp = Hono<{
  Bindings: GatewayBindings;
  Variables: GatewayVariables;
}>;

export type GatewayDependencies = {
  facilitator?: FacilitatorClient;
  fetchImpl?: typeof fetch;
  cache?: Cache;
};

const HEALTH_CACHE_TTL_SECONDS = 15;
const STATS_CACHE_TTL_SECONDS = 15;
const publicEndpointInFlight = new Map<string, Promise<Response>>();

function matchingRoute(
  pathname: string,
  config: GatewayConfig,
): ProtectedRoute | undefined {
  return [...config.protectedRoutes]
    .sort((left, right) => right.pattern.length - left.pattern.length)
    .find((route) => pathMatchesPattern(pathname, route.pattern));
}

function routesFromConfig(config: GatewayConfig): RoutesConfig {
  return Object.fromEntries(
    [...config.protectedRoutes]
      .sort((left, right) => right.pattern.length - left.pattern.length)
      .map((route) => [
        `GET ${route.pattern}`,
        {
          accepts: [
            {
              scheme: "exact",
              payTo: config.payTo,
              network: CELO_NETWORK,
              price: {
                asset: CELO_USDC,
                amount: route.amountAtomic,
                extra: { name: "USDC", version: "2" },
              },
            },
          ],
          description: "Paid machine-readable publisher content via PayCrawl",
          mimeType: "text/html",
          serviceName: "PayCrawl",
        },
      ]),
  );
}

function numberHeader(
  headers: Record<string, string> | undefined,
  name: string,
): number {
  const value = Object.entries(headers ?? {}).find(
    ([key]) => key.toLowerCase() === name,
  )?.[1];
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

function headerHasStatusSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

function securityHeaders(cacheControl: string): Record<string, string> {
  return {
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy":
      "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}

function noStore(response: Response): Response {
  for (const [name, value] of Object.entries(
    securityHeaders("private, no-store"),
  )) {
    response.headers.set(name, value);
  }
  return response;
}

function publicJsonHeaders(maxAgeSeconds: number): Record<string, string> {
  return securityHeaders(
    `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}`,
  );
}

function defaultCache(): Cache | undefined {
  return typeof caches === "undefined" ? undefined : caches.default;
}

function cacheKey(name: string, config: GatewayConfig): Request {
  const scope = encodeURIComponent(
    `${config.payTo.toLowerCase()}|${config.originBaseUrl}|${config.originHealthPath}`,
  );
  return new Request(`https://paycrawl-cache.invalid/${name}?scope=${scope}`);
}

async function readOrWritePublicCache(
  cache: Cache | undefined,
  key: Request,
  response: () => Promise<Response>,
): Promise<Response> {
  if (cache) {
    try {
      const cached = await cache.match(key);
      if (cached) return cached;
    } catch {
      logGatewayEvent("public_endpoint_cache_read_failed");
    }
  }

  const existing = publicEndpointInFlight.get(key.url);
  if (existing) return (await existing).clone();

  const freshResponse = response();
  publicEndpointInFlight.set(key.url, freshResponse);
  try {
    const fresh = await freshResponse;
    if (cache) {
      try {
        await cache.put(key, fresh.clone());
      } catch {
        // The response is still safe to serve if the best-effort cache is unavailable.
        logGatewayEvent("public_endpoint_cache_write_failed");
      }
    }
    return fresh;
  } finally {
    publicEndpointInFlight.delete(key.url);
  }
}

export function createGateway(
  env: GatewayBindings,
  dependencies: GatewayDependencies = {},
): GatewayApp {
  assertStrongSecret(env.ORIGIN_TOKEN, "ORIGIN_TOKEN");
  assertStrongSecret(env.ANALYTICS_HMAC_KEY, "ANALYTICS_HMAC_KEY");
  const config = parseGatewayConfig(env.GATEWAY_CONFIG);
  const facilitator =
    dependencies.facilitator ??
    new HTTPFacilitatorClient({ url: FACILITATOR_URL });
  const cache = dependencies.cache ?? defaultCache();
  const resourceServer = new x402ResourceServer(facilitator).register(
    CELO_NETWORK,
    new ExactEvmScheme(),
  );

  resourceServer.onAfterSettle(async (context) => {
    const transport = context.transportContext as
      HTTPTransportContext | undefined;
    const normalizedPath = normalizeProtectedPath(
      transport?.request.path ?? "",
    );
    const payer = context.result.payer;
    const transactionHash = context.result.transaction;
    const routePattern = normalizedPath
      ? routePatternFromPath(normalizedPath)
      : null;

    if (!routePattern || !payer || !transactionHash) {
      return;
    }

    const record = {
      transactionHash: transactionHash as `0x${string}`,
      payerHash: await hashPayer(payer, env.ANALYTICS_HMAC_KEY),
      amountAtomic: context.result.amount ?? context.requirements.amount,
      routePattern,
      latencyMs: numberHeader(
        transport?.responseHeaders,
        INTERNAL_LATENCY_HEADER,
      ),
      settledAt: new Date().toISOString(),
    };

    try {
      await env.SETTLEMENT_QUEUE.send(record);
    } catch {
      try {
        await recordSettlement(env.ANALYTICS, record);
      } catch {
        // A receipt has settled on-chain even if both analytics paths are unavailable.
        // The public transaction hash is enough to reconcile later and does not expose a signature.
        logGatewayEvent("settlement_analytics_delivery_failed", {
          transactionHash,
        });
      }
    }
  });

  resourceServer.onVerifiedPaymentCanceled(async (context) => {
    const transport = context.transportContext as
      HTTPTransportContext | undefined;
    const path = transport?.request.path ?? "";
    try {
      await recordCanceledVerifiedPayment(
        env.ANALYTICS,
        routeKindFromPath(path),
        new Date().toISOString(),
      );
    } catch {
      logGatewayEvent("canceled_payment_analytics_write_failed", {
        routeKind: routeKindFromPath(path),
      });
    }
  });

  const paymentServer = new x402HTTPResourceServer(
    resourceServer,
    routesFromConfig(config),
  );
  const app: GatewayApp = new Hono();

  // This outer middleware runs after the x402 middleware, so it also protects
  // 402 and settlement-failure responses from intermediary caching.
  app.use("/agent/*", async (context, next) => {
    context.set("requestStartedAt", Date.now());
    await next();
    context.res.headers.delete(INTERNAL_LATENCY_HEADER);
    noStore(context.res);
  });

  // x402/Hono handles the strict v2 challenge, verification, cancellation when
  // an origin handler fails, successful settlement, and PAYMENT-RESPONSE header.
  app.use("/agent/*", paymentMiddlewareFromHTTPServer(paymentServer));

  app.get("/.well-known/paycrawl.json", (context) =>
    context.json(
      {
        name: "PayCrawl",
        version: 1,
        protocol: "x402",
        network: CELO_NETWORK,
        asset: CELO_USDC,
        facilitatorUrl: FACILITATOR_URL,
        endpoints: config.protectedRoutes.map((route) => ({
          pattern: route.pattern,
          amountAtomic: route.amountAtomic,
          scheme: "exact",
        })),
      },
      200,
      publicJsonHeaders(300),
    ),
  );

  app.get("/health", async (context) => {
    return readOrWritePublicCache(
      cache,
      cacheKey("health", config),
      async () => {
        const [facilitatorReady, originReady] = await Promise.all([
          facilitator
            .getSupported()
            .then((supported) =>
              supported.kinds.some(
                (kind) =>
                  kind.network === CELO_NETWORK &&
                  kind.scheme === "exact" &&
                  kind.x402Version === 2,
              ),
            )
            .catch(() => false),
          probeOrigin(config, env.ORIGIN_TOKEN, dependencies.fetchImpl),
        ]);

        return context.json(
          {
            status: facilitatorReady && originReady ? "ok" : "degraded",
            facilitator: facilitatorReady ? "ready" : "unavailable",
            origin: originReady ? "ready" : "unavailable",
          },
          facilitatorReady && originReady ? 200 : 503,
          publicJsonHeaders(HEALTH_CACHE_TTL_SECONDS),
        );
      },
    );
  });

  app.get("/api/stats", async (context) => {
    return readOrWritePublicCache(
      cache,
      cacheKey("stats", config),
      async () => {
        const metrics = await getPublicMetrics(env.ANALYTICS);
        return context.json(
          metrics,
          200,
          publicJsonHeaders(STATS_CACHE_TTL_SECONDS),
        );
      },
    );
  });

  app.all("/agent/*", async (context) => {
    const method = context.req.method;
    if (method !== "GET" && method !== "HEAD") {
      context.header("Allow", "GET, HEAD");
      return context.json({ error: "Only GET and HEAD are permitted" }, 405);
    }

    const path = normalizeProtectedPath(new URL(context.req.url).pathname);
    if (!path || !matchingRoute(path, config)) {
      return context.json({ error: "Unknown protected route" }, 404);
    }

    // HEAD is deliberately payment-free and content-free. This permits agents
    // to probe availability without authorizing a settlement or receiving data.
    if (method === "HEAD") {
      return new Response(null, {
        status: 204,
        headers: {
          "Cache-Control": "private, no-store",
          "X-PayCrawl-Payment-Method": "GET",
        },
      });
    }

    let originResponse: Response;
    try {
      originResponse = await fetchProtectedOrigin(
        context.req.raw,
        config,
        env.ORIGIN_TOKEN,
        dependencies.fetchImpl,
      );
    } catch {
      return context.json({ error: "Publisher origin is unavailable" }, 502);
    }

    // Do not settle a payment when the origin declined, failed, or returned an
    // unexpected status. The x402 middleware cancels the verified payment.
    if (!headerHasStatusSuccess(originResponse.status)) {
      return context.json(
        { error: "Publisher origin did not return content" },
        502,
      );
    }

    const startedAt = context.get("requestStartedAt") ?? Date.now();
    const headers = sanitizeOriginResponseHeaders(originResponse.headers);
    headers.set(INTERNAL_LATENCY_HEADER, String(Date.now() - startedAt));
    return new Response(originResponse.body, {
      status: originResponse.status,
      headers,
    });
  });

  app.notFound((context) =>
    context.json({ error: "Not found" }, 404, publicJsonHeaders(0)),
  );
  app.onError((_error, context) =>
    context.json(
      { error: "Gateway error" },
      500,
      securityHeaders("private, no-store"),
    ),
  );

  return app;
}
