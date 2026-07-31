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
      currentEvidence: [
        {
          player: "Drake London",
          category: "opportunity",
          score: 1,
          confidence: 0.9,
          adjustedSignal: 0.9,
          source: "https://example.com/targets",
          note: "Target share remained elite",
        },
        {
          player: "Drake London",
          category: "defensiveAttention",
          score: -0.5,
          confidence: 0.8,
          adjustedSignal: -0.4,
          source: "https://example.com/coverage",
        },
      ],
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
      currentEvidence: [
        {
          player: "Malik Nabers",
          category: "opportunity",
          score: 1,
          confidence: 0.9,
          adjustedSignal: 0.9,
          source: "https://example.com/targets",
          note: "Target share remained elite",
          provider: "FantasyPros",
          sourceDate: "2026-07-15",
          sourceQuality: "primary",
        },
        {
          player: "Malik Nabers",
          category: "skillFit",
          score: 0.5,
          confidence: 0.8,
          adjustedSignal: 0.4,
          source: "https://example.com/routes",
          note: "Separation profile supports role",
        },
        {
          player: "Malik Nabers",
          category: "risk",
          score: -0.25,
          confidence: 0.8,
          adjustedSignal: -0.2,
          source: "https://example.com/injury",
          note: "Minor availability risk",
          provider: "FantasyPros",
          sourceDate: "2026-07-15",
        },
      ],
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
      evidenceRowCount: 5,
      provenanceCompleteEvidenceCount: 3,
      provenanceIncompleteEvidenceCount: 2,
      provenanceCompleteEvidenceRate: 0.6,
    });
    expect(audit.gates.summary).toMatchObject({
      status: "fail",
      gateCount: 4,
      failCount: 2,
    });
    expect(audit.gates.items.map(gate => gate.key)).toEqual([
      "high-priority-missing",
      "evidence-coverage-rate",
      "complete-evidence-rate",
      "evidence-provenance-rate",
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
    expect(audit.provenanceIssues).toEqual([
      {
        priority: "high",
        rank: 11,
        player: "Drake London",
        position: "WR",
        incompleteEvidenceCount: 1,
        missingFields: ["note"],
      },
      {
        priority: "medium",
        rank: 20,
        player: "Malik Nabers",
        position: "WR",
        incompleteEvidenceCount: 1,
        missingFields: ["sourceQuality"],
      },
    ]);

    const csv = playerEvidenceCoverageGatesCsv(audit);
    expect(csv.split("\n")[0]).toBe("key,label,status,target,actual,delta,warn_threshold,fail_threshold");
    expect(csv).toContain("high-priority-missing,High-priority missing evidence,fail,0,1,1,1,1");
    expect(csv).toContain("evidence-provenance-rate,Evidence provenance rate,fail,1,0.6,-0.4,1,0.75");
  });
});
