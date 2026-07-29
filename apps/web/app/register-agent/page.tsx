"use client";

import { useState } from "react";

const chainId = "0xa4ec";
const expectedOwner = "0x5287c8e5017edeec5f733fa926676c21ffcb8b65";
const identityRegistry = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const agentUri = "https://paycrawl.vercel.app/.well-known/paycrawl-agent.json";
const registerData =
  "0xf2c298be0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003b68747470733a2f2f706179637261776c2e76657263656c2e6170702f2e77656c6c2d6b6e6f776e2f706179637261776c2d6167656e742e6a736f6e0000000000";

type Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

function provider(): Provider {
  const value = (window as Window & { ethereum?: Provider }).ethereum;
  if (!value) {
    throw new Error("Open this page in the browser wallet that owns PayCrawl.");
  }
  return value;
}

async function switchToCelo(wallet: Provider): Promise<void> {
  try {
    await wallet.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await wallet.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: "Celo Mainnet",
          nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
          rpcUrls: ["https://forno.celo.org"],
          blockExplorerUrls: ["https://celoscan.io"],
        },
      ],
    });
  }
}

export default function RegisterAgentPage(): React.ReactElement {
  const [status, setStatus] = useState(
    "Connect the registered PayCrawl wallet.",
  );
  const [busy, setBusy] = useState(false);
  const [transaction, setTransaction] = useState<string>();

  async function register(): Promise<void> {
    setBusy(true);
    setTransaction(undefined);
    try {
      const wallet = provider();
      await switchToCelo(wallet);
      const accounts = await wallet.request({ method: "eth_requestAccounts" });
      const account = Array.isArray(accounts) ? accounts[0] : undefined;
      if (
        typeof account !== "string" ||
        account.toLowerCase() !== expectedOwner
      ) {
        throw new Error(
          "Connect the wallet recorded in PayCrawl’s registration metadata.",
        );
      }
      setStatus("Confirm the ERC-8004 identity registration in your wallet…");
      const hash = await wallet.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: account,
            to: identityRegistry,
            data: registerData,
            value: "0x0",
          },
        ],
      });
      if (typeof hash !== "string" || !hash.startsWith("0x")) {
        throw new Error("The wallet did not return a transaction hash.");
      }
      setTransaction(hash);
      setStatus(
        "Transaction submitted. Wait for confirmation, then return to the agent with this hash.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not submit registration.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="registration-page">
      <section className="registration-card">
        <p className="eyebrow">Operator action · Celo mainnet</p>
        <h1>Register PayCrawl&apos;s agent identity.</h1>
        <p>
          This mints one ERC-8004 identity NFT for the wallet already published
          in PayCrawl&apos;s metadata. The wallet signs directly; PayCrawl never
          sees a key.
        </p>
        <dl>
          <div>
            <dt>Owner</dt>
            <dd>{expectedOwner}</dd>
          </div>
          <div>
            <dt>Registry</dt>
            <dd>{identityRegistry}</dd>
          </div>
          <div>
            <dt>Metadata</dt>
            <dd>{agentUri}</dd>
          </div>
        </dl>
        <button
          className="button button-primary"
          type="button"
          onClick={() => void register()}
          disabled={busy}
        >
          {busy ? "Awaiting wallet…" : "Connect & register"}
        </button>
        <p className="registration-status" role="status">
          {status}
        </p>
        {transaction ? (
          <a
            className="text-link"
            href={`https://celoscan.io/tx/${transaction}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction on CeloScan <span>↗</span>
          </a>
        ) : null}
      </section>
    </main>
  );
}
