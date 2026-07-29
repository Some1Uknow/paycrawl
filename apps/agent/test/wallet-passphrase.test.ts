import { describe, expect, it } from "vitest";

import {
  resolveWalletPassphrase,
  type WalletPassphraseStore,
} from "../src/wallet-passphrase.js";

function memoryStore(initial?: string): WalletPassphraseStore & {
  writes: string[];
} {
  let value = initial;
  const writes: string[] = [];
  return {
    writes,
    read: async () => value,
    write: async (passphrase) => {
      writes.push(passphrase);
      value = passphrase;
    },
  };
}

describe("wallet passphrase provider", () => {
  it("prefers the runtime-provided secret", async () => {
    const store = memoryStore();
    await expect(
      resolveWalletPassphrase({
        passphrase: "runtime-owned-secret",
        platform: "darwin",
        store,
      }),
    ).resolves.toBe("runtime-owned-secret");
    expect(store.writes).toEqual([]);
  });

  it("reuses the existing macOS Keychain secret", async () => {
    const store = memoryStore("existing-keychain-secret");
    await expect(
      resolveWalletPassphrase({ platform: "darwin", store }),
    ).resolves.toBe("existing-keychain-secret");
    expect(store.writes).toEqual([]);
  });

  it("creates and stores a macOS Keychain secret once", async () => {
    const store = memoryStore();
    await expect(
      resolveWalletPassphrase({
        platform: "darwin",
        store,
        generatePassphrase: () => "generated-keychain-secret",
      }),
    ).resolves.toBe("generated-keychain-secret");
    expect(store.writes).toEqual(["generated-keychain-secret"]);
  });

  it("requires a runtime secret provider outside macOS", async () => {
    await expect(
      resolveWalletPassphrase({ platform: "linux", environmentPassphrase: "" }),
    ).rejects.toThrow(/secure wallet passphrase provider/);
  });
});
