import { describe, expect, it } from "vitest";

import {
  hashPayer,
  recordSettlement,
  routeKindFromPath,
  routePatternFromPath,
} from "../src/analytics.js";

describe("receipt analytics", () => {
  it("uses the transaction hash as the deduplication key", async () => {
    const inserted = new Set<string>();
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              async run() {
                statements.push({ sql, values });
                inserted.add(String(values[0]));
                return { success: true };
              },
            };
          },
        };
      },
    } as unknown as D1Database;

    const record = {
      transactionHash: `0x${"b".repeat(64)}` as `0x${string}`,
      payerHash: "a".repeat(64),
      amountAtomic: "1000",
      routePattern: "/agent/page/*" as const,
      latencyMs: 12,
      settledAt: "2026-07-22T00:00:00.000Z",
    };
    await recordSettlement(db, record);
    await recordSettlement(db, record);

    expect(statements).toHaveLength(2);
    expect(statements[0]?.sql).toContain("INSERT OR IGNORE");
    expect(statements[0]?.sql).toContain("payer_hash");
    expect(inserted).toEqual(new Set([record.transactionHash]));
  });

  it("reduces paths to safe route categories for failure telemetry", () => {
    expect(routeKindFromPath("/agent/page/secret-article")).toBe("page");
    expect(routeKindFromPath("/agent/feed/sitemap.xml")).toBe("feed");
    expect(routeKindFromPath("/agent/export/archive.json")).toBe("export");
    expect(routeKindFromPath("/not-a-paid-route")).toBe("unknown");
    expect(routePatternFromPath("/agent/export/archive.json")).toBe(
      "/agent/export/*",
    );
    expect(routePatternFromPath("/not-a-paid-route")).toBeNull();
  });

  it("pseudonymizes payer addresses with a deployment secret", async () => {
    const secret = "abcdef0123456789abcdef0123456789abcdef0123456789";
    const payer = "0x1111111111111111111111111111111111111111";
    await expect(hashPayer(payer, secret)).resolves.toMatch(/^[a-f0-9]{64}$/);
    await expect(hashPayer(payer.toUpperCase(), secret)).resolves.toBe(
      await hashPayer(payer, secret),
    );
  });
});
