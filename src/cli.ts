import { keeperSummary } from "./keeperModel.js";
import { loadHistoricalAuctionRecords } from "./data/parseHistoricalBoards.js";
import {
  buildLeagueOpenAuctionSpendTargets,
  buildOwnerProfiles,
  defaultHistoricalWeights,
} from "./modeling/ownerProfiles.js";
import { loadEspnWeeksOneToFour } from "./projections.js";

const command = process.argv[2];

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

  if (command === "validate") {
    const players = await loadEspnWeeksOneToFour("data/raw/espn-projections-2026-weeks-1-4.json");
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

  console.log("Usage: npm run keepers | npm run profiles | npm run validate | npm run mock");
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
