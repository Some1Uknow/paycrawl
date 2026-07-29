import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadOrCreatePayerWallet } from "../src/wallet.js";

const passphrase = "test-only-passphrase-for-wallet";
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("encrypted payer wallet", () => {
  it("creates, locks, and reuses one wallet file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "paycrawl-wallet-"));
    directories.push(directory);
    const filePath = join(directory, "payer.json");

    const created = await loadOrCreatePayerWallet({ filePath, passphrase });
    const reused = await loadOrCreatePayerWallet({ filePath, passphrase });
    const contents = await readFile(filePath, "utf8");
    const fileDetails = await stat(filePath);

    expect(reused.address).toBe(created.address);
    expect(contents).not.toContain(created.privateKey);
    expect(fileDetails.mode & 0o077).toBe(0);
  });

  it("rejects a wrong passphrase without exposing key material", async () => {
    const directory = await mkdtemp(join(tmpdir(), "paycrawl-wallet-"));
    directories.push(directory);
    const filePath = join(directory, "payer.json");
    await loadOrCreatePayerWallet({ filePath, passphrase });

    await expect(
      loadOrCreatePayerWallet({ filePath, passphrase: "wrong-passphrase" }),
    ).rejects.toThrow("Unable to unlock the PayCrawl wallet file");
  });
});
