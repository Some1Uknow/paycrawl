import { z } from "zod";

const transactionHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Expected a transaction hash");
const atomicAmountSchema = z
  .string()
  .regex(/^\d+$/, "Expected an atomic USDC amount");
const isoDateSchema = z.string().datetime();

export const settlementRecordSchema = z
  .object({
    transactionHash: transactionHashSchema,
    payerHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/, "Expected an HMAC-SHA-256 payer hash"),
    amountAtomic: z
      .string()
      .regex(/^[1-9]\d*$/, "Expected a positive atomic USDC amount"),
    routePattern: z.enum(["/agent/page/*", "/agent/feed/*", "/agent/export/*"]),
    latencyMs: z.number().int().nonnegative().max(120_000),
    settledAt: isoDateSchema,
  })
  .strict();

export type SettlementRecord = z.infer<typeof settlementRecordSchema>;

export const publicMetricsSchema = z
  .object({
    schemaVersion: z.literal(1),
    settlementCount: z.number().int().nonnegative(),
    revenueAtomic: atomicAmountSchema,
    uniquePayerCount: z.number().int().nonnegative(),
    /** Settled payments divided by settled plus verified-and-canceled payments. */
    verifiedDeliveryRate: z.number().min(0).max(1),
    generatedAt: isoDateSchema,
    lastSettlementAt: isoDateSchema.nullable(),
    retentionDays: z.number().int().positive(),
    /** Public receipts intentionally exclude payer identifiers, paths, and payment payload data. */
    receipts: z
      .array(
        z
          .object({
            transactionHash: transactionHashSchema,
            amountAtomic: atomicAmountSchema,
            settledAt: isoDateSchema,
          })
          .strict(),
      )
      .max(12),
  })
  .strict();

export type PublicMetrics = z.infer<typeof publicMetricsSchema>;
