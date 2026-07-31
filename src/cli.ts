import { keepers } from "../config/keepers.js";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { customWeightsPlayerContextConfig } from "../config/playerContext.js";
import { keeperSummary } from "./keeperModel.js";
import { loadHistoricalAuctionRecords } from "./data/parseHistoricalBoards.js";
import {
  buildAuctionConfig,
  buildAuctionPlayerPool,
  buildInitialRostersFromKeepers,
  buildOwnerDemandMultipliers,
  simulateAuction,
} from "./modeling/auctionEngine.js";
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
import { buildProjectionRankings } from "./modeling/projectionRankings.js";
import { loadEspnWeeksOneToFour } from "./projections.js";
import { validateRoster } from "./validateMocks.js";

const command = process.argv[2];
const useCustomWeights = process.argv.includes("--custom-weights");
const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

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

const main = async (): Promise<void> => {
  if (command === "keepers") {
    console.log(JSON.stringify(keeperSummary(), null, 2));
    return;
  }

  if (command === "profiles") {
    const historicalRecords = await loadHistoricalAuctionRecords();

    console.log(JSON.stringify({
      weights: defaultHistoricalWeights,
      profiles: buildOwnerProfiles(historicalRecords),
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
    const prices = buildBasePrices(players, historicalRecords, pricingConfig);
    const scenarios = buildKeeperScenarios(keepers);
    const scenarioKey = optionValue("--scenario") ?? "expected";
    const scenario = scenarios.find(candidate => candidate.key === scenarioKey);
    if (!scenario) {
      throw new Error(`Unknown keeper scenario "${scenarioKey}". Use confirmedOnly, expected, or highRetention.`);
    }

    const adjustedPrices = applyKeeperScenarioToPrices(prices, scenario, keepers);
    const initialRostersByOwner = buildInitialRostersFromKeepers(
      keepers,
      players,
      scenario.includedKeeperStatuses,
    );
    const keeperCount = Object.values(initialRostersByOwner)
      .reduce((count, roster) => count + (roster?.length ?? 0), 0);
    const totalRosterSlots = leagueConfig.teams * leagueConfig.rosterSize;
    const auctionPlayers = buildAuctionPlayerPool({
      pricedPlayers: adjustedPrices.availablePrices,
      projections: players,
      excludedNames: adjustedPrices.unavailableKeepers.map(keeper => keeper.player),
      targetCount: totalRosterSlots - keeperCount + 24,
    });
    const auctionConfig = buildAuctionConfig({
      seed: optionValue("--seed") ?? "mockd-default",
      ownerDemandMultipliers: buildOwnerDemandMultipliers(buildOwnerProfiles(historicalRecords)),
    });
    const result = simulateAuction({
      players: auctionPlayers,
      config: auctionConfig,
      initialRostersByOwner,
    });

    console.log(JSON.stringify({
      seed: result.seed,
      keeperScenario: {
        key: scenario.key,
        label: scenario.label,
        totalKeeperCost: scenario.totalKeeperCost,
        openAuctionDollars: scenario.openAuctionDollars,
        globalFactor: scenario.globalFactor,
        positionFactors: scenario.positionFactors,
      },
      economics: {
        marketAnchor: "Base or scenario-adjusted player price remains the market input.",
        salePrice: "Auction result price is resolved from owner-local max bids, need, historical owner demand, and scarcity pressure.",
        budgetRule: "$1 is held back for every unfilled roster slot; overspent owners are capped individually.",
        scarcityRule: "Comparable-player scarcity can push good players above anchor while full-budget owners are still bidding.",
      },
      inputCounts: {
        pricedPlayers: adjustedPrices.availablePrices.length,
        auctionPlayers: auctionPlayers.length,
        lockedKeepers: keeperCount,
      },
      pickCount: result.picks.length,
      firstPicks: result.picks.slice(0, 30),
      rosters: ownerOrder.map(owner => {
        const roster = result.rosters[owner];
        if (!roster) throw new Error(`Missing roster for ${owner}.`);
        const validation = validateRoster(roster);

        return {
          owner,
          spend: validation.spend,
          budgetRemaining: leagueConfig.auctionBudget - validation.spend,
          week1Score: validation.week1Score,
          weeks1To4Score: validation.weeks1To4Score,
          valid: validation.valid,
          errors: validation.errors,
          players: roster.players.map(player => ({
            name: player.name,
            position: player.position,
            price: player.price,
            weeks1To4: player.weeks1To4,
          })),
        };
      }),
      unsoldPlayerCount: result.unsoldPlayers.length,
    }, null, 2));
    return;
  }

  console.log("Usage: npm run keepers | npm run profiles | npm run rankings | npm run prices [-- --custom-weights] | npm run scenarios [-- --custom-weights] | npm run validate | npm run mock [-- --scenario=expected --seed=mockd-default]");
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
