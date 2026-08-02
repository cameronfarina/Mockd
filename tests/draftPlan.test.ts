import { describe, expect, it } from "vitest";
import { buildDraftPlanReport } from "../src/modeling/draftPlan.js";
import type { MockBatch } from "../src/modeling/mockBatch.js";
import type { Player } from "../src/types.js";

const player = (
  name: string,
  position: Player["position"],
  price: number,
  weeks1To4 = price,
): Player => ({
  name,
  position,
  price,
  week1: weeks1To4 / 4,
  weeks1To4,
});

const emptyPositionAmounts = {
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
};

const expectedScenario = {
  key: "expected",
  label: "Expected",
  includedKeeperStatuses: ["confirmed", "assumed"],
  keeperCounts: emptyPositionAmounts,
  totalKeeperCost: 0,
  openAuctionDollars: 2800,
  globalFactor: 1,
  positionFactors: {
    QB: 1,
    RB: 1,
    WR: 1,
    TE: 1,
    K: 1,
    DST: 1,
  },
} as const;

describe("draft plan generation", () => {
  it("filters real mock rosters into true 3RB draft plans with sale bands", () => {
    const batch: MockBatch = {
      options: {
        scenarioKeys: ["expected"],
        runsPerScenario: 2,
        seedPrefix: "draft-plan-test",
      },
      runs: [
        {
          seed: "draft-plan-test:expected:1",
          keeperScenario: expectedScenario,
          inputCounts: {
            pricedPlayers: 0,
            auctionPlayers: 0,
            lockedKeepers: 0,
          },
          pickCount: 0,
          picks: [],
          budgetTrajectory: [],
          rosters: [
            {
              owner: "Cam",
              spend: 200,
              budgetRemaining: 0,
              week1Score: 120,
              weeks1To4Score: 480,
              valid: true,
              errors: [],
              positionSpend: {
                QB: 2,
                RB: 156,
                WR: 35,
                TE: 3,
                K: 2,
                DST: 2,
              },
              players: [
                player("Justin Herbert", "QB", 2),
                player("Elite RB", "RB", 62, 80),
                player("Strong RB", "RB", 52, 72),
                player("Flex RB", "RB", 42, 64),
                player("WR Value 1", "WR", 20, 60),
                player("WR Value 2", "WR", 14, 52),
                player("Cheap TE", "TE", 3, 32),
                player("Bench RB", "RB", 1, 20),
                player("Bench WR 1", "WR", 1, 24),
                player("Bench WR 2", "WR", 1, 20),
                player("Bench WR 3", "WR", 1, 16),
                player("Bench WR 4", "WR", 1, 12),
                player("Bench WR 5", "WR", 1, 8),
                player("Bench TE", "TE", 1, 6),
                player("Kicker", "K", 1),
                player("Defense", "DST", 1),
              ],
            },
          ],
          invalidRosterCount: 0,
          unsoldPlayerCount: 0,
        },
        {
          seed: "draft-plan-test:expected:2",
          keeperScenario: expectedScenario,
          inputCounts: {
            pricedPlayers: 0,
            auctionPlayers: 0,
            lockedKeepers: 0,
          },
          pickCount: 0,
          picks: [],
          budgetTrajectory: [],
          rosters: [
            {
              owner: "Cam",
              spend: 200,
              budgetRemaining: 0,
              week1Score: 110,
              weeks1To4Score: 440,
              valid: true,
              errors: [],
              positionSpend: {
                QB: 2,
                RB: 137,
                WR: 56,
                TE: 3,
                K: 1,
                DST: 1,
              },
              players: [
                player("Justin Herbert", "QB", 2),
                player("Elite RB", "RB", 62, 80),
                player("Strong RB", "RB", 50, 72),
                player("Light RB", "RB", 25, 46),
                player("WR Value 1", "WR", 25, 60),
                player("WR Value 2", "WR", 20, 52),
                player("Cheap TE", "TE", 3, 32),
                player("Kicker", "K", 1),
                player("Defense", "DST", 1),
              ],
            },
          ],
          invalidRosterCount: 0,
          unsoldPlayerCount: 0,
        },
      ],
      summary: {
        runCount: 2,
        scenarios: [],
        players: [
          {
            name: "Elite RB",
            position: "RB",
            draftedCount: 2,
            draftedRate: 1,
            averageMarketPrice: 60,
            averageSalePrice: 62,
            minimumSalePrice: 62,
            maximumSalePrice: 62,
          },
          {
            name: "Flex RB",
            position: "RB",
            draftedCount: 1,
            draftedRate: 0.5,
            averageMarketPrice: 39,
            averageSalePrice: 42,
            minimumSalePrice: 42,
            maximumSalePrice: 42,
          },
        ],
        owners: [],
        ownerPlayerExposure: [],
      },
    };

    const report = buildDraftPlanReport({
      batch,
      owner: "Cam",
      strategyKey: "three-rb",
      limit: 5,
    });

    expect(report.runCount).toBe(2);
    expect(report.matchedRunCount).toBe(1);
    expect(report.candidates).toHaveLength(1);
    expect(report.candidates[0]).toMatchObject({
      seed: "draft-plan-test:expected:1",
      owner: "Cam",
      rosterSpend: 200,
      strategy: "three-rb",
      rbCoreSpend: 156,
      rbCore: [
        {
          name: "Elite RB",
          price: 62,
          market: {
            averageSalePrice: 62,
            minimumSalePrice: 62,
            maximumSalePrice: 62,
          },
        },
        {
          name: "Strong RB",
          price: 52,
        },
        {
          name: "Flex RB",
          price: 42,
          market: {
            averageSalePrice: 42,
            draftedRate: 0.5,
          },
        },
      ],
    });
    expect(report.candidates[0]?.lineup.map(entry => entry.slot)).toEqual([
      "QB",
      "RB1",
      "RB2",
      "WR1",
      "WR2",
      "TE",
      "K",
      "DST",
      "FLEX",
    ]);
  });
});
