<proposed_plan>
# PayCrawl: Celo Hackathon MVP Plan

## Summary

Build **PayCrawl**, a one-click Cloudflare edge gateway that lets publishers expose paid, machine-readable content to AI agents:

```text
Agent requests /agent/page/*
→ gateway returns x402 challenge
→ agent signs USDC authorization
→ Celo facilitator verifies
→ gateway fetches publisher origin
→ facilitator settles on Celo mainnet
→ content + transaction receipt returned
```

Positioning: “Turn block-or-scrape into pay-per-crawl.”

Target all four tracks for a theoretical maximum of **$3,250 in CELO**:

| Priority | Track | Strategy |
|---|---|---|
| 1 | Most x402 Payments | $0.001 page requests and real agent pilots |
| 2 | Askbots | Polished live product and autonomous crawl agent |
| 3 | Best Feedback for Aigora | Complete its separate profile and feedback requirements |
| 4 | Most Revenue Generated | Real paid exports/publisher traffic; treat as a stretch goal |

Do not manufacture circular transactions or mirror facilitator settlements. The organizer says x402 settlements are attributed through the submitted payout/agent wallet. ERC-8021 tags are only for direct transactions PayCrawl sends itself.

## Architecture and Interfaces

### Repository

Create a new public `paycrawl` pnpm monorepo:

- `apps/gateway`: Hono Cloudflare Worker and D1 analytics.
- `apps/web`: Next.js landing page, installation instructions, live metrics, and receipt explorer.
- `apps/agent`: Node CLI demonstrating autonomous paid crawling.
- `packages/shared`: configuration schemas, constants, receipt and metrics types.

No custom smart contract, publisher accounts, arbitrary proxying, or unreliable AI User-Agent enforcement in v1.

### Gateway

Use:

- `@x402/core`, `@x402/hono`, `@x402/evm` pinned to `2.19.0`
- Hono 4 and Cloudflare Workers with `nodejs_compat`
- Facilitator: `https://api.x402.celo.org`
- Network: `eip155:42220`
- USDC: `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`
- Scheme: `exact`, x402 v2
- Separate publisher payout wallet and test-agent payer wallet

The current x402 SDK does not contain Celo in its default stablecoin map, so every route must use an explicit asset amount:

```ts
{
  asset: CELO_USDC,
  amount: "1000", // $0.001
  extra: { name: "USDC", version: "2" }
}
```

Expose these routes:

- `GET /.well-known/paycrawl.json`: free discovery manifest.
- `GET /health`: facilitator/origin readiness.
- `GET /agent/page/*`: 0.001 USDC per page.
- `GET /agent/feed/*`: 0.01 USDC per feed/sitemap update.
- `GET /agent/export/*`: 0.10 USDC for useful bulk exports.
- `GET /api/stats`: public aggregate metrics without IPs, signatures, private URLs, or content.

Each publisher deploys its own Worker using a Cloudflare deploy button and supplies:

```ts
type GatewayConfig = {
  originBaseUrl: string;
  payTo: `0x${string}`;
  protectedRoutes: Array<{
    pattern: string;
    amountAtomic: string;
  }>;
  facilitatorUrl: "https://api.x402.celo.org";
  network: "eip155:42220";
};
```

`ORIGIN_TOKEN` is a Cloudflare secret. The publisher origin must reject requests missing `X-PayCrawl-Origin-Token`, preventing users from bypassing the paid gateway.

Gateway safeguards:

- Permit only `GET` and `HEAD`; settle only successful `GET` responses.
- Fixed HTTPS origin allowlist; reject redirects to other hosts, traversal, localhost, and private IPs.
- Strip cookies, authorization, payment, forwarding, and hop-by-hop headers before origin fetch.
- Set `Cache-Control: private, no-store` on protected responses.
- Fail closed when verification or settlement fails.
- Never expose or store payment signatures.
- Record successful settlement transaction, payer, amount, normalized path, latency, and timestamp in D1 using transaction hash as the unique key.

### Agent CLI

Provide:

```bash
pnpm crawl \
  --url https://gateway.example/agent/page/article-1 \
  --max-requests 100 \
  --max-total-usdc 0.10 \
  --concurrency 1
```

The client will:

- Use `@x402/fetch` and `ExactEvmScheme`.
- Accept only Celo mainnet, expected USDC, and configured payout addresses.
- Decode the 402 before signing and abort above per-request or total budget.
- Retry network errors, but never blindly retry rejected or settled payments.
- Print transaction hashes and `PAYMENT-RESPONSE` receipts.
- Read the payer key only from an uncommitted local secret.

### Web experience

The landing/live console will show:

- Problem, architecture, and “Deploy to Cloudflare” integration.
- Free discovery-manifest and unpaid 402 examples.
- Live settlement count, USDC revenue, unique payer count, success rate, and Celoscan links.
- Three-step publisher installation.
- Agent CLI example and recorded end-to-end demo.
- Honest limitation: the cooperative paid machine route does not prevent malicious crawlers from impersonating humans; publishers still protect or restrict their ordinary origin.

## Zero-to-One Schedule

### July 21–22: Register first

1. Create the public GitHub repository before registration because the attribution tag is permanently derived from `owner/repo`.
2. With explicit permission, collect the required builder details and connect through Celo Builders.
3. Register the draft with project name, GitHub URL, personal Telegram, payout wallet, and all four track slugs:
   - `most-x402-payments`
   - `most-revenue-generated`
   - `askbots`
   - `track-4-tba`
4. Save all applicable bounty slugs, including both placement possibilities.
5. Record the returned `celo_…` attribution tag and payout wallet.
6. Join the hackathon Telegram and confirm the next Askbots office-hours slot.
7. Do not publish the final submission yet.

### July 22–24: Build protocol core

1. Scaffold the monorepo and Cloudflare Worker.
2. Implement explicit Celo USDC payment requirements and the paid proxy.
3. Add origin locking, cache protection, route pricing, D1 settlement hooks, and discovery manifest.
4. Build the capped-spend crawler CLI.
5. Complete local protocol and security tests using mock facilitator/origin services.

### July 24–26: Go live on mainnet

1. Deploy the demo origin to Vercel and gateway to `workers.dev`; add a custom domain only if already available.
2. Create two wallets:
   - Publisher payout/submission wallet.
   - Locally held test-agent payer wallet funded with 5–10 USDC.
3. Execute one real 0.001-USDC payment.
4. Confirm:
   - Origin content was withheld before payment.
   - Settlement reached the payout wallet.
   - `PAYMENT-RESPONSE` contains the transaction hash.
   - D1 recorded one settlement.
   - The registered wallet appears correctly on the Dune leaderboard after refresh.
5. Do not send a separate tagged transaction to mirror the settlement.

### July 26–30: Product proof and pilots

Recruit:

- One publisher with authorized content and origin control.
- Two independent agent operators using their own wallets.
- Target three independent payer wallets total.

Pilot targets:

- Minimum: 1,000 legitimate settlements.
- Competitive: 10,000 settlements by July 30.
- Stretch: 30,000 settlements by August 2.
- Default price: 0.001 USDC; never lower it solely to create meaningless loops.
- Budget ceiling: $75 total, including mainnet tests, up to $30 in pilot credits, ERC-8004 gas, and contingency.

Document consent, publisher ownership, agent use case, transaction evidence, and one testimonial per pilot. Check the live leaderboard daily and adjust outreach, corpus size, and useful crawl frequency without circular self-payments.

### July 28–August 1: Additional prizes

- Register PayCrawl’s ERC-8004 identity on Celo mainnet using the existing Identity Registry and a public registration JSON containing the gateway endpoint and wallet. Submit the resulting 8004scan/Celoscan NFT URL.
- If sending the ERC-8004 registration directly, append the assigned ERC-8021 suffix and verify it with `verifyTx`.
- Register the agent on Aigora and file substantive feedback through its required feedback skill; save both required URLs.
- Attend Askbots office hours with the live agent, focusing the demo on autonomous discovery, budget enforcement, payment, content retrieval, and on-chain proof.
- Publish a technical launch post on X and save its public URL.

### August 1–3: Submission freeze

1. Freeze protocol code by August 1; allow only critical fixes afterward.
2. Record a 90-second demo:
   - unpaid request,
   - decoded 402,
   - autonomous payment,
   - returned content,
   - Celoscan receipt,
   - live dashboard attribution.
3. Complete tagline, description, demo URL, video URL, X link, ERC-8004 URL, wallet, Celo mainnet, tracks, bounties, and agent-contribution notes.
4. Review the private draft through `GET /submissions/me`.
5. Publish only after explicit final approval.
6. Finish by **August 3, 07:00 UTC**, leaving two hours before the 09:00 UTC deadline.

## Test and Acceptance Plan

- Unit tests: configuration validation, pricing, budget caps, URL normalization, redirect rejection, header stripping, and metrics deduplication.
- Protocol tests: unpaid 402, valid payment, invalid/expired signature, wrong asset/network/payee, replay, settlement failure, and origin 4xx/5xx cancellation.
- Security tests: open-proxy attempts, private-network SSRF, path traversal, origin-token bypass, cache leakage, and secret redaction.
- Mainnet acceptance:
  - Real Celo USDC settlement through `api.x402.celo.org`.
  - Protected content returned only after settlement.
  - Payout balance increase matches the quoted amount.
  - Transaction appears in Celoscan and the hackathon leaderboard.
- Product acceptance:
  - One-click publisher deployment works from a clean Cloudflare account.
  - Three real pilots complete paid crawls.
  - Live console shows deduplicated receipts.
  - Public repo, demo, video, X post, ERC-8004 identity, Askbots appearance, and Aigora URLs are complete.

## Assumptions and Official Constraints

- Project name defaults to **PayCrawl**.
- This is a greenfield repo; all submitted code is produced during the hackathon.
- Celo mainnet and public GitHub are mandatory.
- x402/volume counting ends August 3, 2026 at 09:00 UTC.
- Multiple track IDs are supported by the submission interface; all four will be selected.
- Revenue-track victory is a stretch under a solo $25–$100 budget; the highest-probability portfolio is x402 count, Askbots, and Aigora.
- Authoritative references: [hackathon FAQs](https://celobuilders.xyz/hackathons/agentic-payments-defai/faqs), [tracks](https://celobuilders.xyz/hackathons/agentic-payments-defai/tracks), [Celo x402 documentation](https://docs.celo.org/build-on-celo/build-with-ai/x402), [live facilitator capabilities](https://api.x402.celo.org/supported), and [ERC-8004 on Celo](https://docs.celo.org/build-on-celo/build-with-ai/8004).
- Organizer Q&A source labels used: `Judging: x402 payment count`, `Track: Most x402 Payments`, `Rule: Counting window`, and `FAQ: How is on-chain activity tracked?`.
</proposed_plan>
