# PayCrawl — Hackathon Submission Runbook

This is the operational path from the current registered draft to a complete, verifiable submission for the **Agentic Payments and DeFAI Hackathon**. The deadline is **2026-08-03 09:00 UTC (14:30 IST)**.

## What is already complete

- Public code: <https://github.com/Some1Uknow/paycrawl>
- Registered project: **PayCrawl**
- Assigned attribution tag: `celo_468e1efe7287`
- Submitted agent/payTo wallet: `0x5287c8e5017edeec5f733fa926676c21ffcb8b65`
- Correct x402 v2 / Celo mainnet / native USDC configuration
- Local quality gates: formatting, lint, typecheck, 36 tests, and production builds

## Required to publish

| Item | Exact value or evidence | Owner |
| --- | --- | --- |
| Public GitHub repository | `https://github.com/Some1Uknow/paycrawl` | Complete |
| Telegram handle | Personal `@handle`, 5–32 letters/numbers/underscores | Builder (already used at registration) |
| Celo network | `celo-mainnet` | Agent, when updating draft |
| Agent wallet | `0x5287c8e5017edeec5f733fa926676c21ffcb8b65` | Already recorded; verify in draft |
| X submission post | Public `x.com` / `twitter.com` status URL | Builder |
| ERC-8004 identity | Public `8004scan.io/agents/celo/<id>` or Celoscan NFT URL | Builder signs; agent prepares |
| Live demo | Public HTTPS URL for the deployed gateway or web app | Agent deploys after account/origin access |
| Proof of a real x402 settlement | Gateway response's `PAYMENT-RESPONSE`, Celoscan transaction, D1 row, and `/api/stats` result | Agent verifies after funded payer signs |
| Project metadata | Tagline, description, tracks/bounties, agent contribution notes | Drafted below; builder approves |

Video is optional, but a 60–90 second recording is strongly recommended for judging.

## 1. Deploy the production gateway

The deployment requires a publisher-controlled HTTPS origin. It must reject requests unless it receives the exact `X-PayCrawl-Origin-Token` header, and must return `204 No Content` to an authenticated `HEAD /healthz` request. The existing Next.js app now includes such a demo origin at `/api/demo-origin`, so one hosted web deployment can provide both the product site and a valid paid demonstration route.

### Builder supplies once, privately

1. A Cloudflare login or an API token with permission to deploy Workers and manage the existing D1 database and Queue.
2. A public HTTPS origin base URL that the builder owns or is authorized to expose as paid machine-readable content. For the built-in demo origin, this is the deployed web-app URL plus `/api/demo-origin`.
3. The origin route(s) to monetize, for example `/agent/page/*`.
4. Two fresh, high-entropy secrets: `ORIGIN_TOKEN` and `ANALYTICS_HMAC_KEY`. Do not paste either into chat, commits, issues, or command arguments.

### Agent executes after authentication

From the repository root:

```bash
pnpm --filter @paycrawl/gateway exec wrangler d1 migrations apply paycrawl-analytics --remote
pnpm --filter @paycrawl/gateway exec wrangler secret put ORIGIN_TOKEN
pnpm --filter @paycrawl/gateway exec wrangler secret put ANALYTICS_HMAC_KEY
pnpm --filter @paycrawl/gateway exec wrangler secret put GATEWAY_CONFIG
pnpm --filter @paycrawl/gateway deploy
```

For `GATEWAY_CONFIG`, enter valid JSON with the real origin and the existing payout wallet. A minimal production policy is:

```json
{
  "originBaseUrl": "https://YOUR-WEB-APP-HOST/api/demo-origin",
  "originHealthPath": "/healthz",
  "payTo": "0x5287c8e5017edeec5f733fa926676c21ffcb8b65",
  "protectedRoutes": [
    { "pattern": "/agent/page/*", "amountAtomic": "1000" },
    { "pattern": "/agent/feed/*", "amountAtomic": "10000" },
    { "pattern": "/agent/export/*", "amountAtomic": "100000" }
  ],
  "facilitatorUrl": "https://api.x402.celo.org",
  "network": "eip155:42220"
}
```

The `YOUR-WEB-APP-HOST` value must be replaced before deploying. It is deliberately not a submission placeholder and must never be presented as a live demo URL. Set the same secret as `ORIGIN_TOKEN` in the web host's server environment as `PAYCRAWL_DEMO_ORIGIN_TOKEN` before enabling this route.

### Required gateway acceptance checks

Replace `GATEWAY_URL` with the real Workers URL or custom domain:

```bash
curl -i https://GATEWAY_URL/.well-known/paycrawl.json
curl -i https://GATEWAY_URL/health
curl -i https://GATEWAY_URL/agent/page/article-1
curl -i https://GATEWAY_URL/api/stats
```

Expected results:

- Discovery manifest: `200`, Celo chain `eip155:42220`, native USDC, correct non-zero `payTo`.
- Health: `200` and both `facilitator` and `origin` are `ready`.
- Unpaid protected GET: one `402` challenge and no origin content.
- Stats: valid public metrics with no payer address, signature, private path, or origin URL.

Set Cloudflare WAF rate limits for `/health` and `/api/stats`, then monitor the `paycrawl-settlements-dlq` dead-letter queue. These are production safeguards, not submission fields.

## 2. Make one real x402 payment

1. Fund a **separate payer wallet** with a small amount of Celo mainnet USDC. Do not use the private key of the registered `payTo` wallet as the payer.
2. Create a local, uncommitted `apps/agent/.env` using `apps/agent/.env.example`. Put the payer key only in that local file and allowlist `0x5287c8e5017edeec5f733fa926676c21ffcb8b65`.
3. Run one real crawl against the deployed paid URL:

```bash
pnpm crawl \
  --url https://GATEWAY_URL/agent/page/article-1 \
  --max-requests 1 \
  --max-total-usdc 0.001 \
  --max-per-request-usdc 0.001 \
  --concurrency 1
```

4. Save the `PAYMENT-RESPONSE` transaction hash. Confirm it on Celoscan, in `/api/stats`, and in the D1 settlement record.

For Celo facilitator settlements, attribution is based on the submitted agent/payTo wallet. Do not send a duplicate transaction just to mirror the settlement.

## 3. Register PayCrawl's ERC-8004 identity

The registered wallet owner signs this on Celo mainnet. The agent can prepare the metadata, transaction, and post-registration verification; the builder must approve and sign the transaction.

1. Host a public agent registration JSON at a durable HTTPS URL or IPFS. It should identify PayCrawl, describe paid machine-readable publisher access, include the deployed gateway endpoint, and list the registered wallet with `chainId: 42220`.
2. Register that `agentURI` with the Celo mainnet Identity Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
3. Record the minted agent ID and submit either:
   - `https://8004scan.io/agents/celo/<AGENT_ID>`, or
   - `https://celoscan.io/nft/0x8004a169fb4a3325136eb29fa0ceb6d2e539a432/<AGENT_ID>`.
4. If the PayCrawl wallet sends any direct transactions, append `celo_468e1efe7287` as an ERC-8021 suffix and verify it after confirmation. The facilitator settlement itself does not need a mirrored tagged transaction.

## 4. Create the public demo and social evidence

### Demo

Deploy the Next.js web app to a public host and set its server environment variable:

```text
PAYCRAWL_GATEWAY_URL=https://GATEWAY_URL
```

The deployed landing page must show real gateway metrics, not the unavailable-state message. A hosted gateway URL may be used as the demo URL if necessary, but the hosted web app plus a short video is the stronger entry.

### X post

The builder publishes a truthful public post that includes the project name, Celo mainnet, a demo link, and GitHub link. Keep its status URL; the exact URL is required in the submission.

Suggested post copy:

> Introducing PayCrawl: a Celo mainnet x402 gateway that turns AI-agent crawling into bounded, verifiable USDC payments. A publisher can protect machine-readable routes, an agent validates the quote before signing, and successful delivery returns an on-chain receipt. Live demo: [URL] · Code: https://github.com/Some1Uknow/paycrawl

### Demo video

Record 60–90 seconds showing: unpaid 402 → agent budget limit → paid response → `PAYMENT-RESPONSE` → Celoscan transaction → dashboard metric. Upload it publicly and retain the URL.

## 5. Finalize the private Celo Builders draft

Use these submission values after the live evidence exists:

| Field | Value |
| --- | --- |
| Project name | PayCrawl |
| Tagline | Turn block-or-scrape into pay-per-crawl. |
| GitHub | `https://github.com/Some1Uknow/paycrawl` |
| Celo network | `celo-mainnet` |
| Tracks | `most-x402-payments`, `most-revenue-generated`, `askbots` |
| Bounties | `most-x402-payments-1st`, `most-x402-payments-2nd`, `most-revenue-generated-1st`, `most-revenue-generated-2nd`, `askbots-prize-pool` |
| Contract addresses | Omit: PayCrawl uses no custom contract. |

Description:

> PayCrawl gives publishers a secure, self-hosted way to sell machine-readable access to AI agents. Its Cloudflare edge gateway returns an x402 v2 Celo-USDC quote before any protected origin request. The reference agent validates the network, token, payee, and local spending ceiling before it signs. A payment is settled only after the locked origin returns a successful response; the gateway then returns the content and an on-chain `PAYMENT-RESPONSE` receipt. PayCrawl avoids shared custody, blocks open-proxy and redirect abuse, strips sensitive forwarding headers, uses bounded responses and timeouts, and exposes privacy-preserving settlement analytics.

Agent contribution notes:

> Codex helped implement and test the Cloudflare gateway, x402 payment validation, bounded-spend crawler, analytics, release checks, deployment runbook, and submission materials. The builder supplied product direction, authorized infrastructure, and will approve all externally published content and transactions.

Do not select `track-4-tba` or its bounty unless the project has both a real Aigora profile URL and a substantive feedback issue URL.

## 6. Review, then publish only on explicit approval

Before publication, the agent should fetch the private draft, confirm every required field and URL resolves publicly, verify the repository remains public, and confirm the attribution wallet and ERC-8004 identity are correct. Publishing is an irreversible public action and happens only after the builder says to publish.
