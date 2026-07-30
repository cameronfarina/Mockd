import { describe, expect, it } from "vitest";
import { keeperCost } from "../config/keepers.js";

describe("keeperCost", () => {
  it("rounds a 20% increase up to the next whole dollar", () => {
    expect(keeperCost(3)).toBe(4);
    expect(keeperCost(35)).toBe(42);
    expect(keeperCost(1)).toBe(2);
  });
});
