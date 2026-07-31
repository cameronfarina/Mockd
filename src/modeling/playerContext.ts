import {
  playerContextCategories,
  type PlayerContextConfig,
  type PlayerContextNotes,
  type PlayerContextSignals,
  type PlayerContextWeights,
} from "../../config/playerContext.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";

export interface PlayerContextAdjustment {
  enabled: boolean;
  factor: number;
  uncappedAdjustment: number;
  cappedAdjustment: number;
  signals: PlayerContextSignals;
  weights: PlayerContextWeights;
  notes?: PlayerContextNotes;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const overrideForPlayer = (
  playerName: string,
  config: PlayerContextConfig,
) => {
  const normalizedName = normalizePlayerName(playerName);
  return config.overrides.find(override => normalizePlayerName(override.player) === normalizedName);
};

const weightedSignalSum = (
  signals: PlayerContextSignals,
  weights: PlayerContextWeights,
): number =>
  playerContextCategories.reduce(
    (sum, category) => sum + (signals[category] ?? 0) * weights[category],
    0,
  );

export const calculatePlayerContextAdjustment = (
  playerName: string,
  config: PlayerContextConfig,
): PlayerContextAdjustment => {
  const override = overrideForPlayer(playerName, config);
  const signals = override?.signals ?? {};
  const uncappedAdjustment = config.enabled ? weightedSignalSum(signals, config.weights) : 0;
  const cappedAdjustment = clamp(uncappedAdjustment, -config.maxAdjustment, config.maxAdjustment);

  return {
    enabled: config.enabled,
    factor: 1 + cappedAdjustment,
    uncappedAdjustment,
    cappedAdjustment,
    signals: config.enabled ? signals : {},
    weights: config.weights,
    ...(config.enabled && override?.notes ? { notes: override.notes } : {}),
  };
};
