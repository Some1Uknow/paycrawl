import { execFile as executeFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { userInfo } from "node:os";
import { promisify } from "node:util";

const execFile = promisify(executeFile);
const KEYCHAIN_SERVICE = "paycrawl-wallet-passphrase";
const MACOS_SECURITY = "/usr/bin/security";

export type WalletPassphraseStore = {
  read(): Promise<string | undefined>;
  write(passphrase: string): Promise<void>;
};

type SecurityError = Error & { code?: number | string };

function keychainAccount(): string {
  return process.env.USER ?? userInfo().username;
}

function isMissingKeychainItem(error: unknown): boolean {
  return (error as SecurityError).code === 44;
}

class MacOsKeychainPassphraseStore implements WalletPassphraseStore {
  async read(): Promise<string | undefined> {
    try {
      const { stdout } = await execFile(
        MACOS_SECURITY,
        [
          "find-generic-password",
          "-a",
          keychainAccount(),
          "-s",
          KEYCHAIN_SERVICE,
          "-w",
        ],
        { encoding: "utf8", maxBuffer: 4096 },
      );
      return stdout.trimEnd() || undefined;
    } catch (error) {
      if (isMissingKeychainItem(error)) return undefined;
      throw new Error(
        "Unable to read the PayCrawl wallet passphrase from macOS Keychain",
      );
    }
  }

  async write(passphrase: string): Promise<void> {
    try {
      await execFile(
        MACOS_SECURITY,
        [
          "add-generic-password",
          "-a",
          keychainAccount(),
          "-s",
          KEYCHAIN_SERVICE,
          "-w",
          passphrase,
        ],
        { encoding: "utf8", maxBuffer: 4096 },
      );
    } catch (error) {
      throw new Error(
        "Unable to create the PayCrawl wallet passphrase in macOS Keychain",
        { cause: error },
      );
    }
  }
}

/**
 * Resolve the encryption secret without exposing it to an end user. A runtime
 * may inject a passphrase directly; the self-hosted macOS runtime uses a
 * dedicated Keychain entry and provisions it only once.
 */
export async function resolveWalletPassphrase(options?: {
  passphrase?: string;
  environmentPassphrase?: string;
  platform?: NodeJS.Platform;
  store?: WalletPassphraseStore;
  generatePassphrase?: () => string;
}): Promise<string> {
  const provided =
    options?.passphrase ??
    options?.environmentPassphrase ??
    process.env.PAYCRAWL_WALLET_PASSPHRASE;
  if (provided) return provided;

  const platform = options?.platform ?? process.platform;
  if (platform !== "darwin") {
    throw new Error(
      "This runtime needs a secure wallet passphrase provider. Configure PAYCRAWL_WALLET_PASSPHRASE through the agent runtime's secret store",
    );
  }

  const store = options?.store ?? new MacOsKeychainPassphraseStore();
  const existing = await store.read();
  if (existing) return existing;

  const passphrase =
    options?.generatePassphrase?.() ?? randomBytes(32).toString("hex");
  try {
    await store.write(passphrase);
    return passphrase;
  } catch (error) {
    // Another runtime may have provisioned the same Keychain item first.
    const recovered = await store.read().catch(() => undefined);
    if (recovered) return recovered;
    throw error;
  }
}
