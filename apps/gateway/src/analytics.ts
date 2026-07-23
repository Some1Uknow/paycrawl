import {
  settlementRecordSchema,
  type PublicMetrics,
  type SettlementRecord,
} from "@paycrawl/shared";

type D1Count = { count: number };
type Revenue = { revenueAtomic: number | string | null };
type LatestSettlement = { settledAt: string | null };
type ReceiptRow = {
  transactionHash: string;
  amountAtomic: string;
  settledAt: string;
};

export type RouteKind = "page" | "feed" | "export" | "unknown";
export const ANALYTICS_RETENTION_DAYS = 90;
const D1_WRITE_ATTEMPTS = 3;

export function routeKindFromPath(pathname: string): RouteKind {
  if (pathname.startsWith("/agent/page/")) return "page";
  if (pathname.startsWith("/agent/feed/")) return "feed";
  if (pathname.startsWith("/agent/export/")) return "export";
  return "unknown";
}

export function routePatternFromPath(
  pathname: string,
): SettlementRecord["routePattern"] | null {
  const routeKind = routeKindFromPath(pathname);
  if (routeKind === "unknown") return null;
  return `/agent/${routeKind}/*`;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withD1Retry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < D1_WRITE_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt + 1 < D1_WRITE_ATTEMPTS) await delay(25 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("D1 write failed");
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

export async function hashPayer(
  payer: string,
  hmacKey: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(hmacKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payer.toLowerCase()),
  );
  return bytesToHex(signature);
}

export async function recordSettlement(
  db: D1Database,
  record: SettlementRecord,
): Promise<void> {
  const safeRecord = settlementRecordSchema.parse(record);
  await withD1Retry(() =>
    db
      .prepare(
        `INSERT OR IGNORE INTO settlements
          (transaction_hash, payer_hash, amount_atomic, route_pattern, latency_ms, settled_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        safeRecord.transactionHash,
        safeRecord.payerHash,
        safeRecord.amountAtomic,
        safeRecord.routePattern,
        safeRecord.latencyMs,
        safeRecord.settledAt,
      )
      .run(),
  );
}

export async function recordCanceledVerifiedPayment(
  db: D1Database,
  routeKind: RouteKind,
  occurredAt: string,
): Promise<void> {
  await withD1Retry(() =>
    db
      .prepare(
        "INSERT INTO payment_attempts (route_kind, outcome, occurred_at) VALUES (?, ?, ?)",
      )
      .bind(routeKind, "canceled", occurredAt)
      .run(),
  );
}

export async function getPublicMetrics(
  db: D1Database,
  now = new Date(),
): Promise<PublicMetrics> {
  const [settlements, payers, revenue, canceled, latestSettlement, receipts] =
    await Promise.all([
      db.prepare("SELECT COUNT(*) AS count FROM settlements").first<D1Count>(),
      db
        .prepare("SELECT COUNT(DISTINCT payer_hash) AS count FROM settlements")
        .first<D1Count>(),
      db
        .prepare(
          "SELECT COALESCE(SUM(CAST(amount_atomic AS INTEGER)), 0) AS revenueAtomic FROM settlements",
        )
        .first<Revenue>(),
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM payment_attempts WHERE outcome = ?",
        )
        .bind("canceled")
        .first<D1Count>(),
      db
        .prepare("SELECT MAX(settled_at) AS settledAt FROM settlements")
        .first<LatestSettlement>(),
      db
        .prepare(
          `SELECT transaction_hash AS transactionHash, amount_atomic AS amountAtomic, settled_at AS settledAt
         FROM settlements ORDER BY settled_at DESC LIMIT 12`,
        )
        .all<ReceiptRow>(),
    ]);

  const settlementCount = settlements?.count ?? 0;
  const canceledCount = canceled?.count ?? 0;
  const totalCompletedOrCanceled = settlementCount + canceledCount;

  return {
    schemaVersion: 1,
    settlementCount,
    revenueAtomic: String(revenue?.revenueAtomic ?? 0),
    uniquePayerCount: payers?.count ?? 0,
    verifiedDeliveryRate:
      totalCompletedOrCanceled === 0
        ? 0
        : settlementCount / totalCompletedOrCanceled,
    generatedAt: now.toISOString(),
    lastSettlementAt: latestSettlement?.settledAt ?? null,
    retentionDays: ANALYTICS_RETENTION_DAYS,
    receipts: (receipts.results ?? []).map((receipt) => ({
      transactionHash: receipt.transactionHash as `0x${string}`,
      amountAtomic: receipt.amountAtomic,
      settledAt: receipt.settledAt,
    })),
  };
}

export async function pruneAnalytics(
  db: D1Database,
  now = new Date(),
): Promise<void> {
  const cutoff = new Date(
    now.getTime() - ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  await Promise.all([
    withD1Retry(() =>
      db
        .prepare("DELETE FROM settlements WHERE settled_at < ?")
        .bind(cutoff)
        .run(),
    ),
    withD1Retry(() =>
      db
        .prepare("DELETE FROM payment_attempts WHERE occurred_at < ?")
        .bind(cutoff)
        .run(),
    ),
  ]);
}
