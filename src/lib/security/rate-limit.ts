import crypto from "crypto";

export type RateLimitScope =
  | "auth_login"
  | "auth_signup"
  | "password_reset"
  | "search"
  | "checkout"
  | "coupon"
  | "review"
  | "contact"
  | "upload"
  | "general_api";

interface LimitRule {
  requests: number;
  windowSeconds: number;
}

const RULES: Record<RateLimitScope, LimitRule> = {
  auth_login: { requests: 10, windowSeconds: 300 },
  auth_signup: { requests: 5, windowSeconds: 600 },
  password_reset: { requests: 5, windowSeconds: 900 },
  search: { requests: 60, windowSeconds: 60 },
  checkout: { requests: 15, windowSeconds: 300 },
  coupon: { requests: 20, windowSeconds: 300 },
  review: { requests: 10, windowSeconds: 600 },
  contact: { requests: 8, windowSeconds: 600 },
  upload: { requests: 20, windowSeconds: 300 },
  general_api: { requests: 120, windowSeconds: 60 },
};

// Local sliding-window fallback store when Upstash credentials are not set
const memoryBuckets = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Queries Upstash Redis REST /pipeline for an atomic sliding-window count.
 */
async function checkUpstashSlidingWindow(
  scope: RateLimitScope,
  identifier: string,
  rule: LimitRule
): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = now - windowMs;
  const key = `triodealers:rl:${scope}:${identifier}`;
  const member = `${now}:${crypto.randomUUID()}`;

  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["ZREMRANGEBYSCORE", key, "-inf", String(windowStart)],
      ["ZADD", key, String(now), member],
      ["ZCARD", key],
      ["PEXPIRE", key, String(windowMs)],
    ]),
    cache: "no-store",
  });

  if (!res.ok) return null;
  const results = (await res.json()) as Array<{ result?: number | string }>;
  const count = Number(results?.[2]?.result ?? 0);
  const allowed = count <= rule.requests;

  return {
    allowed,
    limit: rule.requests,
    remaining: Math.max(0, rule.requests - count),
    resetAt: now + windowMs,
  };
}

/**
 * Enforces sliding-window rate limits per identifier (IP or IP+userId) across Upstash Redis REST or in-memory fallback.
 */
export async function checkRateLimit(
  scope: RateLimitScope,
  identifier: string,
  customRule?: LimitRule
): Promise<RateLimitResult> {
  const rule = customRule || RULES[scope];
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;

  try {
    const upstash = await checkUpstashSlidingWindow(scope, identifier, rule);
    if (upstash) return upstash;
  } catch {
    // Fall back cleanly if Upstash is temporarily unreachable
  }

  const bucketKey = `${scope}:${identifier}`;
  const existing = memoryBuckets.get(bucketKey) || [];
  const valid = existing.filter((ts) => now - ts < windowMs);

  if (valid.length >= rule.requests) {
    memoryBuckets.set(bucketKey, valid);
    const oldest = valid[0] || now;
    return {
      allowed: false,
      limit: rule.requests,
      remaining: 0,
      resetAt: oldest + windowMs,
    };
  }

  valid.push(now);
  memoryBuckets.set(bucketKey, valid);

  return {
    allowed: true,
    limit: rule.requests,
    remaining: Math.max(0, rule.requests - valid.length),
    resetAt: now + windowMs,
  };
}

export function resetMemoryRateLimits(): void {
  memoryBuckets.clear();
}
