---
name: paycrawl
description: Safely access or integrate PayCrawl paid-content routes over x402 on Celo. Use when an agent needs to discover a PayCrawl manifest, inspect a 402 quote, make a governed Celo-USDC request, retrieve a receipt, or deploy a publisher gateway.
---

# PayCrawl

Use PayCrawl to access paid machine-readable content with x402. The payment
credential is attached to the HTTP request. Do not use a browser checkout flow.

## Safety rules

- Never ask a user to paste a private key, seed phrase, origin token, or API
  secret into chat.
- Use only a runtime-managed signer. Persist its wallet handle, never its raw
  key, under the stable logical wallet reference `paycrawl:payer:eip155:42220`.
  A self-hosted reference runtime may use the encrypted wallet file described
  below; it must never persist a plaintext private key.
- Before a signed request, enforce an approved publisher origin and payout
  address, a per-request limit, a total limit, and a request limit.
- Do not create an `.env` file or ask an end user to edit one. The repository
  client is for runtime integrators only.
- Do not retry a signed request after a network error. Its settlement state can
  be ambiguous.
- Do not claim payment or delivery unless a successful response contains a
  PAYMENT-RESPONSE header.

## Access a paid route

1. Fetch /.well-known/paycrawl.json. Read the route, price, network, asset,
   and payTo address.
2. Fetch the protected URL without a payment header. Expect
   402 Payment Required and a PAYMENT-REQUIRED header.
3. Resolve the persistent payer wallet and apply the policy in
   references/payment-policy.md.
4. Check its native Celo USDC balance against the approved budget.
5. Use the runtime's approved x402 signer to create a payment credential.
6. Send one signed retry. Do not follow redirects on a paid request.
7. Return the content and the decoded receipt. Record the transaction hash when
   available.

For the hosted gateway, start with:

    curl --include https://paycrawl-gateway.raghu250407.workers.dev/.well-known/paycrawl.json
    curl --include https://paycrawl-gateway.raghu250407.workers.dev/agent/page/article-1

## Agent wallet lifecycle

Resolve `paycrawl:payer:eip155:42220` from the agent runtime's secure wallet
store before every paid request. Reuse that wallet for later crawls.

If it does not exist, create a dedicated Celo mainnet payer wallet through the
runtime's approved wallet provider and persist only its wallet handle and
address under that reference. Do not use the publisher's `payTo` wallet as the
payer.

The runtime wallet integration must provide encrypted key custody or a
hardware/hosted signer, durable storage, address lookup, balance lookup, and
transaction signing. If it cannot provide those capabilities, stop after the
unpaid 402 and report that wallet provisioning is unavailable; never fall back
to a raw key, shared wallet, repository file, or browser checkout.

### Self-hosted macOS runtime

The repository CLI can provision the payer wallet locally for a self-hosted
agent. On its first paid crawl it creates an AES-256-GCM encrypted file at
`~/.paycrawl/wallets/payer-eip155-42220.json`, locks the file to the owner, and
reuses the same address later. On macOS it automatically creates or reuses the
`paycrawl-wallet-passphrase` Keychain item; do not ask the user to create,
export, or reveal it. Other runtimes supply an equivalent secret provider.
Never put a raw private key in an environment variable, repository file,
prompt, or skill message. The CLI checks the Celo USDC balance before it signs. It separately
stores public publisher approvals at
`~/.paycrawl/policies/publishers-eip155-42220.json`; that file contains no
wallet key.

## Funding and policy

The operator provides only these policy inputs through the wallet integration:

- approval for a new publisher origin and payout address;
- per-request, total, and request-count limits.

For an unknown publisher, stop after the unsigned 402. Show the user the
publisher origin, Celo-USDC payout address, and quoted amount. Ask for one
clear approval. Persist the approved origin/payout pair in the runtime's local
policy store, then allow future requests to that same pair automatically within
the spend limits. If either the origin or payout address changes, ask again.
Never auto-approve a new payout address from a 402 response.

## End-user execution

Do the setup work yourself. Do not tell an end user to run a shell command,
clone a repository, edit an environment file, create a passphrase, or use a
browser wallet.

For a self-hosted macOS agent, invoke the local PayCrawl CLI directly. It
provisions the Keychain secret, encrypted wallet, and publisher-policy file as
needed. From a PayCrawl repository workspace, use:

    pnpm crawl --url <protected-url> --max-requests 1 --max-total-usdc <limit> --max-per-request-usdc <limit> --concurrency 1

On the first unknown publisher, run that unpaid request, show the validated
origin, payout address, and quoted amount, and ask for approval. Only after a
clear approval, rerun that one target with `--approve-publisher`.

If the balance is insufficient, give the user only the persistent payer wallet
address, `Celo mainnet`, and one bounded Celo-USDC funding amount. For example:

> Fund your PayCrawl agent wallet with 0.01 Celo USDC at
> `0x…`. I will use that wallet for future approved crawls.

When the user says it is funded, check the balance and resume the same request.
Never ask for a private key, seed phrase, Keychain value, browser-wallet
connection, or payment to the publisher directly.

Before signing, compare the wallet's native Celo USDC balance with the next
quote and approved reserve. If it is insufficient, ask for a single bounded
funding action and include the persistent agent wallet address, Celo mainnet,
and the minimum USDC amount. For example:

> Your PayCrawl agent wallet needs at least $0.01 Celo USDC to continue within
> the approved $0.001-per-crawl policy. Fund this wallet once; no private key
> or repository setup is required.

After funding is visible, resume with the same wallet and policy. Ask again
only when the balance or spending policy no longer covers the requested crawl.

## Integrate another agent

Use an x402 v2 EVM client and the runtime signer. The integration must:

1. Perform an unsigned request first.
2. Decode the 402 response.
3. Reject a quote that fails the local policy.
4. Reserve the quote against the local budget before signing.
5. Sign and send one retry.
6. Parse PAYMENT-RESPONSE only from a successful response.

Do not add a shared PayCrawl wallet, central key store, or server-side custody
layer. A skill supplies procedure and wallet-lifecycle requirements; the agent
runtime supplies the secure wallet implementation.

## Deploy for a publisher

Use the repository deployment guide when a publisher asks to monetize an
origin. The publisher must own the Cloudflare account, origin token, and Celo
payout address. Configure a protected HTTPS origin before deploying the
gateway.
