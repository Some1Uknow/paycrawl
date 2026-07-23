import type { SettlementRecord } from "@paycrawl/shared";

export type GatewayBindings = {
  ANALYTICS: D1Database;
  SETTLEMENT_QUEUE: Queue<SettlementRecord>;
  GATEWAY_CONFIG: string;
  ORIGIN_TOKEN: string;
  ANALYTICS_HMAC_KEY: string;
};

export type GatewayVariables = {
  requestStartedAt: number;
};
