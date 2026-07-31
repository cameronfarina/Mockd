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
        "calibration-summary.csv",
        "historical-calibration-audit.json",
        "owner-player-exposure.csv",
        "owner-summaries.csv",
        "player-sale-ranges.csv",
        "price-tier-calibration.csv",
        "position-spend-calibration.csv",
        "mock-batch-summary.json",
      ].sort());

      const playerCsv = await readFile(join(outputDirectory, "player-sale-ranges.csv"), "utf8");
      expect(playerCsv.split("\n")[0]).toBe("name,position,drafted_count,drafted_rate,average_market_price,average_sale_price,minimum_sale_price,maximum_sale_price");

      const calibrationSummaryCsv = await readFile(join(outputDirectory, "calibration-summary.csv"), "utf8");
      expect(calibrationSummaryCsv.split("\n")[0]).toBe("category,key,label,target,actual,delta");
      expect(calibrationSummaryCsv).toContain("owner_spend");

      const calibrationJson = JSON.parse(
        await readFile(join(outputDirectory, "historical-calibration-audit.json"), "utf8"),
      ) as { runCount: number };
      expect(calibrationJson.runCount).toBe(2);
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });
});
