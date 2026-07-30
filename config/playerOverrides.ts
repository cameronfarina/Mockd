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
    player: "Aaron Jones",
    sustainabilityFactor: 0.95,
    note: "Age and workload durability adjustment.",
  },
  {
    player: "Chuba Hubbard",
    sustainabilityFactor: 0.95,
    note: "Backfield competition and role-fragility adjustment.",
  },
  {
    player: "Christian Watson",
    sustainabilityFactor: 0.95,
    note: "Availability and target-volume volatility adjustment.",
  },
  {
    player: "Harold Fannin Jr.",
    sustainabilityFactor: 0.9,
    note: "Early-career tight end role uncertainty.",
  },
  {
    player: "Jordyn Tyson",
    sustainabilityFactor: 0.9,
    note: "Projection-driven role is not fully established.",
  },
  {
    player: "Kyle Monangai",
    sustainabilityFactor: 0.95,
    note: "Backfield role is plausible but not yet stable.",
  },
  {
    player: "Rhamondre Stevenson",
    sustainabilityFactor: 0.95,
    note: "Pre-keeper role-risk adjustment.",
  },
  {
    player: "J.K. Dobbins",
    sustainabilityFactor: 0.9,
    note: "Durability and backfield-role risk.",
  },
  {
    player: "Kenny Gainwell",
    sustainabilityFactor: 0.85,
    note: "Projection spike is role-sensitive behind Bucky Irving.",
  },
  {
    player: "Tucker Kraft",
    sustainabilityFactor: 0.9,
    note: "ACL recovery and early-season availability risk.",
  },
];
