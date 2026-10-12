import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/feed/route";

const visit = (authorization?: string) => GET(new Request("http://localhost/api/cron/feed", { headers: authorization ? { authorization } : {} }));

describe("the daily job refresh address", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("only answers the scheduler when a secret is set", async () => {
    vi.stubEnv("JOB_FEED_OFFLINE", "1");
    vi.stubEnv("CRON_SECRET", "a-long-secret-for-the-scheduler");
    expect((await visit()).status).toBe(401);
    expect((await visit("Bearer a-wrong-secret-for-the-scheduler")).status).toBe(401);
    expect((await visit("Bearer a-long-secret-for-the-scheduler")).status).toBe(200);
  });

  it("answers one visit every ten minutes and no more when there is no secret", async () => {
    vi.stubEnv("JOB_FEED_OFFLINE", "1");
    vi.stubEnv("CRON_SECRET", "");
    const answers = [];
    for (let visits = 0; visits < 4; visits++) answers.push((await visit()).status);
    expect(answers).toEqual([200, 429, 429, 429]);
  });
});
