export type KeeperStatus = "confirmed" | "assumed";

export interface KeeperDeclaration {
  owner: string;
  player: string;
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DST";
  priorCost: number;
  newCost: number;
  status: KeeperStatus;
}

export const keeperCost = (priorCost: number): number => Math.ceil(priorCost * 1.2);

export const keepers: KeeperDeclaration[] = [
  { owner: "PJ", player: "Bucky Irving", position: "RB", priorCost: 3, newCost: 4, status: "confirmed" },
  { owner: "Jakub", player: "Rhamondre Stevenson", position: "RB", priorCost: 2, newCost: 3, status: "confirmed" },
  { owner: "Cam", player: "Justin Herbert", position: "QB", priorCost: 1, newCost: 2, status: "confirmed" },
  { owner: "Martins", player: "Javonte Williams", position: "RB", priorCost: 3, newCost: 4, status: "confirmed" },
  { owner: "Seth", player: "Jaxon Smith-Njigba", position: "WR", priorCost: 35, newCost: 42, status: "assumed" },
  { owner: "Russ", player: "Pat Freiermuth", position: "TE", priorCost: 1, newCost: 2, status: "assumed" }
];
