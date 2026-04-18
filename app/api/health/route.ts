import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getAnalysisCacheClient } from "@/lib/cache";
import { fetchWithTimeout, getTimeoutConfig, withTimeout } from "@/lib/timeouts";

type CheckStatus = "pass" | "fail" | "skip";

type HealthCheck = {
  status: CheckStatus;
  detail: string;
};

type HealthPayload = {
  status: "ok" | "degraded" | "unauthorized";
  generatedAt: string;
  checks: {
    app: HealthCheck;
    github: HealthCheck;
    openai: HealthCheck;
    redis: HealthCheck;
  };
};

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        status: "unauthorized",
        generatedAt: new Date().toISOString(),
        checks: {
          app: { status: "pass", detail: "Health endpoint is reachable." },
          github: { status: "skip", detail: "Unauthorized." },
          openai: { status: "skip", detail: "Unauthorized." },
          redis: { status: "skip", detail: "Unauthorized." }
        }
      } satisfies HealthPayload,
      { status: 401 }
    );
  }

  const deep = new URL(request.url).searchParams.get("deep") === "1";
  const checks = {
    app: { status: "pass", detail: "App server is reachable." } satisfies HealthCheck,
    github: await checkGitHub(deep),
    openai: await checkOpenAI(deep),
    redis: await checkRedis(deep)
  };
  const status = Object.values(checks).some((check) => check.status === "fail") ? "degraded" : "ok";

  return NextResponse.json({
    status,
    generatedAt: new Date().toISOString(),
    checks
  } satisfies HealthPayload);
}

function isAuthorized(request: Request): boolean {
  const expected = process.env.HEALTHCHECK_TOKEN;
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }

  const provided = request.headers.get("x-codeatlas-health-token");
  return provided === expected;
}

async function checkGitHub(deep: boolean): Promise<HealthCheck> {
  if (!process.env.GITHUB_TOKEN) {
    return { status: "skip", detail: "GITHUB_TOKEN is not configured." };
  }

  if (!deep) {
    return { status: "pass", detail: "GITHUB_TOKEN is configured. Use ?deep=1 for live validation." };
  }

  try {
    const response = await fetchWithTimeout(
      "https://api.github.com/rate_limit",
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          "User-Agent": "CodeAtlas Healthcheck"
        }
      },
      getTimeoutConfig().githubMs,
      "GitHub healthcheck timed out."
    );

    if (!response.ok) {
      return { status: "fail", detail: `GitHub returned ${response.status}.` };
    }

    return { status: "pass", detail: "GitHub token validated against rate_limit endpoint." };
  } catch (error) {
    return { status: "fail", detail: error instanceof Error ? error.message : "GitHub validation failed." };
  }
}

async function checkOpenAI(deep: boolean): Promise<HealthCheck> {
  if (!process.env.OPENAI_API_KEY) {
    return { status: "skip", detail: "OPENAI_API_KEY is not configured." };
  }

  if (!deep) {
    return { status: "pass", detail: "OPENAI_API_KEY is configured. Use ?deep=1 for live validation." };
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL_FAST || "gpt-4.1-mini";
    await withTimeout(client.models.retrieve(model), getTimeoutConfig().llmMs, "OpenAI model validation timed out.");
    return { status: "pass", detail: `OpenAI key validated with model ${model}.` };
  } catch (error) {
    return { status: "fail", detail: error instanceof Error ? error.message : "OpenAI validation failed." };
  }
}

async function checkRedis(deep: boolean): Promise<HealthCheck> {
  const client = getAnalysisCacheClient();
  if (!client) {
    return { status: "skip", detail: "Redis env vars are not configured." };
  }

  if (!deep) {
    return { status: "pass", detail: "Redis env vars are configured. Use ?deep=1 for live validation." };
  }

  const key = `codeatlas:health:${Date.now()}`;
  try {
    await client.set(key, "ok", { ex: 60 });
    const value = await client.get<string>(key);
    if (client.del) {
      await client.del(key);
    }

    return value === "ok" ? { status: "pass", detail: "Redis set/get validation passed." } : { status: "fail", detail: "Redis set/get returned an unexpected value." };
  } catch (error) {
    return { status: "fail", detail: error instanceof Error ? error.message : "Redis validation failed." };
  }
}
