import { SiteFooter, SiteNav } from "../../components/site-chrome";

const agentId = "9746";
const owner = "0x24c9DEAF91f462EE6705F710C4D0aadCbD64b4E7";
const identityRegistry = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const agentUri = "https://paycrawl.vercel.app/.well-known/paycrawl-agent.json";
const attributionTag = "celo_468e1efe7287";
const registrationTx =
  "0xe7c8b85f49518d5e73d2e324a4afa6a17de926c23ad7de734512763d65b2d910";

export default function RegisterAgentPage(): React.ReactElement {
  return (
    <main className="registration-page" id="main-content">
      <SiteNav
        links={[
          { href: "/#how-it-works", label: "How it works" },
          { href: "/docs#agent", label: "Agent" },
          { href: "/docs#publisher", label: "Publisher" },
        ]}
        action={{ href: "/docs", label: "Read the docs" }}
      />

      <section className="registration-card">
        <div className="registration-state">
          <span className="signal" aria-hidden="true" />
          Registered on Celo mainnet
        </div>
        <p className="eyebrow">ERC-8004 identity</p>
        <h1>PayCrawl has a registered agent identity.</h1>
        <p>
          The identity is complete. This page is a public record and cannot
          submit another registration transaction.
        </p>
        <dl>
          <div>
            <dt>Agent ID</dt>
            <dd>{agentId}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{owner}</dd>
          </div>
          <div>
            <dt>Registry</dt>
            <dd>{identityRegistry}</dd>
          </div>
          <div>
            <dt>Metadata</dt>
            <dd>{agentUri}</dd>
          </div>
          <div>
            <dt>Attribution</dt>
            <dd>{attributionTag}</dd>
          </div>
        </dl>
        <div className="registration-actions">
          <a
            className="button button-primary"
            href={`https://8004scan.io/agents/celo/${agentId}`}
            target="_blank"
            rel="noreferrer"
          >
            View agent identity <span aria-hidden="true">↗</span>
          </a>
          <a
            className="text-link"
            href={`https://celoscan.io/tx/${registrationTx}`}
            target="_blank"
            rel="noreferrer"
          >
            View registration transaction <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
