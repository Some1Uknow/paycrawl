import { PROTECTED_ROUTE_PREFIXES } from "./constants";

const encodedSeparator = /%2f|%5c/i;
const duplicateSlash = /\/{2,}/g;

export function normalizeProtectedPath(pathname: string): string | null {
  if (!pathname.startsWith("/") || encodedSeparator.test(pathname)) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (
    decoded.includes("\\") ||
    decoded.split("/").includes("..") ||
    decoded.includes("\u0000")
  ) {
    return null;
  }

  const normalized = decoded.replace(duplicateSlash, "/");
  if (
    !PROTECTED_ROUTE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  ) {
    return null;
  }

  return normalized;
}

export function pathMatchesPattern(pathname: string, pattern: string): boolean {
  const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
  return pathname.startsWith(prefix);
}
