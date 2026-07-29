import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PayCrawl documentation",
  description: "Use and deploy PayCrawl on Celo.",
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
            <p>
              PayCrawl has two operators: a publisher protects and prices a
              machine-readable route; an agent discovers its quote and pays it
              within a local policy. There is no reader checkout and PayCrawl
              does not custody either wallet.
            </p>
            <ol>
              <li>
                <span>Send a request to the route.</span>
              </li>
              <li>
                <span>
                  Read the <code>402 Payment Required</code> response.
                </span>
              </li>
              <li>
                <span>
                  Validate the price, asset, network, and payout address.
                </span>
              </li>
              <li>
                <span>Sign the payment with the local wallet.</span>
              </li>
              <li>
                <span>
                  Retry the request with <code>PAYMENT-SIGNATURE</code>.
                </span>
              </li>
              <li>
                <span>
                  Read the content and <code>PAYMENT-RESPONSE</code> receipt.
                </span>
              </li>
            </ol>
            <div className="reference-note">
              <strong>Settlement rule.</strong> The gateway settles only after
              the origin returns a successful response.
            </div>
          </section>

          <section id="agent">
            <h2>Agent setup</h2>
            <h3>Install the skill</h3>
            <p>
              Install the PayCrawl workflow skill in the agent project. It
              supports all detected skill-aware agents.
            </p>
            <CodeBlock>
              {
                "npx skills add Some1Uknow/paycrawl --skill paycrawl --agent '*' --yes --full-depth"
              }
            </CodeBlock>
            <p>
              The skill owns discovery, quote validation, payment, and receipt
              handling. It uses the agent runtime&apos;s approved signer.
            </p>
            <h3>Give the agent authority once</h3>
            <p>
              Connect a funded Celo mainnet USDC wallet through the agent
              runtime&apos;s own wallet or secret manager. Do not send USDC
              directly to a publisher and never paste a key into chat.
            </p>
            <p>
              Approve publisher addresses, a per-request ceiling, a total
              budget, and a request limit. The skill refuses any quote outside
              that policy.
            </p>
            <h3>Ask the agent</h3>
            <p>
              Give the agent a route and the limits you want. It reads the
              manifest, checks the live quote, and returns the content with its
              receipt.
            </p>
            <CodeBlock>{`Use PayCrawl to crawl ${gatewayUrl}/agent/page/article-1.
Allow only Celo USDC. Do not spend more than 0.001 USDC on this request
or more than 0.01 USDC in total. Return the PAYMENT-RESPONSE receipt.`}</CodeBlock>
          </section>

          <section id="publisher">
            <h2>Publisher setup</h2>
            <p>
              Current publisher deployment is self-hosted. The publisher keeps
              control of the origin, payout wallet, route policy, and Cloudflare
              account.
            </p>
            <h3>Requirements</h3>
            <ul>
              <li>An HTTPS origin for the protected content.</li>
              <li>An origin token that blocks direct access.</li>
              <li>A Celo wallet address for USDC payments.</li>
              <li>A Cloudflare account for the Worker resources.</li>
            </ul>
            <h3>Publish a paid route</h3>
            <p>
              Lock the origin with the generated token. Create the Worker
              resources, then add the origin, payout address, and route prices
              as secrets. When deployed, each configured <code>/agent/*</code>{" "}
              route returns its quote to an agent automatically.
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
