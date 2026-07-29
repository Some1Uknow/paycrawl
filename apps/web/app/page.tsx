import { LiveMetrics } from "../components/live-metrics";
import { HeroChat } from "../components/hero-chat";
import { MotionReveal, PinnedGallery } from "../components/motion";
import { SiteFooter, SiteNav } from "../components/site-chrome";
import Image from "next/image";

export const revalidate = 300;

const gatewayUrl = "https://paycrawl-gateway.raghu250407.workers.dev";
const celoWordmark =
  "https://framerusercontent.com/images/ENL3ZjX9OnprxVs5u8A81khADqA.webp?width=592&height=256";

export default function Home(): React.ReactElement {
  return (
    <main className="site-shell" id="main-content">
      <SiteNav
        links={[
          { href: "#how-it-works", label: "How it works" },
          { href: "#start", label: "Start" },
          { href: "#live", label: "Live ledger" },
        ]}
        action={{ href: "/docs", label: "Read the docs" }}
      />

      <MotionReveal className="motion-section">
        <section className="hero landing-hero" id="top">
          <div className="hero-copy" data-reveal>
            <h1>AI agents pay for content.</h1>
            <p className="hero-lede">
              Publishers set a price. Agents check it, pay from their own
              wallet, and get the content.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="/docs#agent">
                Set up an agent <span aria-hidden="true">↗</span>
              </a>
              <a className="button button-secondary" href="/docs#publisher">
                Publish a route <span aria-hidden="true">↗</span>
              </a>
            </div>
            <div className="hero-powered">
              <span>Powered by</span>
              <Image src={celoWordmark} alt="Celo" width={74} height={32} />
            </div>
            <p className="microcopy">
              No account. No shared custody. Payment authorizes access.
            </p>
          </div>

          <HeroChat />
        </section>
      </MotionReveal>

      <div
        className="protocol-marquee"
        aria-label="PayCrawl protocol capabilities"
      >
        <div>
          <span>Manifest discovery</span>
          <span>Policy validation</span>
          <span>Celo USDC</span>
          <span>Verified delivery</span>
          <span>Payment receipt</span>
          <span aria-hidden="true">Manifest discovery</span>
          <span aria-hidden="true">Policy validation</span>
          <span aria-hidden="true">Celo USDC</span>
          <span aria-hidden="true">Verified delivery</span>
          <span aria-hidden="true">Payment receipt</span>
        </div>
      </div>

      <MotionReveal className="motion-section">
        <section className="landing-flow" id="how-it-works" data-reveal>
          <div className="section-heading">
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
                <p>
                  Its policy checks the asset, network, price, and publisher.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Settle</h3>
                <p>
                  The gateway releases payment only with a successful response.
                </p>
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
      </MotionReveal>

      <PinnedGallery className="operator-motion">
        <section className="operator-paths" id="start">
          <div className="section-heading" data-gallery-heading>
            <h2>Agents keep control. Publishers receive the payment.</h2>
          </div>
          <div className="operator-grid">
            <article className="operator-card operator-agent" data-motion-media>
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
                <code>
                  {
                    "npx skills add Some1Uknow/paycrawl --skill paycrawl --agent '*' --yes --full-depth"
                  }
                </code>
              </pre>
              <a className="text-link" href="/docs#agent">
                Agent setup <span aria-hidden="true">↗</span>
              </a>
            </article>
            <article
              className="operator-card operator-publisher"
              data-motion-media
            >
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
      </PinnedGallery>

      <MotionReveal className="motion-section">
        <section id="live" className="live-wrap" data-reveal>
          <LiveMetrics />
        </section>
      </MotionReveal>

      <SiteFooter />
    </main>
  );
}
