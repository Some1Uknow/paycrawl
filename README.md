# PayCrawl

> Paid content for AI agents.

PayCrawl lets a publisher put a price on machine-readable content. An AI agent
checks the price, pays in Celo USDC from its own wallet, and receives the
content with a payment receipt.

There is no reader checkout, shared wallet, or PayCrawl custody layer.

## Live project

- Gateway: <https://paycrawl-gateway.raghu250407.workers.dev>
- Payment manifest: <https://paycrawl-gateway.raghu250407.workers.dev/.well-known/paycrawl.json>
- Protected demo route: <https://paycrawl-gateway.raghu250407.workers.dev/agent/page/article-1>
- Live settlement telemetry: <https://paycrawl.vercel.app/api/stats>
- ERC-8004 agent identity: <https://8004scan.io/agents/celo/9746>
- Celo Builders attribution: `celo_468e1efe7287`

The live route charges `0.001 USDC` on Celo mainnet. An unsigned request gets
a standard x402 `402 Payment Required` challenge. A successful signed request
returns the protected response and a `PAYMENT-RESPONSE` receipt. The receipt
contains the Celo settlement transaction; the public telemetry lists completed
settlements without exposing payer addresses.

## What problem it solves

Publishers can block crawlers, but they cannot easily charge AI agents for
useful content. Agents can access APIs, but they need a safe way to make small,
bounded payments without a human checkout flow.

PayCrawl makes the HTTP request itself the purchase flow:

```text
agent requests protected content
  -> gateway returns a Celo USDC price
  -> agent checks its local policy and wallet balance
  -> agent signs one x402 payment authorization
  -> gateway delivers the content
  -> Celo facilitator settles the payment
  -> agent receives content and an on-chain receipt
```

The gateway settles only after the publisher origin returns a successful
response. A failed origin request does not unlock content or settle payment.

## Try it as an agent

Install the portable PayCrawl skill in a skill-aware agent project:

```bash
npx skills add Some1Uknow/paycrawl --skill paycrawl --agent '*' --yes --full-depth
```

Then give the agent a plain-language instruction:

```text
Use PayCrawl to crawl https://paycrawl-gateway.raghu250407.workers.dev/agent/page/article-1.
Use only Celo USDC. Ask me before approving a new publisher. Do not spend more
than 0.001 USDC on this request or 0.01 USDC in total. Return the content and
PAYMENT-RESPONSE receipt.
```

The agent discovers the manifest and quote, checks the network, USDC asset,
payout address, price, request limit, and total budget before it signs. It
stores an approved publisher origin and payout-address pair locally, so a
changed payout address always requires new approval.

### Agent wallet model

The agent owns the payer wallet. PayCrawl never receives a private key or
custodies funds.

The reference CLI creates a dedicated encrypted Celo wallet on first use and
reuses it later. On macOS, its passphrase is created or reused in Keychain. The
wallet file contains encrypted material only; the raw private key is never
printed or written to the repository. If the wallet needs funds, the agent asks
for one bounded Celo USDC top-up to its own address.

For agent-runtime developers, the reference client is available here:

```bash
git clone https://github.com/Some1Uknow/paycrawl.git
cd paycrawl
pnpm install
pnpm crawl \
  --url https://paycrawl-gateway.raghu250407.workers.dev/agent/page/article-1 \
  --max-requests 1 \
  --max-per-request-usdc 0.001 \
  --max-total-usdc 0.001 \
  --approve-publisher
```

Do not paste a private key, seed phrase, origin token, or facilitator key into
chat or source control.

## Publish a paid route

Publishers keep control of their content origin, Cloudflare account, route
prices, payout address, and revenue. PayCrawl is not a central proxy or
publisher account.

Each publisher deploys a Cloudflare Worker with:

- an HTTPS origin that rejects requests without `X-PayCrawl-Origin-Token`;
- a Celo wallet address that receives USDC;
- a route-to-price policy; and
- a Celo x402 facilitator API key.

The gateway configuration uses Celo mainnet and native USDC explicitly:

```ts
type GatewayConfig = {
  originBaseUrl: string;
  originHealthPath: string; // authenticated, redirect-free 204 endpoint
  payTo: `0x${string}`;
  protectedRoutes: Array<{
    pattern: string;
    amountAtomic: string;
  }>;
  facilitatorUrl: "https://api.x402.celo.org";
  network: "eip155:42220";
};
```

Default prices use six-decimal USDC atomic units:

| Route             |        Price |
| ----------------- | -----------: |
| `/agent/page/*`   | `0.001 USDC` |
| `/agent/feed/*`   |  `0.01 USDC` |
| `/agent/export/*` |  `0.10 USDC` |

### Deploy a publisher gateway

Authenticate with Cloudflare and create the analytics resources:

```bash
pnpm --filter @paycrawl/gateway exec wrangler login
pnpm --filter @paycrawl/gateway exec wrangler d1 create paycrawl-analytics
pnpm --filter @paycrawl/gateway exec wrangler queues create paycrawl-settlements
pnpm --filter @paycrawl/gateway exec wrangler queues create paycrawl-settlements-dlq
```

Add the reported D1 ID to [apps/gateway/wrangler.jsonc](./apps/gateway/wrangler.jsonc).
Copy [apps/gateway/.dev.vars.example](./apps/gateway/.dev.vars.example) to an
uncommitted `.dev.vars` for local development. Generate independent origin and
analytics secrets.

Store the production values as Worker secrets, apply the migration, then
deploy:

```bash
pnpm --filter @paycrawl/gateway exec wrangler secret put ORIGIN_TOKEN
pnpm --filter @paycrawl/gateway exec wrangler secret put ANALYTICS_HMAC_KEY
pnpm --filter @paycrawl/gateway exec wrangler secret put FACILITATOR_API_KEY
pnpm --filter @paycrawl/gateway exec wrangler secret put GATEWAY_CONFIG
pnpm --filter @paycrawl/gateway exec wrangler d1 migrations apply paycrawl-analytics --remote
pnpm --filter @paycrawl/gateway deploy
```

`FACILITATOR_API_KEY` is required for the production settlement call. Keep all
four values out of git, logs, and client-side code.

## Why this is safe enough to automate

PayCrawl is designed to make the payment decision local to the agent:

- It accepts one unambiguous x402 v2 `exact` quote on `eip155:42220` only.
- It accepts only the official native Celo USDC token at `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`.
- It compares the exact requested URL, publisher payout address, price, asset,
  network, request count, and total spend against local policy before signing.
- It retries network errors only before signing. A signed request is never
  blindly retried because settlement could be ambiguous.
- It reads a settlement as confirmed only from a successful response with a
  `PAYMENT-RESPONSE` header.
- It keeps the publisher origin private behind an origin token, strips payment
  and identity headers before forwarding, rejects redirects that leave the
  configured origin, and serves paid responses with `Cache-Control: private, no-store`.

## Architecture

```text
apps/gateway   Hono Cloudflare Worker, x402 verification, protected proxy,
               D1 receipt analytics, and Cloudflare Queue delivery
apps/agent     Reference CLI with wallet provisioning, publisher approval,
               Celo USDC budget enforcement, and receipt handling
apps/web       Product site, documentation, agent identity metadata, and
               public settlement telemetry
packages/shared  Protocol constants, configuration schemas, receipt types,
                 and shared validation
skills/paycrawl  Portable workflow for compatible agents
```

The gateway exposes free discovery and health endpoints:

```text
GET /.well-known/paycrawl.json
GET /health
GET /api/stats
```

It stores only successful transaction data needed for aggregates: transaction
hash, keyed payer pseudonym, amount, route category, latency, and timestamp.
Public metrics do not expose payer addresses, payment signatures, private
paths, origin URLs, or paid content.

## Run locally

Requires Node 22+ and pnpm 10.

```bash
pnpm install
pnpm check
pnpm build
```

`pnpm check` runs formatting, linting, type checks, and focused configuration,
security, redirect, quote-policy, and budget tests.

The optional hosted demo origin lives in the Next.js app. Deploy the web app,
set server-only `PAYCRAWL_DEMO_ORIGIN_TOKEN`, and configure the Worker with:

```ts
{
  originBaseUrl: "https://YOUR_WEB_APP_HOST/api/demo-origin",
  originHealthPath: "/healthz"
}
```

The origin returns `401` without the token, authenticated `HEAD /healthz`
returns `204`, and paid article routes are served under `/agent/page/*`.

## Security

Please read [SECURITY.md](./SECURITY.md) before reporting a vulnerability.
Never include private keys, seed phrases, origin tokens, facilitator keys, or
other secrets in issues, pull requests, logs, or demonstrations.

## License

PayCrawl is released under the [MIT License](./LICENSE).
