import {
  chmod,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { resolveWalletPassphrase } from "./wallet-passphrase.js";

const WALLET_VERSION = 1;
const MIN_PASSPHRASE_LENGTH = 16;
const DEFAULT_WALLET_FILE = join(
  homedir(),
  ".paycrawl",
  "wallets",
  "payer-eip155-42220.json",
);

type EncryptedWalletFile = {
  version: typeof WALLET_VERSION;
  network: "eip155:42220";
  address: `0x${string}`;
  kdf: "scrypt";
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

export type PayerWallet = {
  address: `0x${string}`;
  privateKey: `0x${string}`;
  filePath: string;
};

function requirePassphrase(passphrase: string | undefined): string {
  if (!passphrase || passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(
      `PAYCRAWL_WALLET_PASSPHRASE must contain at least ${MIN_PASSPHRASE_LENGTH} characters`,
    );
  }
  return passphrase;
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32, { N: 16_384, r: 8, p: 1 });
}

function encryptPrivateKey(
  privateKey: `0x${string}`,
  address: `0x${string}`,
  passphrase: string,
): EncryptedWalletFile {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  const ciphertext = Buffer.concat([
    cipher.update(privateKey, "utf8"),
    cipher.final(),
  ]);

  return {
    version: WALLET_VERSION,
    network: "eip155:42220",
    address,
    kdf: "scrypt",
    salt: salt.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
}

function decryptPrivateKey(
  stored: EncryptedWalletFile,
  passphrase: string,
): `0x${string}` {
  if (
    stored.version !== WALLET_VERSION ||
    stored.network !== "eip155:42220" ||
    stored.kdf !== "scrypt"
  ) {
    throw new Error("Unsupported PayCrawl wallet file");
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(passphrase, Buffer.from(stored.salt, "base64url")),
      Buffer.from(stored.iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(stored.tag, "base64url"));
    const privateKey = Buffer.concat([
      decipher.update(Buffer.from(stored.ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");

    if (!/^0x[0-9a-f]{64}$/i.test(privateKey)) {
      throw new Error("Invalid decrypted private key");
    }
    return privateKey as `0x${string}`;
  } catch {
    throw new Error("Unable to unlock the PayCrawl wallet file");
  }
}

async function writeWalletFile(
  filePath: string,
  stored: EncryptedWalletFile,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
  // The managed default directory is private. Do not change permissions on a
  // caller-provided parent such as the home or system temp directory.
  if (filePath === DEFAULT_WALLET_FILE) {
    await chmod(dirname(filePath), 0o700);
  }
  const temporaryPath = `${filePath}.${randomBytes(8).toString("hex")}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(stored, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, filePath);
  await chmod(filePath, 0o600);
}

async function assertPrivateWalletFile(filePath: string): Promise<void> {
  const details = await stat(filePath);
  if (!details.isFile()) throw new Error("PAYCRAWL_WALLET_FILE must be a file");
  if (process.platform !== "win32" && (details.mode & 0o077) !== 0) {
    throw new Error("PAYCRAWL_WALLET_FILE must be readable only by its owner");
  }
}

function resolveWalletPath(filePath: string): string {
  return filePath === "~"
    ? homedir()
    : filePath.startsWith("~/")
      ? join(homedir(), filePath.slice(2))
      : filePath;
}

export async function loadOrCreatePayerWallet(options?: {
  filePath?: string;
  passphrase?: string;
}): Promise<PayerWallet> {
  const filePath = resolveWalletPath(
    options?.filePath ??
      process.env.PAYCRAWL_WALLET_FILE ??
      DEFAULT_WALLET_FILE,
  );
  const passphrase = requirePassphrase(
    await resolveWalletPassphrase(
      options?.passphrase ? { passphrase: options.passphrase } : undefined,
    ),
  );

  let raw: string;
  try {
    await assertPrivateWalletFile(filePath);
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const privateKey = generatePrivateKey();
    const address = privateKeyToAccount(privateKey).address;
    await writeWalletFile(
      filePath,
      encryptPrivateKey(privateKey, address, passphrase),
    );
    return { address, privateKey, filePath };
  }

  let stored: EncryptedWalletFile;
  try {
    stored = JSON.parse(raw) as EncryptedWalletFile;
  } catch {
    throw new Error("PAYCRAWL_WALLET_FILE is not valid JSON");
  }

  const privateKey = decryptPrivateKey(stored, passphrase);
  const address = privateKeyToAccount(privateKey).address;
  if (address.toLowerCase() !== stored.address.toLowerCase()) {
    throw new Error("PayCrawl wallet address does not match its encrypted key");
  }
  return { address, privateKey, filePath };
}
