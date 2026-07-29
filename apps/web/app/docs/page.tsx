import type { Metadata } from "next";

import { SiteFooter, SiteNav } from "../../components/site-chrome";

export const metadata: Metadata = {
  title: "PayCrawl documentation",
  description: "Use and deploy PayCrawl on Celo.",
};

const gatewayUrl = "https://paycrawl-gateway.raghu250407.workers.dev";
const repositoryUrl = "https://github.com/Some1Uknow/paycrawl";
const deployUrl = `${repositoryUrl}#deploy-a-publisher-gateway`;

function CodeBlock({ children }: { children: string }): React.ReactElement {
  return (
    <pre className="reference-code">
      <code>{children}</code>
    </pre>
  );
}

export default function DocsPage(): React.ReactElement {
  return (
    <main className="reference-docs" id="main-content">
      <SiteNav
        links={[
          { href: "#agent", label: "Agent" },
          { href: "#publisher", label: "Publisher" },
          { href: "#endpoints", label: "API" },
        ]}
        action={{ href: "/", label: "Product" }}
      />

      <header className="reference-header">
        <p className="eyebrow">Documentation / Public beta</p>
        <h1>PayCrawl</h1>
        <p>
          An x402 gateway for paid machine-readable content on Celo. Agents pay
          in USDC. Publishers receive payment after the gateway delivers the
          content.
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
            <dt>Protocol</dt>
            <dd>x402</dd>
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
            <p className="section-label">01 / Overview</p>
            <h2>How a paid request works</h2>
            <p>
              A publisher protects and prices a machine-readable route. An agent
              discovers the quote, applies its local policy, and pays only when
              the quote is approved. There is no reader checkout and PayCrawl
              does not custody either wallet.
            </p>
            <ol className="docs-sequence">
              <li>
                <span>01</span>
                <p>Send a request to the protected route.</p>
              </li>
              <li>
                <span>02</span>
                <p>
                  Read the <code>402 Payment Required</code> response.
                </p>
              </li>
              <li>
                <span>03</span>
                <p>Validate the price, asset, network, and payout address.</p>
              </li>
              <li>
                <span>04</span>
                <p>Sign the payment with the persistent agent wallet.</p>
              </li>
              <li>
                <span>05</span>
                <p>
                  Retry with <code>PAYMENT-SIGNATURE</code>.
                </p>
              </li>
              <li>
                <span>06</span>
                <p>
                  Read the content and <code>PAYMENT-RESPONSE</code> receipt.
                </p>
              </li>
            </ol>
            <div className="reference-note">
              <strong>Settlement rule</strong>
              <span>
                The gateway settles only after the origin returns a successful
                response.
              </span>
            </div>
          </section>

          <section id="agent">
            <p className="section-label">02 / Agent setup</p>
            <h2>Install once. Let the runtime manage the wallet.</h2>
            <h3>Install the skill</h3>
            <p>
              Add the PayCrawl workflow skill to the agent project. It handles
              discovery, quote validation, payment, and receipt handling.
            </p>
            <CodeBlock>{"npx skills add Some1Uknow/paycrawl --skill paycrawl --agent '*' --yes --full-depth"}</CodeBlock>
            <h3>Set the policy</h3>
            <p>
              Set approved publisher addresses, a per-request ceiling, a total
              budget, and a request limit. The skill rejects a quote outside
              that policy.
            </p>
            <h3>Fund only when asked</h3>
            <p>
              On the first paid crawl, the agent creates a dedicated Celo wallet
              and saves its secure wallet handle for later crawls. If an
              approved request needs funds, it asks for a bounded Celo USDC
              top-up to that wallet. Do not paste a private key or send USDC
              directly to a publisher.
            </p>
            <h3>Ask the agent</h3>
            <CodeBlock>{`Use PayCrawl to crawl ${gatewayUrl}/agent/page/article-1.
Allow only Celo USDC. Do not spend more than 0.001 USDC on this request
or more than 0.01 USDC in total. Return the PAYMENT-RESPONSE receipt.`}</CodeBlock>
          </section>

          <section id="publisher">
            <p className="section-label">03 / Publisher setup</p>
            <h2>Protect the origin. Set the price.</h2>
            <p>
              Publisher deployment is self-hosted. You keep control of the
              origin, payout wallet, route policy, and Cloudflare account.
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
              Lock the origin with its token. Create the Worker resources, then
              add the origin, payout address, and route prices as secrets. Each
              configured <code>/agent/*</code> route then returns its payment
              quote automatically.
            </p>
            <a
              className="button button-primary"
              href={deployUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open deployment guide <span aria-hidden="true">↗</span>
            </a>
          </section>

          <section id="endpoints">
            <p className="section-label">04 / API reference</p>
            <h2>Public endpoints</h2>
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
            <p className="section-label">05 / Beta limits</p>
            <h2>Current limits</h2>
            <ul>
              <li>Publisher deployment requires a Cloudflare account.</li>
              <li>The agent client is not a published package yet.</li>
              <li>The website does not hold wallet keys or funds.</li>
            </ul>
          </section>
        </article>
      </div>

      <SiteFooter />
    </main>
  );
}
