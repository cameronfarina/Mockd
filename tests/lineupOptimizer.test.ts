import { describe, expect, it } from "vitest";
import { lineupScore, optimizeLineup } from "../src/lineupOptimizer.js";
import type { MockRoster, Player } from "../src/types.js";

const player = (name: string, position: Player["position"], weeks1To4: number): Player => ({
  name,
  position,
  price: 1,
  week1: weeks1To4 / 4,
  weeks1To4,
});

describe("optimizeLineup", () => {
  it("starts the best legal players after the full roster exists", () => {
    const roster: MockRoster = {
      strategy: "test",
      players: [
        player("QB", "QB", 70),
        player("RB bad", "RB", 8),
        player("RB good 1", "RB", 50),
        player("RB good 2", "RB", 45),
        player("RB flex", "RB", 40),
        player("WR 1", "WR", 48),
        player("WR 2", "WR", 46),
        player("WR bench", "WR", 15),
        player("TE", "TE", 30),
        player("TE bench", "TE", 10),
        player("K", "K", 20),
        player("DST", "DST", 20),
        player("Bench 1", "WR", 9),
        player("Bench 2", "RB", 7),
        player("Bench 3", "WR", 6),
        player("Bench 4", "RB", 5),
      ],
    };

    const lineup = optimizeLineup(roster, "weeks1To4");
    const starters = new Set(lineup.map(entry => entry.player.name));

    expect(starters.has("RB bad")).toBe(false);
    expect(starters.has("RB good 1")).toBe(true);
    expect(starters.has("RB good 2")).toBe(true);
    expect(starters.has("RB flex")).toBe(true);
    expect(lineupScore(lineup, "weeks1To4")).toBe(369);
  });
});
