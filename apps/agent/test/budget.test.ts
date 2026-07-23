import { describe, expect, it } from "vitest";

import { SpendBudget, formatUsdc, parseUsdc } from "../src/budget.js";

describe("USDC budget", () => {
  it("preserves six-decimal atomic precision", () => {
    expect(parseUsdc("0.001")).toBe(1000n);
    expect(parseUsdc("0.10")).toBe(100000n);
    expect(formatUsdc(1000n)).toBe("0.001000");
  });

  it("blocks per-request and total overspend before signing", () => {
    const budget = new SpendBudget(9000n, 5000n);
    budget.reserve(5000n);
    expect(() => budget.reserve(5001n)).toThrow(/per-request/);
    expect(() => budget.reserve(5000n)).toThrow(/total budget/);
  });
});
