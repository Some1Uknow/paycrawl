import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PayCrawl docs",
  description: "Reference for using and deploying PayCrawl on Celo.",
};

const gatewayUrl = "https://paycrawl-gateway.raghu250407.workers.dev";
const repositoryUrl = "https://github.com/Some1Uknow/paycrawl";
const deployUrl = `${repositoryUrl}#deploy-a-publisher-gateway`;

function Mark(): React.ReactElement {
  return (
    <svg aria-hidden="true" className="mark" viewBox="0 0 48 48" fill="none">
      <path
        d="M7 12.5h24.5L41 22l-9.5 9.5H7V12.5Z"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <path
        d="M7 20h26M15 12.5v19M25 12.5v19"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <circle cx="37" cy="31.5" r="5" fill="currentColor" />
    </svg>
  );
}

export default function DocsPage(): React.ReactElement {
  return (
    <main className="reference-docs">
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/">
          <Mark />
          <span>PayCrawl</span>
        </Link>
        <div className="nav-links">
          <a href="#agent">Agent</a>
          <a href="#publisher">Publisher</a>
          <a href="#endpoints">Endpoints</a>
        </div>
        <Link className="nav-cta" href="/">
          Product <span>↗</span>
        </Link>
      </nav>

      <header className="reference-header">
        <p className="eyebrow">Documentation</p>
        <h1>PayCrawl</h1>
        <p>
          A Celo x402 gateway for paid, machine-readable content. It returns a
          payment challenge, accepts a signed USDC authorization, and returns
          content only after settlement succeeds.
        </p>
      </header>

      <div className="reference-shell">
        <aside className="reference-nav" aria-label="Documentation sections">
          <a href="#overview">Overview</a>
          <a href="#agent">Use as an agent</a>
          <a href="#publisher">Deploy as a publisher</a>
          <a href="#endpoints">Endpoints</a>
          <a href="#beta">Beta status</a>
        </aside>

        <article className="reference-content">
          <section id="overview">
            <h2>Overview</h2>
            <p>
              The payment exchange stays inside HTTP. The agent requests a
              protected resource, receives a <code>402</code> with the Celo USDC
              terms, signs locally, and retries with a payment signature.
            </p>
            <pre className="reference-code">
              <code>{`GET /agent/page/article-1
→ 402 PAYMENT-REQUIRED
→ PAYMENT-SIGNATURE
→ 200 content + PAYMENT-RESPONSE`}</code>
            </pre>
          </section>

          <section id="agent">
            <h2>Use as an agent</h2>
            <ol>
              <li>
                Read the public manifest. It lists route prices, Celo network,
                USDC asset, and the publisher payout address.
              </li>
              <li>
                Request the protected route. An unpaid request returns a quote;
                it does not expose content.
              </li>
              <li>
                Sign only if the publisher and amount match your local policy.
                Keep the wallet key local and enforce a spend limit.
              </li>
            </ol>
            <pre className="reference-code">
              <code>{`curl -i ${gatewayUrl}/.well-known/paycrawl.json
curl -i ${gatewayUrl}/agent/page/article-1`}</code>
            </pre>
            <p>
              The current reference client is in the repository and validates
              Celo USDC, the payout allowlist, and a local budget before it
              signs. A standalone client package is not published yet.
            </p>
            <pre className="reference-code">
              <code>{`pnpm crawl \\
  --url ${gatewayUrl}/agent/page/article-1 \\
  --max-requests 1 \\
  --max-total-usdc 0.001 \\
  --concurrency 1`}</code>
            </pre>
          </section>

          <section id="publisher">
            <h2>Deploy as a publisher</h2>
            <p>Current beta deployment is self-hosted. You need:</p>
            <ul>
              <li>
                An HTTPS origin that rejects unauthenticated direct access.
              </li>
              <li>A Celo payout address and explicit USDC prices per route.</li>
              <li>
                A Cloudflare Worker, D1 database, queue, and three secrets.
              </li>
            </ul>
            <p>
              The gateway authenticates to your origin only after it verifies a
              payment authorization. Funds settle directly to your payout
              address.
            </p>
            <a
              className="button button-primary"
              href={deployUrl}
              target="_blank"
              rel="noreferrer"
            >
              Publisher deployment guide <span>↗</span>
            </a>
          </section>

          <section id="endpoints">
            <h2>Endpoints</h2>
            <div className="reference-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <code>/.well-known/paycrawl.json</code>
                    </td>
                    <td>Public payment manifest</td>
                  </tr>
                  <tr>
                    <td>
                      <code>/agent/page/*</code>
                    </td>
                    <td>Paid content; 0.001 USDC in the public beta</td>
                  </tr>
                  <tr>
                    <td>
                      <code>/health</code>
                    </td>
                    <td>Gateway and origin health</td>
                  </tr>
                  <tr>
                    <td>
                      <code>/api/stats</code>
                    </td>
                    <td>Public aggregate settlement metrics</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="beta">
            <h2>Beta status</h2>
            <p>
              The public gateway is live. Publisher setup is currently
              self-hosted; managed Cloudflare onboarding, browser wallet
              connection, and a standalone agent package are not available yet.
            </p>
          </section>
        </article>
      </div>

      <footer>
        <Link className="brand" href="/">
          <Mark />
          <span>PayCrawl</span>
        </Link>
        <p>Turn block-or-scrape into pay-per-crawl.</p>
        <a href={repositoryUrl} target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
      </footer>
    </main>
  );
}
