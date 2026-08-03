import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
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
    expect(updatedState.availableTargets.some(target => target.name === "George Kittle")).toBe(false);
    expect(updatedState.room.actualAuctionSpend).toBe(28);
    expect(updatedState.room.expectedAuctionSpend).toBe(2);
    expect(updatedState.room.saleVsExpected).toBe(26);
    expect(updatedState.room.liveInflationFactor).toBeLessThan(initialState.room.liveInflationFactor);
    expect(updatedState.availableTargets[0]?.recommendedMaxBid).toBeLessThanOrEqual(updatedState.watchOwner.maxBid);
  });
});
