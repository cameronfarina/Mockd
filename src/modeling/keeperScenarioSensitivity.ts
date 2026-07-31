import type { KeeperDeclaration } from "../../config/keepers.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import type { BasePrice } from "./basePricing.js";
import {
  applyKeeperScenarioToPrices,
  buildKeeperScenarios,
  type KeeperScenarioKey,
  type ScenarioAdjustedPrice,
} from "./keeperInflation.js";

export const keeperScenarioSensitivityKeys = [
  "confirmedOnly",
  "expected",
  "highRetention",
] as const satisfies readonly KeeperScenarioKey[];

export interface BuildKeeperScenarioSensitivityReportOptions {
  prices: readonly BasePrice[];
  keepers: readonly KeeperDeclaration[];
  limit?: number;
}

export interface KeeperScenarioPlayerState {
  available: boolean;
  scenarioPrice: number | null;
  scenarioFactor: number | null;
  keeperRemoved: boolean;
  unavailableReason?: string;
}

export type KeeperScenarioPlayerStates = Record<KeeperScenarioKey, KeeperScenarioPlayerState>;

export interface KeeperScenarioSensitivityRow {
  rank: number;
  player: string;
  position: BasePrice["position"];
  pricedPool: boolean;
  basePrice: number | null;
  publicAnchorValue: number | null;
  scenarios: KeeperScenarioPlayerStates;
  priceSpread: number | null;
  expectedVsConfirmedDelta: number | null;
  highRetentionVsExpectedDelta: number | null;
  keeperRemoved: boolean;
  keeperRemovalChanged: boolean;
  availabilityChanged: boolean;
  unavailableScenarios: KeeperScenarioKey[];
  keeperRemovalScenarios: KeeperScenarioKey[];
  sortScore: number;
}

export interface KeeperScenarioSensitivitySummary {
  scenarioKeys: KeeperScenarioKey[];
  playerCount: number;
  reportedPlayerCount: number;
  limit: number;
  truncated: boolean;
  keeperRemovedCount: number;
  keeperRemovalChangeCount: number;
  availabilityChangeCount: number;
  reportedKeeperRemovalChangeCount: number;
  reportedAvailabilityChangeCount: number;
  pricedPlayerCount: number;
  unpricedKeeperCount: number;
  maxPriceSpread: number;
  averagePriceSpread: number;
}

export interface KeeperScenarioSensitivityReport {
  summary: KeeperScenarioSensitivitySummary;
  rows: KeeperScenarioSensitivityRow[];
}

type CsvValue = string | number | boolean | null | undefined;
type KeeperReasonMaps = Record<KeeperScenarioKey, ReadonlyMap<string, string>>;

const defaultLimit = 60;
const outsidePricedPoolReason = "outside priced auction pool";

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

const keeperReasonMapFor = (
  scenario: { includedKeeperStatuses: readonly KeeperDeclaration["status"][] },
  keepers: readonly KeeperDeclaration[],
): ReadonlyMap<string, string> =>
  new Map(
    keepers
      .filter(keeper => scenario.includedKeeperStatuses.some(status => status === keeper.status))
      .map(keeper => [
        normalizePlayerName(keeper.player),
        `${keeper.owner} ${keeper.status} keeper at $${keeper.newCost}`,
      ]),
  );

const scenarioStateFor = (
  price: BasePrice,
  scenarioKey: KeeperScenarioKey,
  availableByName: ReadonlyMap<string, ScenarioAdjustedPrice>,
  keeperReasonMaps: KeeperReasonMaps,
): KeeperScenarioPlayerState => {
  const scenarioPrice = availableByName.get(price.normalizedName);
  if (!scenarioPrice) {
    const unavailableReason = keeperReasonMaps[scenarioKey].get(price.normalizedName);

    return {
      available: false,
      scenarioPrice: null,
      scenarioFactor: null,
      keeperRemoved: unavailableReason !== undefined,
      ...(unavailableReason ? { unavailableReason } : {}),
    };
  }

  return {
    available: true,
    scenarioPrice: scenarioPrice.scenarioPrice,
    scenarioFactor: scenarioPrice.scenarioFactor,
    keeperRemoved: false,
  };
};

const scenarioPriceValues = (
  states: KeeperScenarioPlayerStates,
): number[] =>
  keeperScenarioSensitivityKeys.flatMap(key => {
    const value = states[key].scenarioPrice;
    return value === null ? [] : [value];
  });

const deltaBetween = (
  left: KeeperScenarioPlayerState,
  right: KeeperScenarioPlayerState,
): number | null =>
  left.scenarioPrice === null || right.scenarioPrice === null
    ? null
    : right.scenarioPrice - left.scenarioPrice;

const rowFor = (
  price: BasePrice,
  scenarioMaps: Record<KeeperScenarioKey, ReadonlyMap<string, ScenarioAdjustedPrice>>,
  keeperReasonMaps: KeeperReasonMaps,
): Omit<KeeperScenarioSensitivityRow, "rank"> => {
  const scenarios = Object.fromEntries(
    keeperScenarioSensitivityKeys.map(key => [
      key,
      scenarioStateFor(price, key, scenarioMaps[key], keeperReasonMaps),
    ]),
  ) as KeeperScenarioPlayerStates;
  const values = scenarioPriceValues(scenarios);
  const priceSpread = values.length < 2 ? null : Math.max(...values) - Math.min(...values);
  const unavailableScenarios = keeperScenarioSensitivityKeys
    .filter(key => !scenarios[key].available);
  const keeperRemovalScenarios = keeperScenarioSensitivityKeys
    .filter(key => scenarios[key].keeperRemoved);
  const keeperRemoved = keeperRemovalScenarios.length > 0;
  const keeperRemovalChanged = keeperRemovalScenarios.length > 0 &&
    keeperRemovalScenarios.length < keeperScenarioSensitivityKeys.length;
  const availabilityChanged = unavailableScenarios.length > 0 &&
    unavailableScenarios.length < keeperScenarioSensitivityKeys.length;
  const expectedVsConfirmedDelta = deltaBetween(scenarios.confirmedOnly, scenarios.expected);
  const highRetentionVsExpectedDelta = deltaBetween(scenarios.expected, scenarios.highRetention);
  const largestDelta = Math.max(
    Math.abs(expectedVsConfirmedDelta ?? 0),
    Math.abs(highRetentionVsExpectedDelta ?? 0),
    priceSpread ?? 0,
  );

  return {
    player: price.name,
    position: price.position,
    pricedPool: true,
    basePrice: price.price,
    publicAnchorValue: price.publicAnchorValue,
    scenarios,
    priceSpread,
    expectedVsConfirmedDelta,
    highRetentionVsExpectedDelta,
    keeperRemoved,
    keeperRemovalChanged,
    availabilityChanged,
    unavailableScenarios,
    keeperRemovalScenarios,
    sortScore: keeperRemovalChanged ? 1000 + price.price : keeperRemoved ? 900 + price.price : largestDelta,
  };
};

const rowForUnpricedKeeper = (
  keeper: KeeperDeclaration,
  keeperReasonMaps: KeeperReasonMaps,
): Omit<KeeperScenarioSensitivityRow, "rank"> => {
  const normalizedName = normalizePlayerName(keeper.player);
  const scenarios = Object.fromEntries(
    keeperScenarioSensitivityKeys.map(key => {
      const unavailableReason = keeperReasonMaps[key].get(normalizedName) ?? outsidePricedPoolReason;

      return [
        key,
        {
          available: false,
          scenarioPrice: null,
          scenarioFactor: null,
          keeperRemoved: unavailableReason !== outsidePricedPoolReason,
          unavailableReason,
        },
      ];
    }),
  ) as KeeperScenarioPlayerStates;
  const unavailableScenarios = keeperScenarioSensitivityKeys
    .filter(key => !scenarios[key].available);
  const keeperRemovalScenarios = keeperScenarioSensitivityKeys
    .filter(key => scenarios[key].keeperRemoved);
  const keeperRemoved = keeperRemovalScenarios.length > 0;
  const keeperRemovalChanged = keeperRemovalScenarios.length > 0 &&
    keeperRemovalScenarios.length < keeperScenarioSensitivityKeys.length;
  const availabilityChanged = unavailableScenarios.length > 0 &&
    unavailableScenarios.length < keeperScenarioSensitivityKeys.length;

  return {
    player: keeper.player,
    position: keeper.position,
    pricedPool: false,
    basePrice: null,
    publicAnchorValue: null,
    scenarios,
    priceSpread: null,
    expectedVsConfirmedDelta: null,
    highRetentionVsExpectedDelta: null,
    keeperRemoved,
    keeperRemovalChanged,
    availabilityChanged,
    unavailableScenarios,
    keeperRemovalScenarios,
    sortScore: keeperRemovalChanged ? 1000 : keeperRemoved ? 900 : 0,
  };
};

const sortRows = (
  left: Omit<KeeperScenarioSensitivityRow, "rank">,
  right: Omit<KeeperScenarioSensitivityRow, "rank">,
): number =>
  right.sortScore - left.sortScore ||
  (right.priceSpread ?? 0) - (left.priceSpread ?? 0) ||
  (right.basePrice ?? 0) - (left.basePrice ?? 0) ||
  left.player.localeCompare(right.player);

export const buildKeeperScenarioSensitivityReport = ({
  prices,
  keepers,
  limit = defaultLimit,
}: BuildKeeperScenarioSensitivityReportOptions): KeeperScenarioSensitivityReport => {
  const scenarios = buildKeeperScenarios(keepers);
  const scenarioByKey = new Map(scenarios.map(scenario => [scenario.key, scenario]));
  const scenarioMaps = {} as Record<KeeperScenarioKey, ReadonlyMap<string, ScenarioAdjustedPrice>>;
  const keeperReasonMaps = {} as KeeperReasonMaps;

  for (const key of keeperScenarioSensitivityKeys) {
    const scenario = scenarioByKey.get(key);
    if (!scenario) throw new Error(`Unknown keeper scenario "${key}".`);
    const applied = applyKeeperScenarioToPrices(prices, scenario, keepers);

    scenarioMaps[key] = new Map(applied.availablePrices.map(price => [price.normalizedName, price]));
    keeperReasonMaps[key] = keeperReasonMapFor(scenario, keepers);
  }

  const pricedNames = new Set(prices.map(price => price.normalizedName));
  const unpricedKeepersByName = new Map<string, KeeperDeclaration>();
  for (const keeper of keepers) {
    const normalizedName = normalizePlayerName(keeper.player);
    if (!pricedNames.has(normalizedName) && !unpricedKeepersByName.has(normalizedName)) {
      unpricedKeepersByName.set(normalizedName, keeper);
    }
  }
  const allRows = prices
    .map(price => rowFor(price, scenarioMaps, keeperReasonMaps))
    .concat([...unpricedKeepersByName.values()].map(keeper => rowForUnpricedKeeper(keeper, keeperReasonMaps)))
    .sort(sortRows);
  const rows = allRows.slice(0, limit)
    .map((row, index) => ({
      rank: index + 1,
      ...row,
    }));
  const allSpreads = allRows.flatMap(row => row.priceSpread === null ? [] : [row.priceSpread]);

  return {
    summary: {
      scenarioKeys: [...keeperScenarioSensitivityKeys],
      playerCount: allRows.length,
      reportedPlayerCount: rows.length,
      limit,
      truncated: allRows.length > rows.length,
      keeperRemovedCount: allRows.filter(row => row.keeperRemoved).length,
      keeperRemovalChangeCount: allRows.filter(row => row.keeperRemovalChanged).length,
      availabilityChangeCount: allRows.filter(row => row.availabilityChanged).length,
      reportedKeeperRemovalChangeCount: rows.filter(row => row.keeperRemovalChanged).length,
      reportedAvailabilityChangeCount: rows.filter(row => row.availabilityChanged).length,
      pricedPlayerCount: prices.length,
      unpricedKeeperCount: unpricedKeepersByName.size,
      maxPriceSpread: allSpreads.length === 0 ? 0 : Math.max(...allSpreads),
      averagePriceSpread: roundToTwo(average(allSpreads)),
    },
    rows,
  };
};

const csvCell = (value: CsvValue): string => {
  const text = value === undefined || value === null ? "" : String(value);
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

const scenarioList = (
  values: readonly string[],
): string => values.join("; ");

const unavailableReasonSummaryFor = (
  row: KeeperScenarioSensitivityRow,
): string[] => {
  const scenariosByReason = new Map<string, KeeperScenarioKey[]>();

  for (const key of keeperScenarioSensitivityKeys) {
    const reason = row.scenarios[key].unavailableReason;
    if (!reason) continue;
    scenariosByReason.set(reason, [...(scenariosByReason.get(reason) ?? []), key]);
  }

  return [...scenariosByReason.entries()].map(([reason, scenarioKeys]) =>
    `${scenarioKeys.join("/")}: ${reason}`,
  );
};

export const keeperScenarioSensitivityCsv = (
  report: KeeperScenarioSensitivityReport,
): string =>
  [
    [
      "rank",
      "player",
      "position",
      "base_price",
      "confirmed_only_available",
      "confirmed_only_price",
      "confirmed_only_factor",
      "expected_available",
      "expected_price",
      "expected_factor",
      "high_retention_available",
      "high_retention_price",
      "high_retention_factor",
      "price_spread",
      "expected_vs_confirmed_delta",
      "high_retention_vs_expected_delta",
      "keeper_removed",
      "keeper_removal_scenarios",
      "keeper_removal_changed",
      "availability_changed",
      "unavailable_scenarios",
      "unavailable_reasons",
    ].map(csvCell).join(","),
    ...report.rows.map(row => [
      row.rank,
      row.player,
      row.position,
      row.basePrice,
      row.scenarios.confirmedOnly.available,
      row.scenarios.confirmedOnly.scenarioPrice,
      row.scenarios.confirmedOnly.scenarioFactor,
      row.scenarios.expected.available,
      row.scenarios.expected.scenarioPrice,
      row.scenarios.expected.scenarioFactor,
      row.scenarios.highRetention.available,
      row.scenarios.highRetention.scenarioPrice,
      row.scenarios.highRetention.scenarioFactor,
      row.priceSpread,
      row.expectedVsConfirmedDelta,
      row.highRetentionVsExpectedDelta,
      row.keeperRemoved,
      scenarioList(row.keeperRemovalScenarios),
      row.keeperRemovalChanged,
      row.availabilityChanged,
      scenarioList(row.unavailableScenarios),
      scenarioList(unavailableReasonSummaryFor(row)),
    ].map(csvCell).join(",")),
  ].join("\n");
