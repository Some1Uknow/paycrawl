import { createGateway } from "./app.js";
import { pruneAnalytics, recordSettlement } from "./analytics.js";
import type { GatewayBindings } from "./bindings.js";
import { logGatewayEvent } from "./observability.js";
import {
  settlementRecordSchema,
  type SettlementRecord,
} from "@paycrawl/shared";

let cachedKey: string | undefined;
let cachedGateway: ReturnType<typeof createGateway> | undefined;

function appForEnvironment(
  env: GatewayBindings,
): ReturnType<typeof createGateway> {
  // The closure contains the origin token, so rotation naturally creates a new
  // app instance. The key is module-private and never returned or logged.
  const key = `${env.GATEWAY_CONFIG}\u0000${env.ORIGIN_TOKEN}\u0000${env.ANALYTICS_HMAC_KEY}`;
  if (!cachedGateway || cachedKey !== key) {
    cachedKey = key;
    cachedGateway = createGateway(env);
  }
  return cachedGateway;
}

export default {
  async fetch(
    request: Request,
    env: GatewayBindings,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    try {
      return await appForEnvironment(env).fetch(request, env, executionContext);
    } catch {
      return Promise.resolve(
        new Response(
          JSON.stringify({ error: "Gateway configuration is invalid" }),
          {
            status: 500,
            headers: {
              "content-type": "application/json",
              "cache-control": "private, no-store",
              "x-content-type-options": "nosniff",
              "referrer-policy": "no-referrer",
              "x-frame-options": "DENY",
              "content-security-policy":
                "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
              "cross-origin-opener-policy": "same-origin",
              "cross-origin-resource-policy": "same-origin",
            },
          },
        ),
      );
    }
  },
  async queue(
    batch: MessageBatch<SettlementRecord>,
    env: GatewayBindings,
  ): Promise<void> {
    for (const message of batch.messages) {
      const record = settlementRecordSchema.safeParse(message.body);
      if (!record.success) {
        logGatewayEvent("invalid_settlement_analytics_message_discarded");
        message.ack();
        continue;
      }
      try {
        await recordSettlement(env.ANALYTICS, record.data);
        message.ack();
      } catch {
        logGatewayEvent("settlement_analytics_retry_scheduled", {
          attempt: message.attempts,
          transactionHash: record.data.transactionHash,
        });
        message.retry({ delaySeconds: Math.min(60, 2 ** message.attempts) });
      }
    }
  },
  async scheduled(
    _event: ScheduledEvent,
    env: GatewayBindings,
    executionContext: ExecutionContext,
  ): Promise<void> {
    executionContext.waitUntil(
      pruneAnalytics(env.ANALYTICS).catch(() => {
        logGatewayEvent("analytics_retention_prune_failed");
      }),
    );
  },
};

export { createGateway } from "./app.js";
export type { GatewayBindings } from "./bindings.js";
