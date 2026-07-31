import { describe, expect, it } from "vitest";
import type { TopPlayerSanityReport } from "../src/modeling/topPlayerSanity.js";
import {
  buildPlayerEvidenceQueue,
  playerEvidenceQueueCsv,
} from "../src/modeling/playerEvidenceQueue.js";

const sanityReport = {
  config: {
    scenarioKey: "expected",
    limit: 40,
    runs: 3,
    seedPrefix: "queue-test",
  },
  scenario: {
    label: "Expected",
    openAuctionDollars: 2700,
    globalFactor: 1.04,
  },
  summary: {
    reviewedCount: 3,
    flaggedPlayerCount: 3,
    flagCounts: {
      highMockPremium: 1,
      missingFactualEvidence: 2,
      largeProjectionRankLift: 1,
      hardCeilingPressure: 1,
    },
    highPriceVolume: [],
  },
  players: [],
  flaggedPlayers: [
    {
      rank: 11,
      name: "Drake London",
      position: "WR",
      publicAnchorValue: 39,
      projectionRank: 5,
      espnRank: 17,
      rankGap: -12,
      basePrice: 52,
      scenarioPrice: 56,
      draftedCount: 3,
      draftedRate: 1,
      averageMockSalePrice: 62.67,
      saleVsScenarioPrice: 6.67,
      minMockSalePrice: 62,
      maxMockSalePrice: 63,
      contextAdjustmentPercent: 0,
      contextEvidenceCount: 0,
      flags: [
        {
          key: "highMockPremium",
          severity: "review",
          message: "Mock sale average is $6.67 above the scenario anchor.",
        },
        {
          key: "largeProjectionRankLift",
          severity: "review",
          message: "Projection rank is 12 spots higher than ESPN rank.",
        },
        {
          key: "missingFactualEvidence",
          severity: "review",
          message: "Expensive player has no factual evidence rows attached.",
        },
      ],
    },
    {
      rank: 1,
      name: "Jahmyr Gibbs",
      position: "RB",
      publicAnchorValue: 63,
      projectionRank: 1,
      espnRank: 1,
      rankGap: 0,
      basePrice: 69,
      scenarioPrice: 72,
      draftedCount: 3,
      draftedRate: 1,
      averageMockSalePrice: 78,
      saleVsScenarioPrice: 6,
      minMockSalePrice: 78,
      maxMockSalePrice: 78,
      contextAdjustmentPercent: 0,
      contextEvidenceCount: 0,
      flags: [
        {
          key: "highMockPremium",
          severity: "review",
          message: "Mock sale average is $6 above the scenario anchor.",
        },
        {
          key: "missingFactualEvidence",
          severity: "review",
          message: "Expensive player has no factual evidence rows attached.",
        },
      ],
    },
    {
      rank: 20,
      name: "Malik Nabers",
      position: "WR",
      publicAnchorValue: 36,
      projectionRank: 16,
      espnRank: 16,
      rankGap: 0,
      basePrice: 40,
      scenarioPrice: 44,
      draftedCount: 3,
      draftedRate: 1,
      averageMockSalePrice: 45,
      saleVsScenarioPrice: 1,
      minMockSalePrice: 45,
      maxMockSalePrice: 45,
      contextAdjustmentPercent: 0,
      contextEvidenceCount: 1,
      contextEvidence: [
        {
          player: "Malik Nabers",
          category: "opportunity",
          score: 1,
          confidence: 0.9,
          adjustedSignal: 0.9,
          source: "https://example.com/targets",
          note: "Target share remained elite",
        },
      ],
      flags: [
        {
          key: "hardCeilingPressure",
          severity: "info",
          message: "Base price is at the WR hard ceiling.",
        },
      ],
    },
    {
      rank: 21,
      name: "Example Duplicate",
      position: "WR",
      publicAnchorValue: 30,
      projectionRank: 20,
      espnRank: 20,
      rankGap: 0,
      basePrice: 38,
      scenarioPrice: 42,
      draftedCount: 3,
      draftedRate: 1,
      averageMockSalePrice: 42,
      saleVsScenarioPrice: 0,
      minMockSalePrice: 42,
      maxMockSalePrice: 42,
      contextAdjustmentPercent: 0,
      contextEvidenceCount: 3,
      contextEvidence: [
        {
          player: "Example Duplicate",
          category: "opportunity",
          score: 1,
          confidence: 1,
          adjustedSignal: 1,
          source: "https://example.com/targets-a",
          note: "First target source",
        },
        {
          player: "Example Duplicate",
          category: "opportunity",
          score: 0.5,
          confidence: 1,
          adjustedSignal: 0.5,
          source: "https://example.com/targets-b",
          note: "Second target source",
        },
        {
          player: "Example Duplicate",
          category: "opportunity",
          score: 0.25,
          confidence: 1,
          adjustedSignal: 0.25,
          source: "https://example.com/targets-c",
          note: "Third target source",
        },
      ],
      flags: [
        {
          key: "hardCeilingPressure",
          severity: "info",
          message: "Base price is at the WR hard ceiling.",
        },
      ],
    },
  ],
} satisfies TopPlayerSanityReport;

describe("player evidence queue", () => {
  it("turns top-player sanity flags into prioritized factual research rows", () => {
    const queue = buildPlayerEvidenceQueue(sanityReport);

    expect(queue.summary).toMatchObject({
      playerCount: 4,
      highPriorityCount: 2,
      mediumPriorityCount: 2,
    });
    expect(queue.summary.categoryCounts).toMatchObject({
      opportunity: 4,
      defensiveAttention: 2,
      skillFit: 4,
      environment: 2,
      risk: 4,
    });
    expect(queue.rows.map(row => row.player)).toEqual([
      "Jahmyr Gibbs",
      "Drake London",
      "Malik Nabers",
      "Example Duplicate",
    ]);

    const london = queue.rows.find(row => row.player === "Drake London");
    expect(london).toMatchObject({
      priority: "high",
      evidenceStatus: "missing",
      flags: ["highMockPremium", "largeProjectionRankLift", "missingFactualEvidence"],
      categories: ["opportunity", "defensiveAttention", "skillFit", "environment", "risk"],
    });
    expect(london?.researchPrompts).toContain(
      "Opportunity: Validate role, routes/targets/touches, and whether the Weeks 1-4 projection is sustainable.",
    );
    expect(queue.rows.find(row => row.player === "Malik Nabers")?.currentEvidence).toEqual([
      expect.objectContaining({
        category: "opportunity",
        source: "https://example.com/targets",
      }),
    ]);
    expect(queue.rows.find(row => row.player === "Example Duplicate")).toMatchObject({
      currentEvidenceCount: 3,
      evidenceStatus: "partial",
      categories: ["opportunity", "skillFit", "risk"],
    });

    const csv = playerEvidenceQueueCsv(queue);
    expect(csv.split("\n")[0]).toBe("priority,rank,player,position,scenario_price,average_mock_sale_price,sale_vs_scenario_price,current_evidence_count,evidence_status,flags,categories,research_prompts");
    expect(csv).toContain("high,11,Drake London,WR,56,62.67,6.67,0,missing");
    expect(csv).toContain("\"opportunity; defensiveAttention; skillFit; environment; risk\"");
  });
});
