export type TimeoutConfig = {
  githubMs: number;
  fileMs: number;
  llmMs: number;
  totalMs: number;
};

export function getTimeoutConfig(): TimeoutConfig {
  return {
    githubMs: readPositiveInteger("GITHUB_FETCH_TIMEOUT_MS", 15_000),
    fileMs: readPositiveInteger("FILE_FETCH_TIMEOUT_MS", 8_000),
    llmMs: readPositiveInteger("LLM_TIMEOUT_MS", 60_000),
    totalMs: readPositiveInteger("ANALYZE_TOTAL_TIMEOUT_MS", 120_000)
  };
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit | undefined, ms: number, message: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(message);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
