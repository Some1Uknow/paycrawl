import { ATOMIC_USDC_DECIMALS } from "@paycrawl/shared";

const USDC_INPUT = /^(0|[1-9]\d*)(?:\.(\d{1,6}))?$/;

export function parseUsdc(value: string): bigint {
  const match = USDC_INPUT.exec(value.trim());
  if (!match) {
    throw new Error(
      "USDC amounts must be non-negative decimals with at most 6 fractional digits",
    );
  }

  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? "").padEnd(ATOMIC_USDC_DECIMALS, "0");
  return (
    BigInt(whole) * 10n ** BigInt(ATOMIC_USDC_DECIMALS) +
    BigInt(fraction || "0")
  );
}

export function formatUsdc(amountAtomic: bigint): string {
  const divisor = 10n ** BigInt(ATOMIC_USDC_DECIMALS);
  const whole = amountAtomic / divisor;
  const fraction = (amountAtomic % divisor)
    .toString()
    .padStart(ATOMIC_USDC_DECIMALS, "0");
  return `${whole}.${fraction}`;
}

/**
 * Reservations happen before signing. This intentionally counts an ambiguous
 * network outcome against the remaining budget rather than risking a duplicate
 * authorization after a timeout.
 */
export class SpendBudget {
  private authorizedAtomic = 0n;

  constructor(
    readonly totalLimitAtomic: bigint,
    readonly perRequestLimitAtomic: bigint,
  ) {
    if (totalLimitAtomic <= 0n || perRequestLimitAtomic <= 0n) {
      throw new Error("Budget limits must be greater than zero");
    }
  }

  reserve(amountAtomic: bigint): void {
    if (amountAtomic <= 0n) {
      throw new Error("A payment quote must be greater than zero");
    }
    if (amountAtomic > this.perRequestLimitAtomic) {
      throw new Error(
        `Quote ${formatUsdc(amountAtomic)} USDC exceeds per-request limit ${formatUsdc(this.perRequestLimitAtomic)} USDC`,
      );
    }
    if (this.authorizedAtomic + amountAtomic > this.totalLimitAtomic) {
      throw new Error(
        `Quote would exceed total budget ${formatUsdc(this.totalLimitAtomic)} USDC (already authorized ${formatUsdc(this.authorizedAtomic)} USDC)`,
      );
    }
    this.authorizedAtomic += amountAtomic;
  }

  get authorized(): bigint {
    return this.authorizedAtomic;
  }

  get remaining(): bigint {
    return this.totalLimitAtomic - this.authorizedAtomic;
  }
}
