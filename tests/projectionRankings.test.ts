import { describe, expect, it } from "vitest";
import { buildProjectionRankings } from "../src/modeling/projectionRankings.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

describe("projection rank anchors", () => {
  it("adds positional projection ranks and transparent rank gaps", async () => {
    const records = await loadEspnWeeksOneToFour(projectionPath);
    const rankings = buildProjectionRankings(records);

    expect(rankings.find(player => player.name === "Puka Nacua")).toMatchObject({
      position: "WR",
      projectionRank: 1,
      espnRank: 3,
      espnAuctionValue: 56,
      rankGap: -2,
    });
    expect(rankings.find(player => player.name === "Josh Allen")).toMatchObject({
      position: "QB",
      projectionRank: 1,
      espnRank: 36,
      espnAuctionValue: 22,
      rankGap: -35,
    });
    expect(rankings.find(player => player.name === "Jadarian Price")).toMatchObject({
      position: "RB",
      projectionRank: 16,
      espnRank: 94,
      espnAuctionValue: 8,
      rankGap: -78,
    });
  });
});
