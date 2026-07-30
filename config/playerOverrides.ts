export interface PlayerOverride {
  player: string;
  sustainabilityFactor: number;
  note: string;
}

export const playerOverrides: PlayerOverride[] = [
  {
    player: "Jadarian Price",
    sustainabilityFactor: 0.68,
    note: "Temporary-opportunity concern tied to Zach Charbonnet's recovery.",
  },
  {
    player: "Bhayshul Tuten",
    sustainabilityFactor: 0.9,
    note: "Role expansion is plausible but workload is not yet fully established.",
  },
  {
    player: "TreVeyon Henderson",
    sustainabilityFactor: 0.95,
    note: "Strong role, but modeled as part of a tandem rather than a solo backfield.",
  },
  {
    player: "Rico Dowdle",
    sustainabilityFactor: 0.9,
    note: "Committee-sensitive workload.",
  },
  {
    player: "Tucker Kraft",
    sustainabilityFactor: 0.9,
    note: "ACL recovery and early-season availability risk.",
  },
];
