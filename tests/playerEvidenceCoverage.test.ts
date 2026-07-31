import { describe, expect, it } from "vitest";
import {
  buildPlayerEvidenceCoverageAudit,
  playerEvidenceCoverageGatesCsv,
} from "../src/modeling/playerEvidenceCoverage.js";
import type { PlayerEvidenceQueue } from "../src/modeling/playerEvidenceQueue.js";

const queue = {
  summary: {
    playerCount: 3,
    highPriorityCount: 2,
    mediumPriorityCount: 1,
    lowPriorityCount: 0,
    categoryCounts: {
      opportunity: 3,
      defensiveAttention: 2,
      skillFit: 3,
      environment: 2,
      risk: 2,
    },
  },
  rows: [
    {
      priority: "high",
      rank: 1,
      player: "Jahmyr Gibbs",
      position: "RB",
      scenarioPrice: 72,
      averageMockSalePrice: 78,
      saleVsScenarioPrice: 6,
      currentEvidenceCount: 0,
      evidenceStatus: "missing",
      flags: ["highMockPremium", "missingFactualEvidence"],
      categories: ["opportunity", "defensiveAttention", "skillFit", "environment", "risk"],
      researchPrompts: [],
    },
    {
      priority: "high",
      rank: 11,
      player: "Drake London",
      position: "WR",
      scenarioPrice: 56,
      averageMockSalePrice: 62.67,
      saleVsScenarioPrice: 6.67,
      currentEvidenceCount: 2,
      evidenceStatus: "partial",
      flags: ["highMockPremium", "largeProjectionRankLift"],
      categories: ["opportunity", "defensiveAttention", "skillFit"],
      researchPrompts: [],
    },
    {
      priority: "medium",
      rank: 20,
      player: "Malik Nabers",
      position: "WR",
      scenarioPrice: 44,
      averageMockSalePrice: 45,
      saleVsScenarioPrice: 1,
      currentEvidenceCount: 3,
      evidenceStatus: "present",
      flags: ["hardCeilingPressure"],
      categories: ["opportunity", "skillFit", "risk"],
      researchPrompts: [],
    },
  ],
} satisfies PlayerEvidenceQueue;

describe("player evidence coverage audit", () => {
  it("fails the audit when high-priority top players are missing factual evidence", () => {
    const audit = buildPlayerEvidenceCoverageAudit(queue);

    expect(audit.summary).toMatchObject({
      status: "fail",
      playerCount: 3,
      coveredPlayerCount: 2,
      missingEvidenceCount: 1,
      highPriorityMissingCount: 1,
      coverageRate: 0.67,
    });
    expect(audit.gates.summary).toMatchObject({
      status: "fail",
      gateCount: 3,
      failCount: 1,
    });
    expect(audit.gates.items.map(gate => gate.key)).toEqual([
      "high-priority-missing",
      "evidence-coverage-rate",
      "complete-evidence-rate",
    ]);
    expect(audit.gates.items.find(gate => gate.key === "high-priority-missing")).toMatchObject({
      status: "fail",
      target: 0,
      actual: 1,
      delta: 1,
    });
    expect(audit.missingPlayers).toEqual([
      {
        priority: "high",
        rank: 1,
        player: "Jahmyr Gibbs",
        position: "RB",
        scenarioPrice: 72,
        categories: ["opportunity", "defensiveAttention", "skillFit", "environment", "risk"],
      },
    ]);

    const csv = playerEvidenceCoverageGatesCsv(audit);
    expect(csv.split("\n")[0]).toBe("key,label,status,target,actual,delta,warn_threshold,fail_threshold");
    expect(csv).toContain("high-priority-missing,High-priority missing evidence,fail,0,1,1,1,1");
  });
});
