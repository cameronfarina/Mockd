import { describe, expect, it } from "vitest";
import { ownerOrder } from "../config/league.js";
import {
  buildLeagueOpenAuctionSpendTargets,
  buildOwnerProfiles,
  defaultHistoricalWeights,
} from "../src/modeling/ownerProfiles.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";

const expectNear = (actual: number, expected: number, tolerance = 0.25): void => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
};

const expectedProfiles = {
  Beaton: { QB: 21.6, RB: 117.2, WR: 32.0, TE: 9.0, specialTeams: 2.9, topTwo: 61.4, ones: 8.4, keeper: 17.3, label: "RB stars and scrubs" },
  Hoody: { QB: 8.4, RB: 52.9, WR: 124.1, TE: 8.5, specialTeams: 2.0, topTwo: 60.7, ones: 5.4, keeper: 3.5, label: "WR stars and scrubs" },
  PJ: { QB: 25.5, RB: 37.4, WR: 125.5, TE: 4.3, specialTeams: 3.0, topTwo: 61.5, ones: 9.0, keeper: 4.3, label: "extreme WR concentration" },
  Seth: { QB: 6.8, RB: 69.1, WR: 91.1, TE: 20.2, specialTeams: 2.8, topTwo: 52.2, ones: 5.4, keeper: 9.8, label: "flexible WR-leaning hybrid" },
  Jakub: { QB: 30.1, RB: 62.2, WR: 61.5, TE: 32.2, specialTeams: 3.4, topTwo: 36.0, ones: 4.2, keeper: 10.6, label: "balanced premium QB/TE" },
  Tye: { QB: 10.4, RB: 106.2, WR: 44.1, TE: 12.3, specialTeams: 3.2, topTwo: 37.2, ones: 2.0, keeper: 9.1, label: "deep RB-heavy" },
  Chip: { QB: 9.4, RB: 71.5, WR: 59.3, TE: 8.2, specialTeams: 7.8, topTwo: 51.4, ones: 3.1, keeper: 43.8, label: "expensive-keeper dependent" },
  CJ: { QB: 8.4, RB: 73.0, WR: 91.0, TE: 10.2, specialTeams: 4.5, topTwo: 53.6, ones: 4.7, keeper: 12.5, label: "low-QB, slight WR lean" },
  Kenny: { QB: 17.7, RB: 69.1, WR: 93.1, TE: 4.1, specialTeams: 3.4, topTwo: 41.8, ones: 5.1, keeper: 12.6, label: "balanced with WR preference" },
  Russ: { QB: 24.5, RB: 92.2, WR: 69.9, TE: 3.0, specialTeams: 3.2, topTwo: 56.0, ones: 5.5, keeper: 7.2, label: "RB concentration plus paid QB" },
  Cam: { QB: 3.0, RB: 43.3, WR: 112.6, TE: 11.0, specialTeams: 3.0, topTwo: 42.0, ones: 6.6, keeper: 27.1, label: "extreme wait-on-QB, WR-heavy" },
  Sam: { QB: 19.8, RB: 84.0, WR: 51.2, TE: 25.7, specialTeams: 2.0, topTwo: 43.8, ones: 4.2, keeper: 17.3, label: "RB plus premium TE/QB" },
  Martins: { QB: 10.7, RB: 111.4, WR: 56.3, TE: 10.0, specialTeams: 1.9, topTwo: 55.4, ones: 2.2, keeper: 8.2, label: "concentrated RB-heavy" },
  Mello: { QB: 4.2, RB: 46.0, WR: 140.3, TE: 4.0, specialTeams: 2.7, topTwo: 62.2, ones: 5.8, keeper: 2.8, label: "extreme WR stars and scrubs" },
} as const;

describe("owner profiles", () => {
  it("reproduces the verified weighted owner behavior profiles from historical boards", async () => {
    const records = await loadHistoricalAuctionRecords();
    const profiles = buildOwnerProfiles(records);

    expect(profiles.map(profile => profile.owner)).toEqual(ownerOrder);

    for (const profile of profiles) {
      const expected = expectedProfiles[profile.owner];

      expectNear(profile.openAuctionSpend.QB, expected.QB);
      expectNear(profile.openAuctionSpend.RB, expected.RB);
      expectNear(profile.openAuctionSpend.WR, expected.WR);
      expectNear(profile.openAuctionSpend.TE, expected.TE);
      expectNear(profile.normalSpecialTeamsSpend, expected.specialTeams);
      expectNear(profile.topTwoConcentration, expected.topTwo);
      expectNear(profile.oneDollarPlayerCount, expected.ones);
      expectNear(profile.averageKeeperCost, expected.keeper);
      expect(profile.profileLabel).toBe(expected.label);
    }
  });

  it("builds the league-level open-auction spend calibration targets", async () => {
    const records = await loadHistoricalAuctionRecords();
    const targets = buildLeagueOpenAuctionSpendTargets(records, defaultHistoricalWeights);

    expectNear(targets.byPosition.QB, 200.5);
    expectNear(targets.byPosition.RB, 1035.5);
    expectNear(targets.byPosition.WR, 1152.0);
    expectNear(targets.byPosition.TE, 162.7);
    expectNear(targets.byPosition.K, 22.9);
    expectNear(targets.byPosition.DST, 22.9);
    expectNear(targets.total, 2596.5);
  });
});
