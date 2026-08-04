import { type Owner, type Position } from "../../config/league.js";
import { lineupScore, optimizeLineup } from "../lineupOptimizer.js";
import type { LineupEntry, Player } from "../types.js";
import type { AuctionEngineConfigOverrides } from "./auctionEngine.js";
import type { LiveDraftStrategyKey } from "./liveDraftStrategies.js";
import type { MockBatch, MockRosterSummary, PlayerBatchSummary } from "./mockBatch.js";

export type DraftPlanStrategyKey = LiveDraftStrategyKey;

export interface DraftPlanStrategyDefinition {
  key: DraftPlanStrategyKey;
  label: string;
  thresholds: {
    rb1Minimum: number;
    rb2Minimum: number;
    rb3Minimum: number;
    rbCoreSpendMinimum: number;
  };
}

export interface DraftPlanPriceBand {
  slot: string;
  position: Position;
  minimumPrice: number;
  maximumPrice: number;
  note: string;
}

export interface DraftPlanTargetCluster {
  label: string;
  position: Position;
  targetNames: string[];
  priceBand: string;
  note: string;
}

export interface DraftPlanPivotRule {
  label: string;
  trigger: string;
  action: string;
}

export type DraftPlanRiskStatus = "pass" | "warn" | "fail";

export interface DraftPlanSlotBlueprint {
  slot: string;
  position: Position;
  sampleCount: number;
  minimumPrice: number;
  maximumPrice: number;
  averagePrice: number;
  priceBand: string;
  lockedNames: string[];
  targetNames: string[];
  fallbackPriceBand: string;
  fallbackNames: string[];
  note: string;
}

export interface DraftPlanContingencyPlan {
  label: string;
  trigger: string;
  action: string;
  targetNames: string[];
  priceBand: string;
}

export interface DraftPlanRiskGuardrail {
  label: string;
  status: DraftPlanRiskStatus;
  detail: string;
}

export interface DraftPlanStrategyCoach {
  headline: string;
  sampleSize: number;
  averageWeeks1To4Score: number;
  blueprint: DraftPlanSlotBlueprint[];
  contingencyPlans: DraftPlanContingencyPlan[];
  riskGuardrails: DraftPlanRiskGuardrail[];
}

export interface DraftPlanRecommendations {
  maxPriceBands: DraftPlanPriceBand[];
  targetClusters: DraftPlanTargetCluster[];
  pivotRules: DraftPlanPivotRule[];
  deadZoneWarnings: string[];
  strategyCoach: DraftPlanStrategyCoach;
}

export interface DraftPlanPlayerMarket {
  averageMarketPrice: number;
  averageSalePrice: number;
  minimumSalePrice: number;
  maximumSalePrice: number;
  draftedRate: number;
}

export interface DraftPlanPlayer {
  name: string;
  position: Position;
  price: number;
  weeks1To4: number;
  market?: DraftPlanPlayerMarket;
}

export interface DraftPlanLineupEntry {
  slot: LineupEntry["slot"];
  player: DraftPlanPlayer;
}

export interface DraftPlanCandidate {
  seed: string;
  scenarioKey: string;
  owner: Owner;
  strategy: DraftPlanStrategyKey;
  rosterSpend: number;
  budgetRemaining: number;
  week1Score: number;
  weeks1To4Score: number;
  rbCoreSpend: number;
  positionSpend: Record<Position, number>;
  rbCore: DraftPlanPlayer[];
  lineup: DraftPlanLineupEntry[];
  bench: DraftPlanPlayer[];
  players: DraftPlanPlayer[];
}

export interface BuildDraftPlanReportOptions {
  batch: MockBatch;
  owner: Owner;
  strategyKey: DraftPlanStrategyKey;
  limit?: number;
}

export interface DraftPlanReport {
  owner: Owner;
  strategy: DraftPlanStrategyDefinition;
  engineMode: "fast" | "full";
  runCount: number;
  matchedRunCount: number;
  candidateLimit: number;
  recommendations: DraftPlanRecommendations;
  candidates: DraftPlanCandidate[];
}

type CsvValue = string | number | undefined;

const defaultCandidateLimit = 5;
const hashDivisor = 0x100000000;

export const threeRbPathRules = {
  rbCoreBudget: {
    targetCount: 3,
    minimumSpend: 130,
    hardBudget: 158,
    minimumFutureCorePrice: 14,
  },
  priceBands: [
    {
      slot: "RB1",
      position: "RB",
      minimumPrice: 50,
      maximumPrice: 76,
      note: "Anchor RB lane; can flex up when the board makes it worth it.",
    },
    {
      slot: "RB2",
      position: "RB",
      minimumPrice: 35,
      maximumPrice: 76,
      note: "Second core RB lane, balanced against total RB spend.",
    },
    {
      slot: "RB3",
      position: "RB",
      minimumPrice: 12,
      maximumPrice: 48,
      note: "Third playable RB lane; price flexes down after expensive anchors.",
    },
    {
      slot: "WR1",
      position: "WR",
      minimumPrice: 12,
      maximumPrice: 26,
      note: "Paid WR value starter.",
    },
    {
      slot: "WR2",
      position: "WR",
      minimumPrice: 8,
      maximumPrice: 20,
      note: "Second WR value starter.",
    },
    {
      slot: "TE",
      position: "TE",
      minimumPrice: 1,
      maximumPrice: 4,
      note: "Cheap TE lane.",
    },
  ],
  slotMaxBids: {
    RB: [76, 76, 76, 8, 4],
    WR: [26, 20, 16, 8, 5, 3, 1],
    TE: [4, 1],
    K: [2],
    DST: [2],
  },
  pivotRules: [
    {
      label: "RB budget envelope",
      trigger: "The first two RBs use most of the RB core budget.",
      action: "Let the third RB flex down and protect paid WR value instead of forcing another premium RB.",
    },
    {
      label: "Third RB chase",
      trigger: "The third RB would push the core above the hard RB budget.",
      action: "Pass unless the player is a clear projection value and the WR plan is already intact.",
    },
    {
      label: "WR pocket closes",
      trigger: "WR starters are clearing above the value pocket.",
      action: "Preserve the RB core and force TE/K/DST into the $1-$3 lane.",
    },
  ],
} as const satisfies {
  rbCoreBudget: {
    targetCount: number;
    minimumSpend: number;
    hardBudget: number;
    minimumFutureCorePrice: number;
  };
  priceBands: readonly DraftPlanPriceBand[];
  slotMaxBids: Partial<Record<Position, readonly number[]>>;
  pivotRules: readonly DraftPlanPivotRule[];
};

interface ThreeRbAuctionVariant {
  rbCoreBudget: {
    hardBudget: number;
    minimumFutureCorePrice: number;
  };
  rbSlotMaxBids: readonly number[];
  rbDemandMultiplier: number;
  priceAggression: number;
  scarcityChase: number;
  replacementPatience: number;
  anchorAggression: number;
  depthAggression: number;
}

const threeRbAuctionVariants: readonly ThreeRbAuctionVariant[] = [
  {
    rbCoreBudget: {
      hardBudget: 158,
      minimumFutureCorePrice: 14,
    },
    rbSlotMaxBids: [76, 76, 76, 8, 4],
    rbDemandMultiplier: 1.26,
    priceAggression: 1.07,
    scarcityChase: 1.17,
    replacementPatience: 0.96,
    anchorAggression: 1.38,
    depthAggression: 0.92,
  },
  {
    rbCoreBudget: {
      hardBudget: 152,
      minimumFutureCorePrice: 14,
    },
    rbSlotMaxBids: [76, 76, 76, 8, 4],
    rbDemandMultiplier: 1.34,
    priceAggression: 1.1,
    scarcityChase: 1.22,
    replacementPatience: 0.95,
    anchorAggression: 1.52,
    depthAggression: 0.9,
  },
  {
    rbCoreBudget: {
      hardBudget: 165,
      minimumFutureCorePrice: 22,
    },
    rbSlotMaxBids: [72, 68, 56, 8, 4],
    rbDemandMultiplier: 1.24,
    priceAggression: 1.06,
    scarcityChase: 1.18,
    replacementPatience: 0.97,
    anchorAggression: 1.34,
    depthAggression: 0.93,
  },
  {
    rbCoreBudget: {
      hardBudget: 148,
      minimumFutureCorePrice: 12,
    },
    rbSlotMaxBids: [78, 78, 78, 8, 4],
    rbDemandMultiplier: 1.32,
    priceAggression: 1.09,
    scarcityChase: 1.2,
    replacementPatience: 0.95,
    anchorAggression: 1.5,
    depthAggression: 0.89,
  },
  {
    rbCoreBudget: {
      hardBudget: 160,
      minimumFutureCorePrice: 18,
    },
    rbSlotMaxBids: [74, 74, 64, 8, 4],
    rbDemandMultiplier: 1.22,
    priceAggression: 1.05,
    scarcityChase: 1.16,
    replacementPatience: 0.97,
    anchorAggression: 1.3,
    depthAggression: 0.94,
  },
] as const;

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const threeRbAuctionVariantFor = (variantSeed: string | undefined): ThreeRbAuctionVariant =>
  variantSeed === undefined
    ? threeRbAuctionVariants[0]!
    : threeRbAuctionVariants[Math.floor(
      (hashString(variantSeed) / hashDivisor) * threeRbAuctionVariants.length,
    )] ?? threeRbAuctionVariants[0]!;

export const draftPlanStrategies = {
  balanced: {
    key: "balanced",
    label: "Balanced",
    thresholds: {
      rb1Minimum: 20,
      rb2Minimum: 1,
      rb3Minimum: 0,
      rbCoreSpendMinimum: 40,
    },
  },
  "three-rb": {
    key: "three-rb",
    label: "True 3RB",
    thresholds: {
      rb1Minimum: threeRbPathRules.priceBands[0].minimumPrice,
      rb2Minimum: threeRbPathRules.priceBands[1].minimumPrice,
      rb3Minimum: threeRbPathRules.priceBands[2].minimumPrice,
      rbCoreSpendMinimum: threeRbPathRules.rbCoreBudget.minimumSpend,
    },
  },
  "hero-rb": {
    key: "hero-rb",
    label: "Hero RB",
    thresholds: {
      rb1Minimum: 45,
      rb2Minimum: 1,
      rb3Minimum: 0,
      rbCoreSpendMinimum: 65,
    },
  },
  "wr-heavy": {
    key: "wr-heavy",
    label: "WR Heavy",
    thresholds: {
      rb1Minimum: 1,
      rb2Minimum: 1,
      rb3Minimum: 0,
      rbCoreSpendMinimum: 24,
    },
  },
} as const satisfies Record<DraftPlanStrategyKey, DraftPlanStrategyDefinition>;

const strategyPlanRules = {
  balanced: {
    priceBands: [
      {
        slot: "RB1",
        position: "RB",
        minimumPrice: 35,
        maximumPrice: 68,
        note: "Lead RB lane without locking into three premium backs.",
      },
      {
        slot: "RB2",
        position: "RB",
        minimumPrice: 18,
        maximumPrice: 48,
        note: "Second RB lane that protects starter quality.",
      },
      {
        slot: "WR1",
        position: "WR",
        minimumPrice: 20,
        maximumPrice: 52,
        note: "Paid WR lane when value beats forcing another RB.",
      },
      {
        slot: "WR2",
        position: "WR",
        minimumPrice: 8,
        maximumPrice: 28,
        note: "Second WR starter value pocket.",
      },
      {
        slot: "TE",
        position: "TE",
        minimumPrice: 1,
        maximumPrice: 8,
        note: "Controlled TE lane unless the board creates a discount.",
      },
    ],
    pivotRules: [
      {
        label: "Take the discount",
        trigger: "A starter at RB or WR falls below live value.",
        action: "Buy the discount and rebalance the next starter slot instead of staying rigid by position.",
      },
      {
        label: "Avoid double panic",
        trigger: "Two premium rooms clear above your value in a row.",
        action: "Let one tier go and spend into the next RB/WR pocket with a firm max.",
      },
    ],
  },
  "three-rb": {
    priceBands: threeRbPathRules.priceBands,
    pivotRules: threeRbPathRules.pivotRules,
  },
  "hero-rb": {
    priceBands: [
      {
        slot: "RB1",
        position: "RB",
        minimumPrice: 48,
        maximumPrice: 72,
        note: "One premium RB anchor, then let RB2 come from value.",
      },
      {
        slot: "RB2",
        position: "RB",
        minimumPrice: 8,
        maximumPrice: 30,
        note: "Discount RB2 lane after the anchor.",
      },
      {
        slot: "WR1",
        position: "WR",
        minimumPrice: 28,
        maximumPrice: 60,
        note: "Primary receiver spend after the RB anchor is secured.",
      },
      {
        slot: "WR2",
        position: "WR",
        minimumPrice: 16,
        maximumPrice: 38,
        note: "Second WR starter lane with room for upside.",
      },
      {
        slot: "TE",
        position: "TE",
        minimumPrice: 1,
        maximumPrice: 8,
        note: "Controlled TE lane unless the anchor/WR spend comes in light.",
      },
    ],
    pivotRules: [
      {
        label: "Anchor RB miss",
        trigger: "The RB anchor tier clears above your max.",
        action: "Do not chase a fake hero build; pivot to balanced RB2/WR spend.",
      },
      {
        label: "WR pocket closes",
        trigger: "WR1 and WR2 both climb above plan.",
        action: "Use RB2 value and keep TE cheap so the roster does not become thin.",
      },
    ],
  },
  "wr-heavy": {
    priceBands: [
      {
        slot: "WR1",
        position: "WR",
        minimumPrice: 38,
        maximumPrice: 72,
        note: "Primary receiver anchor lane.",
      },
      {
        slot: "WR2",
        position: "WR",
        minimumPrice: 24,
        maximumPrice: 56,
        note: "Second receiver lane for a real weekly edge.",
      },
      {
        slot: "WR3",
        position: "WR",
        minimumPrice: 12,
        maximumPrice: 36,
        note: "Third receiver/flex value pocket.",
      },
      {
        slot: "RB1",
        position: "RB",
        minimumPrice: 18,
        maximumPrice: 48,
        note: "Playable RB lane without fighting the elite-RB room.",
      },
      {
        slot: "RB2",
        position: "RB",
        minimumPrice: 6,
        maximumPrice: 28,
        note: "Second RB lane built from price discipline.",
      },
      {
        slot: "TE",
        position: "TE",
        minimumPrice: 1,
        maximumPrice: 8,
        note: "Cheap TE lane.",
      },
    ],
    pivotRules: [
      {
        label: "Receiver tax",
        trigger: "WR anchors are all clearing at premium RB prices.",
        action: "Take the RB discount and turn the build back toward balanced instead of paying for the logo.",
      },
      {
        label: "RB scarcity spike",
        trigger: "The room is letting every playable RB disappear.",
        action: "Buy one RB starter before adding the third receiver.",
      },
    ],
  },
} as const satisfies Record<DraftPlanStrategyKey, {
  priceBands: readonly DraftPlanPriceBand[];
  pivotRules: readonly DraftPlanPivotRule[];
}>;

export interface DraftPlanAuctionOverridesOptions {
  owner: Owner;
  strategyKey: DraftPlanStrategyKey;
  variantSeed?: string;
}

export const draftPlanAuctionOverridesFor = ({
  owner,
  strategyKey,
  variantSeed,
}: DraftPlanAuctionOverridesOptions): AuctionEngineConfigOverrides => {
  if (strategyKey === "balanced") {
    return {
      ownerDemandMultipliers: {
        [owner]: {
          QB: 0.65,
          RB: 1.04,
          WR: 1.06,
          TE: 0.82,
        },
      },
      ownerBehaviors: {
        [owner]: {
          priceAggression: 1.02,
          scarcityChase: 1.06,
          replacementPatience: 1,
          anchorAggression: 1.1,
          depthAggression: 0.98,
        },
      },
      ownerPositionSlotMaxBids: {
        [owner]: {
          RB: [58, 46, 24, 10, 4],
          WR: [54, 38, 24, 12, 6, 3, 1],
          TE: [8, 2],
          K: [1],
          DST: [1],
        },
      },
    };
  }

  if (strategyKey === "hero-rb") {
    return {
      ownerDemandMultipliers: {
        [owner]: { QB: 0.65, RB: 1.08, WR: 1.14, TE: 0.82 },
      },
      ownerBehaviors: {
        [owner]: {
          priceAggression: 1.03,
          scarcityChase: 1.08,
          replacementPatience: 0.99,
          anchorAggression: 1.12,
          depthAggression: 0.96,
        },
      },
      ownerPositionAnchorTargets: {
        [owner]: { RB: 1 },
      },
      ownerPositionSlotMaxBids: {
        [owner]: {
          RB: [62, 22, 12, 5, 2],
          WR: [45, 34, 24, 14, 8, 4, 1],
          TE: [8, 2],
          K: [1],
          DST: [1],
        },
      },
    };
  }

  if (strategyKey === "wr-heavy") {
    return {
      ownerDemandMultipliers: {
        [owner]: { QB: 0.62, RB: 0.9, WR: 1.24, TE: 0.82 },
      },
      ownerBehaviors: {
        [owner]: {
          priceAggression: 1.05,
          scarcityChase: 1.12,
          replacementPatience: 0.98,
          anchorAggression: 1.18,
          depthAggression: 1.02,
        },
      },
      ownerPositionAnchorTargets: {
        [owner]: { WR: 3 },
      },
      ownerPositionSlotMaxBids: {
        [owner]: {
          RB: [42, 24, 12, 5, 2],
          WR: [58, 48, 36, 20, 12, 6, 2],
          TE: [7, 2],
          K: [1],
          DST: [1],
        },
      },
    };
  }

  const variant = threeRbAuctionVariantFor(variantSeed);

  return {
    ownerDemandMultipliers: {
      [owner]: {
        QB: 0.55,
        RB: variant.rbDemandMultiplier,
        WR: 1.08,
        TE: 0.75,
      },
    },
    ownerBehaviors: {
      [owner]: {
        priceAggression: variant.priceAggression,
        scarcityChase: variant.scarcityChase,
        replacementPatience: variant.replacementPatience,
        anchorAggression: variant.anchorAggression,
        depthAggression: variant.depthAggression,
      },
    },
    ownerRosterMaximums: {
      [owner]: {
        QB: 1,
        RB: 5,
        WR: 7,
        TE: 2,
        K: 1,
        DST: 1,
      },
    },
    ownerPositionAnchorTargets: {
      [owner]: {
        RB: 3,
      },
    },
    ownerPositionCoreBudgetEnvelopes: {
      [owner]: {
        RB: {
          targetCount: threeRbPathRules.rbCoreBudget.targetCount,
          hardBudget: variant.rbCoreBudget.hardBudget,
          minimumFutureCorePrice: variant.rbCoreBudget.minimumFutureCorePrice,
        },
      },
    },
    ownerPositionSlotMaxBids: {
      [owner]: {
        RB: [...variant.rbSlotMaxBids],
        WR: [...(threeRbPathRules.slotMaxBids.WR ?? [])],
        TE: [...(threeRbPathRules.slotMaxBids.TE ?? [])],
        K: [...(threeRbPathRules.slotMaxBids.K ?? [])],
        DST: [...(threeRbPathRules.slotMaxBids.DST ?? [])],
      },
    },
  };
};

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const average = (values: readonly number[]): number =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;

const sortPlayers = (players: readonly Player[]): Player[] =>
  [...players].sort(
    (left, right) =>
      right.price - left.price ||
      right.weeks1To4 - left.weeks1To4 ||
      left.name.localeCompare(right.name),
  );

const playerMarketByName = (
  players: readonly PlayerBatchSummary[],
): ReadonlyMap<string, DraftPlanPlayerMarket> =>
  new Map(players.map(player => [
    player.name,
    {
      averageMarketPrice: player.averageMarketPrice,
      averageSalePrice: player.averageSalePrice,
      minimumSalePrice: player.minimumSalePrice,
      maximumSalePrice: player.maximumSalePrice,
      draftedRate: player.draftedRate,
    },
  ]));

const draftPlanPlayerFor = (
  player: Player,
  marketByName: ReadonlyMap<string, DraftPlanPlayerMarket>,
): DraftPlanPlayer => {
  const market = marketByName.get(player.name);
  return {
    name: player.name,
    position: player.position,
    price: player.price,
    weeks1To4: player.weeks1To4,
    ...(market ? { market } : {}),
  };
};

const csvCell = (value: CsvValue): string => {
  const text = value === undefined ? "" : String(value);
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

const playerSummary = (player: DraftPlanPlayer): string =>
  `${player.position} ${player.name} $${player.price}`;

const joinedPlayerSummaries = (players: readonly DraftPlanPlayer[]): string =>
  players.map(playerSummary).join("; ");

const priceBandText = (band: Pick<DraftPlanPriceBand, "minimumPrice" | "maximumPrice">): string =>
  `$${band.minimumPrice}-$${band.maximumPrice}`;

const priceWindowText = (minimumPrice: number, maximumPrice: number): string =>
  `$${minimumPrice}-$${maximumPrice}`;

const playerAtPosition = (
  candidate: DraftPlanCandidate,
  position: Position,
  index: number,
): DraftPlanPlayer | undefined =>
  candidate.players.filter(player => player.position === position)[index];

const draftPlanCsvRows = (report: DraftPlanReport): CsvValue[][] =>
  report.candidates.map((candidate, index) => {
    const rb1 = candidate.rbCore[0];
    const rb2 = candidate.rbCore[1];
    const rb3 = candidate.rbCore[2];
    const wr1 = playerAtPosition(candidate, "WR", 0);
    const wr2 = playerAtPosition(candidate, "WR", 1);
    const te = playerAtPosition(candidate, "TE", 0);
    const kicker = playerAtPosition(candidate, "K", 0);
    const defense = playerAtPosition(candidate, "DST", 0);

    return [
      index + 1,
      candidate.seed,
      candidate.scenarioKey,
      candidate.owner,
      candidate.strategy,
      report.engineMode,
      candidate.rosterSpend,
      candidate.budgetRemaining,
      candidate.week1Score,
      candidate.weeks1To4Score,
      candidate.rbCoreSpend,
      rb1?.name,
      rb1?.price,
      rb2?.name,
      rb2?.price,
      rb3?.name,
      rb3?.price,
      wr1?.name,
      wr1?.price,
      wr2?.name,
      wr2?.price,
      te?.name,
      te?.price,
      kicker?.name,
      kicker?.price,
      defense?.name,
      defense?.price,
      candidate.lineup.map(entry => `${entry.slot}: ${playerSummary(entry.player)}`).join("; "),
      joinedPlayerSummaries(candidate.bench),
      joinedPlayerSummaries(candidate.players),
    ];
  });

export const draftPlanReportCsv = (report: DraftPlanReport): string =>
  [
    [
      "rank",
      "seed",
      "scenario",
      "owner",
      "strategy",
      "engine_mode",
      "roster_spend",
      "budget_remaining",
      "week1_score",
      "weeks1_to_4_score",
      "rb_core_spend",
      "rb1",
      "rb1_price",
      "rb2",
      "rb2_price",
      "rb3",
      "rb3_price",
      "wr1",
      "wr1_price",
      "wr2",
      "wr2_price",
      "te",
      "te_price",
      "k",
      "k_price",
      "dst",
      "dst_price",
      "lineup",
      "bench",
      "roster",
    ],
    ...draftPlanCsvRows(report),
  ].map(row => row.map(csvCell).join(",")).join("\n");

const qualifiesForThreeRb = (
  rbCore: readonly Player[],
  strategy: DraftPlanStrategyDefinition,
  lineup: readonly LineupEntry[],
): boolean => {
  const [rb1, rb2, rb3] = rbCore;
  if (!rb1 || !rb2 || !rb3) return false;

  const startingRbCount = lineup.filter(entry => entry.player.position === "RB").length;

  return rb1.price >= strategy.thresholds.rb1Minimum &&
    rb2.price >= strategy.thresholds.rb2Minimum &&
    rb3.price >= strategy.thresholds.rb3Minimum &&
    rbCore.reduce((total, player) => total + player.price, 0) >= strategy.thresholds.rbCoreSpendMinimum &&
    startingRbCount >= threeRbPathRules.rbCoreBudget.targetCount;
};

const draftedSpendFor = (players: readonly Player[], position: Position, count: number): number =>
  sortPlayers(players.filter(player => player.position === position))
    .slice(0, count)
    .reduce((total, player) => total + player.price, 0);

const qualifiesForStrategy = (
  roster: MockRosterSummary,
  rbCore: readonly Player[],
  strategy: DraftPlanStrategyDefinition,
  lineup: readonly LineupEntry[],
): boolean => {
  if (strategy.key === "three-rb") return qualifiesForThreeRb(rbCore, strategy, lineup);

  const hasLegalStarters = lineup.length >= 9;
  if (!hasLegalStarters) return false;

  if (strategy.key === "hero-rb") {
    return (rbCore[0]?.price ?? 0) >= strategy.thresholds.rb1Minimum &&
      draftedSpendFor(roster.players, "WR", 2) >= 30;
  }

  if (strategy.key === "wr-heavy") {
    return draftedSpendFor(roster.players, "WR", 2) >= 40 &&
      (rbCore[0]?.price ?? 0) >= strategy.thresholds.rb1Minimum;
  }

  return (rbCore[0]?.price ?? 0) >= strategy.thresholds.rb1Minimum &&
    draftedSpendFor(roster.players, "WR", 2) >= 12;
};

const buildCandidate = (
  seed: string,
  scenarioKey: string,
  roster: MockRosterSummary,
  strategy: DraftPlanStrategyDefinition,
  marketByName: ReadonlyMap<string, DraftPlanPlayerMarket>,
): DraftPlanCandidate | undefined => {
  if (!roster.valid) return undefined;

  const rbCore = sortPlayers(roster.players.filter(player => player.position === "RB")).slice(0, 3);
  const optimizedLineup = optimizeLineup({ strategy: strategy.key, players: roster.players }, "weeks1To4");
  if (!qualifiesForStrategy(roster, rbCore, strategy, optimizedLineup)) return undefined;

  const lineupNames = new Set(optimizedLineup.map(entry => entry.player.name));
  const players = sortPlayers(roster.players).map(player => draftPlanPlayerFor(player, marketByName));
  const draftedPlayerByName = new Map(players.map(player => [player.name, player]));
  const lineup = optimizedLineup.map(entry => ({
    slot: entry.slot,
    player: draftedPlayerByName.get(entry.player.name) ?? draftPlanPlayerFor(entry.player, marketByName),
  }));
  const bench = sortPlayers(roster.players.filter(player => !lineupNames.has(player.name)))
    .map(player => draftedPlayerByName.get(player.name) ?? draftPlanPlayerFor(player, marketByName));

  return {
    seed,
    scenarioKey,
    owner: roster.owner,
    strategy: strategy.key,
    rosterSpend: roster.spend,
    budgetRemaining: roster.budgetRemaining,
    week1Score: roundToTwo(roster.week1Score ?? 0),
    weeks1To4Score: roundToTwo(roster.weeks1To4Score ?? lineupScore(optimizedLineup, "weeks1To4")),
    rbCoreSpend: rbCore.reduce((total, player) => total + player.price, 0),
    positionSpend: roster.positionSpend,
    rbCore: rbCore.map(player => draftPlanPlayerFor(player, marketByName)),
    lineup,
    bench,
    players,
  };
};

type CoachSlotKey = "RB1" | "RB2" | "RB3" | "WR1" | "WR2" | "TE";

interface CoachSlotDefinition {
  slot: CoachSlotKey;
  position: Position;
  playerForCandidate: (candidate: DraftPlanCandidate) => DraftPlanPlayer | undefined;
  note: string;
}

const coachCohortLimit = 12;
const fallbackWindowCushion = 8;
const minimumFallbackPrice = 1;

const coachSlotDefinitions: readonly CoachSlotDefinition[] = [
  {
    slot: "RB1",
    position: "RB",
    playerForCandidate: candidate => candidate.rbCore[0],
    note: "Primary RB spend lane from the best sampled builds.",
  },
  {
    slot: "RB2",
    position: "RB",
    playerForCandidate: candidate => candidate.rbCore[1],
    note: "Second RB lane that keeps the three-RB structure alive.",
  },
  {
    slot: "RB3",
    position: "RB",
    playerForCandidate: candidate => candidate.rbCore[2],
    note: "Flex RB lane; this is where the plan absorbs expensive early buys.",
  },
  {
    slot: "WR1",
    position: "WR",
    playerForCandidate: candidate => playerAtPosition(candidate, "WR", 0),
    note: "WR1 pocket from winning builds after RB spend is protected.",
  },
  {
    slot: "WR2",
    position: "WR",
    playerForCandidate: candidate => playerAtPosition(candidate, "WR", 1),
    note: "WR2 pocket that prevents a panic buy after RB spend.",
  },
  {
    slot: "TE",
    position: "TE",
    playerForCandidate: candidate => playerAtPosition(candidate, "TE", 0),
    note: "TE lane; expensive TE only makes sense if the core came in under budget.",
  },
];

const topCoachCandidates = (candidates: readonly DraftPlanCandidate[]): DraftPlanCandidate[] =>
  candidates.slice(0, Math.min(candidates.length, coachCohortLimit));

const pathBandForSlot = (
  slot: CoachSlotKey,
  strategy: DraftPlanStrategyDefinition,
): DraftPlanPriceBand | undefined =>
  strategyPlanRules[strategy.key].priceBands.find(band => band.slot === slot);

const fallbackWindowForBlueprint = (
  definition: CoachSlotDefinition,
  minimumPrice: number,
  maximumPrice: number,
  averagePrice: number,
  strategy: DraftPlanStrategyDefinition,
): Pick<DraftPlanPriceBand, "minimumPrice" | "maximumPrice"> => {
  const pathBand = pathBandForSlot(definition.slot, strategy);
  const minimum = Math.max(
    minimumFallbackPrice,
    Math.min(minimumPrice, Math.floor(averagePrice - fallbackWindowCushion)),
  );
  const uncappedMaximum = Math.max(maximumPrice, Math.ceil(averagePrice + fallbackWindowCushion));
  const maximum = pathBand ? Math.min(pathBand.maximumPrice, uncappedMaximum) : uncappedMaximum;

  return {
    minimumPrice: minimum,
    maximumPrice: Math.max(minimum, maximum),
  };
};

const lockedNamesForBlueprint = (
  players: readonly DraftPlanPlayer[],
  candidateCount: number,
): string[] => {
  const firstPlayer = players[0];
  if (!firstPlayer || firstPlayer.market || players.length !== candidateCount) return [];
  const locked = players.every(player =>
    player.name === firstPlayer.name &&
    player.price === firstPlayer.price &&
    !player.market
  );

  return locked ? [firstPlayer.name] : [];
};

const targetNamesForBlueprint = (
  players: readonly DraftPlanPlayer[],
  lockedNames: readonly string[],
): string[] => {
  const lockedNameSet = new Set(lockedNames);
  const summaries = new Map<string, { name: string; count: number; weeks1To4: number; price: number }>();

  for (const player of players) {
    if (lockedNameSet.has(player.name)) continue;
    const summary = summaries.get(player.name) ?? {
      name: player.name,
      count: 0,
      weeks1To4: 0,
      price: 0,
    };
    summary.count += 1;
    summary.weeks1To4 += player.weeks1To4;
    summary.price += player.price;
    summaries.set(player.name, summary);
  }

  return [...summaries.values()]
    .sort(
      (left, right) =>
        right.count - left.count ||
        (right.weeks1To4 / right.count) - (left.weeks1To4 / left.count) ||
        (right.price / right.count) - (left.price / left.count) ||
        left.name.localeCompare(right.name),
    )
    .slice(0, 5)
    .map(summary => summary.name);
};

const fallbackNamesForBlueprint = ({
  definition,
  marketPlayers,
  window,
  lockedNames,
  targetNames,
}: {
  definition: CoachSlotDefinition;
  marketPlayers: readonly PlayerBatchSummary[];
  window: Pick<DraftPlanPriceBand, "minimumPrice" | "maximumPrice">;
  lockedNames: readonly string[];
  targetNames: readonly string[];
}): string[] => {
  const excludedNames = new Set([...lockedNames, ...targetNames]);
  const center = (window.minimumPrice + window.maximumPrice) / 2;

  return marketPlayers
    .filter(player => player.position === definition.position)
    .filter(player => !excludedNames.has(player.name))
    .filter(player => player.draftedRate >= 0.15)
    .filter(player =>
      player.averageSalePrice >= window.minimumPrice &&
      player.averageSalePrice <= window.maximumPrice
    )
    .sort(
      (left, right) =>
        right.averageMarketPrice - left.averageMarketPrice ||
        right.draftedRate - left.draftedRate ||
        Math.abs(left.averageSalePrice - center) - Math.abs(right.averageSalePrice - center) ||
        left.name.localeCompare(right.name),
    )
    .slice(0, 5)
    .map(player => player.name);
};

const slotBlueprintFor = (
  definition: CoachSlotDefinition,
  candidates: readonly DraftPlanCandidate[],
  marketPlayers: readonly PlayerBatchSummary[],
  strategy: DraftPlanStrategyDefinition,
): DraftPlanSlotBlueprint | undefined => {
  const players = candidates
    .map(candidate => definition.playerForCandidate(candidate))
    .filter((player): player is DraftPlanPlayer => player !== undefined);

  if (players.length === 0) return undefined;

  const prices = players.map(player => player.price);
  const minimumPrice = Math.min(...prices);
  const maximumPrice = Math.max(...prices);
  const lockedNames = lockedNamesForBlueprint(players, candidates.length);
  const targetNames = targetNamesForBlueprint(players, lockedNames);
  const fallbackWindow = fallbackWindowForBlueprint(
    definition,
    minimumPrice,
    maximumPrice,
    average(prices),
    strategy,
  );

  return {
    slot: definition.slot,
    position: definition.position,
    sampleCount: players.length,
    minimumPrice,
    maximumPrice,
    averagePrice: roundToTwo(average(prices)),
    priceBand: priceWindowText(minimumPrice, maximumPrice),
    lockedNames,
    targetNames,
    fallbackPriceBand: priceBandText(fallbackWindow),
    fallbackNames: fallbackNamesForBlueprint({
      definition,
      marketPlayers,
      window: fallbackWindow,
      lockedNames,
      targetNames,
    }),
    note: definition.note,
  };
};

const blueprintBySlot = (
  blueprint: readonly DraftPlanSlotBlueprint[],
): ReadonlyMap<string, DraftPlanSlotBlueprint> =>
  new Map(blueprint.map(slot => [slot.slot, slot]));

const targetText = (names: readonly string[]): string =>
  names.length ? names.slice(0, 5).join(" / ") : "the next value tier";

const fallbackActionText = (slots: readonly DraftPlanSlotBlueprint[]): string => {
  const fallbackPlans = slots.flatMap(slot =>
    slot.fallbackNames.length
      ? [`${slot.slot} fallback ${slot.fallbackPriceBand}: ${targetText(slot.fallbackNames)}`]
      : []
  );

  return fallbackPlans.length ? ` ${fallbackPlans.join("; ")}` : "";
};

const contingencyPlansFor = (
  blueprint: readonly DraftPlanSlotBlueprint[],
): DraftPlanContingencyPlan[] => {
  const bySlot = blueprintBySlot(blueprint);
  const rb1 = bySlot.get("RB1");
  const rb2 = bySlot.get("RB2");
  const rb3 = bySlot.get("RB3");
  const wr1 = bySlot.get("WR1");
  const wr2 = bySlot.get("WR2");
  const te = bySlot.get("TE");
  const plans: DraftPlanContingencyPlan[] = [];

  if (rb1 && rb2 && rb3) {
    plans.push({
      label: "After elite RB spend",
      trigger: `RB1 lands in ${rb1.priceBand}.`,
      action: `Preserve RB2 ${rb2.priceBand} and RB3 ${rb3.priceBand}; target ${targetText([...rb2.targetNames, ...rb3.targetNames])}.${fallbackActionText([rb2, rb3])}`,
      targetNames: [...new Set([...rb2.targetNames, ...rb3.targetNames])].slice(0, 5),
      priceBand: `${rb2.priceBand} / ${rb3.priceBand}`,
    });
  }

  if (rb2 && rb3 && wr1) {
    plans.push({
      label: "RB2 pocket closes",
      trigger: `The RB2 tier clears above ${rb2.priceBand}.`,
      action: `Do not chase the miss; move WR1 into ${wr1.priceBand} and keep RB3 opportunistic at ${rb3.priceBand}.${fallbackActionText([wr1, rb3])}`,
      targetNames: [...new Set([...wr1.targetNames, ...rb3.targetNames])].slice(0, 5),
      priceBand: `${wr1.priceBand} / ${rb3.priceBand}`,
    });
  }

  if (wr1 && wr2) {
    plans.push({
      label: "WR value pocket",
      trigger: `WR starters are available in ${wr1.priceBand} and ${wr2.priceBand}.`,
      action: `Draft WR1 from ${targetText(wr1.targetNames)} and WR2 from ${targetText(wr2.targetNames)} instead of solving receiver with one panic spend.${fallbackActionText([wr1, wr2])}`,
      targetNames: [...new Set([...wr1.targetNames, ...wr2.targetNames])].slice(0, 5),
      priceBand: `${wr1.priceBand} / ${wr2.priceBand}`,
    });
  }

  if (te) {
    plans.push({
      label: "TE risk control",
      trigger: `TE remains in ${te.priceBand} in the best sampled builds.`,
      action: `Keep TE cheap unless an earlier RB or WR slot comes in below plan; target ${targetText(te.targetNames)}.${fallbackActionText([te])}`,
      targetNames: te.targetNames,
      priceBand: te.priceBand,
    });
  }

  return plans;
};

const guardrailStatus = (failed: boolean, warned: boolean): DraftPlanRiskStatus => {
  if (failed) return "fail";
  if (warned) return "warn";
  return "pass";
};

const riskGuardrailsFor = (
  candidates: readonly DraftPlanCandidate[],
  strategy: DraftPlanStrategyDefinition,
): DraftPlanRiskGuardrail[] => {
  if (candidates.length === 0) {
    return [{
      label: "Strategy sample",
      status: "fail",
      detail: "No sampled roster reached the requested strategy shape; do not treat this path as live-ready yet.",
    }];
  }

  if (strategy.key !== "three-rb") {
    const rosterSpends = candidates.map(candidate => candidate.rosterSpend);
    const starterScores = candidates.map(candidate => candidate.weeks1To4Score);
    const dollarPlayerCounts = candidates.map(candidate =>
      candidate.players.filter(player => player.price <= 1).length,
    );
    const spendMinimum = Math.min(...rosterSpends);
    const spendMaximum = Math.max(...rosterSpends);
    const scoreMinimum = Math.min(...starterScores);
    const scoreMaximum = Math.max(...starterScores);
    const averageDollarPlayers = roundToTwo(average(dollarPlayerCounts));

    return [
      {
        label: "Budget usage",
        status: guardrailStatus(spendMaximum > 200, spendMinimum < 185),
        detail: `Best sampled teams spent ${priceWindowText(spendMinimum, spendMaximum)}; leaving more than about $15 unused means the plan probably passed too many useful tiers.`,
      },
      {
        label: "Starter strength",
        status: guardrailStatus(scoreMinimum <= 0, scoreMaximum - scoreMinimum > 80),
        detail: `Best sampled teams landed in a ${scoreMinimum.toFixed(1)}-${scoreMaximum.toFixed(1)} Weeks 1-4 starter range.`,
      },
      {
        label: "Dollar-player exposure",
        status: guardrailStatus(averageDollarPlayers >= 11, averageDollarPlayers >= 9),
        detail: `Best sampled teams averaged ${averageDollarPlayers.toFixed(1)} $1 players; crossing 9 means the roster is leaning thin.`,
      },
    ];
  }

  const rbCoreSpends = candidates.map(candidate => candidate.rbCoreSpend);
  const wrStarterSpends = candidates.map(candidate =>
    (playerAtPosition(candidate, "WR", 0)?.price ?? 0) +
    (playerAtPosition(candidate, "WR", 1)?.price ?? 0),
  );
  const dollarPlayerCounts = candidates.map(candidate =>
    candidate.players.filter(player => player.price <= 1).length,
  );
  const rbMinimum = Math.min(...rbCoreSpends);
  const rbMaximum = Math.max(...rbCoreSpends);
  const wrMinimum = Math.min(...wrStarterSpends);
  const wrMaximum = Math.max(...wrStarterSpends);
  const averageDollarPlayers = roundToTwo(average(dollarPlayerCounts));

  return [
    {
      label: "RB core spend",
      status: guardrailStatus(
        rbMinimum > threeRbPathRules.rbCoreBudget.hardBudget,
        rbMaximum > threeRbPathRules.rbCoreBudget.hardBudget,
      ),
      detail: `Best sampled teams spent ${priceWindowText(rbMinimum, rbMaximum)} on the three-RB core; ${priceWindowText(threeRbPathRules.rbCoreBudget.minimumSpend, threeRbPathRules.rbCoreBudget.hardBudget)} is the planned lane.`,
    },
    {
      label: "WR starter pocket",
      status: guardrailStatus(wrMinimum === 0, wrMaximum > 50),
      detail: `Best sampled teams reserved ${priceWindowText(wrMinimum, wrMaximum)} for the top two WR slots instead of buying one receiver at any price.`,
    },
    {
      label: "Dollar-player exposure",
      status: guardrailStatus(averageDollarPlayers >= 11, averageDollarPlayers >= 9),
      detail: `Best sampled teams averaged ${averageDollarPlayers.toFixed(1)} $1 players; crossing 9 means the roster is leaning thin.`,
    },
  ];
};

const strategyCoachFor = (
  candidates: readonly DraftPlanCandidate[],
  marketPlayers: readonly PlayerBatchSummary[],
  strategy: DraftPlanStrategyDefinition,
): DraftPlanStrategyCoach => {
  const coachCandidates = topCoachCandidates(candidates);
  const blueprint = coachSlotDefinitions
    .map(definition => slotBlueprintFor(definition, coachCandidates, marketPlayers, strategy))
    .filter((slot): slot is DraftPlanSlotBlueprint => slot !== undefined);
  const averageWeeks1To4Score = roundToTwo(average(coachCandidates.map(candidate => candidate.weeks1To4Score)));

  return {
    headline: coachCandidates.length
      ? `Top ${coachCandidates.length} sampled ${strategy.label} ${coachCandidates.length === 1 ? "build" : "builds"} averaged ${averageWeeks1To4Score.toFixed(1)} Weeks 1-4 points. Use the bands as guardrails, not guarantees.`
      : "No winning roster blueprint yet; run more mocks or loosen the strategy filters.",
    sampleSize: coachCandidates.length,
    averageWeeks1To4Score,
    blueprint,
    contingencyPlans: contingencyPlansFor(blueprint),
    riskGuardrails: riskGuardrailsFor(coachCandidates, strategy),
  };
};

const buildRecommendations = (
  candidates: readonly DraftPlanCandidate[],
  marketPlayers: readonly PlayerBatchSummary[],
  strategy: DraftPlanStrategyDefinition,
): DraftPlanRecommendations => {
  const topCandidate = candidates[0];
  const rules = strategyPlanRules[strategy.key];
  const rbBands = rules.priceBands.filter(band => band.position === "RB");
  const wrBands = rules.priceBands.filter(band => band.position === "WR");
  const teBand = rules.priceBands.find(band => band.position === "TE");
  const targetClusters: DraftPlanTargetCluster[] = [];

  if (topCandidate) {
    targetClusters.push({
      label: strategy.key === "three-rb" ? "RB core" : "RB starters",
      position: "RB",
      targetNames: topCandidate.rbCore.slice(0, strategy.key === "three-rb" ? 3 : 2).map(player => player.name),
      priceBand: rbBands.map(priceBandText).join(" / "),
      note: strategy.key === "three-rb"
        ? `The true 3RB build works when three startable RBs fit inside about $${threeRbPathRules.rbCoreBudget.minimumSpend}-$${threeRbPathRules.rbCoreBudget.hardBudget} of core RB spend.`
        : "Use RB prices as a budget lane, then let the WR/TE board decide where the next dollar creates the most weekly points.",
    });

    const wrTargets = topCandidate.players
      .filter(player => player.position === "WR")
      .slice(0, 3)
      .map(player => player.name);
    if (wrTargets.length) {
      targetClusters.push({
        label: strategy.key === "wr-heavy" ? "WR core" : "WR values",
        position: "WR",
        targetNames: wrTargets,
        priceBand: wrBands.map(priceBandText).join(" / "),
        note: strategy.key === "wr-heavy"
          ? "WR-heavy builds need real receiver strength, but still need price discipline after the first two buys."
          : "Fill WR starters from the value pocket after the RB budget envelope is protected.",
      });
    }

    const teTargets = topCandidate.players
      .filter(player => player.position === "TE")
      .slice(0, 2)
      .map(player => player.name);
    if (teTargets.length && teBand) {
      targetClusters.push({
        label: "Cheap TE",
        position: "TE",
        targetNames: teTargets,
        priceBand: priceBandText(teBand),
        note: "Avoid paying up at TE unless the RB core came in under plan.",
      });
    }
  }

  return {
    maxPriceBands: rules.priceBands.map(band => ({ ...band })),
    targetClusters,
    pivotRules: rules.pivotRules.map(rule => ({ ...rule })),
    deadZoneWarnings: topCandidate ? [] : [`No sampled roster matched the ${strategy.label} path.`],
    strategyCoach: strategyCoachFor(candidates, marketPlayers, strategy),
  };
};

export const buildDraftPlanReport = ({
  batch,
  owner,
  strategyKey,
  limit = defaultCandidateLimit,
}: BuildDraftPlanReportOptions): DraftPlanReport => {
  const strategy = draftPlanStrategies[strategyKey];
  const marketByName = playerMarketByName(batch.summary.players);
  const candidates = batch.runs.flatMap(run => {
    const roster = run.rosters.find(candidate => candidate.owner === owner);
    if (!roster) return [];

    try {
      const candidate = buildCandidate(
        run.seed,
        run.keeperScenario.key,
        roster,
        strategy,
        marketByName,
      );
      return candidate ? [candidate] : [];
    } catch {
      return [];
    }
  }).sort(
    (left, right) =>
      right.weeks1To4Score - left.weeks1To4Score ||
      right.rbCoreSpend - left.rbCoreSpend ||
      left.budgetRemaining - right.budgetRemaining ||
      left.seed.localeCompare(right.seed),
  );

  return {
    owner,
    strategy,
    engineMode: batch.options.diagnosticsMode === "summary" ? "fast" : "full",
    runCount: batch.runs.length,
    matchedRunCount: candidates.length,
    candidateLimit: limit,
    recommendations: buildRecommendations(candidates, batch.summary.players, strategy),
    candidates: candidates.slice(0, limit),
  };
};
