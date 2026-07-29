import { NextResponse } from "next/server";

const GATEWAY_URL = "https://paycrawl-gateway.raghu250407.workers.dev";
const PAYCRAWL_WALLET = "0x24c9DEAF91f462EE6705F710C4D0aadCbD64b4E7";

export const revalidate = 3600;

export function GET(): NextResponse {
  return NextResponse.json(
    {
      type: "Agent",
      name: "PayCrawl",
      description:
        "A Celo x402 gateway that gives publishers paid, machine-readable access for AI agents.",
      endpoints: [
        {
          type: "wallet",
          address: PAYCRAWL_WALLET,
          chainId: 42220,
        },
      ],
      capabilities: [
        "x402-v2",
        "celo-mainnet-usdc",
        "paid-machine-readable-content",
      ],
      services: [
        {
          type: "x402",
          url: `${GATEWAY_URL}/.well-known/paycrawl.json`,
        },
      ],
      supportedTrust: ["reputation"],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
