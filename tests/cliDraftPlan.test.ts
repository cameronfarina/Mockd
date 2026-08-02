import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("CLI draft plan report", () => {
  it("prints owner-specific draft plans from real mock batches", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "teams",
        "--",
        "--owner=Cam",
        "--strategy=three-rb",
        "--scenario=expected",
        "--runs=8",
        "--limit=3",
        "--strategy-mode=force",
        "--seed-prefix=cli-draft-plan-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 30 * 1024 * 1024,
      },
    );
    const report = JSON.parse(stdout) as {
      owner: string;
      strategy: {
        key: string;
      };
      runCount: number;
      matchedRunCount: number;
      candidateLimit: number;
      candidates: {
        owner: string;
        rbCore: {
          name: string;
          price: number;
          market?: {
            averageSalePrice: number;
          };
        }[];
        players: {
          position: string;
          price: number;
        }[];
      }[];
    };

    expect(report.owner).toBe("Cam");
    expect(report.strategy.key).toBe("three-rb");
    expect(report.runCount).toBe(8);
    expect(report.matchedRunCount).toBeGreaterThan(0);
    expect(report.candidateLimit).toBe(3);
    expect(report.candidates.length).toBeGreaterThan(0);
    for (const candidate of report.candidates) {
      expect(candidate.owner).toBe("Cam");
      expect(candidate.rbCore).toHaveLength(3);
      expect(candidate.rbCore[0]?.price).toBeGreaterThanOrEqual(55);
      expect(candidate.rbCore[1]?.price).toBeGreaterThanOrEqual(45);
      expect(candidate.rbCore[2]?.price).toBeGreaterThanOrEqual(35);
      const paidReceivers = candidate.players
        .filter(player => player.position === "WR")
        .sort((left, right) => right.price - left.price);
      expect(paidReceivers[0]?.price).toBeGreaterThanOrEqual(14);
      expect(paidReceivers[1]?.price).toBeGreaterThanOrEqual(12);
      const rbDepth = candidate.players
        .filter(player => player.position === "RB")
        .sort((left, right) => right.price - left.price)
        .slice(3);
      expect(rbDepth.every(player => player.price <= 8)).toBe(true);
    }
  }, 30000);
});
