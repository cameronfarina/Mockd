import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("CLI player evidence queue", () => {
  it("prints a prioritized factual research queue from the top-player sanity report", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "evidence:queue",
        "--",
        "--scenario=expected",
        "--limit=40",
        "--runs=2",
        "--seed-prefix=evidence-queue-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const queue = JSON.parse(stdout) as {
      summary: {
        playerCount: number;
        highPriorityCount: number;
        categoryCounts: Record<string, number>;
      };
      rows: {
        player: string;
        priority: string;
        evidenceStatus: string;
        categories: string[];
        researchPrompts: string[];
      }[];
    };

    expect(queue.summary.playerCount).toBeGreaterThan(0);
    expect(queue.summary.highPriorityCount).toBeGreaterThan(0);
    expect(queue.summary.categoryCounts.opportunity).toBeGreaterThan(0);

    const london = queue.rows.find(row => row.player === "Drake London");
    expect(london).toBeDefined();
    expect(london).toMatchObject({
      priority: "high",
      evidenceStatus: "missing",
    });
    expect(london?.categories).toContain("opportunity");
    expect(london?.categories).toContain("defensiveAttention");
    expect(london?.researchPrompts.length).toBeGreaterThan(0);
  }, 15000);
});
