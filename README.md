# PayCrawl

> Turn block-or-scrape into pay-per-crawl.

PayCrawl is a Cloudflare edge gateway that lets a publisher offer paid, machine-readable content to AI agents over x402. An agent receives a 402 quote, signs a bounded Celo USDC authorization, and gets the origin response plus an on-chain receipt only after the origin succeeds.

```text
Agent GET /agent/page/*
  → x402 v2 402 challenge
  → signed Celo USDC authorization
  → gateway verifies authorization
  → locked publisher origin returns 2xx content
  → facilitator settles on Celo mainnet
  → content + PAYMENT-RESPONSE receipt
```

The product and hackathon requirements are preserved in [SPEC.md](./SPEC.md). Registration information is intentionally kept in [REGISTRATION.md](./REGISTRATION.md), with no private keys or origin secrets.

## Workspace

```text
apps/gateway  Hono Cloudflare Worker, queued D1 receipt analytics, secure paid proxy
apps/web      Next.js product site, validated public metrics console
apps/agent    Node CLI with pre-sign Celo USDC budget enforcement
packages/shared  Config schemas, protocol constants, receipt and metrics types
```

## Local development

Requires Node 22+ and pnpm 10.

```bash
pnpm install
pnpm check
pnpm build
```

`pnpm check` type-checks, lints, and runs the focused security, configuration, redirect, challenge-policy, and budget tests.

## Deploy a publisher gateway

Each publisher deploys their own Worker, D1 database, Cloudflare Queue, origin token, analytics HMAC key, and Celo payout address. There is no shared proxy and no PayCrawl custody. The Worker deliberately has no deployable default configuration.

1. Authenticate with Cloudflare, then create the data resources. Copy the reported D1 ID into `database_id` in [apps/gateway/wrangler.jsonc](./apps/gateway/wrangler.jsonc).

```bash
pnpm --filter @paycrawl/gateway exec wrangler login
pnpm --filter @paycrawl/gateway exec wrangler d1 create paycrawl-analytics
pnpm --filter @paycrawl/gateway exec wrangler queues create paycrawl-settlements
pnpm --filter @paycrawl/gateway exec wrangler queues create paycrawl-settlements-dlq
```

2. Copy [apps/gateway/.dev.vars.example](./apps/gateway/.dev.vars.example) to an uncommitted `.dev.vars`. Generate two independent secrets with `openssl rand -hex 32`; replace the sample origin, non-zero payout address, and JSON route policy. Keep both values out of the origin's logs and source control.

3. Configure the publisher origin to reject any request without the exact `X-PayCrawl-Origin-Token` secret header. It must serve `HEAD {originBaseUrl}{originHealthPath}` as an authenticated, redirect-free `204 No Content`. The default health path is `/healthz`; for `originBaseUrl: "https://publisher.example/content"`, the Worker checks `https://publisher.example/content/healthz`.

4. Store all three runtime values as Worker secrets, apply the migration, and deploy:

```bash
pnpm --filter @paycrawl/gateway exec wrangler secret put ORIGIN_TOKEN
pnpm --filter @paycrawl/gateway exec wrangler secret put ANALYTICS_HMAC_KEY
pnpm --filter @paycrawl/gateway exec wrangler secret put GATEWAY_CONFIG
pnpm --filter @paycrawl/gateway exec wrangler d1 migrations apply paycrawl-analytics --remote
pnpm --filter @paycrawl/gateway deploy
```

The Worker configuration must have this shape:

```ts
type GatewayConfig = {
  originBaseUrl: string;
  originHealthPath: string; // default: "/healthz"; must return authenticated 204
  payTo: `0x${string}`;
  protectedRoutes: Array<{
    pattern: string;
    amountAtomic: string;
  }>;
  facilitatorUrl: "https://api.x402.celo.org";
  network: "eip155:42220";
};
```

Default route prices are atomic USDC (six decimals):

| Route             | Atomic USDC |    USDC |
| ----------------- | ----------: | ------: |
| `/agent/page/*`   |      `1000` | `0.001` |
| `/agent/feed/*`   |     `10000` |  `0.01` |
| `/agent/export/*` |    `100000` |  `0.10` |

The configuration schema rejects a route above `1000000000` atomic units (1,000 USDC). Agents should still set a lower local per-request budget.

## Gateway behavior and security

- Accepts only `GET` and content-free `HEAD` requests on `/agent/*`.
- Uses x402 v2 `exact` payments on Celo (`eip155:42220`) with explicit native Celo USDC `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` amounts and `{ name: "USDC", version: "2" }` metadata.
- Verifies before origin access; settles only a successful `GET` origin response. Origin errors, unsafe redirects, and handler failures cancel the verified authorization rather than settling it.
- Locks the proxy to one HTTPS DNS origin and rejects localhost, literal IPs, cross-host redirects, traversal, credentials, unsafe health paths, and redirects that escape the configured origin base path.
- Forwards no cookies, authorization, payment, forwarding, or hop-by-hop headers to the origin. Paid responses are always `Cache-Control: private, no-store`.
- Applies a 12-second origin timeout and a 4 MiB origin-response ceiling; the CLI separately caps fetched responses at 2 MiB by default.
- Queues settlement analytics outside the payment path, retries D1 writes, retains data for 90 days, and places exhausted queue messages in `paycrawl-settlements-dlq` for operator review.
- Stores only successful transaction hash, keyed payer HMAC, amount, route category, latency, and timestamp in D1. Public stats omit raw payer addresses, private paths, signatures, private URLs, and content.
- Caches `/health` and `/api/stats` for 15 seconds to limit public-endpoint amplification. Add Cloudflare WAF rate-limit rules for these paths and alert on the dead-letter queue before enabling a public custom domain.
- Emits redacted JSON Worker-log events for cache failures, canceled-payment telemetry failures, queue retries, invalid queue messages, and retention-prune failures. Alert on `settlement_analytics_delivery_failed`, repeated `settlement_analytics_retry_scheduled`, and the dead-letter queue; events intentionally exclude secrets, signatures, payer addresses, full paths, and origin URLs.

Free endpoints:

```text
GET /.well-known/paycrawl.json
GET /health
GET /api/stats
```

## Crawl as an agent

Create an uncommitted local environment file from [apps/agent/.env.example](./apps/agent/.env.example). It must contain the payer key and a comma-separated allowlist of publisher payout addresses. The key is never accepted as a command-line option.

```bash
pnpm crawl \
  --url https://gateway.example/agent/page/article-1 \
  --max-requests 100 \
  --max-total-usdc 0.10 \
  --concurrency 1
```

For a stricter per-request policy, add `--max-per-request-usdc 0.001`.

Before signing, the CLI decodes the actual 402 and requires exactly one approved payment option: x402 v2, Celo mainnet, the expected native USDC contract, USDC v2 metadata, and a locally configured `payTo`. It reserves the quote against the total budget before signing. It retries only unsigned challenge network requests; a signed request with an ambiguous network result is deliberately not retried.

## Web console

Set `PAYCRAWL_GATEWAY_URL` in [apps/web/.env.example](./apps/web/.env.example), then run:

```bash
pnpm --filter @paycrawl/web dev
```

The site proxies `GET /api/stats` server-side, accepts only a validated HTTPS public-host target, imposes an 8-second / 64 KiB upstream cap, validates the versioned response schema, and refreshes public telemetry every 30 seconds. Until a real gateway URL is configured, it explicitly shows telemetry as unavailable rather than presenting invented metrics.

## Production acceptance checklist

Run these checks against the actual custom domain before announcing a public launch:

1. `GET /.well-known/paycrawl.json` returns the intended non-zero `payTo`, route prices, Celo network, and USDC address.
2. `GET /health` returns `200` only while the facilitator is available and the authenticated origin health endpoint returns exactly `204`; induce an origin `401` or `404` and confirm `/health` becomes `503` after its 15-second cache window.
3. An unsigned protected request returns one strict x402 v2 Celo-USDC challenge. An invalid or replayed signed request returns no origin content and creates no settlement.
4. A funded, separately held Celo mainnet agent completes one allowed route. Confirm the `PAYMENT-RESPONSE` receipt on Celoscan, publisher receipt, D1 aggregate, and `/api/stats` without exposing a payer address or full content path.
5. Confirm origin redirects cannot leave the configured base path, a response larger than 4 MiB is rejected, and a stale or invalid `PAYCRAWL_GATEWAY_URL` makes the web console show an unavailable state.
6. Enable Cloudflare WAF rate limits for `/health` and `/api/stats`, monitor Worker errors and `paycrawl-settlements-dlq`, and rotate both secrets after any suspected exposure.

The repository contains no Cloudflare account, origin, DNS zone, or funded test-agent wallet; those publisher-controlled resources are required for the final live acceptance run and are intentionally not committed.
