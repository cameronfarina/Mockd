import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import {
  buildInteractiveMockDraftState,
  resolveInteractiveMockDraftAction,
} from "../src/modeling/interactiveMockDraft.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const commandsBeforeAffordableRb3Decision = [
  "Beaton drafted Jahmyr Gibbs for 74",
  "Mello drafted Puka Nacua for 74",
  "Beaton drafted Bijan Robinson for 74",
  "Mello drafted Ja'Marr Chase for 74",
  "Martins drafted Christian McCaffrey for 69",
  "Martins drafted Jonathan Taylor for 69",
  "PJ drafted Amon-Ra St. Brown for 69",
  "PJ drafted CeeDee Lamb for 69",
  "Russ drafted De'Von Achane for 69",
  "Russ drafted Saquon Barkley for 69",
  "Cam drafted Derrick Henry for 62",
  "Hoody drafted Justin Jefferson for 66",
  "Hoody drafted Rashee Rice for 58",
  "CJ drafted Ashton Jeanty for 59",
  "CJ drafted Jeremiyah Love for 55",
  "Seth drafted Nico Collins for 55",
  "Chip drafted Garrett Wilson for 58",
  "Cam drafted Omarion Hampton for 54",
  "Seth drafted Drake London for 56",
  "Chip drafted James Cook III for 51",
  "Kenny drafted A.J. Brown for 49",
  "Sam drafted Josh Jacobs for 46",
  "Sam drafted Josh Allen for 37",
  "Sam drafted Brock Bowers for 39",
  "Jakub drafted Trey McBride for 39",
];

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

    expect(state.phase).toBe("ai-sale");
    expect(state.nominator).toBe("Beaton");
    expect(state.nomination?.player).toBe("Jahmyr Gibbs");
    expect(state.aiSaleCommand).toMatch(/^\w+ drafted Jahmyr Gibbs for \d+$/);
    expect(state.camDecision).toBeUndefined();
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
      commands: commandsBeforeAffordableRb3Decision,
      watchOwner: "Cam",
      strategyKey: "three-rb",
      seed: "interactive-test",
    });

    expect(state.phase).toBe("human-decision");
    expect(state.nomination?.player).toBe("Breece Hall");
    expect(state.camDecision).toMatchObject({
      maxBid: 44,
      recommendedBid: 42,
      topAiBid: 41,
      topAiBidOwner: "Chip",
    });
    expect(state.camDecision?.maxBid).toBeGreaterThanOrEqual(state.camDecision?.recommendedBid ?? 0);

    const camBid = resolveInteractiveMockDraftAction(state, "cam-bid");
    const pass = resolveInteractiveMockDraftAction(state, "pass");
    expect(camBid.command).toBe(`Cam drafted ${state.nomination?.player} for ${state.camDecision?.recommendedBid}`);
    expect(pass.command).toBe(state.aiSaleCommand);
  });

  it("lets Cam explicitly nominate a selected player on his snake turn", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const commandsBeforeCamNomination = commandsBeforeAffordableRb3Decision.slice(0, 10);
    const nominationTurn = buildInteractiveMockDraftState({
      projections,
      historicalRecords,
      keepers,
      commands: commandsBeforeCamNomination,
      watchOwner: "Cam",
      strategyKey: "three-rb",
      seed: "cam-nomination-test",
    });
    const nominated = buildInteractiveMockDraftState({
      projections,
      historicalRecords,
      keepers,
      commands: commandsBeforeCamNomination,
      watchOwner: "Cam",
      strategyKey: "three-rb",
      seed: "cam-nomination-test",
      nominatedPlayer: "Breece Hall",
    });

    expect(nominationTurn).toMatchObject({
      phase: "human-nomination",
      nominator: "Cam",
    });
    expect(nominated.nominator).toBe("Cam");
    expect(nominated.nomination?.player).toBe("Breece Hall");
    expect(nominated.aiBids.length).toBeGreaterThan(0);
    expect(nominated.aiSaleCommand).toContain("Breece Hall");
    expect(["human-decision", "ai-sale"]).toContain(nominated.phase);

    const resolved = resolveInteractiveMockDraftAction(
      nominated,
      nominated.phase === "human-decision" ? "pass" : "advance",
    );
    expect(resolved.command).toBe(nominated.aiSaleCommand);
  });
});
