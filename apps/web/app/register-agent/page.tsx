const agentId = "9746";
const owner = "0x24c9DEAF91f462EE6705F710C4D0aadCbD64b4E7";
const identityRegistry = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const agentUri = "https://paycrawl.vercel.app/.well-known/paycrawl-agent.json";
const attributionTag = "celo_468e1efe7287";
const registrationTx =
  "0xe7c8b85f49518d5e73d2e324a4afa6a17de926c23ad7de734512763d65b2d910";

export default function RegisterAgentPage(): React.ReactElement {
  return (
    <main className="registration-page">
      <section className="registration-card">
        <p className="eyebrow">Celo mainnet · registered</p>
        <h1>PayCrawl&apos;s agent identity is registered.</h1>
        <p>
          The ERC-8004 identity has been minted. This page no longer submits a
          registration transaction, so it cannot create a duplicate identity.
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
        <a
          className="button button-primary"
          href={`https://8004scan.io/agents/celo/${agentId}`}
          target="_blank"
          rel="noreferrer"
        >
          View agent identity <span>↗</span>
        </a>
        <p className="registration-status" role="status">
          Registration transaction: {registrationTx}
        </p>
      </section>
    </main>
  );
}
