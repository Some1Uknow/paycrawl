# Payment policy

Read this file before an agent sends a signed PayCrawl request.

## Required quote values

Accept only one unambiguous payment option with all of these values:

| Field            | Required value                             |
| ---------------- | ------------------------------------------ |
| x402 version     | 2                                          |
| Scheme           | exact                                      |
| Network          | eip155:42220                               |
| Asset            | 0xcebA9300f2b948710d2653dD7B07f33A8B32118C |
| Asset metadata   | USDC, version 2                            |
| Publisher origin | Present in the local approval policy       |
| Payout address   | Approved for that publisher origin         |

The amount uses six-decimal atomic USDC units. For example, 1000 atomic
units equal 0.001 USDC.

## Required checks

- Confirm that the quote resource equals the requested URL, including path and
  query string.
- Confirm that the requested URL uses public HTTPS and no embedded credentials.
- For an unknown publisher origin or changed payout address, show the user the
  origin, payout address, and amount. Persist the pair only after explicit
  approval. Never approve it silently from a 402 response.
- Confirm that the amount is within the local per-request and total limits.
- Reserve the amount before the agent creates a signature.
- Do not follow a redirect after a quote or signed request.

## Receipt handling

On a successful paid response, read the PAYMENT-RESPONSE header. Save the
transaction hash if present. Do not treat a 2xx response without that header as
a confirmed x402 settlement.
