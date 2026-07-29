import {
  chmod,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { CELO_NETWORK, CELO_USDC, isEvmAddress } from "@paycrawl/shared";

import type { ValidatedQuote } from "./payment.js";

const POLICY_VERSION = 1;
const DEFAULT_POLICY_FILE = join(
  homedir(),
  ".paycrawl",
  "policies",
  "publishers-eip155-42220.json",
);

export type PublisherApproval = {
  origin: string;
  payTo: `0x${string}`;
  network: typeof CELO_NETWORK;
  asset: typeof CELO_USDC;
  approvedAt: string;
};

type StoredPublisherPolicy = {
  version: typeof POLICY_VERSION;
  approvals: PublisherApproval[];
};

function normalizeAddress(address: string): `0x${string}` {
  return address.toLowerCase() as `0x${string}`;
}

function normalizeOrigin(url: URL): string {
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(
      "Publisher approvals require an HTTPS origin without credentials",
    );
  }
  return url.origin.toLowerCase();
}

function approvalKey(origin: string, payTo: string): string {
  return `${origin}\u0000${normalizeAddress(payTo)}`;
}

function resolvePolicyPath(filePath: string): string {
  return filePath === "~"
    ? homedir()
    : filePath.startsWith("~/")
      ? join(homedir(), filePath.slice(2))
      : filePath;
}

function quotePayTo(quote: ValidatedQuote): `0x${string}` {
  return normalizeAddress(quote.requirements.payTo);
}

function assertApproval(value: unknown): PublisherApproval {
  if (!value || typeof value !== "object") {
    throw new Error("Publisher policy contains an invalid approval");
  }
  const approval = value as Partial<PublisherApproval>;
  let origin: string;
  try {
    origin = normalizeOrigin(new URL(approval.origin ?? ""));
  } catch {
    throw new Error("Publisher policy contains an invalid origin");
  }
  const payTo = approval.payTo;
  if (typeof payTo !== "string" || !isEvmAddress(payTo)) {
    throw new Error("Publisher policy contains an invalid payout address");
  }
  if (approval.network !== CELO_NETWORK || approval.asset !== CELO_USDC) {
    throw new Error("Publisher policy contains an unsupported payment route");
  }
  if (
    typeof approval.approvedAt !== "string" ||
    !Number.isFinite(Date.parse(approval.approvedAt))
  ) {
    throw new Error("Publisher policy contains an invalid approval timestamp");
  }
  return {
    origin,
    payTo: normalizeAddress(payTo),
    network: CELO_NETWORK,
    asset: CELO_USDC,
    approvedAt: approval.approvedAt,
  };
}

async function assertPrivatePolicyFile(filePath: string): Promise<void> {
  const details = await stat(filePath);
  if (!details.isFile()) {
    throw new Error("PAYCRAWL_PUBLISHER_POLICY_FILE must be a file");
  }
  if (process.platform !== "win32" && (details.mode & 0o077) !== 0) {
    throw new Error(
      "PAYCRAWL_PUBLISHER_POLICY_FILE must be readable only by its owner",
    );
  }
}

async function writePolicyFile(
  filePath: string,
  policy: StoredPublisherPolicy,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
  await chmod(dirname(filePath), 0o700);
  const temporaryPath = `${filePath}.${randomBytes(8).toString("hex")}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(policy, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, filePath);
  await chmod(filePath, 0o600);
}

/**
 * A durable local policy for publishers the agent has explicitly approved.
 * It intentionally contains no signing material; wallet custody stays in the
 * dedicated wallet module.
 */
export class PublisherPolicy {
  private readonly approvals = new Map<string, PublisherApproval>();
  private writes: Promise<void> = Promise.resolve();

  constructor(
    readonly filePath: string,
    approvals: PublisherApproval[],
  ) {
    for (const approval of approvals) {
      this.approvals.set(
        approvalKey(approval.origin, approval.payTo),
        approval,
      );
    }
  }

  isApproved(requestedUrl: URL, quote: ValidatedQuote): boolean {
    const origin = normalizeOrigin(requestedUrl);
    return this.approvals.has(approvalKey(origin, quotePayTo(quote)));
  }

  async approve(
    requestedUrl: URL,
    quote: ValidatedQuote,
  ): Promise<PublisherApproval> {
    const origin = normalizeOrigin(requestedUrl);
    const payTo = quotePayTo(quote);
    const key = approvalKey(origin, payTo);
    const existing = this.approvals.get(key);
    if (existing) return existing;

    const approval: PublisherApproval = {
      origin,
      payTo,
      network: CELO_NETWORK,
      asset: CELO_USDC,
      approvedAt: new Date().toISOString(),
    };
    this.approvals.set(key, approval);
    const persist = this.writes.then(async () => {
      await writePolicyFile(this.filePath, {
        version: POLICY_VERSION,
        approvals: [...this.approvals.values()],
      });
    });
    this.writes = persist.catch(() => undefined);
    try {
      await persist;
    } catch (error) {
      this.approvals.delete(key);
      throw error;
    }
    return approval;
  }
}

export async function loadPublisherPolicy(options?: {
  filePath?: string;
}): Promise<PublisherPolicy> {
  const filePath = resolvePolicyPath(
    options?.filePath ??
      process.env.PAYCRAWL_PUBLISHER_POLICY_FILE ??
      DEFAULT_POLICY_FILE,
  );

  let raw: string;
  try {
    await assertPrivatePolicyFile(filePath);
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new PublisherPolicy(filePath, []);
    }
    throw error;
  }

  let stored: StoredPublisherPolicy;
  try {
    stored = JSON.parse(raw) as StoredPublisherPolicy;
  } catch {
    throw new Error("PAYCRAWL_PUBLISHER_POLICY_FILE is not valid JSON");
  }
  if (stored.version !== POLICY_VERSION || !Array.isArray(stored.approvals)) {
    throw new Error("Unsupported PayCrawl publisher policy file");
  }

  return new PublisherPolicy(filePath, stored.approvals.map(assertApproval));
}
