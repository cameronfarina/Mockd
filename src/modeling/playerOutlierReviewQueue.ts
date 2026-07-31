import type { KeeperScenarioKey } from "./keeperInflation.js";
import type {
  HighPriceVolumeSanity,
  SanityFlag,
  SanityFlagKey,
  TopPlayerSanityReport,
  TopPlayerSanityRow,
} from "./topPlayerSanity.js";

export type PlayerOutlierPriority = "high" | "medium" | "low";
export type PlayerOutlierReviewStatus = "open";
export type PlayerOutlierReasonKey =
  | SanityFlagKey
  | "mockSaleDiscount"
  | "mockSaleRange"
  | "thinMockDemand"
  | "anchorToScenarioJump"
  | "eliteTierContributor";

export interface PlayerOutlierReason {
  key: PlayerOutlierReasonKey;
  severity: "review" | "info";
  message: string;
  threshold: string;
  actual: string;
}

export interface PlayerOutlierReviewRow {
  priority: PlayerOutlierPriority;
  rank: number;
  player: string;
  position: string;
  publicAnchorValue: number;
  basePrice: number;
  scenarioPrice: number;
  averageMockSalePrice: number;
  saleVsScenarioPrice: number;
  minMockSalePrice: number;
  maxMockSalePrice: number;
  mockSaleRange: number;
  draftedRate: number;
  rankGap: number | null;
  contextAdjustmentPercent: number;
  currentEvidenceCount: number;
  primaryReason: PlayerOutlierReasonKey;
  outlierReasons: readonly PlayerOutlierReason[];
  thresholds: readonly string[];
  auditCommand: string;
  reviewStatus: PlayerOutlierReviewStatus;
  reviewNote: string;
}

export interface PlayerOutlierReviewQueueSummary {
  playerCount: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  reasonCounts: Partial<Record<PlayerOutlierReasonKey, number>>;
}

export interface PlayerOutlierReviewQueue {
  summary: PlayerOutlierReviewQueueSummary;
  rows: readonly PlayerOutlierReviewRow[];
}

type CsvValue = string | number | undefined;

const mockSalePremiumThreshold = 6;
const mockSaleDiscountThreshold = -6;
const mockSaleRangeThreshold = 8;
const thinDemandMinimumScenarioPrice = 25;
const thinDemandDraftedRateThreshold = 0.8;
const thinDemandMinimumRuns = 5;
const anchorJumpMinimumDollars = 10;
const anchorJumpMinimumRatio = 1.2;

const priorityScore = {
  high: 3,
  medium: 2,
  low: 1,
} as const satisfies Record<PlayerOutlierPriority, number>;
const primaryReasonScore = {
  highMockPremium: 100,
  mockSaleDiscount: 95,
  thinMockDemand: 90,
  eliteTierContributor: 85,
  largeProjectionRankLift: 80,
  missingFactualEvidence: 75,
  hardCeilingPressure: 70,
  mockSaleRange: 60,
  anchorToScenarioJump: 50,
  contextPenalty: 10,
} as const satisfies Record<PlayerOutlierReasonKey, number>;

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const csvCell = (value: CsvValue): string => {
  const text = value === undefined ? "" : String(value);
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

const csvJoin = (values: readonly string[]): string => values.join("; ");

const reasonForFlag = (
  flag: SanityFlag,
  player: TopPlayerSanityRow,
): PlayerOutlierReason => {
  const threshold = {
    highMockPremium: `>= $${mockSalePremiumThreshold} over scenario`,
    largeProjectionRankLift: "rank gap <= -5 for expensive players or <= -30 overall",
    missingFactualEvidence: "scenario price >= $50 and evidence count = 0",
    contextPenalty: "<= -3% context adjustment",
    hardCeilingPressure: "base price at hard ceiling",
  } satisfies Record<SanityFlagKey, string>;
  const actual = {
    highMockPremium: `$${player.saleVsScenarioPrice}`,
    largeProjectionRankLift: player.rankGap === null ? "n/a" : String(player.rankGap),
    missingFactualEvidence: `${player.contextEvidenceCount} evidence row(s)`,
    contextPenalty: `${roundToTwo(player.contextAdjustmentPercent * 100)}%`,
    hardCeilingPressure: `$${player.basePrice}`,
  } satisfies Record<SanityFlagKey, string>;

  return {
    key: flag.key,
    severity: flag.severity,
    message: flag.message,
    threshold: threshold[flag.key],
    actual: actual[flag.key],
  };
};

const reviewedEliteThresholdsFor = (
  player: TopPlayerSanityRow,
  volumes: readonly HighPriceVolumeSanity[],
): HighPriceVolumeSanity[] =>
  volumes.filter(volume =>
    volume.status === "review" &&
    (
      player.scenarioPrice >= volume.threshold ||
      player.averageMockSalePrice >= volume.threshold ||
      player.maxMockSalePrice >= volume.threshold
    ),
  );

const additionalReasonsFor = (
  player: TopPlayerSanityRow,
  report: TopPlayerSanityReport,
): PlayerOutlierReason[] => {
  const reasons: PlayerOutlierReason[] = [];
  const mockSaleRange = player.maxMockSalePrice - player.minMockSalePrice;

  if (player.saleVsScenarioPrice <= mockSaleDiscountThreshold) {
    reasons.push({
      key: "mockSaleDiscount",
      severity: "review",
      message: `Mock sale average is $${Math.abs(player.saleVsScenarioPrice)} below the scenario anchor.`,
      threshold: `<= $${mockSaleDiscountThreshold} vs scenario`,
      actual: `$${player.saleVsScenarioPrice}`,
    });
  }

  if (mockSaleRange >= mockSaleRangeThreshold) {
    reasons.push({
      key: "mockSaleRange",
      severity: "review",
      message: `Mock sale range spans $${mockSaleRange}.`,
      threshold: `>= $${mockSaleRangeThreshold} range`,
      actual: `$${mockSaleRange}`,
    });
  }

  if (
    report.config.runs >= thinDemandMinimumRuns &&
    player.scenarioPrice >= thinDemandMinimumScenarioPrice &&
    player.draftedRate < thinDemandDraftedRateThreshold
  ) {
    reasons.push({
      key: "thinMockDemand",
      severity: "review",
      message: `Drafted in only ${roundToTwo(player.draftedRate * 100)}% of mock runs.`,
      threshold: `scenario >= $${thinDemandMinimumScenarioPrice} and drafted rate < ${thinDemandDraftedRateThreshold}`,
      actual: `${player.draftedRate}`,
    });
  }

  const anchorJump = player.scenarioPrice - player.publicAnchorValue;
  const anchorRatio = player.publicAnchorValue > 0 ? player.scenarioPrice / player.publicAnchorValue : 0;
  if (anchorJump >= anchorJumpMinimumDollars && anchorRatio >= anchorJumpMinimumRatio) {
    reasons.push({
      key: "anchorToScenarioJump",
      severity: "review",
      message: `Scenario price is $${anchorJump} above the public anchor.`,
      threshold: `>= $${anchorJumpMinimumDollars} and >= ${anchorJumpMinimumRatio}x public anchor`,
      actual: `$${anchorJump}, ${roundToTwo(anchorRatio)}x`,
    });
  }

  const eliteThresholds = reviewedEliteThresholdsFor(player, report.summary.highPriceVolume);
  if (eliteThresholds.length > 0) {
    reasons.push({
      key: "eliteTierContributor",
      severity: "review",
      message: "Player contributes to a reviewed elite-price volume threshold.",
      threshold: eliteThresholds.map(volume => `$${volume.threshold}+`).join(", "),
      actual: `scenario $${player.scenarioPrice}, mock average $${player.averageMockSalePrice}, mock max $${player.maxMockSalePrice}`,
    });
  }

  return reasons;
};

const reasonsFor = (
  player: TopPlayerSanityRow,
  report: TopPlayerSanityReport,
): PlayerOutlierReason[] => [
  ...player.flags.map(flag => reasonForFlag(flag, player)),
  ...additionalReasonsFor(player, report),
];

const priorityFor = (
  player: TopPlayerSanityRow,
  reasons: readonly PlayerOutlierReason[],
): PlayerOutlierPriority => {
  if (reasons.some(reason =>
    reason.key === "highMockPremium" ||
    reason.key === "mockSaleDiscount" ||
    reason.key === "thinMockDemand" ||
    reason.key === "eliteTierContributor" ||
    reason.key === "hardCeilingPressure" ||
    (reason.key === "largeProjectionRankLift" && player.scenarioPrice >= 45) ||
    (reason.key === "missingFactualEvidence" && player.scenarioPrice >= 50)
  )) {
    return "high";
  }
  if (reasons.some(reason => reason.severity === "review")) return "medium";
  return "low";
};

const auditCommandFor = (
  player: TopPlayerSanityRow,
  scenarioKey: KeeperScenarioKey,
): string =>
  `npm run audit -- --player="${player.name.replaceAll("\"", "\\\"")}" --scenario=${scenarioKey}`;

const primaryReasonFor = (
  reasons: readonly PlayerOutlierReason[],
): PlayerOutlierReasonKey =>
  [...reasons].sort((left, right) =>
    primaryReasonScore[right.key] - primaryReasonScore[left.key] ||
    left.key.localeCompare(right.key),
  )[0]?.key ?? "highMockPremium";

const rowFor = (
  player: TopPlayerSanityRow,
  report: TopPlayerSanityReport,
): PlayerOutlierReviewRow | undefined => {
  const outlierReasons = reasonsFor(player, report);
  if (outlierReasons.length === 0) return undefined;

  const thresholds = outlierReasons.flatMap(reason =>
    reason.key === "eliteTierContributor"
      ? reviewedEliteThresholdsFor(player, report.summary.highPriceVolume)
        .map(volume => `$${volume.threshold} volume exceeds historical max ${volume.historicalMaxCount}`)
      : [reason.threshold],
  );

  return {
    priority: priorityFor(player, outlierReasons),
    rank: player.rank,
    player: player.name,
    position: player.position,
    publicAnchorValue: player.publicAnchorValue,
    basePrice: player.basePrice,
    scenarioPrice: player.scenarioPrice,
    averageMockSalePrice: player.averageMockSalePrice,
    saleVsScenarioPrice: player.saleVsScenarioPrice,
    minMockSalePrice: player.minMockSalePrice,
    maxMockSalePrice: player.maxMockSalePrice,
    mockSaleRange: player.maxMockSalePrice - player.minMockSalePrice,
    draftedRate: player.draftedRate,
    rankGap: player.rankGap,
    contextAdjustmentPercent: player.contextAdjustmentPercent,
    currentEvidenceCount: player.contextEvidenceCount,
    primaryReason: primaryReasonFor(outlierReasons),
    outlierReasons,
    thresholds,
    auditCommand: auditCommandFor(player, report.config.scenarioKey),
    reviewStatus: "open",
    reviewNote: "",
  };
};

const sortRows = (
  left: PlayerOutlierReviewRow,
  right: PlayerOutlierReviewRow,
): number =>
  priorityScore[right.priority] - priorityScore[left.priority] ||
  right.scenarioPrice - left.scenarioPrice ||
  left.rank - right.rank ||
  left.player.localeCompare(right.player);

const reasonCountsFor = (
  rows: readonly PlayerOutlierReviewRow[],
): Partial<Record<PlayerOutlierReasonKey, number>> => {
  const counts: Partial<Record<PlayerOutlierReasonKey, number>> = {};

  for (const row of rows) {
    for (const reason of row.outlierReasons) {
      counts[reason.key] = (counts[reason.key] ?? 0) + 1;
    }
  }

  return counts;
};

export const buildPlayerOutlierReviewQueue = (
  report: TopPlayerSanityReport,
): PlayerOutlierReviewQueue => {
  const rows = report.players
    .map(player => rowFor(player, report))
    .filter((row): row is PlayerOutlierReviewRow => Boolean(row))
    .sort(sortRows);

  return {
    summary: {
      playerCount: rows.length,
      highPriorityCount: rows.filter(row => row.priority === "high").length,
      mediumPriorityCount: rows.filter(row => row.priority === "medium").length,
      lowPriorityCount: rows.filter(row => row.priority === "low").length,
      reasonCounts: reasonCountsFor(rows),
    },
    rows,
  };
};

export const playerOutlierReviewQueueCsv = (
  queue: PlayerOutlierReviewQueue,
): string =>
  [
    [
      "priority",
      "rank",
      "player",
      "position",
      "public_anchor_value",
      "base_price",
      "scenario_price",
      "average_mock_sale_price",
      "sale_vs_scenario_price",
      "min_mock_sale_price",
      "max_mock_sale_price",
      "mock_sale_range",
      "drafted_rate",
      "rank_gap",
      "context_adjustment_percent",
      "current_evidence_count",
      "primary_reason",
      "outlier_reasons",
      "thresholds",
      "audit_command",
      "review_status",
      "review_note",
    ].map(csvCell).join(","),
    ...queue.rows.map(row => [
      row.priority,
      row.rank,
      row.player,
      row.position,
      row.publicAnchorValue,
      row.basePrice,
      row.scenarioPrice,
      row.averageMockSalePrice,
      row.saleVsScenarioPrice,
      row.minMockSalePrice,
      row.maxMockSalePrice,
      row.mockSaleRange,
      row.draftedRate,
      row.rankGap ?? undefined,
      row.contextAdjustmentPercent,
      row.currentEvidenceCount,
      row.primaryReason,
      csvJoin(row.outlierReasons.map(reason => reason.key)),
      csvJoin(row.thresholds),
      row.auditCommand,
      row.reviewStatus,
      row.reviewNote,
    ].map(csvCell).join(",")),
  ].join("\n");
