import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("CLI player audit report", () => {
  it("explains one player's price bridge from anchor through mock sale behavior", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-cli-audit-"));
    const evidencePath = join(directory, "evidence.csv");
    await writeFile(evidencePath, [
      "player,category,score,confidence,source,note",
      "Drake London,opportunity,1,1,targets,Target volume remains strong",
      "Drake London,defensiveAttention,-1,0.8,coverage,More WR1 defensive attention",
      "Drake London,skillFit,-0.5,1,separation,Separation profile trims upside",
    ].join("\n"));

    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "audit",
        "--",
        "--player=Drake London",
        "--scenario=expected",
        "--runs=2",
        "--seed-prefix=audit-test",
        `--player-evidence=${evidencePath}`,
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const result = JSON.parse(stdout) as {
      player: {
        name: string;
        position: string;
      };
      pricing: {
        publicAnchorValue: number;
        projectionRank: number;
        espnRank: number;
        rankGap: number;
        rankGapAdjustment: number;
        basePrice: number;
        contextAdjustmentPercent: number;
        contextSignals: Record<string, number>;
        contextEvidence: unknown[];
      };
      scenario: {
        key: string;
        available: boolean;
        scenarioFactor: number;
        scenarioPrice: number;
      };
      mockSale: {
        runCount: number;
        draftedCount: number;
        draftedRate: number;
        averageSalePrice: number;
        averageSaleVsScenarioPrice: number;
        minSalePrice: number;
        maxSalePrice: number;
      };
      explanation: string[];
    };

    expect(result.player).toMatchObject({
      name: "Drake London",
      position: "WR",
    });
    expect(result.pricing.publicAnchorValue).toBeGreaterThan(0);
    expect(result.pricing.projectionRank).toBeGreaterThan(0);
    expect(result.pricing.espnRank).toBeGreaterThan(0);
    expect(Number.isFinite(result.pricing.rankGap)).toBe(true);
    expect(result.pricing.rankGapAdjustment).toBeGreaterThan(0);
    expect(result.pricing.basePrice).toBeGreaterThan(0);
    expect(result.pricing.contextAdjustmentPercent).not.toBe(0);
    expect(result.pricing.contextSignals).toMatchObject({
      opportunity: 1,
      defensiveAttention: -0.8,
      skillFit: -0.5,
    });
    expect(result.pricing.contextEvidence).toHaveLength(3);
    expect(result.scenario).toMatchObject({
      key: "expected",
      available: true,
    });
    expect(result.scenario.scenarioFactor).toBeGreaterThan(1);
    expect(result.scenario.scenarioPrice).toBeGreaterThanOrEqual(result.pricing.basePrice);
    expect(result.mockSale.runCount).toBe(2);
    expect(result.mockSale.draftedCount).toBeGreaterThan(0);
    expect(result.mockSale.draftedRate).toBeGreaterThan(0);
    expect(result.mockSale.averageSalePrice).toBeGreaterThan(0);
    expect(result.mockSale.averageSaleVsScenarioPrice).toBe(
      result.mockSale.averageSalePrice - result.scenario.scenarioPrice,
    );
    expect(result.mockSale.minSalePrice).toBeLessThanOrEqual(result.mockSale.maxSalePrice);
    expect(result.explanation.join("\n")).toContain("ESPN");
    expect(result.explanation.join("\n")).toContain("keeper inflation");
    expect(result.explanation.join("\n")).toContain("mock sale");
  });

  it("explains when the scenario removes a keeper from the auction pool", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "audit",
        "--",
        "--player=Jaxon Smith-Njigba",
        "--scenario=expected",
        "--runs=1",
        "--seed-prefix=keeper-audit-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const result = JSON.parse(stdout) as {
      scenario: {
        available: boolean;
        scenarioPrice: number;
        unavailableReason?: string;
      };
      mockSale: {
        draftedCount: number;
      };
      explanation: string[];
    };

    expect(result.scenario).toMatchObject({
      available: false,
      scenarioPrice: 0,
      unavailableReason: "Seth assumed keeper at $42",
    });
    expect(result.mockSale.draftedCount).toBe(0);
    expect(result.explanation.join("\n")).toContain("removed from the auction pool");
  });
});
