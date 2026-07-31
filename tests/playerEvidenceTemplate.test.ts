import { describe, expect, it } from "vitest";
import type { PlayerEvidenceQueue } from "../src/modeling/playerEvidenceQueue.js";
import { playerEvidenceTemplateCsv } from "../src/modeling/playerEvidenceTemplate.js";

const queue = {
  summary: {
    playerCount: 1,
    highPriorityCount: 1,
    mediumPriorityCount: 0,
    lowPriorityCount: 0,
    categoryCounts: {
      opportunity: 1,
      defensiveAttention: 1,
    },
  },
  rows: [
    {
      priority: "high",
      rank: 11,
      player: "Drake London",
      position: "WR",
      scenarioPrice: 56,
      averageMockSalePrice: 62.67,
      saleVsScenarioPrice: 6.67,
      currentEvidenceCount: 0,
      evidenceStatus: "missing",
      flags: ["highMockPremium", "largeProjectionRankLift", "missingFactualEvidence"],
      categories: ["opportunity", "defensiveAttention"],
      researchPrompts: [
        "Opportunity: Validate role, routes/targets/touches, and whether the Weeks 1-4 projection is sustainable.",
        "Defensive attention: Check whether the player is gaining or losing true No. 1 defensive attention.",
      ],
    },
  ],
} satisfies PlayerEvidenceQueue;

describe("player evidence template", () => {
  it("exports one fillable sourced-evidence row for each queued player category", () => {
    const csv = playerEvidenceTemplateCsv(queue);
    const lines = csv.split("\n");

    expect(lines[0]).toBe("player,category,score,confidence,source,note,priority,rank,position,scenario_price,average_mock_sale_price,sale_vs_scenario_price,evidence_status,flags,research_prompt");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Drake London,opportunity,,,");
    expect(lines[1]).toContain(",high,11,WR,56,62.67,6.67,missing,");
    expect(lines[1]).toContain("\"highMockPremium; largeProjectionRankLift; missingFactualEvidence\"");
    expect(lines[1]).toContain("Opportunity: Validate role");
    expect(lines[2]).toContain("Drake London,defensiveAttention,,,");
    expect(lines[2]).toContain("Defensive attention: Check whether");
  });
});
