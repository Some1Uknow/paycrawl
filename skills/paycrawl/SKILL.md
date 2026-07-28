---
name: paycrawl
description: Safely access or integrate PayCrawl paid-content routes over x402 on Celo. Use when an agent needs to discover a PayCrawl manifest, inspect a 402 quote, make a budgeted Celo-USDC request, retrieve a receipt, configure the PayCrawl reference client, or deploy a publisher gateway.
---

# PayCrawl

Use PayCrawl to access paid machine-readable content with x402. The payment
credential is attached to the HTTP request. Do not use a browser checkout flow.

## Safety rules

- Never ask a user to paste a private key, seed phrase, origin token, or API
  secret into chat.
- Use only a signer that the agent runtime already controls securely.
- Before a signed request, enforce an allowed publisher address, a per-request
  limit, a total limit, and a request limit.
- If payment authority is not already configured, stop after the unpaid 402
  request. Report the exact quote and ask for direction.
- Do not retry a signed request after a network error. Its settlement state can
  be ambiguous.
- Do not claim payment or delivery unless a successful response contains a
  PAYMENT-RESPONSE header.

## Access a paid route

1. Fetch /.well-known/paycrawl.json. Read the route, price, network, asset,
   and payTo address.
2. Fetch the protected URL without a payment header. Expect
   402 Payment Required and a PAYMENT-REQUIRED header.
3. Apply the policy in references/payment-policy.md.
4. Use the local x402 signer to create a payment credential.
5. Send one signed retry. Do not follow redirects on a paid request.
6. Return the content and the decoded receipt. Record the transaction hash when
   available.

For the public beta gateway, start with:

    curl --include https://paycrawl-gateway.raghu250407.workers.dev/.well-known/paycrawl.json
    curl --include https://paycrawl-gateway.raghu250407.workers.dev/agent/page/article-1

## Use the reference client

Use this path only when the PayCrawl repository is available locally.

    cp apps/agent/.env.example apps/agent/.env
    pnpm crawl \
      --url https://paycrawl-gateway.raghu250407.workers.dev/agent/page/article-1 \
      --max-requests 1 \
      --max-total-usdc 0.001 \
      --max-per-request-usdc 0.001 \
      --concurrency 1

Keep PAYCRAWL_PAYER_PRIVATE_KEY and PAYCRAWL_ALLOWED_PAY_TO only in the
uncommitted local environment file. The reference client validates the quote
before it signs.

## Integrate another agent

Use an x402 v2 EVM client and a local signer. The integration must:

1. Perform an unsigned request first.
2. Decode the 402 response.
3. Reject a quote that fails the local policy.
4. Reserve the quote against the local budget before signing.
5. Sign and send one retry.
6. Parse PAYMENT-RESPONSE only from a successful response.

Do not add a shared PayCrawl wallet, central key store, or server-side custody
layer. A skill supplies procedure. The agent runtime supplies the signer and
the payment authority.

## Deploy for a publisher

Use the repository deployment guide when a publisher asks to monetize an
origin. The publisher must own the Cloudflare account, origin token, and Celo
payout address. Configure a protected HTTPS origin before deploying the
gateway.
