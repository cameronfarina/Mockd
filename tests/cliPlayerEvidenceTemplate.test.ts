import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("CLI player evidence template", () => {
  it("prints a fillable sourced-evidence CSV template for queued players", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "evidence:template",
        "--",
        "--scenario=expected",
        "--limit=12",
        "--runs=2",
        "--seed-prefix=evidence-template-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const lines = stdout.trim().split("\n");

    expect(lines[0]).toBe("player,category,score,confidence,source,note,priority,rank,position,scenario_price,average_mock_sale_price,sale_vs_scenario_price,evidence_status,flags,research_prompt");
    expect(lines.length).toBeGreaterThan(12);
    expect(lines.some(line => line.startsWith("Drake London,opportunity,,,"))).toBe(true);
    expect(lines.some(line => line.startsWith("Drake London,defensiveAttention,,,"))).toBe(true);
    expect(lines.some(line => line.includes("highMockPremium"))).toBe(true);
  }, 15000);
});
