import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import {
  buildInteractiveMockDraftState,
  resolveInteractiveMockDraftAction,
} from "../src/modeling/interactiveMockDraft.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

describe("interactive mock draft", () => {
  it("uses real auction nominations and AI bids for owners other than Cam", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildInteractiveMockDraftState({
      projections,
      historicalRecords,
      keepers,
      commands: [],
      watchOwner: "Cam",
      strategyKey: "three-rb",
      seed: "interactive-test",
    });

    expect(state.phase).toBe("human-decision");
    expect(state.nominator).toBe("Beaton");
    expect(state.nomination?.player).toBe("Jahmyr Gibbs");
    expect(state.aiSaleCommand).toMatch(/^\w+ drafted Jahmyr Gibbs for \d+$/);
    expect(state.camDecision).toMatchObject({
      recommendedBid: 79,
      topAiBid: 78,
      topAiBidOwner: "Beaton",
    });
    expect(state.aiBids[0]).toMatchObject({
      player: "Jahmyr Gibbs",
      owner: expect.not.stringMatching(/^Cam$/),
    });
    expect(state.topTargets[0]).toMatchObject({
      name: "Jahmyr Gibbs",
      position: "RB",
    });
  });

  it("stops for Cam when his strategy value beats the AI price", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildInteractiveMockDraftState({
      projections,
      historicalRecords,
      keepers,
      commands: ["beaton drafted jahmyr gibbs for 74"],
      watchOwner: "Cam",
      strategyKey: "three-rb",
      seed: "interactive-test",
    });

    expect(state.phase).toBe("human-decision");
    expect(state.nomination?.player).toBeTruthy();
    expect(state.camDecision?.maxBid).toBeGreaterThanOrEqual(state.camDecision?.recommendedBid ?? 0);

    const camBid = resolveInteractiveMockDraftAction(state, "cam-bid");
    const pass = resolveInteractiveMockDraftAction(state, "pass");
    expect(camBid.command).toBe(`Cam drafted ${state.nomination?.player} for ${state.camDecision?.recommendedBid}`);
    expect(pass.command).toBe(state.aiSaleCommand);
  });
});
