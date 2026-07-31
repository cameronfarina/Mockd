import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { buildHistoricalCalibrationAudit } from "../src/modeling/calibrationAudit.js";
import { runMockBatch } from "../src/modeling/mockBatch.js";
import { writePrepOutputArtifacts } from "../src/modeling/prepOutputs.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

describe("prep output artifacts", () => {
  it("writes batch summary, calibration, and CSV draft-prep artifacts", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const batch = runMockBatch({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 2,
      seedPrefix: "outputs-test",
    });
    const audit = buildHistoricalCalibrationAudit({ historicalRecords, batch });
    const outputDirectory = await mkdtemp(join(tmpdir(), "mockd-prep-"));

    try {
      const artifacts = await writePrepOutputArtifacts({ batch, audit, outputDirectory });
      const filenames = artifacts.map(artifact => artifact.filename).sort();

      expect(filenames).toEqual([
        "calibration-gates.csv",
        "calibration-summary.csv",
        "high-price-volume-calibration.csv",
        "historical-calibration-audit.json",
        "mock-draft-board.csv",
        "owner-player-exposure.csv",
        "owner-summaries.csv",
        "player-sale-ranges.csv",
        "price-tier-calibration.csv",
        "position-spend-calibration.csv",
        "mock-batch-summary.json",
      ].sort());

      const playerCsv = await readFile(join(outputDirectory, "player-sale-ranges.csv"), "utf8");
      expect(playerCsv.split("\n")[0]).toBe("name,position,drafted_count,drafted_rate,average_market_price,average_sale_price,minimum_sale_price,maximum_sale_price");

      const draftBoardCsv = await readFile(join(outputDirectory, "mock-draft-board.csv"), "utf8");
      const draftBoardLines = draftBoardCsv.trim().split("\n");
      expect(draftBoardLines[0]).toBe("seed,scenario,pick,nominator,winner,player,position,anchor_price,sale_price,budget_after_pick,roster_slots_after_pick,top_bid_1_owner,top_bid_1_amount,top_bid_1_uncapped,top_bid_2_owner,top_bid_2_amount,top_bid_2_uncapped,top_bid_3_owner,top_bid_3_amount,top_bid_3_uncapped");
      expect(draftBoardLines).toHaveLength(batch.runs.reduce((count, run) => count + run.pickCount, 0) + 1);
      expect(draftBoardLines[1]).toContain(",expected,1,");

      const calibrationSummaryCsv = await readFile(join(outputDirectory, "calibration-summary.csv"), "utf8");
      expect(calibrationSummaryCsv.split("\n")[0]).toBe("category,key,label,target,actual,delta");
      expect(calibrationSummaryCsv).toContain("owner_spend");

      const calibrationGatesCsv = await readFile(join(outputDirectory, "calibration-gates.csv"), "utf8");
      expect(calibrationGatesCsv.split("\n")[0]).toBe("key,category,label,status,target,actual,delta,warn_threshold,fail_threshold");
      expect(calibrationGatesCsv).toContain("high-price-volume:80-plus,high_price_volume,$80+ player count,pass");
      expect(calibrationGatesCsv).toContain("price-tier-count:dollar,price_tier_count,$1 player count,warn");

      const highPriceVolumeCsv = await readFile(join(outputDirectory, "high-price-volume-calibration.csv"), "utf8");
      expect(highPriceVolumeCsv.split("\n")[0]).toBe("threshold,historical_average_count,historical_max_count,mock_average_count,mock_max_count,average_count_delta,max_count_delta");
      expect(highPriceVolumeCsv).toContain("80,0.33,1,");

      const calibrationJson = JSON.parse(
        await readFile(join(outputDirectory, "historical-calibration-audit.json"), "utf8"),
      ) as { runCount: number; gates: { summary: { status: string } } };
      expect(calibrationJson.runCount).toBe(2);
      expect(calibrationJson.gates.summary.status).toBe("fail");
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });
});
