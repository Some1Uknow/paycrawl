import {
  isForbiddenPublicHostname,
  publicMetricsSchema,
} from "@paycrawl/shared";
import { NextResponse } from "next/server";

const STATS_TIMEOUT_MS = 8_000;
const MAX_STATS_RESPONSE_BYTES = 64 * 1024;

function configuredGatewayUrl(): URL | null {
  const raw = process.env.PAYCRAWL_GATEWAY_URL?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      isForbiddenPublicHostname(url.hostname)
    ) {
      return null;
    }
    return new URL(url.origin);
  } catch {
    return null;
  }
}

async function readChunkWithAbort(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (signal.aborted) throw new Error("Gateway stats response timed out");

  let removeAbortListener: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    const abort = () => reject(new Error("Gateway stats response timed out"));
    signal.addEventListener("abort", abort, { once: true });
    removeAbortListener = () => signal.removeEventListener("abort", abort);
  });

  try {
    return await Promise.race([reader.read(), aborted]);
  } finally {
    removeAbortListener?.();
  }
}

async function readJsonWithinLimit(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("Gateway stats response was not JSON");
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_STATS_RESPONSE_BYTES
  ) {
    await response.body?.cancel();
    throw new Error("Gateway stats response exceeded the size limit");
  }

  if (!response.body) throw new Error("Gateway stats response was empty");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await readChunkWithAbort(reader, signal);
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_STATS_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Gateway stats response exceeded the size limit");
      }
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function GET(): Promise<NextResponse> {
  const gatewayUrl = configuredGatewayUrl();
  if (!gatewayUrl) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "PAYCRAWL_GATEWAY_URL is not configured with a public HTTPS gateway",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STATS_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${gatewayUrl.toString()}/api/stats`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!upstream.ok) throw new Error("Gateway stats endpoint was unavailable");

    const parsed = publicMetricsSchema.safeParse(
      await readJsonWithinLimit(upstream, controller.signal),
    );
    if (!parsed.success)
      throw new Error(
        "Gateway stats response did not match the public metrics schema",
      );

    return NextResponse.json(parsed.data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        configured: true,
        error:
          "The configured gateway could not provide verified public metrics",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    clearTimeout(timeout);
  }
}
