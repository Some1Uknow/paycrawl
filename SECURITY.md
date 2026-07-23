# Security policy

## Supported version

Security fixes are made on the current `main` branch before a tagged release exists.

## Reporting a vulnerability

Please use [GitHub's private security advisory form](https://github.com/Some1Uknow/paycrawl/security/advisories/new) for suspected vulnerabilities. Do not open a public issue with exploit steps, credentials, wallet material, origin tokens, or transaction payloads.

Include the affected route or component, reproduction steps, impact, and a safe proof of concept. We aim to acknowledge reports within seven calendar days and will coordinate disclosure after a fix is available.

## Scope notes

The repository does not operate a shared custody service. Each publisher owns its Cloudflare account, gateway secrets, origin, payout address, and agent wallet. Treat an exposed `ORIGIN_TOKEN`, `ANALYTICS_HMAC_KEY`, or agent private key as compromised: rotate it immediately and invalidate any affected deployment.
