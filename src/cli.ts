import { keeperSummary } from "./keeperModel.js";
import { loadEspnWeeksOneToFour } from "./projections.js";

const command = process.argv[2];

const main = async (): Promise<void> => {
  if (command === "keepers") {
    console.log(JSON.stringify(keeperSummary(), null, 2));
    return;
  }

  if (command === "validate") {
    const players = await loadEspnWeeksOneToFour("data/raw/espn-projections-2026-weeks-1-4.json");
    console.log(`Loaded ${players.length} projection records.`);
    return;
  }

  if (command === "mock") {
    console.log("Mock generation is represented in the current Excel output and will be ported next.");
    return;
  }

  console.log("Usage: npm run keepers | npm run validate | npm run mock");
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
