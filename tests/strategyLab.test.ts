import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import {
  defaultStrategyLabScenarios,
  runStrategyLab,
  strategyLabReportMarkdown,
} from "../src/modeling/strategyLab.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

describe("strategy lab", () => {
  it("compares forced Cam paths with budget pressure and realistic mock outcomes", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const report = await runStrategyLab({
      projections,
      historicalRecords,
      keepers,
      runsPerScenario: 2,
      seedPrefix: "strategy-lab-test",
    });

    const puka75 = report.scenarios.find(scenario => scenario.key === "puka-75");
    const puka80 = report.scenarios.find(scenario => scenario.key === "puka-80");
    const valueWrCook = report.scenarios.find(scenario => scenario.key === "value-wr-cook");

    expect(report.mode).toBe("strategy-lab");
    expect(report.options.runsPerScenario).toBe(2);
    expect(report.scenarios).toHaveLength(defaultStrategyLabScenarios.length);
    expect(report.leaderboard).toHaveLength(defaultStrategyLabScenarios.length);
    expect(puka75?.forcedSales).toEqual([{ owner: "Cam", player: "Puka Nacua", price: 75 }]);
    expect(puka75?.camForcedStart.players).toEqual([
      { player: "De'Von Achane", position: "RB", price: 50, source: "keeper" },
      { player: "Puka Nacua", position: "WR", price: 75, source: "forced-sale" },
    ]);
    expect(puka75?.camForcedStart.budgetRemaining).toBe(75);
    expect(puka80?.camForcedStart.budgetRemaining).toBe(70);
    expect(puka80?.camForcedStart.maxBid).toBe((puka75?.camForcedStart.maxBid ?? 0) - 5);
    expect(puka75?.averageCamRank).toBeGreaterThanOrEqual(1);
    expect(puka75?.averageCamRank).toBeLessThanOrEqual(14);
    expect(puka75?.sampleBuilds).not.toHaveLength(0);
    expect(
      puka75?.sampleBuilds.every(build =>
        build.camPlayers.some(player => player.name === "Puka Nacua" && player.price === 75),
      ),
    ).toBe(true);
    expect(valueWrCook?.camForcedStart.players.map(player => player.player)).toEqual([
      "De'Von Achane",
      "DeVonta Smith",
      "Ladd McConkey",
      "James Cook III",
    ]);
  }, 20000);

  it("renders a markdown leaderboard for fast draft-prep review", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const report = await runStrategyLab({
      projections,
      historicalRecords,
      keepers,
      runsPerScenario: 1,
      seedPrefix: "strategy-lab-markdown",
    });
    const markdown = strategyLabReportMarkdown(report);

    expect(markdown).toContain("# Cam Strategy Lab");
    expect(markdown).toContain("Puka $75");
    expect(markdown).toContain("Budget after forced start");
    expect(markdown).toContain("Best sample");
  }, 20000);
});
