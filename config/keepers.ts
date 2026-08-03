import type { Owner, Position } from "./league.js";

export type KeeperStatus = "confirmed" | "assumed" | "pending" | "open";

export interface KeeperDeclaration {
  owner: Owner;
  player: string;
  position: Position;
  priorCost: number;
  newCost: number;
  status: KeeperStatus;
  notes?: string;
}

export const keeperCost = (priorCost: number): number => Math.ceil(priorCost * 1.2);

export const keepers: KeeperDeclaration[] = [
  { owner: "PJ", player: "Bucky Irving", position: "RB", priorCost: 3, newCost: 4, status: "confirmed" },
  { owner: "Jakub", player: "Rhamondre Stevenson", position: "RB", priorCost: 2, newCost: 3, status: "confirmed" },
  { owner: "Cam", player: "De'Von Achane", position: "RB", priorCost: 41, newCost: keeperCost(41), status: "confirmed" },
  { owner: "Martins", player: "Javonte Williams", position: "RB", priorCost: 3, newCost: 4, status: "confirmed" },
  { owner: "Seth", player: "Jaxon Smith-Njigba", position: "WR", priorCost: 35, newCost: 42, status: "assumed" },
  { owner: "Russ", player: "Pat Freiermuth", position: "TE", priorCost: 1, newCost: 2, status: "assumed" }
];
