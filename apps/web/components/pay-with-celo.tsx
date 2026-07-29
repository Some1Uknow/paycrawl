"use client";

import { CELO_NETWORK, CELO_USDC } from "@paycrawl/shared";
import { ExactEvmScheme, type ClientEvmSigner } from "@x402/evm";
import {
  wrapFetchWithPayment,
  x402Client,
  x402HTTPClient,
  type PaymentRequired,
  type PaymentRequirements,
} from "@x402/fetch";
import { useState } from "react";

const gatewayUrl = "https://paycrawl-gateway.raghu250407.workers.dev";
const routeUrl = `${gatewayUrl}/agent/page/article-1`;
const celoChainId = "0xa4ec";
const expectedPayTo = "0x5287c8e5017edeec5f733fa926676c21ffcb8b65";

type WalletProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

type Quote = {
  requirements: PaymentRequirements;
  amount: bigint;
};

type Receipt = {
  transaction?: string;
  amount?: string;
};

const caps = [
  { label: "0.001 USDC", value: "1000" },
  { label: "0.01 USDC", value: "10000" },
  { label: "0.10 USDC", value: "100000" },
];

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatUsdc(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${fraction.replace(/0+$/, "") || "0"}`;
}

function isExpectedRequirement(requirement: PaymentRequirements): boolean {
  return (
    requirement.scheme === "exact" &&
    requirement.network === CELO_NETWORK &&
    requirement.asset.toLowerCase() === CELO_USDC.toLowerCase() &&
    requirement.extra.name === "USDC" &&
    requirement.extra.version === "2" &&
    requirement.payTo.toLowerCase() === expectedPayTo
  );
}

function validateQuote(
  paymentRequired: PaymentRequired,
  requestedUrl: URL,
): Quote {
  if (paymentRequired.x402Version !== 2) {
    throw new Error("This route did not return x402 v2 terms.");
  }

  const resource = new URL(paymentRequired.resource.url);
  if (resource.href !== requestedUrl.href) {
    throw new Error(
      "The payment challenge does not match the requested route.",
    );
  }

  const accepted = paymentRequired.accepts.filter(isExpectedRequirement);
  if (accepted.length !== 1 || !accepted[0]) {
    throw new Error("The quote is not the approved Celo USDC payment route.");
  }
  if (!/^[1-9]\d*$/.test(accepted[0].amount)) {
    throw new Error("The quote amount is invalid.");
  }

  return { requirements: accepted[0], amount: BigInt(accepted[0].amount) };
}

function browserWallet(): WalletProvider {
  const provider = (window as Window & { ethereum?: WalletProvider }).ethereum;
  if (!provider) {
    throw new Error("Open this page in a Celo-compatible browser wallet.");
  }
  return provider;
}

async function selectCelo(provider: WalletProvider): Promise<void> {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: celoChainId }],
    });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: celoChainId,
          chainName: "Celo Mainnet",
          nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
          rpcUrls: ["https://forno.celo.org"],
          blockExplorerUrls: ["https://celoscan.io"],
        },
      ],
    });
  }
}

function signedWallet(
  provider: WalletProvider,
  address: `0x${string}`,
): ClientEvmSigner {
  return {
    address,
    async signTypedData({ domain, types, primaryType, message }) {
      const signature = await provider.request({
        method: "eth_signTypedData_v4",
        params: [
          address,
          JSON.stringify({ domain, types, primaryType, message }),
        ],
      });
      if (typeof signature !== "string" || !signature.startsWith("0x")) {
        throw new Error("The wallet did not return a valid payment signature.");
      }
      return signature as `0x${string}`;
    },
  };
}

function readableContent(html: string): string {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  return (parsed.body.textContent ?? html).replace(/\s+\n/g, "\n").trim();
}

export function PayWithCelo(): React.ReactElement {
  const [address, setAddress] = useState<`0x${string}`>();
  const [quote, setQuote] = useState<Quote>();
  const [cap, setCap] = useState("1000");
  const [state, setState] = useState<
    "idle" | "loading" | "signing" | "paid" | "error"
  >("idle");
  const [notice, setNotice] = useState(
    "Request the live quote before you connect a wallet.",
  );
  const [content, setContent] = useState<string>();
  const [receipt, setReceipt] = useState<Receipt>();

  async function loadQuote(): Promise<Quote> {
    setState("loading");
    setNotice("Reading the live payment terms…");
    setContent(undefined);
    setReceipt(undefined);
    try {
      const response = await fetch(routeUrl, {
        method: "GET",
        redirect: "error",
      });
      if (response.status !== 402) {
        throw new Error(`Expected a 402 quote; received ${response.status}.`);
      }
      const httpClient = new x402HTTPClient(new x402Client());
      const paymentRequired = httpClient.getPaymentRequiredResponse((name) =>
        response.headers.get(name),
      );
      const nextQuote = validateQuote(paymentRequired, new URL(routeUrl));
      setQuote(nextQuote);
      setNotice("Quote verified. Connect a wallet when you are ready to sign.");
      setState("idle");
      return nextQuote;
    } catch (error) {
      setState("error");
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not read the live quote.",
      );
      throw error;
    }
  }

  async function connect(): Promise<void> {
    setState("loading");
    setNotice("Connecting your Celo wallet…");
    try {
      const provider = browserWallet();
      await selectCelo(provider);
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });
      const first = Array.isArray(accounts) ? accounts[0] : undefined;
      if (typeof first !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(first)) {
        throw new Error("The wallet did not provide an EVM address.");
      }
      setAddress(first as `0x${string}`);
      setNotice(
        "Wallet connected. The exact quote remains visible before you sign.",
      );
      setState("idle");
    } catch (error) {
      setState("error");
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not connect the wallet.",
      );
    }
  }

  async function pay(): Promise<void> {
    if (!address) {
      await connect();
      return;
    }

    setState("signing");
    setNotice("Verifying the quote again before the wallet signs…");
    setContent(undefined);
    setReceipt(undefined);
    try {
      const provider = browserWallet();
      const maximum = BigInt(cap);
      let quoteForPayment = quote;
      if (!quoteForPayment) quoteForPayment = await loadQuote();
      if (quoteForPayment.amount > maximum) {
        throw new Error(
          `The live price exceeds your ${formatUsdc(maximum)} USDC cap.`,
        );
      }

      const client = new x402Client((_version, requirements) => {
        const paymentRequired: PaymentRequired = {
          x402Version: 2,
          resource: { url: routeUrl },
          accepts: requirements,
        };
        const checked = validateQuote(paymentRequired, new URL(routeUrl));
        if (checked.amount > maximum) {
          throw new Error(
            `The live price exceeds your ${formatUsdc(maximum)} USDC cap.`,
          );
        }
        return checked.requirements;
      }).register(
        CELO_NETWORK,
        new ExactEvmScheme(signedWallet(provider, address)),
      );
      client.onBeforePaymentCreation(async ({ paymentRequired }) => {
        const checked = validateQuote(paymentRequired, new URL(routeUrl));
        if (checked.amount > maximum) {
          throw new Error(
            `The live price exceeds your ${formatUsdc(maximum)} USDC cap.`,
          );
        }
        setNotice("Confirm the exact USDC authorization in your wallet…");
      });

      const httpClient = new x402HTTPClient(client);
      const paidFetch = wrapFetchWithPayment(fetch, httpClient);
      const response = await paidFetch(routeUrl, {
        method: "GET",
        redirect: "error",
      });
      if (!response.ok) {
        throw new Error(
          `The paid request returned ${response.status}. No retry was sent.`,
        );
      }
      const paymentResponse = response.headers.get("payment-response");
      if (!paymentResponse)
        throw new Error("The response did not include a payment receipt.");
      const settled = httpClient.getPaymentSettleResponse((name) =>
        response.headers.get(name),
      );
      setReceipt(settled as Receipt);
      setContent(readableContent(await response.text()));
      setNotice("Payment settled. Content and receipt are below.");
      setState("paid");
    } catch (error) {
      setState("error");
      setNotice(
        `Payment was not retried automatically. ${error instanceof Error ? error.message : "Check the wallet and receipt before trying again."}`,
      );
    }
  }

  return (
    <section className="wallet-checkout" id="try" aria-labelledby="try-title">
      <div className="checkout-intro">
        <p className="eyebrow">Live checkout · Celo mainnet</p>
        <h2 id="try-title">Use the route from your wallet.</h2>
        <p>
          Read the signed payment terms first. PayCrawl does not hold a balance,
          store a key, or create a wallet for you.
        </p>
      </div>

      <div className="checkout-card">
        <div className="checkout-topline">
          <span>LIVE ROUTE</span>
          <code>/agent/page/article-1</code>
          <span className={`checkout-state state-${state}`}>
            {state === "paid" ? "SETTLED" : "READY"}
          </span>
        </div>
        <div className="checkout-terms">
          <div>
            <span>Asset</span>
            <strong>Celo USDC</strong>
          </div>
          <div>
            <span>Price</span>
            <strong>
              {quote ? `${formatUsdc(quote.amount)} USDC` : "Read quote"}
            </strong>
          </div>
          <div>
            <span>Publisher</span>
            <strong>{shortAddress(expectedPayTo)}</strong>
          </div>
        </div>
        <div className="checkout-controls">
          <label>
            <span>Hard cap for this request</span>
            <select
              value={cap}
              onChange={(event) => setCap(event.target.value)}
              disabled={state === "loading" || state === "signing"}
            >
              {caps.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="checkout-actions">
            <button
              className="button button-quiet"
              type="button"
              onClick={() => void loadQuote()}
              disabled={state === "loading" || state === "signing"}
            >
              {quote ? "Refresh quote" : "Read live quote"}
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={() => void (address ? pay() : connect())}
              disabled={state === "loading" || state === "signing"}
            >
              {state === "loading"
                ? "Working…"
                : state === "signing"
                  ? "Awaiting wallet…"
                  : address
                    ? "Sign & read"
                    : "Connect wallet"}
            </button>
          </div>
        </div>
        <p
          className={`checkout-notice ${state === "error" ? "is-error" : ""}`}
          role="status"
        >
          {notice}
        </p>
        <p className="checkout-wallet">
          {address
            ? `Connected: ${shortAddress(address)}`
            : "No wallet connected"}{" "}
          · Each payment requires a wallet confirmation in this beta.
        </p>
        {receipt?.transaction ? (
          <a
            className="checkout-receipt"
            href={`https://celoscan.io/tx/${receipt.transaction}`}
            target="_blank"
            rel="noreferrer"
          >
            <span>PAYMENT-RESPONSE</span>
            <code>{receipt.transaction}</code>
            <b>View on CeloScan ↗</b>
          </a>
        ) : null}
        {content ? <pre className="checkout-content">{content}</pre> : null}
      </div>
    </section>
  );
}
