import type { KeeperDeclaration } from "../../config/keepers.js";
import type { Position } from "../../config/league.js";
import type {
  PlayerContextEvidence,
  PlayerContextNotes,
  PlayerContextSignals,
} from "../../config/playerContext.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import type { HistoricalAuctionRecord } from "../data/parseHistoricalBoards.js";
import type { ProjectionRecord } from "../projections.js";
import type { BasePrice, PricingConfig } from "./basePricing.js";
import { buildBasePrices, defaultPricingConfig } from "./basePricing.js";
import {
  applyKeeperScenarioToPrices,
  buildKeeperScenarios,
  type KeeperScenarioKey,
  type ScenarioAdjustedPrice,
} from "./keeperInflation.js";
import { runMockBatch, type MockBatch, type MockRun } from "./mockBatch.js";

export interface BuildPlayerPriceAuditOptions {
  playerName: string;
  projections: readonly ProjectionRecord[];
  historicalRecords: readonly HistoricalAuctionRecord[];
  keepers: readonly KeeperDeclaration[];
  scenarioKey?: KeeperScenarioKey;
  runs?: number;
  seedPrefix?: string;
  pricingConfig?: PricingConfig;
}

export interface PlayerAuditIdentity {
  name: string;
  position: Position;
  normalizedName: string;
  week1: number;
  weeks1To4: number;
}

export interface PlayerAuditPricing {
  publicAnchorValue: number;
  projectionRank: number;
  espnRank: number | null;
  rankGap: number | null;
  rankGapAdjustment: number;
  positionMultiplier: number;
  marketPressure: number;
  anchoredPrice: number;
  projectionFloorPrice: number;
  preSustainabilityPrice: number;
  sustainabilityFactor: number;
  sustainabilityNote?: string;
  contextAdjustmentFactor: number;
  contextAdjustmentPercent: number;
  contextSignals: PlayerContextSignals;
  contextNotes?: PlayerContextNotes;
  contextEvidence: readonly PlayerContextEvidence[];
  rawPrice: number;
  hardCeiling: number;
  basePrice: number;
}

export interface PlayerAuditScenario {
  key: KeeperScenarioKey;
  label: string;
  available: boolean;
  totalKeeperCost: number;
  openAuctionDollars: number;
  globalFactor: number;
  positionFactor: number;
  scenarioFactor: number;
  scenarioPrice: number;
  unavailableReason?: string;
}

export interface PlayerAuditMockPick {
  seed: string;
  pick: number;
  nominator: string;
  owner: string;
  salePrice: number;
  marketPrice: number;
  budgetAfterPick: number;
  rosterSlotsAfterPick: number;
}

export interface PlayerAuditMockSale {
  runCount: number;
  draftedCount: number;
  draftedRate: number;
  averageMarketPrice: number;
  averageSalePrice: number;
  averageSaleVsScenarioPrice: number;
  minSalePrice: number;
  maxSalePrice: number;
  picks: readonly PlayerAuditMockPick[];
}

export type PlayerPriceWaterfallStepKey =
  | "espn-anchor"
  | "position-multiplier"
  | "rank-gap-adjustment"
  | "market-pressure"
  | "projection-floor"
  | "sustainability"
  | "factual-context"
  | "spend-reconciliation"
  | "keeper-inflation"
  | "mock-sale-average";

export interface PlayerPriceWaterfallStep {
  key: PlayerPriceWaterfallStepKey;
  label: string;
  inputAmount: number;
  outputAmount: number;
  delta: number;
  factor?: number;
  note: string;
}

export interface PlayerPriceWaterfallSummary {
  anchorPrice: number;
  basePrice: number;
  scenarioPrice: number;
  averageMockSalePrice: number;
  saleVsScenarioPrice: number;
}

export interface PlayerPriceWaterfall {
  summary: PlayerPriceWaterfallSummary;
  steps: readonly PlayerPriceWaterfallStep[];
}

export interface PlayerPriceAudit {
  player: PlayerAuditIdentity;
  pricing: PlayerAuditPricing;
  scenario: PlayerAuditScenario;
  mockSale: PlayerAuditMockSale;
  waterfall: PlayerPriceWaterfall;
  explanation: string[];
}

const defaultScenarioKey: KeeperScenarioKey = "expected";
const defaultRuns = 10;
const defaultSeedPrefix = "player-audit";

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

const findBasePrice = (
  prices: readonly BasePrice[],
  playerName: string,
): BasePrice => {
  const normalizedName = normalizePlayerName(playerName);
  const price = prices.find(candidate => candidate.normalizedName === normalizedName);
  if (!price) throw new Error(`Unable to find priced player "${playerName}".`);
  return price;
};

const scenarioPriceFor = (
  adjustedPrices: readonly ScenarioAdjustedPrice[],
  basePrice: BasePrice,
): ScenarioAdjustedPrice | undefined =>
  adjustedPrices.find(price => price.normalizedName === basePrice.normalizedName);

const keeperReasonFor = (
  unavailableKeepers: readonly KeeperDeclaration[],
  basePrice: BasePrice,
): string | undefined => {
  const keeper = unavailableKeepers.find(candidate =>
    normalizePlayerName(candidate.player) === basePrice.normalizedName,
  );
  if (!keeper) return undefined;

  return `${keeper.owner} ${keeper.status} keeper at $${keeper.newCost}`;
};

const mockPicksFor = (
  batch: MockBatch,
  basePrice: BasePrice,
): PlayerAuditMockPick[] =>
  batch.runs.flatMap(run =>
    run.picks
      .filter(pick => normalizePlayerName(pick.player) === basePrice.normalizedName)
      .map(pick => ({
        seed: run.seed,
        pick: pick.pick,
        nominator: pick.nominator,
        owner: pick.owner,
        salePrice: pick.price,
        marketPrice: pick.marketPrice,
        budgetAfterPick: pick.budgetAfterPick,
        rosterSlotsAfterPick: pick.rosterSlotsAfterPick,
      })),
  );

const mockSaleFor = (
  runs: readonly MockRun[],
  picks: readonly PlayerAuditMockPick[],
  scenarioPrice: number,
): PlayerAuditMockSale => {
  const salePrices = picks.map(pick => pick.salePrice);
  const marketPrices = picks.map(pick => pick.marketPrice);
  const averageSalePrice = roundToTwo(average(salePrices));

  return {
    runCount: runs.length,
    draftedCount: picks.length,
    draftedRate: roundToTwo(picks.length / Math.max(1, runs.length)),
    averageMarketPrice: roundToTwo(average(marketPrices)),
    averageSalePrice,
    averageSaleVsScenarioPrice: roundToTwo(averageSalePrice - scenarioPrice),
    minSalePrice: salePrices.length > 0 ? Math.min(...salePrices) : 0,
    maxSalePrice: salePrices.length > 0 ? Math.max(...salePrices) : 0,
    picks,
  };
};

const explanationFor = (
  basePrice: BasePrice,
  scenario: PlayerAuditScenario,
  mockSale: PlayerAuditMockSale,
): string[] => {
  const baseExplanation =
    `ESPN anchor $${basePrice.publicAnchorValue} becomes a $${basePrice.price} base price after rank gap, league multipliers, context, and spend reconciliation.`;

  if (!scenario.available) {
    const reason = scenario.unavailableReason ? `: ${scenario.unavailableReason}` : ".";
    return [
      baseExplanation,
      `${scenario.label} scenario has this player removed from the auction pool${reason}`,
      `Across ${mockSale.runCount} mock run(s), the player was not available for a mock sale.`,
    ];
  }

  return [
    baseExplanation,
    `${scenario.label} keeper inflation applies a ${roundToTwo(scenario.scenarioFactor)}x ${basePrice.position} factor, moving the auction-pool anchor to $${scenario.scenarioPrice}.`,
    `Across ${mockSale.runCount} mock run(s), the player was drafted ${mockSale.draftedCount} time(s) at an average mock sale price of $${mockSale.averageSalePrice}.`,
  ];
};

const auditPricingFor = (basePrice: BasePrice): PlayerAuditPricing => ({
  publicAnchorValue: basePrice.publicAnchorValue,
  projectionRank: basePrice.projectionRank,
  espnRank: basePrice.espnRank ?? null,
  rankGap: basePrice.rankGap ?? null,
  rankGapAdjustment: basePrice.rankGapAdjustment,
  positionMultiplier: basePrice.positionMultiplier,
  marketPressure: basePrice.marketPressure,
  anchoredPrice: roundToTwo(basePrice.anchoredPrice),
  projectionFloorPrice: roundToTwo(basePrice.projectionFloorPrice),
  preSustainabilityPrice: roundToTwo(basePrice.preSustainabilityPrice),
  sustainabilityFactor: basePrice.sustainabilityFactor,
  ...(basePrice.sustainabilityNote ? { sustainabilityNote: basePrice.sustainabilityNote } : {}),
  contextAdjustmentFactor: basePrice.contextAdjustmentFactor,
  contextAdjustmentPercent: basePrice.contextAdjustmentPercent,
  contextSignals: basePrice.contextSignals,
  ...(basePrice.contextNotes ? { contextNotes: basePrice.contextNotes } : {}),
  contextEvidence: basePrice.contextEvidence ?? [],
  rawPrice: roundToTwo(basePrice.rawPrice),
  hardCeiling: basePrice.hardCeiling,
  basePrice: basePrice.price,
});

const waterfallStep = (
  key: PlayerPriceWaterfallStepKey,
  label: string,
  inputAmount: number,
  outputAmount: number,
  note: string,
  factor?: number,
): PlayerPriceWaterfallStep => ({
  key,
  label,
  inputAmount: roundToTwo(inputAmount),
  outputAmount: roundToTwo(outputAmount),
  delta: roundToTwo(outputAmount - inputAmount),
  ...(factor === undefined ? {} : { factor: roundToTwo(factor) }),
  note,
});

const buildWaterfall = (
  basePrice: BasePrice,
  scenario: PlayerAuditScenario,
  mockSale: PlayerAuditMockSale,
): PlayerPriceWaterfall => {
  const afterPositionMultiplier = basePrice.publicAnchorValue * basePrice.positionMultiplier;
  const afterRankGapAdjustment = afterPositionMultiplier * basePrice.rankGapAdjustment;
  const afterMarketPressure = afterRankGapAdjustment * basePrice.marketPressure;
  const afterProjectionFloor = basePrice.preSustainabilityPrice;
  const afterSustainability = afterProjectionFloor * basePrice.sustainabilityFactor;
  const scenarioNote = scenario.available
    ? `${scenario.label} keeper inflation uses a ${roundToTwo(scenario.scenarioFactor)}x ${basePrice.position} factor.`
    : `Removed from the ${scenario.label} auction pool${scenario.unavailableReason ? `: ${scenario.unavailableReason}` : "."}`;

  return {
    summary: {
      anchorPrice: basePrice.publicAnchorValue,
      basePrice: basePrice.price,
      scenarioPrice: scenario.scenarioPrice,
      averageMockSalePrice: mockSale.averageSalePrice,
      saleVsScenarioPrice: mockSale.averageSaleVsScenarioPrice,
    },
    steps: [
      waterfallStep(
        "espn-anchor",
        "ESPN auction anchor",
        0,
        basePrice.publicAnchorValue,
        "Public ESPN auction value used as the external starting point.",
      ),
      waterfallStep(
        "position-multiplier",
        "League positional multiplier",
        basePrice.publicAnchorValue,
        afterPositionMultiplier,
        `${basePrice.position} prices are scaled to this league's historical open-auction market.`,
        basePrice.positionMultiplier,
      ),
      waterfallStep(
        "rank-gap-adjustment",
        "Projection rank gap",
        afterPositionMultiplier,
        afterRankGapAdjustment,
        basePrice.rankGap === undefined
          ? "No ESPN positional rank gap was available, so no rank-gap movement was applied."
          : `Model positional rank is ${basePrice.rankGap} spot(s) away from the ESPN rank.`,
        basePrice.rankGapAdjustment,
      ),
      waterfallStep(
        "market-pressure",
        "League market pressure",
        afterRankGapAdjustment,
        afterMarketPressure,
        "Applies position-level auction pressure before player-specific overrides.",
        basePrice.marketPressure,
      ),
      waterfallStep(
        "projection-floor",
        "Projection floor",
        afterMarketPressure,
        afterProjectionFloor,
        basePrice.projectionFloorPrice > afterMarketPressure
          ? "Projection rank floor lifted the player above the anchored price."
          : "Projection rank floor did not lift this player above the anchored price.",
      ),
      waterfallStep(
        "sustainability",
        "Role sustainability",
        afterProjectionFloor,
        afterSustainability,
        basePrice.sustainabilityNote ?? "No manual role-sustainability override applied.",
        basePrice.sustainabilityFactor,
      ),
      waterfallStep(
        "factual-context",
        "Factual context",
        afterSustainability,
        basePrice.rawPrice,
        `${basePrice.contextEvidence?.length ?? 0} sourced evidence row(s) contributed to the context adjustment.`,
        basePrice.contextAdjustmentFactor,
      ),
      waterfallStep(
        "spend-reconciliation",
        "Spend reconciliation and ceiling",
        basePrice.rawPrice,
        basePrice.price,
        `Reconciles into historical ${basePrice.position} spend while respecting price ceilings and rounding.`,
      ),
      waterfallStep(
        "keeper-inflation",
        "Keeper inflation",
        basePrice.price,
        scenario.scenarioPrice,
        scenarioNote,
        scenario.scenarioFactor,
      ),
      waterfallStep(
        "mock-sale-average",
        "Mock sale average",
        scenario.scenarioPrice,
        mockSale.averageSalePrice,
        `Observed simulation outcome: drafted ${mockSale.draftedCount} time(s) across ${mockSale.runCount} mock run(s).`,
      ),
    ],
  };
};

export const buildPlayerPriceAudit = ({
  playerName,
  projections,
  historicalRecords,
  keepers,
  scenarioKey = defaultScenarioKey,
  runs = defaultRuns,
  seedPrefix = defaultSeedPrefix,
  pricingConfig = defaultPricingConfig,
}: BuildPlayerPriceAuditOptions): PlayerPriceAudit => {
  const prices = buildBasePrices(projections, historicalRecords, pricingConfig);
  const basePrice = findBasePrice(prices, playerName);
  const scenario = buildKeeperScenarios(keepers).find(candidate => candidate.key === scenarioKey);
  if (!scenario) throw new Error(`Unknown keeper scenario "${scenarioKey}".`);

  const appliedScenario = applyKeeperScenarioToPrices(prices, scenario, keepers);
  const adjustedPrice = scenarioPriceFor(appliedScenario.availablePrices, basePrice);
  const positionFactor = scenario.positionFactors[basePrice.position];
  const scenarioFactor = adjustedPrice?.scenarioFactor ?? positionFactor;
  const scenarioPrice = adjustedPrice?.scenarioPrice ?? 0;
  const unavailableReason = keeperReasonFor(appliedScenario.unavailableKeepers, basePrice);
  const auditScenario: PlayerAuditScenario = {
    key: scenario.key,
    label: scenario.label,
    available: Boolean(adjustedPrice),
    totalKeeperCost: scenario.totalKeeperCost,
    openAuctionDollars: scenario.openAuctionDollars,
    globalFactor: scenario.globalFactor,
    positionFactor,
    scenarioFactor,
    scenarioPrice,
    ...(adjustedPrice || !unavailableReason ? {} : { unavailableReason }),
  };
  const batch = runMockBatch({
    projections,
    historicalRecords,
    keepers,
    scenarioKeys: [scenarioKey],
    runsPerScenario: runs,
    seedPrefix,
    pricingConfig,
  });
  const mockPicks = mockPicksFor(batch, basePrice);
  const mockSale = mockSaleFor(batch.runs, mockPicks, scenarioPrice);

  return {
    player: {
      name: basePrice.name,
      position: basePrice.position,
      normalizedName: basePrice.normalizedName,
      week1: basePrice.weeks[1] ?? 0,
      weeks1To4: basePrice.weeks1To4,
    },
    pricing: auditPricingFor(basePrice),
    scenario: auditScenario,
    mockSale,
    waterfall: buildWaterfall(basePrice, auditScenario, mockSale),
    explanation: explanationFor(basePrice, auditScenario, mockSale),
  };
};
