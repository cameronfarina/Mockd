import { describe, expect, it } from "vitest";
import { keeperCost, keepers } from "../config/keepers.js";

describe("keeperCost", () => {
  it("rounds a 20% increase up to the next whole dollar", () => {
    expect(keeperCost(3)).toBe(4);
    expect(keeperCost(35)).toBe(42);
    expect(keeperCost(1)).toBe(2);
    expect(keeperCost(41)).toBe(50);
  });
});

describe("keepers", () => {
  it("uses Achane as Cam's confirmed keeper", () => {
    expect(keepers.filter(keeper => keeper.owner === "Cam" && keeper.status === "confirmed")).toEqual([
      {
        owner: "Cam",
        player: "De'Von Achane",
        position: "RB",
        priorCost: 41,
        newCost: 50,
        status: "confirmed",
      },
    ]);
  });
});
