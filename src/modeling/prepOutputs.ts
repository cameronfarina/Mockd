import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HistoricalBacktestReport } from "./historicalBacktest.js";
import type { HistoricalCalibrationAudit } from "./calibrationAudit.js";
import type { MockBatch } from "./mockBatch.js";
import type { MockSmokeReport } from "./mockSmoke.js";
import {
  playerEvidenceCoverageGatesCsv,
  type EvidenceCoverageAudit,
} from "./playerEvidenceCoverage.js";
import {
  playerEvidenceQueueCsv,
  type PlayerEvidenceQueue,
} from "./playerEvidenceQueue.js";
import { playerEvidenceTemplateCsv } from "./playerEvidenceTemplate.js";

export interface PrepOutputArtifact {
  filename: string;
  path: string;
  content: string;
}

export interface BuildPrepOutputArtifactsOptions {
  batch: MockBatch;
  audit: HistoricalCalibrationAudit;
  outputDirectory: string;
  smokeReport?: MockSmokeReport;
  historicalBacktest?: HistoricalBacktestReport;
  evidenceQueue?: PlayerEvidenceQueue;
  evidenceCoverageAudit?: EvidenceCoverageAudit;
}

type CsvValue = string | number | boolean | undefined;

const csvCell = (value: CsvValue): string => {
  const text = value === undefined ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

const toCsv = (
  headers: readonly string[],
  rows: readonly (readonly CsvValue[])[],
): string =>
  [
    headers.map(csvCell).join(","),
    ...rows.map(row => row.map(csvCell).join(",")),
  ].join("\n");

const jsonArtifact = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;

const playerSaleRangesCsv = (batch: MockBatch): string =>
  toCsv(
    [
      "name",
      "position",
      "drafted_count",
      "drafted_rate",
      "average_market_price",
      "average_sale_price",
      "minimum_sale_price",
      "maximum_sale_price",
    ],
    batch.summary.players.map(player => [
      player.name,
      player.position,
      player.draftedCount,
      player.draftedRate,
      player.averageMarketPrice,
      player.averageSalePrice,
      player.minimumSalePrice,
      player.maximumSalePrice,
    ]),
  );

const ownerSummariesCsv = (batch: MockBatch): string =>
  toCsv(
    [
      "owner",
      "run_count",
      "invalid_roster_count",
      "average_spend",
      "minimum_spend",
      "maximum_spend",
      "average_week1_score",
      "average_weeks1_to_4_score",
      "average_budget_remaining",
      "average_qb_spend",
      "average_rb_spend",
      "average_wr_spend",
      "average_te_spend",
      "average_k_spend",
      "average_dst_spend",
    ],
    batch.summary.owners.map(owner => [
      owner.owner,
      owner.runCount,
      owner.invalidRosterCount,
      owner.averageSpend,
      owner.minimumSpend,
      owner.maximumSpend,
      owner.averageWeek1Score,
      owner.averageWeeks1To4Score,
      owner.averageBudgetRemaining,
      owner.averagePositionSpend.QB,
      owner.averagePositionSpend.RB,
      owner.averagePositionSpend.WR,
      owner.averagePositionSpend.TE,
      owner.averagePositionSpend.K,
      owner.averagePositionSpend.DST,
    ]),
  );

const ownerPlayerExposureCsv = (batch: MockBatch): string =>
  toCsv(
    ["owner", "player", "position", "drafted_count", "drafted_rate", "average_price"],
    batch.summary.ownerPlayerExposure.map(exposure => [
      exposure.owner,
      exposure.player,
      exposure.position,
      exposure.draftedCount,
      exposure.draftedRate,
      exposure.averagePrice,
    ]),
  );

const mockDraftBoardCsv = (batch: MockBatch): string =>
  toCsv(
    [
      "seed",
      "scenario",
      "pick",
      "nominator",
      "winner",
      "player",
      "position",
      "anchor_price",
      "sale_price",
      "budget_after_pick",
      "roster_slots_after_pick",
      "top_bid_1_owner",
      "top_bid_1_amount",
      "top_bid_1_uncapped",
      "top_bid_2_owner",
      "top_bid_2_amount",
      "top_bid_2_uncapped",
      "top_bid_3_owner",
      "top_bid_3_amount",
      "top_bid_3_uncapped",
    ],
    batch.runs.flatMap(run =>
      run.picks.map(pick => [
        run.seed,
        run.keeperScenario.key,
        pick.pick,
        pick.nominator,
        pick.owner,
        pick.player,
        pick.position,
        pick.marketPrice,
        pick.price,
        pick.budgetAfterPick,
        pick.rosterSlotsAfterPick,
        pick.topBids[0]?.owner,
        pick.topBids[0]?.amount,
        pick.topBids[0]?.uncappedAmount,
        pick.topBids[1]?.owner,
        pick.topBids[1]?.amount,
        pick.topBids[1]?.uncappedAmount,
        pick.topBids[2]?.owner,
        pick.topBids[2]?.amount,
        pick.topBids[2]?.uncappedAmount,
      ]),
    ),
  );

const mockBidDiagnosticsCsv = (batch: MockBatch): string =>
  toCsv(
    [
      "seed",
      "scenario",
      "pick",
      "nominator",
      "winner",
      "player",
      "position",
      "anchor_price",
      "sale_price",
      "bid_rank",
      "bid_owner",
      "bid_amount",
      "bid_uncapped",
      "bid_max",
      "bid_capped_by_max",
      "second_bid_amount",
      "reserve_price",
      "nominator_opening_bid",
      "uncapped_sale_price",
      "top_end_guarded_price",
      "sale_price_basis",
      "top_driver_1",
      "top_driver_1_multiplier",
      "top_driver_2",
      "top_driver_2_multiplier",
      "top_driver_3",
      "top_driver_3_multiplier",
    ],
    batch.runs.flatMap(run =>
      run.picks.flatMap(pick =>
        pick.topBids.map((bid, bidIndex) => {
          const diagnostics = pick.diagnostics.topBids[bidIndex];
          const drivers = diagnostics?.drivers ?? [];

          return [
            run.seed,
            run.keeperScenario.key,
            pick.pick,
            pick.nominator,
            pick.owner,
            pick.player,
            pick.position,
            pick.marketPrice,
            pick.price,
            bidIndex + 1,
            bid.owner,
            bid.amount,
            bid.uncappedAmount,
            bid.maxBid,
            diagnostics?.cappedByMaxBid ?? bid.amount < bid.uncappedAmount,
            pick.diagnostics.secondBidAmount,
            pick.diagnostics.reservePrice,
            pick.diagnostics.nominatorOpeningBid,
            pick.diagnostics.uncappedSalePrice,
            pick.diagnostics.topEndGuardedPrice,
            pick.diagnostics.salePriceBasis,
            drivers[0]?.key,
            drivers[0]?.multiplier,
            drivers[1]?.key,
            drivers[1]?.multiplier,
            drivers[2]?.key,
            drivers[2]?.multiplier,
          ] satisfies readonly CsvValue[];
        }),
      ),
    ),
  );

const mockSmokeFirstTwoRoundsCsv = (smokeReport: MockSmokeReport): string =>
  toCsv(
    [
      "pick",
      "round",
      "nominator",
      "winner",
      "player",
      "position",
      "anchor_price",
      "sale_price",
      "sale_vs_anchor",
      "budget_after_pick",
      "roster_slots_after_pick",
    ],
    smokeReport.firstTwoRounds.map(pick => [
      pick.pick,
      pick.round,
      pick.nominator,
      pick.winner,
      pick.player,
      pick.position,
      pick.anchorPrice,
      pick.salePrice,
      pick.saleVsAnchor,
      pick.budgetAfterPick,
      pick.rosterSlotsAfterPick,
    ]),
  );

const historicalBacktestGatesCsv = (backtest: HistoricalBacktestReport): string =>
  toCsv(
    [
      "season",
      "source_seasons",
      "key",
      "category",
      "label",
      "status",
      "target",
      "actual",
      "delta",
      "warn_threshold",
      "fail_threshold",
    ],
    backtest.seasonBacktests.flatMap(seasonBacktest =>
      seasonBacktest.gates.items.map(gate => [
        seasonBacktest.season,
        seasonBacktest.sourceSeasons.join("; "),
        gate.key,
        gate.category,
        gate.label,
        gate.status,
        gate.target,
        gate.actual,
        gate.delta,
        gate.warnThreshold,
        gate.failThreshold,
      ]),
    ),
  );

const priceTierCalibrationCsv = (audit: HistoricalCalibrationAudit): string =>
  toCsv(
    [
      "tier",
      "label",
      "historical_average_price",
      "mock_average_price",
      "price_delta",
      "historical_average_count",
      "mock_average_count",
      "count_delta",
    ],
    audit.priceTiers.map(tier => [
      tier.key,
      tier.label,
      tier.historicalAveragePrice,
      tier.mockAveragePrice,
      tier.priceDelta,
      tier.historicalAverageCount,
      tier.mockAverageCount,
      tier.countDelta,
    ]),
  );

const highPriceVolumeCalibrationCsv = (audit: HistoricalCalibrationAudit): string =>
  toCsv(
    [
      "threshold",
      "historical_average_count",
      "historical_max_count",
      "mock_average_count",
      "mock_max_count",
      "average_count_delta",
      "max_count_delta",
    ],
    audit.highPriceVolumes.map(volume => [
      volume.threshold,
      volume.historicalAverageCount,
      volume.historicalMaxCount,
      volume.mockAverageCount,
      volume.mockMaxCount,
      volume.averageCountDelta,
      volume.maxCountDelta,
    ]),
  );

const positionCountCalibrationCsv = (audit: HistoricalCalibrationAudit): string =>
  toCsv(
    ["position", "historical_average_count", "mock_average_count", "delta"],
    audit.positionCounts.map(position => [
      position.position,
      position.historicalAverageCount,
      position.mockAverageCount,
      position.delta,
    ]),
  );

const positionSpendCalibrationCsv = (audit: HistoricalCalibrationAudit): string =>
  toCsv(
    [
      "position",
      "historical_average_spend",
      "scenario_average_spend_target",
      "mock_average_spend",
      "historical_delta",
      "scenario_delta",
    ],
    audit.positionSpend.map(position => [
      position.position,
      position.historicalAverageSpend,
      position.scenarioAverageSpendTarget,
      position.mockAverageSpend,
      position.delta,
      position.scenarioSpendDelta,
    ]),
  );

const scenarioCalibrationCsv = (audit: HistoricalCalibrationAudit): string =>
  toCsv(
    [
      "scenario",
      "label",
      "run_count",
      "invalid_roster_count",
      "average_pick_count",
      "scenario_open_auction_dollars",
      "mock_auction_spend",
      "scenario_spend_delta",
      "league_average_budget_remaining",
      "max_owner_average_budget_remaining",
    ],
    audit.scenarios.map(scenario => [
      scenario.key,
      scenario.label,
      scenario.runCount,
      scenario.invalidRosterCount,
      scenario.averagePickCount,
      scenario.scenarioAverageOpenAuctionDollars,
      scenario.mockAverageAuctionSpend,
      scenario.scenarioAuctionSpendDelta,
      scenario.leagueAverageBudgetRemaining,
      scenario.maxOwnerAverageBudgetRemaining,
    ]),
  );

const calibrationSummaryCsv = (audit: HistoricalCalibrationAudit): string =>
  toCsv(
    ["category", "key", "label", "target", "actual", "delta"],
    [
      ...audit.summary.largestPriceTierCountDeltas.map(delta => [
        "price_tier_count",
        delta.key,
        delta.label,
        delta.target,
        delta.actual,
        delta.delta,
      ] satisfies readonly CsvValue[]),
      ...audit.summary.largestPositionCountDeltas.map(delta => [
        "position_count",
        delta.key,
        delta.label,
        delta.target,
        delta.actual,
        delta.delta,
      ] satisfies readonly CsvValue[]),
      ...audit.summary.largestPositionSpendDeltas.map(delta => [
        "position_spend",
        delta.key,
        delta.label,
        delta.target,
        delta.actual,
        delta.delta,
      ] satisfies readonly CsvValue[]),
      ...audit.summary.largestOwnerSpendDeltas.map(delta => [
        "owner_spend",
        delta.key,
        delta.label,
        delta.target,
        delta.actual,
        delta.delta,
      ] satisfies readonly CsvValue[]),
      ...audit.summary.budgetRemaining.ownersWithAverageBudgetRemaining.map(owner => [
        "budget_remaining",
        owner.owner,
        owner.owner,
        0,
        owner.averageBudgetRemaining,
        owner.averageBudgetRemaining,
      ] satisfies readonly CsvValue[]),
    ],
  );

const calibrationGatesCsv = (audit: HistoricalCalibrationAudit): string =>
  toCsv(
    ["key", "category", "label", "status", "mode", "target", "actual", "delta", "warn_threshold", "fail_threshold"],
    audit.gates.items.map(gate => [
      gate.key,
      gate.category,
      gate.label,
      gate.status,
      gate.mode,
      gate.target,
      gate.actual,
      gate.delta,
      gate.warnThreshold,
      gate.failThreshold,
    ]),
  );

export const buildPrepOutputArtifacts = ({
  batch,
  audit,
  outputDirectory,
  smokeReport,
  historicalBacktest,
  evidenceQueue,
  evidenceCoverageAudit,
}: BuildPrepOutputArtifactsOptions): PrepOutputArtifact[] => {
  const files = [
    {
      filename: "mock-batch-summary.json",
      content: jsonArtifact({ options: batch.options, summary: batch.summary }),
    },
    {
      filename: "historical-calibration-audit.json",
      content: jsonArtifact(audit),
    },
    ...(smokeReport ? [
      {
        filename: "mock-smoke.json",
        content: jsonArtifact(smokeReport),
      },
      {
        filename: "mock-smoke-first-two-rounds.csv",
        content: `${mockSmokeFirstTwoRoundsCsv(smokeReport)}\n`,
      },
    ] : []),
    ...(historicalBacktest ? [
      {
        filename: "historical-backtest.json",
        content: jsonArtifact(historicalBacktest),
      },
      {
        filename: "historical-backtest-gates.csv",
        content: `${historicalBacktestGatesCsv(historicalBacktest)}\n`,
      },
    ] : []),
    {
      filename: "calibration-summary.csv",
      content: `${calibrationSummaryCsv(audit)}\n`,
    },
    {
      filename: "calibration-gates.csv",
      content: `${calibrationGatesCsv(audit)}\n`,
    },
    {
      filename: "player-sale-ranges.csv",
      content: `${playerSaleRangesCsv(batch)}\n`,
    },
    {
      filename: "owner-summaries.csv",
      content: `${ownerSummariesCsv(batch)}\n`,
    },
    {
      filename: "owner-player-exposure.csv",
      content: `${ownerPlayerExposureCsv(batch)}\n`,
    },
    ...(evidenceQueue ? [{
      filename: "player-evidence-queue.csv",
      content: `${playerEvidenceQueueCsv(evidenceQueue)}\n`,
    }, {
      filename: "player-evidence-template.csv",
      content: `${playerEvidenceTemplateCsv(evidenceQueue)}\n`,
    }] : []),
    ...(evidenceCoverageAudit ? [
      {
        filename: "player-evidence-coverage.json",
        content: jsonArtifact(evidenceCoverageAudit),
      },
      {
        filename: "player-evidence-coverage-gates.csv",
        content: `${playerEvidenceCoverageGatesCsv(evidenceCoverageAudit)}\n`,
      },
    ] : []),
    {
      filename: "mock-draft-board.csv",
      content: `${mockDraftBoardCsv(batch)}\n`,
    },
    {
      filename: "mock-bid-diagnostics.csv",
      content: `${mockBidDiagnosticsCsv(batch)}\n`,
    },
    {
      filename: "price-tier-calibration.csv",
      content: `${priceTierCalibrationCsv(audit)}\n`,
    },
    {
      filename: "high-price-volume-calibration.csv",
      content: `${highPriceVolumeCalibrationCsv(audit)}\n`,
    },
    {
      filename: "position-count-calibration.csv",
      content: `${positionCountCalibrationCsv(audit)}\n`,
    },
    {
      filename: "position-spend-calibration.csv",
      content: `${positionSpendCalibrationCsv(audit)}\n`,
    },
    {
      filename: "scenario-calibration.csv",
      content: `${scenarioCalibrationCsv(audit)}\n`,
    },
  ];

  return files.map(file => ({
    ...file,
    path: join(outputDirectory, file.filename),
  }));
};

export const writePrepOutputArtifacts = async (
  options: BuildPrepOutputArtifactsOptions,
): Promise<PrepOutputArtifact[]> => {
  const artifacts = buildPrepOutputArtifacts(options);
  await mkdir(options.outputDirectory, { recursive: true });

  for (const artifact of artifacts) {
    await writeFile(artifact.path, artifact.content, "utf8");
  }

  return artifacts;
};
