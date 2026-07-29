import { LiveMetrics } from "../components/live-metrics";

export const revalidate = 300;

const gatewayUrl = "https://paycrawl-gateway.raghu250407.workers.dev";

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

export default function Home(): React.ReactElement {
  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <a className="brand" href="#top">
          <Mark />
          <span>PayCrawl</span>
        </a>
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#start">Start</a>
          <a href="#live">Live ledger</a>
        </div>
        <a className="nav-cta" href="/docs">
          Read the docs <span>↗</span>
        </a>
      </nav>

      <section className="hero landing-hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow hero-kicker">
            <span className="signal" /> Celo USDC · x402 v2
          </p>
          <h1>
            Content that <em>pays</em> its way.
          </h1>
          <p className="hero-lede">
            PayCrawl lets an AI agent buy machine-readable content in one HTTP
            flow. Publishers get paid directly; agents stay in control of their
            own wallet and budget.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="/docs#agents">
              Install for an agent <span>↗</span>
            </a>
            <a className="button button-quiet" href="/docs#publisher">
              Publish a route <span>↗</span>
            </a>
          </div>
          <p className="microcopy">
            No account with PayCrawl. No shared custody. The payment itself is
            the access credential.
          </p>
        </div>

        <div className="hero-diagram" aria-label="PayCrawl payment sequence">
          <div className="diagram-topline">
            <span>ONE REQUEST / ONE RECEIPT</span>
            <span>USDC / CELO</span>
          </div>
          <div className="trace">
            <div className="trace-node agent-node">
              <span className="node-index">01</span>
              <strong>Ask</strong>
              <small>agent requests content</small>
            </div>
            <div className="trace-arrow">
              <span>402</span>
              <i />
            </div>
            <div className="trace-node gate-node">
              <span className="node-index">02</span>
              <strong>Approve</strong>
              <small>wallet signs exact USDC</small>
            </div>
            <div className="trace-arrow">
              <span>retry</span>
              <i />
            </div>
            <div className="trace-node celo-node">
              <span className="node-index">03</span>
              <strong>Read</strong>
              <small>content and receipt arrive</small>
            </div>
          </div>
          <div className="trace-receipt">
            <span className="receipt-dot" /> <span>PAYMENT-RESPONSE</span>
            <code>on-chain receipt</code>
            <b>only on success</b>
          </div>
          <div className="scanline" />
        </div>
      </section>

      <section className="landing-flow" id="how-it-works">
        <p className="eyebrow">No checkout page</p>
        <h2>Just an ordinary request that knows how to pay.</h2>
        <ol>
          <li>
            <span>01</span>
            <p>Discover a route and its price for free.</p>
          </li>
          <li>
            <span>02</span>
            <p>Accept only the price and publisher your policy allows.</p>
          </li>
          <li>
            <span>03</span>
            <p>Receive content only after the payment settles.</p>
          </li>
        </ol>
        <a
          className="text-link landing-link"
          href={`${gatewayUrl}/agent/page/article-1`}
          target="_blank"
          rel="noreferrer"
        >
          Inspect the live 402 challenge <span>↗</span>
        </a>
      </section>

      <section className="operator-paths" id="start">
        <header>
          <p className="eyebrow">Start with your role</p>
          <h2>Agents pay. Publishers set the terms.</h2>
        </header>
        <div className="operator-grid">
          <article className="operator-card operator-agent">
            <div className="operator-card-topline">
              <span>01 / AGENT</span>
              <span>LOCAL SIGNER</span>
            </div>
            <h3>Give the agent a bounded payer wallet.</h3>
            <ol>
              <li>
                Fund the wallet the agent runtime already controls with Celo
                USDC.
              </li>
              <li>
                Set the publisher allowlist and spend ceiling in the agent
                policy.
              </li>
              <li>
                Install the workflow skill. The agent validates every live quote
                before it signs.
              </li>
            </ol>
            <pre className="operator-code">
              <code>
                npx skills add Some1Uknow/paycrawl \\ --skill paycrawl --agent
                '*' --yes --full-depth
              </code>
            </pre>
            <a className="text-link" href="/docs#agent">
              Agent guide <span>↗</span>
            </a>
          </article>
          <article className="operator-card operator-publisher">
            <div className="operator-card-topline">
              <span>02 / PUBLISHER</span>
              <span>DIRECT PAYOUT</span>
            </div>
            <h3>Put a price in front of protected machine-readable routes.</h3>
            <ol>
              <li>Keep the origin private behind the PayCrawl origin token.</li>
              <li>
                Choose a Celo payout address and an atomic USDC price per route
                pattern.
              </li>
              <li>
                Deploy the gateway. It issues the 402 and settles only after
                delivery.
              </li>
            </ol>
            <p className="operator-note">
              Your payout address receives settlement. PayCrawl does not custody
              publisher revenue.
            </p>
            <a className="text-link" href="/docs#publisher">
              Publisher guide <span>↗</span>
            </a>
          </article>
        </div>
      </section>

      <section id="live" className="live-wrap">
        <LiveMetrics />
      </section>

      <footer>
        <a className="brand" href="#top">
          <Mark />
          <span>PayCrawl</span>
        </a>
        <p>Turn block-or-scrape into pay-per-crawl.</p>
        <a href="/docs">Docs</a>
        <a
          href="https://github.com/Some1Uknow/paycrawl"
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>
      </footer>
    </main>
  );
}
