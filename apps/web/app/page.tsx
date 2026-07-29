import { LiveMetrics } from "../components/live-metrics";
import { SiteFooter, SiteNav } from "../components/site-chrome";

export const revalidate = 300;

const gatewayUrl = "https://paycrawl-gateway.raghu250407.workers.dev";

export default function Home(): React.ReactElement {
  return (
    <main id="main-content">
      <SiteNav
        links={[
          { href: "#how-it-works", label: "How it works" },
          { href: "#start", label: "Start" },
          { href: "#live", label: "Live ledger" },
        ]}
        action={{ href: "/docs", label: "Read the docs" }}
      />

      <section className="hero landing-hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow hero-kicker">
            <span className="signal" aria-hidden="true" /> Celo USDC / x402
          </p>
          <h1>Turn a crawl into a paid request.</h1>
          <p className="hero-lede">
            PayCrawl lets agents buy machine-readable content in one HTTP flow.
            Publishers set the price. The agent validates the quote, signs from
            its own wallet, and receives a receipt with the response.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="/docs#agent">
              Set up an agent <span aria-hidden="true">↗</span>
            </a>
            <a className="button button-secondary" href="/docs#publisher">
              Publish a route <span aria-hidden="true">↗</span>
            </a>
          </div>
          <p className="microcopy">
            No account. No shared custody. Payment authorizes access.
          </p>
        </div>

        <div className="protocol-panel" aria-label="PayCrawl payment sequence">
          <div className="panel-topline">
            <span>REQUEST FLOW</span>
            <span>CELO MAINNET</span>
          </div>
          <ol className="protocol-steps">
            <li>
              <span className="step-index">01</span>
              <div>
                <strong>Request</strong>
                <p>Agent asks for a protected route.</p>
              </div>
              <code>GET /agent/page/*</code>
            </li>
            <li>
              <span className="step-index">02</span>
              <div>
                <strong>Quote</strong>
                <p>Gateway returns price and payout details.</p>
              </div>
              <code>402 PAYMENT REQUIRED</code>
            </li>
            <li>
              <span className="step-index">03</span>
              <div>
                <strong>Pay and read</strong>
                <p>Agent signs the approved quote and retries.</p>
              </div>
              <code>PAYMENT-RESPONSE</code>
            </li>
          </ol>
          <div className="panel-rule">
            Settlement occurs only after successful origin delivery.
          </div>
        </div>
      </section>

      <section className="landing-flow" id="how-it-works">
        <div className="section-heading">
          <p className="eyebrow">One protocol, two operators</p>
          <h2>Set terms once. Pay only when content is delivered.</h2>
        </div>
        <ol className="flow-list">
          <li>
            <span>01</span>
            <div>
              <h3>Discover</h3>
              <p>The agent reads the public manifest and route quote.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Verify</h3>
              <p>Its policy checks the asset, network, price, and publisher.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Settle</h3>
              <p>The gateway releases payment only with a successful response.</p>
            </div>
          </li>
        </ol>
        <a
          className="text-link landing-link"
          href={`${gatewayUrl}/agent/page/article-1`}
          target="_blank"
          rel="noreferrer"
        >
          Inspect the live 402 challenge <span aria-hidden="true">↗</span>
        </a>
      </section>

      <section className="operator-paths" id="start">
        <div className="section-heading">
          <p className="eyebrow">Start with your role</p>
          <h2>Agents keep control. Publishers receive the payment.</h2>
        </div>
        <div className="operator-grid">
          <article className="operator-card operator-agent">
            <div className="operator-card-topline">
              <span>FOR AGENTS</span>
              <span>LOCAL WALLET</span>
            </div>
            <h3>Install the workflow, then set a policy.</h3>
            <p>
              The skill creates or reuses a dedicated payer wallet through the
              agent runtime. It asks for a Celo USDC top-up only when an
              approved request needs one.
            </p>
            <pre className="operator-code">
              <code>{"npx skills add Some1Uknow/paycrawl --skill paycrawl --agent '*' --yes --full-depth"}</code>
            </pre>
            <a className="text-link" href="/docs#agent">
              Agent setup <span aria-hidden="true">↗</span>
            </a>
          </article>
          <article className="operator-card operator-publisher">
            <div className="operator-card-topline">
              <span>FOR PUBLISHERS</span>
              <span>DIRECT PAYOUT</span>
            </div>
            <h3>Protect a route and name its USDC price.</h3>
            <p>
              Keep the origin private, configure the payout address and route
              price, then deploy the gateway to Cloudflare. PayCrawl never
              holds publisher revenue.
            </p>
            <a className="button button-secondary" href="/docs#publisher">
              Publisher setup <span aria-hidden="true">↗</span>
            </a>
          </article>
        </div>
      </section>

      <section id="live" className="live-wrap">
        <LiveMetrics />
      </section>

      <SiteFooter />
    </main>
  );
}
