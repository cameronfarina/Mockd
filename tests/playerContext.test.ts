import { describe, expect, it } from "vitest";
import type { PlayerContextConfig } from "../config/playerContext.js";
import { calculatePlayerContextAdjustment } from "../src/modeling/playerContext.js";

const contextConfig: PlayerContextConfig = {
  enabled: true,
  maxAdjustment: 0.18,
  weights: {
    role: 0.08,
    injury: 0.07,
    contract: 0.03,
    coaching: 0.04,
    schedule: 0.03,
    bye: 0.02,
  },
  overrides: [
    {
      player: "Example Player",
      signals: {
        role: -1,
        injury: -0.5,
        contract: 0.5,
        coaching: 1,
        schedule: -0.5,
        bye: -1,
      },
      notes: {
        role: "Committee risk.",
        coaching: "New play caller helps.",
      },
    },
  ],
};

describe("player context custom weights", () => {
  it("returns a neutral factor when custom weights are disabled", () => {
    expect(calculatePlayerContextAdjustment("Example Player", {
      ...contextConfig,
      enabled: false,
    })).toMatchObject({
      enabled: false,
      factor: 1,
      cappedAdjustment: 0,
    });
  });

  it("combines enabled manual category signals into one capped factor", () => {
    const adjustment = calculatePlayerContextAdjustment("Example Player", contextConfig);

    expect(adjustment.enabled).toBe(true);
    expect(adjustment.signals).toEqual(contextConfig.overrides[0]!.signals);
    expect(adjustment.notes).toEqual(contextConfig.overrides[0]!.notes);
    expect(adjustment.uncappedAdjustment).toBeCloseTo(-0.095);
    expect(adjustment.cappedAdjustment).toBeCloseTo(-0.095);
    expect(adjustment.factor).toBeCloseTo(0.905);
  });

  it("caps extreme custom-weight adjustments", () => {
    const adjustment = calculatePlayerContextAdjustment("Example Player", {
      ...contextConfig,
      maxAdjustment: 0.1,
      weights: {
        role: 0.5,
        injury: 0.5,
        contract: 0.5,
        coaching: 0.5,
        schedule: 0.5,
        bye: 0.5,
      },
    });

    expect(adjustment.uncappedAdjustment).toBeLessThan(-0.1);
    expect(adjustment.cappedAdjustment).toBe(-0.1);
    expect(adjustment.factor).toBe(0.9);
  });
});
