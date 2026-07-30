export const ownerOrder = [
  "Beaton",
  "Hoody",
  "PJ",
  "Seth",
  "Jakub",
  "Tye",
  "Chip",
  "CJ",
  "Kenny",
  "Russ",
  "Cam",
  "Sam",
  "Martins",
  "Mello",
] as const;

export type Owner = (typeof ownerOrder)[number];

export const leagueConfig = {
  leagueId: 214674,
  teams: 14,
  auctionBudget: 200,
  rosterSize: 16,
  scoring: {
    passingYards: 0.04,
    passingTouchdown: 4,
    rushingYards: 0.1,
    rushingTouchdown: 6,
    receivingYards: 0.1,
    receivingTouchdown: 6,
    reception: 0.5,
  },
  lineup: {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    FLEX: 1,
    K: 1,
    DST: 1,
    BENCH: 7,
  },
  rosterMaximums: {
    QB: 3,
    RB: 6,
    WR: 6,
    TE: 2,
    K: 2,
    DST: 2,
  },
} as const;

export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";
