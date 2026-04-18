import { afterEach, describe, expect, it } from "vitest";
import { checkLlmRateLimit, checkRateLimit, getClientIdentifier, getRateLimitConfig, llmRateLimitHeaders, rateLimitHeaders } from "../lib/rateLimit";

const originalLimit = process.env.RATE_LIMIT_MAX_REQUESTS;
const originalWindow = process.env.RATE_LIMIT_WINDOW_SECONDS;
const originalLlmLimit = process.env.LLM_RATE_LIMIT_MAX_REQUESTS;
const originalLlmWindow = process.env.LLM_RATE_LIMIT_WINDOW_SECONDS;
const originalUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalUpstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const originalKvUrl = process.env.KV_REST_API_URL;
const originalKvToken = process.env.KV_REST_API_TOKEN;

afterEach(() => {
  restoreEnv("RATE_LIMIT_MAX_REQUESTS", originalLimit);
  restoreEnv("RATE_LIMIT_WINDOW_SECONDS", originalWindow);
  restoreEnv("LLM_RATE_LIMIT_MAX_REQUESTS", originalLlmLimit);
  restoreEnv("LLM_RATE_LIMIT_WINDOW_SECONDS", originalLlmWindow);
  restoreEnv("UPSTASH_REDIS_REST_URL", originalUpstashUrl);
  restoreEnv("UPSTASH_REDIS_REST_TOKEN", originalUpstashToken);
  restoreEnv("KV_REST_API_URL", originalKvUrl);
  restoreEnv("KV_REST_API_TOKEN", originalKvToken);
});

describe("rate limiting", () => {
  it("defaults anonymous repo analysis to 15 requests per hour", () => {
    delete process.env.RATE_LIMIT_MAX_REQUESTS;
    delete process.env.RATE_LIMIT_WINDOW_SECONDS;

    expect(getRateLimitConfig()).toMatchObject({
      limit: 15,
      windowSeconds: 3600
    });
  });

  it("blocks requests after the configured in-memory limit", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    process.env.RATE_LIMIT_MAX_REQUESTS = "2";
    process.env.RATE_LIMIT_WINDOW_SECONDS = "60";

    const identifier = `test-${Date.now()}`;
    const first = await checkRateLimit(identifier, 1_000);
    const second = await checkRateLimit(identifier, 1_000);
    const third = await checkRateLimit(identifier, 1_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("blocks fresh LLM summaries after the configured daily IP limit", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    process.env.LLM_RATE_LIMIT_MAX_REQUESTS = "2";
    process.env.LLM_RATE_LIMIT_WINDOW_SECONDS = "86400";

    const identifier = `llm-test-${Date.now()}`;
    const first = await checkLlmRateLimit(identifier, 1_000);
    const second = await checkLlmRateLimit(identifier, 1_000);
    const third = await checkLlmRateLimit(identifier, 1_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.limit).toBe(2);
  });

  it("uses forwarding headers for client identity", () => {
    const request = new Request("http://localhost/api/analyze", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1"
      }
    });

    expect(getClientIdentifier(request)).toBe("203.0.113.10");
  });

  it("emits standard rate-limit headers", () => {
    const headers = rateLimitHeaders({
      allowed: false,
      limit: 10,
      remaining: 0,
      resetAt: 2_000,
      retryAfter: 2,
      key: "test"
    });

    expect(headers).toMatchObject({
      "X-RateLimit-Limit": "10",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": "2",
      "Retry-After": "2"
    });
  });

  it("emits LLM-specific rate-limit headers", () => {
    const headers = llmRateLimitHeaders({
      allowed: false,
      limit: 5,
      remaining: 0,
      resetAt: 86_400_000,
      retryAfter: 60,
      key: "test"
    });

    expect(headers).toMatchObject({
      "X-LLMRateLimit-Limit": "5",
      "X-LLMRateLimit-Remaining": "0",
      "X-LLMRateLimit-Reset": "86400",
      "X-LLMRateLimit-RetryAfter": "60"
    });
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
