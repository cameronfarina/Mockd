import { leagueConfig, positions, type Position } from "../../config/league.js";
import type { KeeperDeclaration, KeeperStatus } from "../../config/keepers.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import type { BasePrice } from "./basePricing.js";

type PositionAmounts = Record<Position, number>;

export type KeeperScenarioKey = "confirmedOnly" | "expected" | "highRetention";

export interface KeeperScenarioDefinition {
  key: KeeperScenarioKey;
  label: string;
  includedKeeperStatuses: readonly KeeperStatus[];
  keeperCounts?: PositionAmounts;
  averageKeeperCosts?: PositionAmounts;
}

export interface KeeperScenarioConfig {
  leagueTotalBudget: number;
  historicalOpenAuctionSpendBaseline: number;
  typicalKeeperCounts: PositionAmounts;
  scarcityRates: PositionAmounts;
  scenarios: readonly KeeperScenarioDefinition[];
}

export interface KeeperScenario {
  key: KeeperScenarioKey;
  label: string;
  includedKeeperStatuses: readonly KeeperStatus[];
  keeperCounts: PositionAmounts;
  totalKeeperCost: number;
  openAuctionDollars: number;
  globalFactor: number;
  positionFactors: PositionAmounts;
}

export interface ScenarioAdjustedPrice extends BasePrice {
  scenarioFactor: number;
  scenarioPrice: number;
}

export interface AppliedKeeperScenario {
  scenario: KeeperScenario;
  unavailableKeepers: KeeperDeclaration[];
  availablePrices: ScenarioAdjustedPrice[];
}

const emptyPositionAmounts = (): PositionAmounts => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

export const defaultKeeperScenarioConfig = {
  leagueTotalBudget: leagueConfig.teams * leagueConfig.auctionBudget,
  historicalOpenAuctionSpendBaseline: 2596.5,
  typicalKeeperCounts: {
    QB: 1,
    RB: 6,
    WR: 6,
    TE: 1,
    K: 0,
    DST: 0,
  },
  scarcityRates: {
    QB: 0.02,
    RB: 0.015,
    WR: 0.015,
    TE: 0.02,
    K: 0,
    DST: 0,
  },
  scenarios: [
    {
      key: "confirmedOnly",
      label: "Confirmed Only",
      includedKeeperStatuses: ["confirmed"],
    },
    {
      key: "expected",
      label: "Expected",
      includedKeeperStatuses: ["confirmed", "assumed"],
      keeperCounts: {
        QB: 1,
        RB: 6,
        WR: 6,
        TE: 1,
        K: 0,
        DST: 0,
      },
      averageKeeperCosts: {
        QB: 2,
        RB: 8,
        WR: 8,
        TE: 8,
        K: 0,
        DST: 0,
      },
    },
    {
      key: "highRetention",
      label: "High Retention / Cheap Surplus",
      includedKeeperStatuses: ["confirmed", "assumed"],
      keeperCounts: {
        QB: 1,
        RB: 8,
        WR: 5,
        TE: 0,
        K: 0,
        DST: 0,
      },
      averageKeeperCosts: {
        QB: 2,
        RB: 6,
        WR: 7,
        TE: 0,
        K: 0,
        DST: 0,
      },
    },
  ],
} as const satisfies KeeperScenarioConfig;

const declaredKeepersFor = (
  keepers: readonly KeeperDeclaration[],
  statuses: readonly KeeperStatus[],
): KeeperDeclaration[] =>
  keepers.filter(keeper => statuses.some(status => status === keeper.status));

const countDeclaredKeepers = (
  keepers: readonly KeeperDeclaration[],
): PositionAmounts => {
  const counts = emptyPositionAmounts();

  for (const keeper of keepers) {
    counts[keeper.position] += 1;
  }

  return counts;
};

const maxPositionAmounts = (
  left: PositionAmounts,
  right: PositionAmounts,
): PositionAmounts => {
  const amounts = emptyPositionAmounts();

  for (const position of positions) {
    amounts[position] = Math.max(left[position], right[position]);
  }

  return amounts;
};

const remainingKeeperCounts = (
  keeperCounts: PositionAmounts,
  declaredCounts: PositionAmounts,
): PositionAmounts => {
  const remaining = emptyPositionAmounts();

  for (const position of positions) {
    remaining[position] = Math.max(0, keeperCounts[position] - declaredCounts[position]);
  }

  return remaining;
};

const totalAverageKeeperCost = (
  keeperCounts: PositionAmounts,
  averageKeeperCosts: PositionAmounts,
): number =>
  positions.reduce(
    (total, position) => total + keeperCounts[position] * averageKeeperCosts[position],
    0,
  );

const positionFactorsFor = (
  keeperCounts: PositionAmounts,
  globalFactor: number,
  config: KeeperScenarioConfig,
): PositionAmounts => {
  const factors = emptyPositionAmounts();

  for (const position of positions) {
    const keeperCountDelta = keeperCounts[position] - config.typicalKeeperCounts[position];
    const scarcityAdjustment = 1 + keeperCountDelta * config.scarcityRates[position];
    factors[position] = globalFactor * scarcityAdjustment;
  }

  return factors;
};

export const buildKeeperScenarios = (
  keepers: readonly KeeperDeclaration[],
  config: KeeperScenarioConfig = defaultKeeperScenarioConfig,
): KeeperScenario[] =>
  config.scenarios.map(definition => {
    const declaredKeepers = declaredKeepersFor(keepers, definition.includedKeeperStatuses);
    const declaredCounts = countDeclaredKeepers(declaredKeepers);
    const keeperCounts = definition.keeperCounts
      ? maxPositionAmounts(definition.keeperCounts, declaredCounts)
      : declaredCounts;
    const declaredKeeperCost = declaredKeepers.reduce((total, keeper) => total + keeper.newCost, 0);
    const totalKeeperCost = definition.averageKeeperCosts
      ? declaredKeeperCost + totalAverageKeeperCost(
        remainingKeeperCounts(keeperCounts, declaredCounts),
        definition.averageKeeperCosts,
      )
      : declaredKeeperCost;
    const openAuctionDollars = config.leagueTotalBudget - totalKeeperCost;
    const globalFactor = openAuctionDollars / config.historicalOpenAuctionSpendBaseline;

    return {
      key: definition.key,
      label: definition.label,
      includedKeeperStatuses: definition.includedKeeperStatuses,
      keeperCounts,
      totalKeeperCost,
      openAuctionDollars,
      globalFactor,
      positionFactors: positionFactorsFor(keeperCounts, globalFactor, config),
    };
  });

export const applyKeeperScenarioToPrices = (
  prices: readonly BasePrice[],
  scenario: KeeperScenario,
  keepers: readonly KeeperDeclaration[],
): AppliedKeeperScenario => {
  const unavailableKeepers = declaredKeepersFor(keepers, scenario.includedKeeperStatuses);
  const unavailableNames = new Set(
    unavailableKeepers.map(keeper => normalizePlayerName(keeper.player)),
  );
  const availablePrices = prices
    .filter(price => !unavailableNames.has(price.normalizedName))
    .map(price => {
      const scenarioFactor = scenario.positionFactors[price.position];
      return {
        ...price,
        scenarioFactor,
        scenarioPrice: Math.max(1, Math.round(price.price * scenarioFactor)),
      };
    })
    .sort(
      (left, right) =>
        right.scenarioPrice - left.scenarioPrice ||
        right.price - left.price ||
        left.name.localeCompare(right.name),
    );

  return {
    scenario,
    unavailableKeepers,
    availablePrices,
  };
};
