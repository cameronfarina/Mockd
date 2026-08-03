import type { Position } from "../config/league.js";

export interface Player {
  id?: string | number;
  name: string;
  position: Position;
  proTeamId?: number;
  price: number;
  week1: number;
  weeks1To4: number;
  seasonProjection?: number;
  contextAdjustmentPercent?: number;
  contextEvidenceCount?: number;
}

export type StarterSlot = "QB" | "RB1" | "RB2" | "WR1" | "WR2" | "TE" | "FLEX" | "K" | "DST";

export interface LineupEntry {
  player: Player;
  slot: StarterSlot;
}

export interface MockRoster {
  strategy: string;
  players: Player[];
}
