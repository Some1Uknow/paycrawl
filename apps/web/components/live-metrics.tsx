"use client";

import type { PublicMetrics } from "@paycrawl/shared";
import { useEffect, useState } from "react";

type MetricsState =
  | { status: "loading"; metrics?: undefined; error?: undefined }
  | { status: "ready"; metrics: PublicMetrics; error?: undefined }
  | { status: "unavailable"; metrics?: undefined; error: string };

function formatUsdc(amountAtomic: string): string {
  try {
    const value = BigInt(amountAtomic);
    const whole = value / 1_000_000n;
    const fraction = (value % 1_000_000n)
      .toString()
      .padStart(6, "0")
      .replace(/0+$/, "");
    return `${whole}${fraction ? `.${fraction}` : ""}`;
  } catch {
    return "—";
  }
}

function formatSuccessRate(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "No settlements yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Timestamp unavailable"
    : date.toLocaleString();
}

export function LiveMetrics(): React.ReactElement {
  const [state, setState] = useState<MetricsState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function refresh(): Promise<void> {
      try {
        const response = await fetch("/api/stats", { cache: "no-store" });
        const result = (await response.json()) as PublicMetrics & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(result.error ?? "Live metrics are unavailable");
        if (active) setState({ status: "ready", metrics: result });
      } catch (error) {
        if (active) {
          setState({
            status: "unavailable",
            error:
              error instanceof Error
                ? error.message
                : "Live metrics are unavailable",
          });
        }
      }
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (state.status !== "ready") {
    return (
      <section className="live-console" aria-labelledby="live-console-heading">
        <div className="console-heading">
          <div>
            <p className="eyebrow">Settlement telemetry</p>
            <h2 id="live-console-heading">The receipt ledger</h2>
          </div>
          <span
            className={`status-chip ${state.status === "loading" ? "pending" : "offline"}`}
          >
            {state.status === "loading" ? "connecting" : "gateway unavailable"}
          </span>
        </div>
        <p className="console-empty">
          {state.status === "loading"
            ? "Connecting to the publisher gateway…"
            : `${state.error}. Set PAYCRAWL_GATEWAY_URL to enable verified gateway analytics.`}
        </p>
      </section>
    );
  }

  const { metrics } = state;
  return (
    <section className="live-console" aria-labelledby="live-console-heading">
      <div className="console-heading">
        <div>
          <p className="eyebrow">Settlement telemetry</p>
          <h2 id="live-console-heading">The receipt ledger</h2>
        </div>
        <span className="status-chip">gateway analytics · 30s refresh</span>
      </div>

      <div className="metric-grid">
        <div className="metric">
          <span>Settlements</span>
          <strong>{metrics.settlementCount.toLocaleString()}</strong>
        </div>
        <div className="metric">
          <span>USDC revenue</span>
          <strong>${formatUsdc(metrics.revenueAtomic)}</strong>
        </div>
        <div className="metric">
          <span>Unique payers</span>
          <strong>{metrics.uniquePayerCount.toLocaleString()}</strong>
        </div>
        <div className="metric">
          <span>Verified delivery rate</span>
          <strong>{formatSuccessRate(metrics.verifiedDeliveryRate)}</strong>
        </div>
      </div>

      <p className="console-empty" aria-live="polite">
        Generated {formatTimestamp(metrics.generatedAt)} · Last settlement{" "}
        {formatTimestamp(metrics.lastSettlementAt)} · Aggregates retain at most{" "}
        {metrics.retentionDays} days of pseudonymized analytics.
      </p>

      <div
        className="receipt-list"
        aria-label="Recent public settlement receipts"
      >
        <div className="receipt-label">Recent public receipts</div>
        {metrics.receipts.length === 0 ? (
          <p className="console-empty">
            No settled receipts yet. The first real Celo settlement will appear
            here.
          </p>
        ) : (
          metrics.receipts.map((receipt) => (
            <a
              className="receipt"
              key={receipt.transactionHash}
              href={`https://celoscan.io/tx/${receipt.transactionHash}`}
              target="_blank"
              rel="noreferrer"
            >
              <span>
                {receipt.transactionHash.slice(0, 10)}…
                {receipt.transactionHash.slice(-8)}
              </span>
              <span>${formatUsdc(receipt.amountAtomic)}</span>
              <span>{new Date(receipt.settledAt).toLocaleString()}</span>
              <span aria-hidden="true">↗</span>
            </a>
          ))
        )}
      </div>
    </section>
  );
}
