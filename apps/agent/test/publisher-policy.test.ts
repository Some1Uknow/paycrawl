import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { ValidatedQuote } from "../src/payment.js";
import { loadPublisherPolicy } from "../src/publisher-policy.js";

const payTo = "0x24c9DEAF91f462EE6705F710C4D0aadCbD64b4E7";
const quote = {
  requirements: {
    scheme: "exact",
    network: "eip155:42220",
    asset: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    amount: "1000",
    payTo,
    maxTimeoutSeconds: 60,
    extra: { name: "USDC", version: "2" },
  },
  amountAtomic: 1000n,
} as ValidatedQuote;

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("publisher approval policy", () => {
  it("persists an explicit approval and limits it to its origin and payout", async () => {
    const directory = await mkdtemp(join(tmpdir(), "paycrawl-policy-"));
    directories.push(directory);
    const filePath = join(directory, "publishers.json");
    const publisherUrl = new URL("https://publisher.example/agent/page/one");
    const policy = await loadPublisherPolicy({ filePath });

    expect(policy.isApproved(publisherUrl, quote)).toBe(false);
    await policy.approve(publisherUrl, quote);
    const stored = await readFile(filePath, "utf8");
    const details = await stat(filePath);
    const reopened = await loadPublisherPolicy({ filePath });

    expect(policy.isApproved(publisherUrl, quote)).toBe(true);
    expect(reopened.isApproved(publisherUrl, quote)).toBe(true);
    expect(
      reopened.isApproved(
        new URL("https://other.example/agent/page/one"),
        quote,
      ),
    ).toBe(false);
    expect(stored).toContain(payTo.toLowerCase());
    expect(details.mode & 0o077).toBe(0);
  });
});
