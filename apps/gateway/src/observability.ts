type SafeLogValue = boolean | number | string;

/**
 * Emits redacted, machine-queryable events for Worker logs. Callers must pass
 * only route categories, public transaction hashes, and operational metadata;
 * never headers, payment payloads, URLs, payer addresses, or secrets.
 */
export function logGatewayEvent(
  event: string,
  fields: Record<string, SafeLogValue> = {},
): void {
  console.error(
    JSON.stringify({
      service: "paycrawl-gateway",
      event,
      at: new Date().toISOString(),
      ...fields,
    }),
  );
}
