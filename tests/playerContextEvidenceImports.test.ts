import { describe, expect, it } from "vitest";
import {
  loadPlayerContextEvidenceOverrides,
  parsePlayerContextEvidenceCsv,
  playerContextEvidenceOverrides,
} from "../src/data/playerContextEvidenceImports.js";

describe("player context evidence imports", () => {
  it("aggregates sourced evidence rows into factual context signals", () => {
    const evidence = parsePlayerContextEvidenceCsv([
      "player,category,score,confidence,source,note,provider,source_date,source_quality",
      "Example WR,opportunity,1,0.8,targets,Projected target share increase,FantasyPros,2026-07-15,primary",
      "Example WR,defensiveAttention,-1,0.75,coverage,Moves from WR2 to WR1 coverage",
      "Example WR,skillFit,-0.5,1,separation,Low separation margin against man",
      "Example WR,environment,0.5,0.8,scheme,Faster pass rate",
      "Example WR,risk,-0.25,1,injury,Minor durability drag",
    ].join("\n"));

    expect(playerContextEvidenceOverrides(evidence)).toEqual([
      {
        player: "Example WR",
        signals: {
          opportunity: 0.8,
          defensiveAttention: -0.75,
          skillFit: -0.5,
          environment: 0.4,
          risk: -0.25,
        },
        notes: {
          opportunity: "targets: Projected target share increase",
          defensiveAttention: "coverage: Moves from WR2 to WR1 coverage",
          skillFit: "separation: Low separation margin against man",
          environment: "scheme: Faster pass rate",
          risk: "injury: Minor durability drag",
        },
        evidence,
      },
    ]);
    expect(evidence[0]).toMatchObject({
      provider: "FantasyPros",
      sourceDate: "2026-07-15",
      sourceQuality: "primary",
    });
  });

  it("loads the checked-in evidence example", async () => {
    await expect(loadPlayerContextEvidenceOverrides("data/raw/player-evidence.example.csv")).resolves.toEqual([
      expect.objectContaining({
        player: "Example WR",
        evidence: expect.arrayContaining([
          expect.objectContaining({
            category: "environment",
            source: "team pace and pass rate",
          }),
        ]),
      }),
    ]);
  });
});
