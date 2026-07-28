import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to use PayCrawl",
  description:
    "A practical guide for AI agents and publishers using PayCrawl on Celo.",
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
    <main className="docs-page">
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/">
          <Mark />
          <span>PayCrawl</span>
        </Link>
        <div className="nav-links">
          <a href="#agents">For agents</a>
          <a href="#publishers">For publishers</a>
          <a href="#beta">Beta status</a>
        </div>
        <Link className="nav-cta" href="/">
          Product <span>↗</span>
        </Link>
      </nav>

      <header className="docs-hero">
        <p className="eyebrow">PayCrawl / usage guide</p>
        <h1>
          Two paths.
          <br />
          <em>No repo required for a crawl.</em>
        </h1>
        <p>
          PayCrawl is infrastructure for paid machine-readable content. Agents
          call a publisher&apos;s public gateway; publishers decide whether to
          run their own gateway. No agent needs to deploy this repository to
          make a paid request.
        </p>
        <div className="docs-jump-links">
          <a href="#agents">
            I&apos;m an agent <span>↓</span>
          </a>
          <a href="#publishers">
            I&apos;m a publisher <span>↓</span>
          </a>
        </div>
      </header>

      <section className="path-grid" aria-label="Choose your path">
        <a className="path-card agent-path" href="#agents">
          <span className="path-index">01 / BUY</span>
          <h2>Agents pay for a fetch.</h2>
          <p>
            Discover a free manifest, receive an x402 price, approve it inside
            your own wallet and budget, then receive content plus a receipt.
          </p>
          <b>Use a gateway →</b>
        </a>
        <a className="path-card publisher-path" href="#publishers">
          <span className="path-index">02 / SELL</span>
          <h2>Publishers price a route.</h2>
          <p>
            Put a locked origin behind a PayCrawl Worker, choose exact USDC
            prices, and keep your payout wallet and content under your control.
          </p>
          <b>Set up a gateway →</b>
        </a>
      </section>

      <section className="docs-section agent-guide" id="agents">
        <div className="docs-section-heading">
          <p className="eyebrow">For agents</p>
          <h2>Your agent uses an endpoint, not a deployment.</h2>
          <p>
            The gateway exposes its pricing without authentication. Sending an
            unpaid request is safe: it returns a 402 quote and never reveals the
            protected content.
          </p>
        </div>
        <div className="guide-steps">
          <article>
            <span>1</span>
            <div>
              <h3>Inspect the free manifest</h3>
              <p>
                Read the route prices, Celo network, USDC asset, and publisher
                payout address before you decide to buy.
              </p>
              <a
                className="inline-code-link"
                href={`${gatewayUrl}/.well-known/paycrawl.json`}
                target="_blank"
                rel="noreferrer"
              >
                {gatewayUrl}/.well-known/paycrawl.json ↗
              </a>
            </div>
          </article>
          <article>
            <span>2</span>
            <div>
              <h3>Ask for content and receive a quote</h3>
              <p>
                Request a protected route. The beta gateway returns an x402 v2
                Celo-USDC challenge for <code>0.001 USDC</code>—no wallet or
                payment is needed to inspect that challenge.
              </p>
              <pre className="docs-code">
                <code>{`curl -i ${gatewayUrl}/agent/page/article-1`}</code>
              </pre>
            </div>
          </article>
          <article>
            <span>3</span>
            <div>
              <h3>Pay only within a local budget</h3>
              <p>
                For the beta, use the reference client from the repository or
                integrate the standard x402 flow in your agent. Keep a funded
                payer wallet local, allowlist the publisher wallet, and set a
                hard per-run spending ceiling before signing.
              </p>
              <pre className="docs-code">
                <code>{`pnpm crawl \\
  --url ${gatewayUrl}/agent/page/article-1 \\
  --max-requests 1 \\
  --max-total-usdc 0.001 \\
  --concurrency 1`}</code>
              </pre>
              <p className="guide-note">
                Your private key stays in your own local environment. PayCrawl
                never asks you to paste it into a website or send it to a
                publisher.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="docs-section publisher-guide" id="publishers">
        <div className="docs-section-heading">
          <p className="eyebrow">For publishers</p>
          <h2>Run the gateway beside your content—not inside your CMS.</h2>
          <p>
            A publisher controls the upstream origin, the payout address, route
            prices, and Cloudflare account. The gateway sends the authenticated
            origin request only after a valid payment authorization.
          </p>
        </div>
        <div className="publisher-checklist">
          <article>
            <span>Bring</span>
            <h3>A protected HTTPS origin</h3>
            <p>
              Your origin must reject direct traffic and accept the private
              PayCrawl origin token. It serves your existing machine-readable
              content; it does not need to be rewritten.
            </p>
          </article>
          <article>
            <span>Choose</span>
            <h3>A Celo payout wallet and route policy</h3>
            <p>
              Set a non-custodial payout address and explicit atomic USDC prices
              for routes such as pages, feeds, and exports.
            </p>
          </article>
          <article>
            <span>Deploy</span>
            <h3>Your own Cloudflare Worker</h3>
            <p>
              The current beta is self-hosted: you create the Worker data
              resources and secrets in your Cloudflare account, then deploy the
              gateway template. You do not give PayCrawl custody of content or
              funds.
            </p>
          </article>
        </div>
        <a
          className="button button-primary"
          href={deployUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open publisher deployment guide <span>↗</span>
        </a>
      </section>

      <section className="beta-strip" id="beta">
        <div>
          <p className="eyebrow">An honest beta boundary</p>
          <h2>Hosted onboarding is the next product layer.</h2>
        </div>
        <p>
          Today, agents can use a gateway immediately, while publishers still
          self-host the gateway from this repository. A smooth managed flow—add
          an origin, connect a payout wallet, choose prices, and publish—is not
          live yet. We call that out so no one mistakes the beta template for a
          finished SaaS dashboard.
        </p>
      </section>

      <aside className="limitation docs-limitation">
        <span>Security boundary</span>
        <p>
          PayCrawl makes an authorized agent route paid and auditable. It does
          not stop a malicious actor from scraping a separately public website,
          so publishers should keep their normal origin controls in place.
        </p>
      </aside>

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
