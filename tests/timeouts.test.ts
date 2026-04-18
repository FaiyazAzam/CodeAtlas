import { describe, expect, it } from "vitest";
import { withTimeout } from "../lib/timeouts";

describe("withTimeout", () => {
  it("returns the resolved value before the timeout", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50, "Timed out")).resolves.toBe("ok");
  });

  it("rejects with the timeout message when work takes too long", async () => {
    await expect(
      withTimeout(
        new Promise((resolve) => setTimeout(resolve, 30)),
        1,
        "Operation timed out"
      )
    ).rejects.toThrow("Operation timed out");
  });
});
