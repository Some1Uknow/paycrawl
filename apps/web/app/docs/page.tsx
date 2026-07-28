import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PayCrawl documentation",
  description: "Use and deploy PayCrawl on Celo.",
};

const gatewayUrl = "https://paycrawl-gateway.raghu250407.workers.dev";
const repositoryUrl = "https://github.com/Some1Uknow/paycrawl";
const deployUrl = `${repositoryUrl}#deploy-a-publisher-gateway`;
const agentEnvUrl = `${repositoryUrl}/blob/main/apps/agent/.env.example`;

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

function CodeBlock({ children }: { children: string }): React.ReactElement {
  return (
    <pre className="reference-code">
      <code>{children}</code>
    </pre>
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
          <a href="#endpoints">API</a>
        </div>
        <Link className="nav-cta" href="/">
          Product <span>↗</span>
        </Link>
      </nav>

      <header className="reference-header">
        <p className="eyebrow">Documentation</p>
        <h1>PayCrawl</h1>
        <p>
          PayCrawl is an x402 gateway for paid machine-readable content on Celo.
          An agent pays with USDC. A publisher receives the payment after the
          gateway delivers content.
        </p>
        <dl className="reference-meta">
          <div>
            <dt>Network</dt>
            <dd>Celo mainnet</dd>
          </div>
          <div>
            <dt>Asset</dt>
            <dd>USDC</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Public beta</dd>
          </div>
        </dl>
      </header>

      <div className="reference-shell">
        <aside className="reference-nav" aria-label="Documentation sections">
          <a href="#overview">Overview</a>
          <a href="#agent">Agent setup</a>
          <a href="#publisher">Publisher setup</a>
          <a href="#endpoints">API reference</a>
          <a href="#limits">Beta limits</a>
        </aside>

        <article className="reference-content">
          <section id="overview">
            <h2>Overview</h2>
            <p>Use this sequence to access a paid route.</p>
            <ol className="reference-steps">
              <li>Send a request to the route.</li>
              <li>
                Read the <code>402 Payment Required</code> response.
              </li>
              <li>Validate the price, asset, network, and payout address.</li>
              <li>Sign the payment with the local wallet.</li>
              <li>
                Retry the request with <code>PAYMENT-SIGNATURE</code>.
              </li>
              <li>
                Read the content and <code>PAYMENT-RESPONSE</code> receipt.
              </li>
            </ol>
            <div className="reference-note">
              <strong>Settlement rule.</strong> The gateway settles only after
              the origin returns a successful response.
            </div>
          </section>

          <section id="agent">
            <h2>Agent setup</h2>
            <h3>1. Read the manifest</h3>
            <p>
              Read the manifest before you pay. It lists the payment terms for
              the gateway.
            </p>
            <CodeBlock>{`curl --include ${gatewayUrl}/.well-known/paycrawl.json`}</CodeBlock>

            <h3>2. Request a paid route</h3>
            <p>
              An unpaid request returns a <code>402</code>. It does not return
              the protected content.
            </p>
            <CodeBlock>{`curl --include ${gatewayUrl}/agent/page/article-1`}</CodeBlock>

            <h3>3. Configure the reference client</h3>
            <p>
              The reference client runs from this repository. It keeps the
              wallet key on the local machine. It checks the payout allowlist
              and the spend limit before it signs.
            </p>
            <CodeBlock>{`git clone ${repositoryUrl}.git
cd paycrawl
pnpm install
cp apps/agent/.env.example apps/agent/.env`}</CodeBlock>
            <p>
              Set <code>PAYCRAWL_PAYER_PRIVATE_KEY</code> and{" "}
              <code>PAYCRAWL_ALLOWED_PAY_TO</code> in{" "}
              <code>apps/agent/.env</code>. Use the address from the manifest.
            </p>
            <CodeBlock>{`pnpm crawl \\
  --url ${gatewayUrl}/agent/page/article-1 \\
  --max-requests 1 \\
  --max-total-usdc 0.001 \\
  --concurrency 1`}</CodeBlock>
            <p>
              See the{" "}
              <a href={agentEnvUrl} target="_blank" rel="noreferrer">
                agent environment file
              </a>{" "}
              for the required values.
            </p>
          </section>

          <section id="publisher">
            <h2>Publisher setup</h2>
            <p>Current publisher deployment is self-hosted.</p>
            <h3>Requirements</h3>
            <ul>
              <li>An HTTPS origin for the protected content.</li>
              <li>An origin token that blocks direct access.</li>
              <li>A Celo wallet address for USDC payments.</li>
              <li>A Cloudflare account for the Worker resources.</li>
            </ul>
            <h3>Deployment</h3>
            <p>
              Create the Worker resources. Add the three secrets. Configure the
              origin, payout address, and route prices. Then deploy the Worker.
            </p>
            <a
              className="button button-primary"
              href={deployUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open deployment guide <span>↗</span>
            </a>
          </section>

          <section id="endpoints">
            <h2>API reference</h2>
            <div className="reference-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>GET</td>
                    <td>
                      <code>/.well-known/paycrawl.json</code>
                    </td>
                    <td>Payment manifest</td>
                  </tr>
                  <tr>
                    <td>GET</td>
                    <td>
                      <code>/agent/page/*</code>
                    </td>
                    <td>402 or paid content</td>
                  </tr>
                  <tr>
                    <td>GET</td>
                    <td>
                      <code>/health</code>
                    </td>
                    <td>Gateway status</td>
                  </tr>
                  <tr>
                    <td>GET</td>
                    <td>
                      <code>/api/stats</code>
                    </td>
                    <td>Public settlement metrics</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="limits">
            <h2>Beta limits</h2>
            <ul>
              <li>Publisher deployment requires a Cloudflare account.</li>
              <li>The agent client is not a published package yet.</li>
              <li>The website does not hold wallet keys or funds.</li>
            </ul>
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
