#!/usr/bin/env node
import "dotenv/config";

import { Command } from "commander";

import { SpendBudget, formatUsdc, parseUsdc } from "./budget.js";
import { crawlOne, formatResult } from "./crawl.js";
import { parsePayToAllowlist } from "./payment.js";
import { loadPublisherPolicy } from "./publisher-policy.js";
import { loadOrCreatePayerWallet } from "./wallet.js";

type CommandOptions = {
  urls: string[];
  maxRequests: string;
  maxTotalUsdc: string;
  maxPerRequestUsdc?: string;
  concurrency: string;
  maxResponseBytes: string;
  approvePublisher?: boolean;
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
  const targets = [...new Set(options.urls)].slice(0, maxRequests);
  if (targets.length === 0) {
    throw new Error("At least one --url is required");
  }
  if (options.approvePublisher && targets.length !== 1) {
    throw new Error(
      "--approve-publisher accepts one target at a time so the approval terms stay explicit",
    );
  }

  const budget = new SpendBudget(totalLimit, perRequestLimit);
  const wallet = await loadOrCreatePayerWallet();
  const publisherPolicy = await loadPublisherPolicy();
  const hardPayoutRestriction = process.env.PAYCRAWL_ALLOWED_PAY_TO
    ? parsePayToAllowlist(process.env.PAYCRAWL_ALLOWED_PAY_TO)
    : undefined;
  process.stderr.write(
    `PayCrawl: ${targets.length} target(s), concurrency ${concurrency}, total budget ${formatUsdc(totalLimit)} USDC, per-request cap ${formatUsdc(perRequestLimit)} USDC\nPayer wallet: ${wallet.address}\nWallet file: ${wallet.filePath}\nPublisher policy: ${publisherPolicy.filePath}\n`,
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
            privateKey: wallet.privateKey,
            resolvePayoutAllowlist: async (quote) => {
              const payTo = quote.requirements.payTo.toLowerCase();
              if (hardPayoutRestriction && !hardPayoutRestriction.has(payTo)) {
                throw new Error(
                  `Publisher payout ${quote.requirements.payTo} is outside PAYCRAWL_ALLOWED_PAY_TO`,
                );
              }

              const requestedUrl = new URL(target);
              if (publisherPolicy.isApproved(requestedUrl, quote)) {
                return new Set([payTo]);
              }
              if (!options.approvePublisher) {
                throw new Error(
                  `Publisher approval required: ${requestedUrl.origin} proposes ${formatUsdc(quote.amountAtomic)} Celo USDC to ${quote.requirements.payTo}. Review the quote, then rerun this one target with --approve-publisher`,
                );
              }

              const approval = await publisherPolicy.approve(
                requestedUrl,
                quote,
              );
              process.stderr.write(
                `Approved publisher: ${approval.origin} → ${approval.payTo} (Celo USDC)\n`,
              );
              return new Set([payTo]);
            },
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
  .option(
    "--approve-publisher",
    "persist approval for the validated publisher quoted by this one target",
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
