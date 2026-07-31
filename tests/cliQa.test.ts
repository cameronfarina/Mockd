import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("CLI QA", () => {
  it("prints the blessed engine QA report", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "qa",
        "--",
        "--scenarios=expected",
        "--runs=2",
        "--seed-prefix=qa-cli-test",
        "--player-evidence=data/raw/player-evidence-2026-initial.csv",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 30 * 1024 * 1024,
      },
    );
    const report = JSON.parse(stdout) as {
      status: string;
      recommendedExitCode: number;
      options: {
        scenarioKeys: string[];
        runsPerScenario: number;
        seedPrefix: string;
      };
      summary: {
        hardFailCount: number;
      };
      checks: {
        key: string;
        severity: string;
        status: string;
      }[];
      artifactPaths: string[];
    };

    expect(["pass", "warn"]).toContain(report.status);
    expect(report.recommendedExitCode).toBe(0);
    expect(report.options).toMatchObject({
      scenarioKeys: ["expected"],
      runsPerScenario: 2,
      seedPrefix: "qa-cli-test",
    });
    expect(report.summary.hardFailCount).toBe(0);
    expect(report.checks.map(check => check.key)).toEqual([
      "smoke",
      "calibration",
      "backtest",
      "evidence-coverage",
    ]);
    expect(report.checks.find(check => check.key === "evidence-coverage")?.severity).toBe("advisory");
    expect(report.artifactPaths).toEqual([]);
  }, 30000);
});
