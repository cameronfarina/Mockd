import { keepers } from "../config/keepers.js";
import { leagueConfig } from "../config/league.js";
import { customWeightsPlayerContextConfig } from "../config/playerContext.js";
import { keeperSummary } from "./keeperModel.js";
import { loadHistoricalAuctionRecords } from "./data/parseHistoricalBoards.js";
import {
  loadPlayerContextOverrides,
  mergePlayerContextOverrides,
} from "./data/playerContextImports.js";
import { loadPlayerContextEvidenceOverrides } from "./data/playerContextEvidenceImports.js";
import {
  loadPlayerEvidenceSourceRows,
  playerContextEvidenceCsv,
  type PlayerEvidenceSourceAdapterKey,
} from "./data/playerEvidenceSourceAdapters.js";
import {
  buildOwnerAuctionBehaviors,
  buildOwnerDemandMultipliers,
  buildOwnerRosterMaximums,
} from "./modeling/auctionEngine.js";
import { buildHistoricalCalibrationAudit } from "./modeling/calibrationAudit.js";
import {
  buildBasePrices,
  defaultPricingConfig,
  summarizePricePool,
  type PricingConfig,
} from "./modeling/basePricing.js";
import { applyKeeperScenarioToPrices, buildKeeperScenarios } from "./modeling/keeperInflation.js";
import {
  buildKeeperScenarioSensitivityReport,
  keeperScenarioSensitivityCsv,
} from "./modeling/keeperScenarioSensitivity.js";
import { buildHistoricalBacktest } from "./modeling/historicalBacktest.js";
import {
  buildLeagueOpenAuctionSpendTargets,
  buildOwnerProfiles,
  defaultHistoricalWeights,
} from "./modeling/ownerProfiles.js";
import { runMock, runMockBatch } from "./modeling/mockBatch.js";
import { buildMockSmokeReport } from "./modeling/mockSmoke.js";
import {
  buildPlayerEvidenceCoverageAudit,
  playerEvidenceCoverageGatesCsv,
} from "./modeling/playerEvidenceCoverage.js";
import {
  buildPlayerEvidenceQueue,
  playerEvidenceQueueCsv,
  type PlayerEvidenceQueue,
} from "./modeling/playerEvidenceQueue.js";
import { playerEvidenceTemplateCsv } from "./modeling/playerEvidenceTemplate.js";
import { buildPlayerPriceAudit } from "./modeling/playerPriceAudit.js";
import {
  buildPlayerOutlierReviewQueue,
  playerOutlierReviewQueueCsv,
  type PlayerOutlierReviewQueue,
} from "./modeling/playerOutlierReviewQueue.js";
import { writePrepOutputArtifacts } from "./modeling/prepOutputs.js";
import { buildProjectionRankings } from "./modeling/projectionRankings.js";
import { buildQaReport } from "./modeling/qaReport.js";
import { buildTopPlayerSanityReport } from "./modeling/topPlayerSanity.js";
import { loadEspnWeeksOneToFour } from "./projections.js";

const command = process.argv[2];
const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const scenarioKeys = ["confirmedOnly", "expected", "highRetention"] as const;

const playerContextSummary = (config: PricingConfig, importPath?: string, evidencePath?: string) => ({
  enabled: config.playerContext.enabled,
  weights: config.playerContext.weights,
  maxAdjustment: config.playerContext.maxAdjustment,
  maxPositiveAdjustment: config.playerContext.maxPositiveAdjustment ?? config.playerContext.maxAdjustment,
  maxNegativeAdjustment: config.playerContext.maxNegativeAdjustment ?? config.playerContext.maxAdjustment,
  overrideCount: config.playerContext.overrides.length,
  ...(importPath ? { importPath } : {}),
  ...(evidencePath ? { evidencePath } : {}),
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

const pricingConfigFromOptions = async (): Promise<PricingConfig> => {
  const importPath = optionValue("--player-context");
  const evidencePath = optionValue("--player-evidence");
  if (!process.argv.includes("--custom-weights") && !importPath && !evidencePath) return defaultPricingConfig;

  const importedOverrides = importPath ? await loadPlayerContextOverrides(importPath) : [];
  const evidenceOverrides = evidencePath ? await loadPlayerContextEvidenceOverrides(evidencePath) : [];

  return {
    ...defaultPricingConfig,
    playerContext: {
      ...customWeightsPlayerContextConfig,
      overrides: mergePlayerContextOverrides(
        customWeightsPlayerContextConfig.overrides,
        [...importedOverrides, ...evidenceOverrides],
      ),
    },
  };
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

const requiredOptionValue = (name: string): string => {
  const value = optionValue(name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const evidenceSourceAdapterOptionValue = (): PlayerEvidenceSourceAdapterKey => {
  const value = optionValue("--adapter") ?? "scored-local";
  if (value !== "scored-local") {
    throw new Error(`Unknown evidence source adapter "${value}". Use scored-local.`);
  }

  return value;
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

const buildPlayerEvidenceQueueFromOptions = async (
  defaultSeedPrefix: string,
): Promise<PlayerEvidenceQueue> => {
  const pricingConfig = await pricingConfigFromOptions();
  const players = await loadEspnWeeksOneToFour(projectionPath);
  const historicalRecords = await loadHistoricalAuctionRecords();
  const sanityReport = buildTopPlayerSanityReport({
    projections: players,
    historicalRecords,
    keepers,
    scenarioKey: scenarioOptionValue(),
    limit: numericOptionValue("--limit", 40),
    runs: numericOptionValue("--runs", 10),
    seedPrefix: optionValue("--seed-prefix") ?? defaultSeedPrefix,
    pricingConfig,
  });

  return buildPlayerEvidenceQueue(sanityReport);
};

const buildPlayerOutlierReviewQueueFromOptions = async (
  defaultSeedPrefix: string,
): Promise<PlayerOutlierReviewQueue> => {
  const pricingConfig = await pricingConfigFromOptions();
  const players = await loadEspnWeeksOneToFour(projectionPath);
  const historicalRecords = await loadHistoricalAuctionRecords();
  const sanityReport = buildTopPlayerSanityReport({
    projections: players,
    historicalRecords,
    keepers,
    scenarioKey: scenarioOptionValue(),
    limit: numericOptionValue("--limit", 40),
    runs: numericOptionValue("--runs", 10),
    seedPrefix: optionValue("--seed-prefix") ?? defaultSeedPrefix,
    pricingConfig,
  });

  return buildPlayerOutlierReviewQueue(sanityReport);
};

const main = async (): Promise<void> => {
  const playerContextImportPath = optionValue("--player-context");
  const playerContextEvidencePath = optionValue("--player-evidence");

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
      ownerRosterMaximums: buildOwnerRosterMaximums(profiles),
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
    const pricingConfig = await pricingConfigFromOptions();
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
        topPriceVolumeLimits: pricingConfig.topPriceVolumeLimits,
        playerContext: playerContextSummary(pricingConfig, playerContextImportPath, playerContextEvidencePath),
      },
      summary: summarizePricePool(prices),
      prices,
    }, null, 2));
    return;
  }

  if (command === "scenarios") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(players, historicalRecords, pricingConfig);
    const scenarios = buildKeeperScenarios(keepers);

    console.log(JSON.stringify({
      config: {
        playerContext: playerContextSummary(pricingConfig, playerContextImportPath, playerContextEvidencePath),
      },
      scenarios: scenarios.map(scenario => applyKeeperScenarioToPrices(prices, scenario, keepers)),
    }, null, 2));
    return;
  }

  if (command === "scenarios-sensitivity") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(players, historicalRecords, pricingConfig);
    const report = buildKeeperScenarioSensitivityReport({
      prices,
      keepers,
      limit: numericOptionValue("--limit", 60),
    });
    const format = optionValue("--format") ?? "json";

    if (format === "csv") {
      console.log(keeperScenarioSensitivityCsv(report));
      return;
    }

    if (format !== "json") throw new Error(`Unknown scenario sensitivity format "${format}". Use json or csv.`);

    console.log(JSON.stringify(report, null, 2));
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

  if (command === "audit") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();

    console.log(JSON.stringify(buildPlayerPriceAudit({
      playerName: requiredOptionValue("--player"),
      projections: players,
      historicalRecords,
      keepers,
      scenarioKey: scenarioOptionValue(),
      runs: numericOptionValue("--runs", 10),
      seedPrefix: optionValue("--seed-prefix") ?? "player-audit",
      pricingConfig,
    }), null, 2));
    return;
  }

  if (command === "sanity") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();

    console.log(JSON.stringify(buildTopPlayerSanityReport({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKey: scenarioOptionValue(),
      limit: numericOptionValue("--limit", 40),
      runs: numericOptionValue("--runs", 10),
      seedPrefix: optionValue("--seed-prefix") ?? "top-sanity",
      pricingConfig,
    }), null, 2));
    return;
  }

  if (command === "evidence-queue") {
    const queue = await buildPlayerEvidenceQueueFromOptions("evidence-queue");
    const format = optionValue("--format") ?? "json";

    if (format === "csv") {
      console.log(playerEvidenceQueueCsv(queue));
      return;
    }

    if (format !== "json") throw new Error(`Unknown evidence queue format "${format}". Use json or csv.`);

    console.log(JSON.stringify(queue, null, 2));
    return;
  }

  if (command === "outliers-queue") {
    const queue = await buildPlayerOutlierReviewQueueFromOptions("outliers-queue");
    const format = optionValue("--format") ?? "json";

    if (format === "csv") {
      console.log(playerOutlierReviewQueueCsv(queue));
      return;
    }

    if (format !== "json") throw new Error(`Unknown outlier queue format "${format}". Use json or csv.`);

    console.log(JSON.stringify(queue, null, 2));
    return;
  }

  if (command === "evidence-template") {
    console.log(playerEvidenceTemplateCsv(await buildPlayerEvidenceQueueFromOptions("evidence-template")));
    return;
  }

  if (command === "evidence-adapt") {
    const rows = await loadPlayerEvidenceSourceRows({
      path: requiredOptionValue("--input"),
      adapter: evidenceSourceAdapterOptionValue(),
    });
    const format = optionValue("--format") ?? "csv";

    if (format === "csv") {
      console.log(playerContextEvidenceCsv(rows));
      return;
    }

    if (format !== "json") throw new Error(`Unknown evidence adapter format "${format}". Use csv or json.`);

    console.log(JSON.stringify({ evidence: rows }, null, 2));
    return;
  }

  if (command === "evidence-coverage") {
    const audit = buildPlayerEvidenceCoverageAudit(
      await buildPlayerEvidenceQueueFromOptions("evidence-coverage"),
    );
    const format = optionValue("--format") ?? "json";

    if (format === "csv") {
      console.log(playerEvidenceCoverageGatesCsv(audit));
      return;
    }

    if (format !== "json") throw new Error(`Unknown evidence coverage format "${format}". Use json or csv.`);

    console.log(JSON.stringify(audit, null, 2));
    return;
  }

  if (command === "mock") {
    const pricingConfig = await pricingConfigFromOptions();
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
      draftBoard: result.picks,
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
    const pricingConfig = await pricingConfigFromOptions();
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

  if (command === "smoke") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const scenarioKey = scenarioOptionValue();
    const seed = optionValue("--seed") ?? "smoke";
    const batch = runMockBatch({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKeys: [scenarioKey],
      runsPerScenario: numericOptionValue("--runs", 2),
      seedPrefix: seed,
      pricingConfig,
    });
    const run = batch.runs[0];
    if (!run) throw new Error("Smoke command did not produce a mock run.");

    console.log(JSON.stringify(buildMockSmokeReport({ run, batch, rounds: 2 }), null, 2));
    return;
  }

  if (command === "calibration") {
    const pricingConfig = await pricingConfigFromOptions();
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

  if (command === "backtest") {
    const historicalRecords = await loadHistoricalAuctionRecords();

    console.log(JSON.stringify(buildHistoricalBacktest(historicalRecords), null, 2));
    return;
  }

  if (command === "qa") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const selectedScenarioKeys = scenarioListOptionValue();
    const evidenceScenarioKey = selectedScenarioKeys[0] ?? "expected";
    const prices = buildBasePrices(players, historicalRecords, pricingConfig);
    const batch = runMockBatch({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKeys: selectedScenarioKeys,
      runsPerScenario: numericOptionValue("--runs", 2),
      seedPrefix: optionValue("--seed-prefix") ?? "qa",
      pricingConfig,
    });
    const audit = buildHistoricalCalibrationAudit({ historicalRecords, batch });
    const firstRun = batch.runs[0];
    if (!firstRun) throw new Error("QA command did not produce a mock run.");
    const smokeReport = buildMockSmokeReport({ run: firstRun, batch, rounds: 2 });
    const historicalBacktest = buildHistoricalBacktest(historicalRecords);
    const sanityReport = buildTopPlayerSanityReport({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKey: evidenceScenarioKey,
      limit: numericOptionValue("--evidence-limit", 40),
      seedPrefix: optionValue("--seed-prefix") ?? "qa",
      pricingConfig,
      mockBatch: batch,
    });
    const evidenceQueue = buildPlayerEvidenceQueue(sanityReport);
    const outlierQueue = buildPlayerOutlierReviewQueue(sanityReport);
    const evidenceCoverageAudit = buildPlayerEvidenceCoverageAudit(evidenceQueue);
    const keeperScenarioSensitivity = buildKeeperScenarioSensitivityReport({
      prices,
      keepers,
      limit: numericOptionValue("--scenario-sensitivity-limit", 60),
    });
    const outputDirectory = optionValue("--out");
    const artifacts = outputDirectory
      ? await writePrepOutputArtifacts({
        batch,
        audit,
        smokeReport,
        historicalBacktest,
        evidenceQueue,
        evidenceCoverageAudit,
        outlierQueue,
        keeperScenarioSensitivity,
        outputDirectory,
      })
      : [];
    const report = buildQaReport({
      options: batch.options,
      smoke: smokeReport,
      calibration: audit,
      backtest: historicalBacktest,
      evidenceCoverage: evidenceCoverageAudit,
      artifactPaths: artifacts.map(artifact => artifact.path),
    });

    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.recommendedExitCode;
    return;
  }

  if (command === "outputs") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const selectedScenarioKeys = scenarioListOptionValue();
    const evidenceScenarioKey = selectedScenarioKeys[0] ?? "expected";
    const prices = buildBasePrices(players, historicalRecords, pricingConfig);
    const batch = runMockBatch({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKeys: selectedScenarioKeys,
      runsPerScenario: numericOptionValue("--runs", 50),
      seedPrefix: optionValue("--seed-prefix") ?? "mockd",
      pricingConfig,
    });
    const audit = buildHistoricalCalibrationAudit({ historicalRecords, batch });
    const firstRun = batch.runs[0];
    if (!firstRun) throw new Error("Outputs command did not produce a mock run.");
    const smokeReport = buildMockSmokeReport({ run: firstRun, batch, rounds: 2 });
    const historicalBacktest = buildHistoricalBacktest(historicalRecords);
    const sanityReport = buildTopPlayerSanityReport({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKey: evidenceScenarioKey,
      limit: numericOptionValue("--evidence-limit", 40),
      seedPrefix: optionValue("--seed-prefix") ?? "mockd",
      pricingConfig,
      mockBatch: batch,
    });
    const evidenceQueue = buildPlayerEvidenceQueue(sanityReport);
    const outlierQueue = buildPlayerOutlierReviewQueue(sanityReport);
    const evidenceCoverageAudit = buildPlayerEvidenceCoverageAudit(evidenceQueue);
    const keeperScenarioSensitivity = buildKeeperScenarioSensitivityReport({
      prices,
      keepers,
      limit: numericOptionValue("--scenario-sensitivity-limit", 60),
    });
    const artifacts = await writePrepOutputArtifacts({
      batch,
      audit,
      smokeReport,
      historicalBacktest,
      evidenceQueue,
      evidenceCoverageAudit,
      outlierQueue,
      keeperScenarioSensitivity,
      outputDirectory: optionValue("--out") ?? "data/processed/mock-prep",
    });

    console.log(JSON.stringify({
      options: batch.options,
      outputDirectory: optionValue("--out") ?? "data/processed/mock-prep",
      files: artifacts.map(artifact => ({
        filename: artifact.filename,
        path: artifact.path,
      })),
    }, null, 2));
    return;
  }

  console.log("Usage: npm run keepers | npm run profiles | npm run rankings | npm run prices [-- --custom-weights --player-context=path.csv --player-evidence=path.csv] | npm run scenarios [-- --custom-weights --player-context=path.csv --player-evidence=path.csv] | npm run scenarios:sensitivity [-- --limit=60 --format=json|csv --custom-weights --player-context=path.csv --player-evidence=path.csv] | npm run validate | npm run audit -- --player=\"Drake London\" [--scenario=expected --runs=10 --seed-prefix=player-audit --player-context=path.csv --player-evidence=path.csv] | npm run sanity [-- --scenario=expected --limit=40 --runs=10 --seed-prefix=top-sanity --player-context=path.csv --player-evidence=path.csv] | npm run outliers:queue [-- --scenario=expected --limit=40 --runs=10 --format=json|csv --player-context=path.csv --player-evidence=path.csv] | npm run evidence:queue [-- --scenario=expected --limit=40 --runs=10 --format=json|csv --player-context=path.csv --player-evidence=path.csv] | npm run evidence:template [-- --scenario=expected --limit=40 --runs=10 --player-context=path.csv --player-evidence=path.csv] | npm run evidence:adapt -- --input=path.csv [--adapter=scored-local --format=csv|json] | npm run evidence:coverage [-- --scenario=expected --limit=40 --runs=10 --format=json|csv --player-context=path.csv --player-evidence=path.csv] | npm run mock [-- --scenario=expected --seed=mockd-default --player-context=path.csv --player-evidence=path.csv] | npm run smoke [-- --scenario=expected --runs=2 --seed=smoke --player-context=path.csv --player-evidence=path.csv] | npm run qa [-- --scenarios=expected --runs=2 --seed-prefix=qa --out=data/processed/mock-prep --evidence-limit=40 --scenario-sensitivity-limit=60 --player-context=path.csv --player-evidence=path.csv] | npm run mocks [-- --scenarios=expected --runs=50 --seed-prefix=mockd --player-context=path.csv --player-evidence=path.csv] | npm run calibration [-- --scenarios=expected --runs=50 --seed-prefix=mockd --player-context=path.csv --player-evidence=path.csv] | npm run backtest | npm run outputs [-- --scenarios=expected --runs=50 --seed-prefix=mockd --out=data/processed/mock-prep --evidence-limit=40 --scenario-sensitivity-limit=60 --player-context=path.csv --player-evidence=path.csv]");
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
