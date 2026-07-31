import { keepers } from "../config/keepers.js";
import { leagueConfig } from "../config/league.js";
import { customWeightsPlayerContextConfig } from "../config/playerContext.js";
import { keeperSummary } from "./keeperModel.js";
import { loadHistoricalAuctionRecords } from "./data/parseHistoricalBoards.js";
import { buildOwnerAuctionBehaviors, buildOwnerDemandMultipliers } from "./modeling/auctionEngine.js";
import { buildHistoricalCalibrationAudit } from "./modeling/calibrationAudit.js";
import {
  buildBasePrices,
  defaultPricingConfig,
  summarizePricePool,
  type PricingConfig,
} from "./modeling/basePricing.js";
import { applyKeeperScenarioToPrices, buildKeeperScenarios } from "./modeling/keeperInflation.js";
import {
  buildLeagueOpenAuctionSpendTargets,
  buildOwnerProfiles,
  defaultHistoricalWeights,
} from "./modeling/ownerProfiles.js";
import { runMock, runMockBatch } from "./modeling/mockBatch.js";
import { buildProjectionRankings } from "./modeling/projectionRankings.js";
import { loadEspnWeeksOneToFour } from "./projections.js";

const command = process.argv[2];
const useCustomWeights = process.argv.includes("--custom-weights");
const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const scenarioKeys = ["confirmedOnly", "expected", "highRetention"] as const;

const pricingConfig = useCustomWeights
  ? { ...defaultPricingConfig, playerContext: customWeightsPlayerContextConfig }
  : defaultPricingConfig;

const playerContextSummary = (config: PricingConfig) => ({
  enabled: config.playerContext.enabled,
  weights: config.playerContext.weights,
  maxAdjustment: config.playerContext.maxAdjustment,
  overrideCount: config.playerContext.overrides.length,
});

const countBySeason = (records: { season: number }[]): Record<number, number> =>
  records.reduce<Record<number, number>>((counts, record) => {
    counts[record.season] = (counts[record.season] ?? 0) + 1;
    return counts;
  }, {});

const optionValue = (name: string): string | undefined => {
  const option = process.argv.find(arg => arg.startsWith(`${name}=`));
  return option?.slice(name.length + 1);
};

const numericOptionValue = (name: string, fallback: number): number => {
  const value = optionValue(name);
  if (value === undefined) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
};

const scenarioOptionValue = (name = "--scenario"): (typeof scenarioKeys)[number] => {
  const value = optionValue(name) ?? "expected";
  const scenario = scenarioKeys.find(candidate => candidate === value);
  if (!scenario) {
    throw new Error(`Unknown keeper scenario "${value}". Use confirmedOnly, expected, or highRetention.`);
  }
  return scenario;
};

const scenarioListOptionValue = (): (typeof scenarioKeys)[number][] => {
  const value = optionValue("--scenarios");
  if (!value) return ["expected"];

  return value.split(",").map(key => {
    const scenario = scenarioKeys.find(candidate => candidate === key);
    if (!scenario) {
      throw new Error(`Unknown keeper scenario "${key}". Use confirmedOnly, expected, or highRetention.`);
    }
    return scenario;
  });
};

const main = async (): Promise<void> => {
  if (command === "keepers") {
    console.log(JSON.stringify(keeperSummary(), null, 2));
    return;
  }

  if (command === "profiles") {
    const historicalRecords = await loadHistoricalAuctionRecords();
    const profiles = buildOwnerProfiles(historicalRecords);

    console.log(JSON.stringify({
      weights: defaultHistoricalWeights,
      profiles,
      ownerDemandMultipliers: buildOwnerDemandMultipliers(profiles),
      ownerAuctionBehaviors: buildOwnerAuctionBehaviors(profiles),
      openAuctionSpendTargets: buildLeagueOpenAuctionSpendTargets(historicalRecords),
    }, null, 2));
    return;
  }

  if (command === "rankings") {
    const players = await loadEspnWeeksOneToFour(projectionPath);
    const rankings = buildProjectionRankings(players);

    console.log(JSON.stringify({
      source: {
        projectionFile: projectionPath,
        projectionLeagueId: 278452,
        historicalLeagueId: leagueConfig.leagueId,
        caveat: "Projection scoring is equivalent, but historical auction prices come only from league 214674 boards.",
        rankBasis: "ESPN Weeks 1-4 appliedTotal positional rank",
      },
      count: rankings.length,
      rankings,
    }, null, 2));
    return;
  }

  if (command === "prices") {
    const players = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(players, historicalRecords, pricingConfig);

    console.log(JSON.stringify({
      config: {
        draftedPoolCounts: pricingConfig.draftedPoolCounts,
        positionMarketMultipliers: pricingConfig.positionMarketMultipliers,
        rankGapAdjustmentCap: pricingConfig.rankGapAdjustmentCap,
        marketPressureByPosition: pricingConfig.marketPressureByPosition,
        hardPriceCeilings: pricingConfig.hardPriceCeilings,
        playerContext: playerContextSummary(pricingConfig),
      },
      summary: summarizePricePool(prices),
      prices,
    }, null, 2));
    return;
  }

  if (command === "scenarios") {
    const players = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(players, historicalRecords, pricingConfig);
    const scenarios = buildKeeperScenarios(keepers);

    console.log(JSON.stringify({
      config: {
        playerContext: playerContextSummary(pricingConfig),
      },
      scenarios: scenarios.map(scenario => applyKeeperScenarioToPrices(prices, scenario, keepers)),
    }, null, 2));
    return;
  }

  if (command === "validate") {
    const players = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const visibleDraftRecords = historicalRecords.filter(record => record.acquisitionType !== "post-draft waiver");

    console.log(`Loaded ${players.length} projection records.`);
    console.log(`Loaded ${historicalRecords.length} historical roster records.`);
    console.log(`Visible draft records by season: ${JSON.stringify(countBySeason(visibleDraftRecords))}.`);
    return;
  }

  if (command === "mock") {
    const players = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const result = runMock({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKey: scenarioOptionValue(),
      seed: optionValue("--seed") ?? "mockd-default",
      pricingConfig,
    });

    console.log(JSON.stringify({
      seed: result.seed,
      keeperScenario: {
        key: result.keeperScenario.key,
        label: result.keeperScenario.label,
        totalKeeperCost: result.keeperScenario.totalKeeperCost,
        openAuctionDollars: result.keeperScenario.openAuctionDollars,
        globalFactor: result.keeperScenario.globalFactor,
        positionFactors: result.keeperScenario.positionFactors,
      },
      economics: {
        marketAnchor: "Base or scenario-adjusted player price remains the market input.",
        salePrice: "Auction result price is resolved from owner-local max bids, need, historical owner demand, and scarcity pressure.",
        budgetRule: "$1 is held back for every unfilled roster slot; overspent owners are capped individually.",
        scarcityRule: "Comparable-player scarcity can push good players above anchor while full-budget owners are still bidding.",
      },
      inputCounts: {
        pricedPlayers: result.inputCounts.pricedPlayers,
        auctionPlayers: result.inputCounts.auctionPlayers,
        lockedKeepers: result.inputCounts.lockedKeepers,
      },
      pickCount: result.pickCount,
      firstPicks: result.picks.slice(0, 30),
      rosters: result.rosters.map(roster => ({
        owner: roster.owner,
        spend: roster.spend,
        budgetRemaining: roster.budgetRemaining,
        week1Score: roster.week1Score,
        weeks1To4Score: roster.weeks1To4Score,
        valid: roster.valid,
        errors: roster.errors,
        players: roster.players.map(player => ({
          name: player.name,
          position: player.position,
          price: player.price,
          weeks1To4: player.weeks1To4,
        })),
      })),
      unsoldPlayerCount: result.unsoldPlayerCount,
    }, null, 2));
    return;
  }

  if (command === "mocks") {
    const players = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const batch = runMockBatch({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKeys: scenarioListOptionValue(),
      runsPerScenario: numericOptionValue("--runs", 50),
      seedPrefix: optionValue("--seed-prefix") ?? "mockd",
      pricingConfig,
    });

    console.log(JSON.stringify({
      options: batch.options,
      summary: batch.summary,
      runCount: batch.runs.length,
    }, null, 2));
    return;
  }

  if (command === "calibration") {
    const players = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const batch = runMockBatch({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKeys: scenarioListOptionValue(),
      runsPerScenario: numericOptionValue("--runs", 50),
      seedPrefix: optionValue("--seed-prefix") ?? "mockd",
      pricingConfig,
    });

    console.log(JSON.stringify({
      options: batch.options,
      audit: buildHistoricalCalibrationAudit({ historicalRecords, batch }),
    }, null, 2));
    return;
  }

  console.log("Usage: npm run keepers | npm run profiles | npm run rankings | npm run prices [-- --custom-weights] | npm run scenarios [-- --custom-weights] | npm run validate | npm run mock [-- --scenario=expected --seed=mockd-default] | npm run mocks [-- --scenarios=expected --runs=50 --seed-prefix=mockd] | npm run calibration [-- --scenarios=expected --runs=50 --seed-prefix=mockd]");
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
