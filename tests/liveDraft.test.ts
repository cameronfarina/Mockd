import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { leagueConfig } from "../config/league.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { buildLiveDraftState, parseLiveDraftSaleCommand } from "../src/modeling/liveDraft.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

describe("live draft room", () => {
  it("parses natural-language auction sale commands", () => {
    expect(parseLiveDraftSaleCommand("jakub drafted kittle for 28")).toEqual({
      ownerText: "jakub",
      playerText: "kittle",
      price: 28,
    });
  });

  it("applies a live Kittle sale from projection fallback data and reprices Cam targets", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const initialState = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Cam",
      scenarioKey: "expected",
    });
    const updatedState = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Cam",
      scenarioKey: "expected",
      commands: ["jakub drafted kittle for 28"],
    });

    expect(updatedState.events).toHaveLength(1);
    expect(updatedState.events[0]).toMatchObject({
      owner: "Jakub",
      player: "George Kittle",
      position: "TE",
      price: 28,
      expectedPrice: 2,
      playerSource: "projectionFallback",
    });
    expect(updatedState.owners.find(owner => owner.owner === "Jakub")).toMatchObject({
      spent: 31,
      budgetRemaining: 169,
      rosterSlotsRemaining: 14,
      maxBid: 156,
    });
    expect(updatedState.owners.find(owner => owner.owner === "Jakub")?.slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slot: "RB1",
          player: expect.objectContaining({ name: "Rhamondre Stevenson" }),
        }),
        expect.objectContaining({
          slot: "TE",
          player: expect.objectContaining({ name: "George Kittle" }),
        }),
      ]),
    );
    expect(updatedState.availableTargets.some(target => target.name === "George Kittle")).toBe(false);
    expect(updatedState.room.actualAuctionSpend).toBe(28);
    expect(updatedState.room.expectedAuctionSpend).toBe(2);
    expect(updatedState.room.saleVsExpected).toBe(26);
    expect(updatedState.room.liveInflationFactor).toBeLessThan(initialState.room.liveInflationFactor);
    expect(updatedState.availableTargets[0]?.recommendedMaxBid).toBeLessThanOrEqual(updatedState.watchOwner.maxBid);
    expect(updatedState.postDraftAudit).toHaveLength(1);
    expect(updatedState.postDraftAudit[0]).toMatchObject({
      input: "jakub drafted kittle for 28",
      owner: "Jakub",
      player: "George Kittle",
      position: "TE",
      price: 28,
      expectedPrice: 2,
      expectedDelta: 26,
      liveExpectedPrice: expect.any(Number),
      liveDelta: expect.any(Number),
      personalValue: expect.any(Number),
      personalDelta: expect.any(Number),
      verdict: "overpay",
    });
    expect(updatedState.postDraftAudit[0]?.personalDelta).toBe(
      28 - (updatedState.postDraftAudit[0]?.personalValue ?? 0),
    );
  });

  it("rejects impossible sale commands before changing the live draft state", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const overMaxBidState = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Cam",
      scenarioKey: "expected",
      commands: ["cam drafted jahmyr gibbs for 999"],
    });
    const overPositionLimitState = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Cam",
      scenarioKey: "expected",
      commands: [
        "cam drafted josh allen for 1",
        "cam drafted lamar jackson for 1",
        "cam drafted jayden daniels for 1",
      ],
    });

    expect(leagueConfig.rosterMaximums).toMatchObject({ QB: 3, RB: 6, WR: 6, TE: 2, K: 2, DST: 2 });
    expect(overMaxBidState.events).toHaveLength(0);
    expect(overMaxBidState.errors[0]?.message).toContain("Cam can only bid up to $184");
    expect(overMaxBidState.availableTargets[0]?.name).toBe("Jahmyr Gibbs");
    expect(overPositionLimitState.events).toHaveLength(2);
    expect(overPositionLimitState.errors[0]?.message).toBe("Cam cannot buy Jayden Daniels: roster limit is 3 QBs.");
  });

  it("rejects ambiguous quick-sale player names with explicit match options", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Cam",
      scenarioKey: "expected",
      commands: ["cam drafted brown for 12"],
    });

    expect(state.events).toHaveLength(0);
    expect(state.errors[0]?.message).toContain("Ambiguous player \"brown\"");
    expect(state.errors[0]?.message).toContain("A.J. Brown");
    expect(state.errors[0]?.message).toContain("Chase Brown");
  });

  it("exposes board metadata for a simple search-and-add interface", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Cam",
      scenarioKey: "expected",
    });

    const camQuarterbackSlot = state.watchOwner.slots.find(slot => slot.slot === "QB");
    const gibbs = state.availableTargets.find(target => target.name === "Jahmyr Gibbs");

    expect(camQuarterbackSlot?.player).toMatchObject({
      name: "Justin Herbert",
      position: "QB",
      price: 2,
    });
    expect(gibbs).toMatchObject({
      position: "RB",
      expectedPrice: 72,
      teamAbbreviation: "DET",
      byeWeek: 6,
    });
    expect(gibbs?.personalValue).toBeGreaterThanOrEqual(gibbs?.liveExpectedPrice ?? 0);
    expect(gibbs?.personalValue).toBeLessThanOrEqual(80);
    expect(gibbs?.strategyValues).toMatchObject({
      balanced: expect.any(Number),
      "three-rb": gibbs?.personalValue,
      "hero-rb": expect.any(Number),
      "wr-heavy": expect.any(Number),
    });
    const receiver = state.availableTargets.find(target => target.position === "WR");
    expect(receiver?.strategyValues["wr-heavy"]).toBeGreaterThanOrEqual(receiver?.strategyValues["three-rb"] ?? 0);
    expect(gibbs?.recommendedMaxBid).toBeLessThanOrEqual(state.watchOwner.maxBid);
    expect(gibbs?.recommendedMaxBid).toBe(62);
    expect(gibbs?.tags).toContain("path max $62");
    expect(state.draftPath).toMatchObject({
      strategyKey: "three-rb",
      label: "True 3RB",
      summary: expect.stringContaining("3 premium RB"),
      maxPriceBands: expect.arrayContaining([
        expect.objectContaining({
          slot: "RB1",
          position: "RB",
          minimumPrice: 55,
          maximumPrice: 62,
          status: "next",
        }),
        expect.objectContaining({
          slot: "RB2",
          position: "RB",
          minimumPrice: 45,
          maximumPrice: 54,
          status: "open",
        }),
      ]),
      targetClusters: expect.arrayContaining([
        expect.objectContaining({
          label: "Target",
          position: "RB",
          priceBand: "$55-$62",
        }),
      ]),
      pivotRules: expect.arrayContaining([
        expect.objectContaining({
          label: "Pivot",
          action: expect.stringContaining("Hero RB"),
        }),
      ]),
      deadZoneWarnings: [],
    });
    expect(state.shortlist[0]).toMatchObject({
      name: "Jahmyr Gibbs",
      position: "RB",
    });
    expect(state.shortlist[0]?.reasons).toContain("starter need");
    expect(state.positionContexts.find(context => context.position === "RB")).toMatchObject({
      position: "RB",
      ownersNeeding: expect.arrayContaining(["Cam"]),
    });
    expect(state.positionContexts.find(context => context.position === "WR")?.blockers.length).toBeGreaterThan(0);
    expect(state.readiness.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "engine-state", status: "pass" }),
        expect.objectContaining({ key: "target-board", status: "pass" }),
        expect.objectContaining({ key: "draft-path", status: "pass" }),
      ]),
    );
  });

  it("advances the live 3RB path bands after Cam buys a core running back", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Cam",
      scenarioKey: "expected",
      strategyKey: "three-rb",
      commands: ["cam drafted jahmyr gibbs for 62"],
    });

    const nextRb = state.availableTargets.find(target => target.position === "RB");

    expect(state.draftPath.maxPriceBands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slot: "RB1",
        status: "filled",
        filledBy: "Jahmyr Gibbs",
      }),
      expect.objectContaining({
        slot: "RB2",
        status: "next",
        maximumPrice: 54,
      }),
    ]));
    expect(nextRb?.recommendedMaxBid).toBeLessThanOrEqual(54);
    expect(nextRb?.tags).toContain("path max $54");
  });
});
