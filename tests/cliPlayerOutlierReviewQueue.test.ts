import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("CLI player outlier review queue", () => {
  it("prints a prioritized top-player outlier queue", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "outliers:queue",
        "--",
        "--scenario=expected",
        "--limit=40",
        "--runs=2",
        "--seed-prefix=outlier-cli-test",
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
        reasonCounts: Record<string, number>;
      };
      rows: {
        priority: string;
        player: string;
        scenarioPrice: number;
        primaryReason: string;
        outlierReasons: {
          key: string;
          message: string;
        }[];
        auditCommand: string;
        reviewStatus: string;
      }[];
    };

    expect(queue.summary.playerCount).toBeGreaterThan(0);
    expect(queue.summary.highPriorityCount).toBeGreaterThan(0);
    expect(queue.summary.reasonCounts.highMockPremium).toBeGreaterThan(0);
    expect(queue.rows[0]).toMatchObject({
      priority: "high",
      reviewStatus: "open",
    });
    expect(queue.rows[0]?.scenarioPrice).toBeGreaterThan(0);
    expect(queue.rows[0]?.outlierReasons.length).toBeGreaterThan(0);
    expect(queue.rows[0]?.auditCommand).toContain("npm run audit -- --player=");

    const london = queue.rows.find(row => row.player === "Drake London");
    expect(london?.outlierReasons.some(reason => reason.key === "highMockPremium")).toBe(true);
  }, 15000);

  it("prints the queue as CSV", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "outliers:queue",
        "--",
        "--scenario=expected",
        "--limit=40",
        "--runs=2",
        "--seed-prefix=outlier-cli-csv-test",
        "--format=csv",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );

    expect(stdout.split("\n")[0]).toBe("priority,rank,player,position,public_anchor_value,base_price,scenario_price,average_mock_sale_price,sale_vs_scenario_price,min_mock_sale_price,max_mock_sale_price,mock_sale_range,drafted_rate,rank_gap,context_adjustment_percent,current_evidence_count,primary_reason,outlier_reasons,thresholds,audit_command,review_status,review_note");
    expect(stdout).toContain("Drake London");
  }, 15000);
});
