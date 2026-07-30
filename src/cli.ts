import { keepers } from "../config/keepers.js";
import { leagueConfig } from "../config/league.js";
import { keeperSummary } from "./keeperModel.js";
import { loadHistoricalAuctionRecords } from "./data/parseHistoricalBoards.js";
import { buildBasePrices, defaultPricingConfig, summarizePricePool } from "./modeling/basePricing.js";
import { applyKeeperScenarioToPrices, buildKeeperScenarios } from "./modeling/keeperInflation.js";
import {
  buildLeagueOpenAuctionSpendTargets,
  buildOwnerProfiles,
  defaultHistoricalWeights,
} from "./modeling/ownerProfiles.js";
import { buildProjectionRankings } from "./modeling/projectionRankings.js";
import { loadEspnWeeksOneToFour } from "./projections.js";

const command = process.argv[2];
const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

const countBySeason = (records: { season: number }[]): Record<number, number> =>
  records.reduce<Record<number, number>>((counts, record) => {
    counts[record.season] = (counts[record.season] ?? 0) + 1;
    return counts;
  }, {});

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
    const prices = buildBasePrices(players, historicalRecords);

    console.log(JSON.stringify({
      config: {
        draftedPoolCounts: defaultPricingConfig.draftedPoolCounts,
        positionMarketMultipliers: defaultPricingConfig.positionMarketMultipliers,
        rankGapAdjustmentCap: defaultPricingConfig.rankGapAdjustmentCap,
        marketPressureByPosition: defaultPricingConfig.marketPressureByPosition,
        hardPriceCeilings: defaultPricingConfig.hardPriceCeilings,
      },
      summary: summarizePricePool(prices),
      prices,
    }, null, 2));
    return;
  }

  if (command === "scenarios") {
    const players = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(players, historicalRecords);
    const scenarios = buildKeeperScenarios(keepers);

    console.log(JSON.stringify({
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
    console.log("Mock generation is represented in the current Excel output and will be ported next.");
    return;
  }

  console.log("Usage: npm run keepers | npm run profiles | npm run rankings | npm run prices | npm run scenarios | npm run validate | npm run mock");
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
