import { CELO_NETWORK, CELO_USDC, X402_VERSION } from "./constants";

export type PaymentReceipt = {
  x402Version: typeof X402_VERSION;
  network: typeof CELO_NETWORK;
  asset: typeof CELO_USDC;
  transactionHash: `0x${string}`;
  payer: `0x${string}`;
  payTo: `0x${string}`;
  amountAtomic: string;
  settledAt: string;
};
