# PayCrawl — Hackathon Submission Runbook

This is the operational path from the current registered draft to a complete, verifiable submission for the **Agentic Payments and DeFAI Hackathon**. The deadline is **2026-08-03 09:00 UTC (14:30 IST)**.

## What is already complete

- Public code: <https://github.com/Some1Uknow/paycrawl>
- Registered project: **PayCrawl**
- Assigned attribution tag: `celo_468e1efe7287`
- Production agent/payTo wallet: `0x24c9DEAF91f462EE6705F710C4D0aadCbD64b4E7`
- Celo Builders draft wallet and ERC-8004 identity: recorded
- Live product: <https://paycrawl.vercel.app>
- Live gateway: <https://paycrawl-gateway.raghu250407.workers.dev>
- Four successful Celo-USDC x402 settlements recorded in public telemetry
- Latest settlement: <https://celoscan.io/tx/0xec1e57a24e0d783b6ae8e76f1a83ad46b81cbe36212aeb389c87146fbe0c8a11>
- Correct x402 v2 / Celo mainnet / native USDC configuration
- Local quality gates: formatting, lint, typecheck, 36 tests, and production builds

## Required to publish

| Item                            | Exact value or evidence                                                                   | Owner                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------- |
| Public GitHub repository        | `https://github.com/Some1Uknow/paycrawl`                                                  | Complete                                |
| Telegram handle                 | Personal `@handle`, 5–32 letters/numbers/underscores                                      | Builder (already used at registration)  |
| Celo network                    | `celo-mainnet`                                                                            | Recorded in the private draft           |
| Agent wallet                    | `0x24c9DEAF91f462EE6705F710C4D0aadCbD64b4E7`                                              | Recorded in the private draft           |
| X submission post               | Public `x.com` / `twitter.com` status URL                                                 | Builder                                 |
| ERC-8004 identity               | <https://8004scan.io/agents/celo/9746>                                                    | Complete: agent ID `9746`, Celo mainnet |
| Live demo                       | <https://paycrawl.vercel.app> and the live gateway                                        | Complete                                |
| Proof of a real x402 settlement | Four receipts in <https://paycrawl.vercel.app/api/stats>; latest transaction linked above | Complete                                |
| Project metadata                | Tagline, description, tracks/bounties, agent contribution notes                           | Drafted below; builder approves         |

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
  "payTo": "0x24c9DEAF91f462EE6705F710C4D0aadCbD64b4E7",
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

## 2. Real x402 payment evidence

Complete. Public telemetry currently reports four successful Celo-USDC
settlements, totaling 4,000 atomic USDC. The latest receipt is
`0xec1e57a24e0d783b6ae8e76f1a83ad46b81cbe36212aeb389c87146fbe0c8a11`.

Use the following procedure only for a new, legitimate paid crawl. Do not
replay a signed payment just to produce duplicate evidence.

1. Let the agent runtime create or reuse its dedicated persistent Celo payer wallet. Do not use the registered `payTo` wallet as the payer.
2. Fund that agent wallet with a small amount of Celo mainnet USDC when the runtime requests a bounded top-up. Give it a policy that allowlists `0x24c9DEAF91f462EE6705F710C4D0aadCbD64b4E7` and caps this demo at one `$0.001` request.
3. The runtime performs one real crawl against the deployed paid URL:

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

Complete. The registered wallet owner signed the Celo mainnet registration transaction, which minted agent ID `9746` and included the assigned `celo_468e1efe7287` attribution tag.

1. The public registration JSON is hosted at `https://paycrawl.vercel.app/.well-known/paycrawl-agent.json`. It identifies PayCrawl, the deployed x402 gateway, and the registered wallet on Celo mainnet.
2. Identity Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
3. Submit <https://8004scan.io/agents/celo/9746> as the ERC-8004 URL.
4. Registration proof: <https://celoscan.io/tx/0xe7c8b85f49518d5e73d2e324a4afa6a17de926c23ad7de734512763d65b2d910>.

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

| Field              | Value                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Project name       | PayCrawl                                                                                                                             |
| Tagline            | Paid content for AI agents.                                                                                                          |
| GitHub             | `https://github.com/Some1Uknow/paycrawl`                                                                                             |
| Celo network       | `celo-mainnet`                                                                                                                       |
| Tracks             | `most-x402-payments`, `most-revenue-generated`, `askbots`                                                                            |
| Bounties           | `most-x402-payments-1st`, `most-x402-payments-2nd`, `most-revenue-generated-1st`, `most-revenue-generated-2nd`, `askbots-prize-pool` |
| Contract addresses | Omit: PayCrawl uses no custom contract.                                                                                              |

Description:

> PayCrawl gives publishers a secure, self-hosted way to sell machine-readable access to AI agents. Its Cloudflare edge gateway returns an x402 v2 Celo-USDC quote before any protected origin request. The reference agent validates the network, token, payee, and local spending ceiling before it signs. A payment is settled only after the locked origin returns a successful response; the gateway then returns the content and an on-chain `PAYMENT-RESPONSE` receipt. PayCrawl avoids shared custody, blocks open-proxy and redirect abuse, strips sensitive forwarding headers, uses bounded responses and timeouts, and exposes privacy-preserving settlement analytics.

Agent contribution notes:

> Codex helped implement and test the Cloudflare gateway, x402 payment validation, bounded-spend crawler, analytics, release checks, deployment runbook, and submission materials. The builder supplied product direction, authorized infrastructure, and will approve all externally published content and transactions.

Do not select `track-4-tba` or its bounty unless the project has both a real Aigora profile URL and a substantive feedback issue URL.

## 6. Review, then publish only on explicit approval

Before publication, the agent should fetch the private draft, confirm every required field and URL resolves publicly, verify the repository remains public, and confirm the attribution wallet and ERC-8004 identity are correct. Publishing is an irreversible public action and happens only after the builder says to publish.
