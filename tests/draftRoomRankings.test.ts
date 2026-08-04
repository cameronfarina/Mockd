import { describe, expect, it } from "vitest";
import {
  defaultDraftRoomRankingPath,
  draftRoomRankingsByName,
  loadDraftRoomRankings,
} from "../src/data/draftRoomRankings.js";
import { normalizePlayerName } from "../src/data/normalizePlayerName.js";

describe("draft room ranking imports", () => {
  it("parses the default half-PPR average tab as a deterministic room signal", async () => {
    const rankings = await loadDraftRoomRankings(defaultDraftRoomRankingPath);
    const byName = draftRoomRankingsByName(rankings);

    expect(rankings).toHaveLength(200);
    expect(byName.get(normalizePlayerName("Jahmyr Gibbs"))).toMatchObject({
      name: "Jahmyr Gibbs",
      sourceId: "average-half-ppr",
      sourceLabel: "Average Half PPR",
      scoring: "half-ppr",
      team: "DET",
      byeWeek: 6,
      position: "RB",
      adpRank: 2,
      fantasyProsRank: 2,
      platformRank: 1.3,
      platformGapVsFantasyPros: -0.33,
      landmineScore: 5.5,
      round: 1,
      pick: 1,
      providerRanks: {
        espn: 1,
        sleeper: 2,
        yahoo: 1,
      },
    });
    expect(byName.get(normalizePlayerName("Jadarian Price"))).toMatchObject({
      name: "Jadarian Price",
      platformRank: 63.7,
      platformGapVsFantasyPros: -0.14,
      landmineScore: 5.5,
    });
  });

  it("parses provider-specific tabs without requiring average columns", async () => {
    const rankings = await loadDraftRoomRankings("data/raw/fantasy-draft-rankings-2026/cbs-ppr.tsv");
    const byName = draftRoomRankingsByName(rankings);

    expect(rankings).toHaveLength(177);
    expect(byName.get(normalizePlayerName("Ja'Marr Chase"))).toMatchObject({
      name: "Ja'Marr Chase",
      sourceId: "cbs-ppr",
      sourceLabel: "CBS PPR",
      scoring: "ppr",
      fantasyProsRank: 1,
      platformRank: 3,
      platformGapVsFantasyPros: 2,
      landmineScore: 5.5,
      providerRanks: {
        cbs: 3,
      },
    });
  });
});
