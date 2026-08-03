import { describe, expect, it } from "vitest";
import { ownerOrder, type Owner, type Position } from "../config/league.js";
import { buildMockResultsReport } from "../src/modeling/mockResults.js";
import type { MockBatch, MockRosterSummary } from "../src/modeling/mockBatch.js";
import type { Player } from "../src/types.js";

const player = (
  owner: Owner,
  label: string,
  position: Position,
  price: number,
  week1: number,
  weeks1To4: number,
  seasonProjection = weeks1To4 * 4,
): Player => ({
  name: `${owner} ${label}`,
  position,
  price,
  week1,
  weeks1To4,
  seasonProjection,
});

const rosterPlayers = (
  owner: Owner,
  weekOneBoost = 0,
  seasonBoost = 0,
  benchBoost = 0,
): Player[] => [
  player(owner, "QB", "QB", 2, 18 + weekOneBoost, 72 + seasonBoost),
  player(owner, "RB1", "RB", 46, 20 + weekOneBoost, 80 + seasonBoost),
  player(owner, "RB2", "RB", 34, 17 + weekOneBoost, 68 + seasonBoost),
  player(owner, "WR1", "WR", 42, 19 + weekOneBoost, 76 + seasonBoost),
  player(owner, "WR2", "WR", 28, 15 + weekOneBoost, 60 + seasonBoost),
  player(owner, "TE", "TE", 6, 10 + weekOneBoost, 40 + seasonBoost),
  player(owner, "FLEX", "RB", 18, 13 + weekOneBoost, 52 + seasonBoost),
  player(owner, "K", "K", 1, 8 + weekOneBoost, 32 + seasonBoost),
  player(owner, "DST", "DST", 1, 7 + weekOneBoost, 28 + seasonBoost),
  player(owner, "Bench RB 1", "RB", 8, 7, 28 + benchBoost),
  player(owner, "Bench WR 1", "WR", 7, 6, 24 + benchBoost),
  player(owner, "Bench RB 2", "RB", 5, 5, 20 + benchBoost),
  player(owner, "Bench WR 2", "WR", 4, 4, 16 + benchBoost),
  player(owner, "Bench QB", "QB", 1, 3, 12),
  player(owner, "Bench TE", "TE", 1, 2, 8),
  player(owner, "Bench K", "K", 1, 1, 4),
];

const rosterSummary = (
  owner: Owner,
  weekOneBoost = 0,
  seasonBoost = 0,
  benchBoost = 0,
): MockRosterSummary => {
  const players = rosterPlayers(owner, weekOneBoost, seasonBoost, benchBoost);
  const spend = players.reduce((total, current) => total + current.price, 0);

  return {
    owner,
    spend,
    budgetRemaining: 200 - spend,
    week1Score: players.slice(0, 9).reduce((total, current) => total + current.week1, 0),
    weeks1To4Score: players.slice(0, 9).reduce((total, current) => total + current.weeks1To4, 0),
    valid: true,
    errors: [],
    players,
    positionSpend: { QB: 3, RB: 111, WR: 81, TE: 7, K: 2, DST: 1 },
  };
};

const mockBatch = (rosters: MockRosterSummary[]): MockBatch => ({
  options: {
    scenarioKeys: ["expected"],
    runsPerScenario: 1,
    seedPrefix: "mock-results-test",
  },
  runs: [{
    seed: "mock-results-test:1",
    keeperScenario: {
      key: "expected",
      label: "Expected",
      includedKeeperStatuses: ["confirmed", "assumed"],
      keeperCounts: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
      totalKeeperCost: 0,
      openAuctionDollars: 2800,
      globalFactor: 1,
      positionFactors: { QB: 1, RB: 1, WR: 1, TE: 1, K: 1, DST: 1 },
    },
    inputCounts: {
      pricedPlayers: 500,
      auctionPlayers: 218,
      lockedKeepers: 0,
    },
    pickCount: 218,
    picks: [],
    budgetTrajectory: [],
    rosters,
    invalidRosterCount: 0,
    unsoldPlayerCount: 0,
  }],
  summary: {
    runCount: 1,
    scenarios: [{
      key: "expected",
      label: "Expected",
      runCount: 1,
      invalidRosterCount: 0,
      averagePickCount: 218,
    }],
    players: [],
    owners: [],
    ownerPlayerExposure: [],
  },
});

describe("mock results report", () => {
  it("separates Week 1 scoring from season-strength projected finish", () => {
    const rosters = ownerOrder.map(owner => {
      if (owner === "Martins") return rosterSummary(owner, 4, -3, 0);
      if (owner === "Cam") return rosterSummary(owner, 0, 4, 8);
      return rosterSummary(owner);
    });

    const report = buildMockResultsReport(mockBatch(rosters), "three-rb");
    const run = report.runs[0];
    expect(run).toBeDefined();
    if (!run) throw new Error("Expected one mock results run");

    expect(run.rankings[0]).toMatchObject({
      owner: "Cam",
      rank: 1,
      week1Rank: expect.any(Number),
      seasonStrengthScore: expect.any(Number),
      projectedFinishScore: expect.any(Number),
    });
    expect(run.rankings.find(ranking => ranking.owner === "Martins")?.week1Rank).toBe(1);
    expect(run.rankings[0]?.explanation).toContain("season strength");
    expect(run.bestBuild.owner).toBe("Cam");
    expect(run.bestBuild.headline).toContain("season-strength score");
    expect(run.teams.find(team => team.owner === "Cam")).toMatchObject({
      projectedRank: 1,
      seasonStrengthScore: run.rankings[0]?.seasonStrengthScore,
      depthScore: expect.any(Number),
      consistencyScore: expect.any(Number),
    });
  });

  it("uses full-season projection for projected finish when it differs from Weeks 1-4", () => {
    const rosters = ownerOrder.map(owner => {
      const summary = owner === "Martins"
        ? rosterSummary(owner, 0, 30, 0)
        : rosterSummary(owner, 0, owner === "Cam" ? -10 : 0, 0);

      if (owner === "Martins") {
        return {
          ...summary,
          players: summary.players.map(current => ({
            ...current,
            seasonProjection: current.weeks1To4 * 2,
          })),
        };
      }

      if (owner === "Cam") {
        return {
          ...summary,
          players: summary.players.map(current => ({
            ...current,
            seasonProjection: current.weeks1To4 * 7,
          })),
        };
      }

      return summary;
    });

    const report = buildMockResultsReport(mockBatch(rosters), "three-rb");
    const run = report.runs[0];
    expect(run).toBeDefined();
    if (!run) throw new Error("Expected one mock results run");

    const cam = run.teams.find(team => team.owner === "Cam");
    const martins = run.teams.find(team => team.owner === "Martins");

    expect(cam).toBeDefined();
    expect(martins).toBeDefined();
    expect(martins?.weeks1To4Score).toBeGreaterThan(cam?.weeks1To4Score ?? 0);
    expect(cam?.starterSeasonScore).toBeGreaterThan(martins?.starterSeasonScore ?? 0);
    expect(run.rankings[0]?.owner).toBe("Cam");
  });
});
