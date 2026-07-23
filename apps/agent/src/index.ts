#!/usr/bin/env node
import "dotenv/config";

import { Command } from "commander";

import { SpendBudget, formatUsdc, parseUsdc } from "./budget.js";
import { crawlOne, formatResult } from "./crawl.js";
import { parsePayToAllowlist } from "./payment.js";

type CommandOptions = {
  urls: string[];
  maxRequests: string;
  maxTotalUsdc: string;
  maxPerRequestUsdc?: string;
  concurrency: string;
  maxResponseBytes: string;
};

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

async function run(options: CommandOptions): Promise<void> {
  const maxRequests = parsePositiveInteger(options.maxRequests, "max-requests");
  const concurrency = parsePositiveInteger(options.concurrency, "concurrency");
  const maxResponseBytes = parsePositiveInteger(
    options.maxResponseBytes,
    "max-response-bytes",
  );
  const totalLimit = parseUsdc(options.maxTotalUsdc);
  const perRequestLimit = parseUsdc(
    options.maxPerRequestUsdc ?? options.maxTotalUsdc,
  );
  const privateKey = process.env.PAYCRAWL_PAYER_PRIVATE_KEY as
    `0x${string}` | undefined;
  if (!privateKey) {
    throw new Error(
      "PAYCRAWL_PAYER_PRIVATE_KEY is required in an uncommitted local environment file",
    );
  }

  const targets = [...new Set(options.urls)].slice(0, maxRequests);
  if (targets.length === 0) {
    throw new Error("At least one --url is required");
  }

  const budget = new SpendBudget(totalLimit, perRequestLimit);
  const payoutAllowlist = parsePayToAllowlist(
    process.env.PAYCRAWL_ALLOWED_PAY_TO,
  );
  process.stderr.write(
    `PayCrawl: ${targets.length} target(s), concurrency ${concurrency}, total budget ${formatUsdc(totalLimit)} USDC, per-request cap ${formatUsdc(perRequestLimit)} USDC\n`,
  );

  let cursor = 0;
  const nextTarget = (): string | undefined => {
    const target = targets[cursor];
    cursor += 1;
    return target;
  };

  // Keeping each worker independent allows a caller to opt into concurrency,
  // while SpendBudget reserves synchronously before every signature.
  const workers = Array.from(
    { length: Math.min(concurrency, targets.length) },
    async () => {
      for (;;) {
        const target = nextTarget();
        if (!target) return;
        try {
          const result = await crawlOne({
            url: target,
            privateKey,
            payoutAllowlist,
            budget,
            maxResponseBytes,
          });
          process.stdout.write(`${formatResult(result)}\n`);
          if (result.content) process.stdout.write(`${result.content}\n`);
        } catch (error) {
          process.stderr.write(
            `crawl failed for ${target}: ${error instanceof Error ? error.message : "unknown error"}\n`,
          );
        }
      }
    },
  );

  await Promise.all(workers);
  process.stderr.write(
    `Authorized budget: ${formatUsdc(budget.authorized)} USDC; remaining: ${formatUsdc(budget.remaining)} USDC\n`,
  );
}

const program = new Command();
program
  .name("paycrawl")
  .description("Safely crawl paid PayCrawl resources over x402")
  .requiredOption(
    "--url <url>",
    "protected PayCrawl URL; repeat the option for multiple targets",
    collect,
    [],
  )
  .option("--max-requests <count>", "maximum URLs to process", "100")
  .requiredOption(
    "--max-total-usdc <amount>",
    "maximum total USDC authorization",
  )
  .option(
    "--max-per-request-usdc <amount>",
    "maximum USDC authorization for a single request (defaults to --max-total-usdc)",
  )
  .option("--concurrency <count>", "number of independent crawl workers", "1")
  .option(
    "--max-response-bytes <bytes>",
    "maximum content bytes accepted from a publisher",
    "2097152",
  )
  .action(async (options: CommandOptions) => {
    await run(options);
  });

program.parseAsync().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "PayCrawl failed"}\n`,
  );
  process.exitCode = 1;
});

export { run };
