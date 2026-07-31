import { describe, expect, it } from "vitest";
import {
  buildPlayerOutlierReviewQueue,
  playerOutlierReviewQueueCsv,
} from "../src/modeling/playerOutlierReviewQueue.js";
import type { TopPlayerSanityReport } from "../src/modeling/topPlayerSanity.js";

const sanityReport = {
  config: {
    scenarioKey: "expected",
    limit: 40,
    runs: 10,
    seedPrefix: "outlier-queue-test",
  },
  scenario: {
    label: "Expected",
    openAuctionDollars: 2700,
    globalFactor: 1.04,
  },
  summary: {
    reviewedCount: 3,
    flaggedPlayerCount: 2,
    flagCounts: {
      highMockPremium: 1,
      largeProjectionRankLift: 1,
      missingFactualEvidence: 1,
      contextPenalty: 1,
    },
    highPriceVolume: [
      {
        threshold: 70,
        historicalAverageCount: 4.33,
        historicalMaxCount: 5,
        scenarioCount: 6,
        mockAverageCount: 6,
        mockMaxCount: 6,
        status: "review",
      },
    ],
  },
  players: [
    {
      rank: 11,
      name: "Drake London",
      position: "WR",
      publicAnchorValue: 45,
      projectionRank: 4,
      espnRank: 9,
      rankGap: -5,
      basePrice: 49,
      scenarioPrice: 56,
      draftedCount: 10,
      draftedRate: 1,
      averageMockSalePrice: 63,
      saleVsScenarioPrice: 7,
      minMockSalePrice: 57,
      maxMockSalePrice: 66,
      contextAdjustmentPercent: -0.1,
      contextEvidenceCount: 5,
      flags: [
        {
          key: "highMockPremium",
          severity: "review",
          message: "Mock sale average is $7 above the scenario anchor.",
        },
        {
          key: "largeProjectionRankLift",
          severity: "review",
          message: "Projection rank is 5 spots higher than ESPN rank.",
        },
        {
          key: "contextPenalty",
          severity: "info",
          message: "Context adjustment trims price by 10%.",
        },
      ],
    },
    {
      rank: 3,
      name: "Elite RB",
      position: "RB",
      publicAnchorValue: 64,
      projectionRank: 2,
      espnRank: 2,
      rankGap: 0,
      basePrice: 72,
      scenarioPrice: 74,
      draftedCount: 10,
      draftedRate: 1,
      averageMockSalePrice: 75,
      saleVsScenarioPrice: 1,
      minMockSalePrice: 74,
      maxMockSalePrice: 76,
      contextAdjustmentPercent: 0,
      contextEvidenceCount: 5,
      flags: [],
    },
    {
      rank: 22,
      name: "Thin Demand WR",
      position: "WR",
      publicAnchorValue: 30,
      projectionRank: 17,
      espnRank: 17,
      rankGap: 0,
      basePrice: 31,
      scenarioPrice: 32,
      draftedCount: 6,
      draftedRate: 0.6,
      averageMockSalePrice: 25,
      saleVsScenarioPrice: -7,
      minMockSalePrice: 21,
      maxMockSalePrice: 31,
      contextAdjustmentPercent: 0,
      contextEvidenceCount: 0,
      flags: [],
    },
    {
      rank: 30,
      name: "Expensive Anchor Jump WR",
      position: "WR",
      publicAnchorValue: 50,
      projectionRank: 25,
      espnRank: 25,
      rankGap: 0,
      basePrice: 60,
      scenarioPrice: 62,
      draftedCount: 10,
      draftedRate: 1,
      averageMockSalePrice: 62,
      saleVsScenarioPrice: 0,
      minMockSalePrice: 62,
      maxMockSalePrice: 62,
      contextAdjustmentPercent: 0,
      contextEvidenceCount: 5,
      flags: [],
    },
  ],
  flaggedPlayers: [],
} satisfies TopPlayerSanityReport;

describe("player outlier review queue", () => {
  it("turns top-player sanity signals into a prioritized review queue", () => {
    const queue = buildPlayerOutlierReviewQueue(sanityReport);

    expect(queue.summary).toMatchObject({
      playerCount: 4,
      highPriorityCount: 3,
      mediumPriorityCount: 1,
      lowPriorityCount: 0,
    });
    expect(queue.rows.map(row => row.player)).toEqual([
      "Elite RB",
      "Drake London",
      "Thin Demand WR",
      "Expensive Anchor Jump WR",
    ]);

    const london = queue.rows.find(row => row.player === "Drake London");
    expect(london).toMatchObject({
      priority: "high",
      primaryReason: "highMockPremium",
      mockSaleRange: 9,
      auditCommand: "npm run audit -- --player=\"Drake London\" --scenario=expected",
      reviewStatus: "open",
    });
    expect(london?.outlierReasons.map(reason => reason.key)).toEqual([
      "highMockPremium",
      "largeProjectionRankLift",
      "contextPenalty",
      "mockSaleRange",
      "anchorToScenarioJump",
    ]);

    const elite = queue.rows.find(row => row.player === "Elite RB");
    expect(elite?.outlierReasons.map(reason => reason.key)).toEqual(["eliteTierContributor"]);
    expect(elite?.thresholds).toContain("$70 volume exceeds historical max 5");

    const thinDemand = queue.rows.find(row => row.player === "Thin Demand WR");
    expect(thinDemand?.outlierReasons.map(reason => reason.key)).toEqual([
      "mockSaleDiscount",
      "mockSaleRange",
      "thinMockDemand",
    ]);

    const anchorJump = queue.rows.find(row => row.player === "Expensive Anchor Jump WR");
    expect(anchorJump).toMatchObject({
      priority: "medium",
      primaryReason: "anchorToScenarioJump",
    });

    const csv = playerOutlierReviewQueueCsv(queue);
    expect(csv.split("\n")[0]).toBe("priority,rank,player,position,public_anchor_value,base_price,scenario_price,average_mock_sale_price,sale_vs_scenario_price,min_mock_sale_price,max_mock_sale_price,mock_sale_range,drafted_rate,rank_gap,context_adjustment_percent,current_evidence_count,primary_reason,outlier_reasons,thresholds,audit_command,review_status,review_note");
    expect(csv).toContain("high,11,Drake London,WR,45,49,56,63,7,57,66,9,1,-5,-0.1,5,highMockPremium");
  });
});
