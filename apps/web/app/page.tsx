import { LiveMetrics } from "../components/live-metrics";

export const revalidate = 300;

const gatewayUrl = "https://gateway.your-domain.example";
const deployUrl =
  "https://github.com/Some1Uknow/paycrawl#deploy-a-publisher-gateway";

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
          <a href="#how-it-works">Protocol</a>
          <a href="#install">Install</a>
          <a href="#agent">Agent CLI</a>
        </div>
        <a
          className="nav-cta"
          href={deployUrl}
          target="_blank"
          rel="noreferrer"
        >
          Deployment guide <span>↗</span>
        </a>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow hero-kicker">
            <span className="signal" /> Celo · x402 v2 · edge-native
          </p>
          <h1>
            Make every <em>crawl</em> an honest transaction.
          </h1>
          <p className="hero-lede">
            PayCrawl is a Cloudflare edge gateway for publishers who want AI
            agents to read machine-ready content—and pay a tiny, verifiable USDC
            receipt for every useful fetch.
          </p>
          <div className="hero-actions">
            <a
              className="button button-primary"
              href={deployUrl}
              target="_blank"
              rel="noreferrer"
            >
              Read deployment guide <span>↗</span>
            </a>
            <a className="button button-quiet" href="#live">
              View receipt ledger <span>↓</span>
            </a>
          </div>
          <p className="microcopy">
            No custom contract. No API keys. A signed x402 authorization settles
            on Celo only after content succeeds.
          </p>
        </div>

        <div className="hero-diagram" aria-label="PayCrawl payment sequence">
          <div className="diagram-topline">
            <span>REQUEST TRACE / 001</span>
            <span>USDC / CELO</span>
          </div>
          <div className="trace">
            <div className="trace-node agent-node">
              <span className="node-index">01</span>
              <strong>Agent</strong>
              <small>asks for /agent/page</small>
            </div>
            <div className="trace-arrow">
              <span>402</span>
              <i />
            </div>
            <div className="trace-node gate-node">
              <span className="node-index">02</span>
              <strong>Edge gateway</strong>
              <small>quotes exact USDC</small>
            </div>
            <div className="trace-arrow">
              <span>sign</span>
              <i />
            </div>
            <div className="trace-node celo-node">
              <span className="node-index">03</span>
              <strong>Celo</strong>
              <small>settles after origin OK</small>
            </div>
          </div>
          <div className="trace-receipt">
            <span className="receipt-dot" /> <span>PAYMENT-RESPONSE</span>
            <code>0x7d…e3b</code>
            <b>settled</b>
          </div>
          <div className="scanline" />
        </div>
      </section>

      <section className="tension-band" aria-label="The publisher problem">
        <p>Publishers face an impossible choice:</p>
        <div>
          <span>block agents</span>
          <i>or</i>
          <span>fund unmetered scraping</span>
        </div>
        <strong>
          PayCrawl creates a third route: <em>cooperative paid access.</em>
        </strong>
      </section>

      <section className="protocol-section" id="how-it-works">
        <header className="section-heading">
          <p className="eyebrow">The protocol</p>
          <h2>One request. One bounded authorization. One receipt.</h2>
        </header>
        <ol className="protocol-steps">
          <li>
            <span className="step-number">01</span>
            <div>
              <h3>Discover</h3>
              <p>
                Agents read the free manifest at{" "}
                <code>/.well-known/paycrawl.json</code> and see only Celo USDC
                prices.
              </p>
            </div>
          </li>
          <li>
            <span className="step-number">02</span>
            <div>
              <h3>Challenge</h3>
              <p>
                A request to a paid route receives a standard 402 with a base64{" "}
                <code>PAYMENT-REQUIRED</code> declaration—before a key is ever
                touched.
              </p>
            </div>
          </li>
          <li>
            <span className="step-number">03</span>
            <div>
              <h3>Deliver &amp; settle</h3>
              <p>
                The gateway verifies the authorization, fetches the locked
                publisher origin, then settles only successful GET responses and
                returns <code>PAYMENT-RESPONSE</code>.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="specimen-grid" aria-label="Protocol examples">
        <article className="terminal-card">
          <div className="terminal-bar">
            <span />
            <span />
            <span />
            <b>free discovery</b>
          </div>
          <pre>
            <code>{`GET ${gatewayUrl}/.well-known/paycrawl.json

{
  "protocol": "x402",
  "network": "eip155:42220",
  "asset": "0xcebA…32118C",
  "endpoints": [
    { "pattern": "/agent/page/*", "amountAtomic": "1000" }
  ]
}`}</code>
          </pre>
        </article>
        <article className="terminal-card redline">
          <div className="terminal-bar">
            <span />
            <span />
            <span />
            <b>unpaid request</b>
          </div>
          <pre>
            <code>{`GET ${gatewayUrl}/agent/page/article-1

HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6Miw...
Cache-Control: private, no-store

{ "error": "payment required" }`}</code>
          </pre>
        </article>
      </section>

      <section id="live" className="live-wrap">
        <LiveMetrics />
      </section>

      <section className="install-section" id="install">
        <div className="install-intro">
          <p className="eyebrow">Publisher setup</p>
          <h2>Three steps from origin to paid machine route.</h2>
          <p>
            Each publisher owns their Worker, payout address, and origin token.
            PayCrawl never becomes a shared proxy or custodian.
          </p>
          <a
            className="button button-primary"
            href={deployUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open deployment guide <span>↗</span>
          </a>
        </div>
        <div className="install-steps">
          <article>
            <span>1</span>
            <h3>Create analytics</h3>
            <p>
              Create a D1 database, paste its ID into{" "}
              <code>wrangler.jsonc</code>, then apply the included migration.
            </p>
          </article>
          <article>
            <span>2</span>
            <h3>Lock the origin</h3>
            <p>
              Set high-entropy <code>ORIGIN_TOKEN</code> and{" "}
              <code>ANALYTICS_HMAC_KEY</code> secrets. Configure{" "}
              <code>/healthz</code> to return 204 only when the origin token is
              valid.
            </p>
          </article>
          <article>
            <span>3</span>
            <h3>Set policy</h3>
            <p>
              Supply one HTTPS origin, a Celo payout address, and explicit
              atomic USDC prices for page, feed, and export paths.
            </p>
          </article>
        </div>
      </section>

      <section className="agent-section" id="agent">
        <div>
          <p className="eyebrow">For autonomous buyers</p>
          <h2>
            The agent sets a ceiling <em>before</em> it signs.
          </h2>
          <p>
            The reference CLI decodes the 402, accepts only Celo mainnet USDC
            and local payout allowlists, reserves the budget before
            authorization, and never retries an ambiguous signed request.
          </p>
        </div>
        <div className="command-panel">
          <span className="prompt">$</span>
          <pre>
            <code>{`pnpm crawl \\
  --url ${gatewayUrl}/agent/page/article-1 \\
  --max-requests 100 \\
  --max-total-usdc 0.10 \\
  --concurrency 1`}</code>
          </pre>
          <div className="command-foot">
            <span>payer key: local .env only</span>
            <span>budget: $0.10 maximum</span>
          </div>
        </div>
      </section>

      <section className="demo-section">
        <div>
          <p className="eyebrow">End-to-end demo</p>
          <h2>Watch the entire receipt chain.</h2>
          <p>
            Publish a real mainnet recording only after a token-enforcing
            origin, gateway health check, Celo USDC settlement, queue-backed
            analytics write, and Celoscan receipt have all been verified.
          </p>
        </div>
        <div className="demo-frame">
          <div className="play">✓</div>
          <span>RELEASE ACCEPTANCE REQUIRED</span>
          <small>
            See the deployment guide for the live mainnet checklist.
          </small>
        </div>
      </section>

      <aside className="limitation">
        <span>Important boundary</span>
        <p>
          This cooperative paid machine route does not stop a malicious crawler
          from impersonating a human browser. Publishers should continue to
          protect or restrict their ordinary origin; PayCrawl makes the
          authorized agent path explicit, paid, and auditable.
        </p>
      </aside>

      <footer>
        <a className="brand" href="#top">
          <Mark />
          <span>PayCrawl</span>
        </a>
        <p>Turn block-or-scrape into pay-per-crawl.</p>
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
