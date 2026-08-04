import { leagueConfig, type Owner } from "../../config/league.js";
import type { DraftPlanReport, DraftPlanStrategyKey } from "./draftPlan.js";
import type { KeeperScenarioKey } from "./keeperInflation.js";
import type { MockBatch } from "./mockBatch.js";
import type { QaReport, QaSeverity, QaStatus } from "./qaReport.js";

export type DraftReadyStrategyMode = "filter" | "force";
export type DraftReadyEngineMode = "fast" | "full";

export interface DraftReadyDataCounts {
  projections: number;
  historicalRecords: number;
  keepers: number;
}

export interface DraftReadyOptions {
  owner: Owner;
  strategyKey: DraftPlanStrategyKey;
  strategyMode: DraftReadyStrategyMode;
  scenarioKey: KeeperScenarioKey;
  runs: number;
  qaRuns: number;
  seedPrefix: string;
  engineMode: DraftReadyEngineMode;
  minimumMatches: number;
}

export interface DraftReadyCheck {
  key: string;
  label: string;
  status: QaStatus;
  severity: QaSeverity;
  message: string;
}

export interface DraftReadyTopCandidate {
  seed: string;
  rosterSpend: number;
  budgetRemaining: number;
  weeks1To4Score: number;
  rbCoreSpend: number;
  rbCore: string[];
}

export interface DraftReadyReport {
  status: QaStatus;
  recommendedExitCode: 0 | 1;
  options: DraftReadyOptions;
  summary: {
    checkCount: number;
    hardFailCount: number;
    hardWarnCount: number;
    advisoryFailCount: number;
    advisoryWarnCount: number;
  };
  checks: DraftReadyCheck[];
  dataCounts: DraftReadyDataCounts;
  qa: {
    status: QaStatus;
    recommendedExitCode: 0 | 1;
    hardFailCount: number;
    hardWarnCount: number;
  };
  draftPlan: {
    engineMode: DraftReadyEngineMode;
    runCount: number;
    matchedRunCount: number;
    candidateLimit: number;
    topCandidate?: DraftReadyTopCandidate;
  };
}

export interface BuildDraftReadyReportOptions {
  options: DraftReadyOptions;
  dataCounts: DraftReadyDataCounts;
  qaReport: QaReport;
  draftPlanReport: DraftPlanReport;
  planBatch: MockBatch;
}

const checkSummary = (checks: readonly DraftReadyCheck[]): DraftReadyReport["summary"] => ({
  checkCount: checks.length,
  hardFailCount: checks.filter(check => check.severity === "hard" && check.status === "fail").length,
  hardWarnCount: checks.filter(check => check.severity === "hard" && check.status === "warn").length,
  advisoryFailCount: checks.filter(check => check.severity === "advisory" && check.status === "fail").length,
  advisoryWarnCount: checks.filter(check => check.severity === "advisory" && check.status === "warn").length,
});

const overallStatus = (summary: DraftReadyReport["summary"]): QaStatus => {
  if (summary.hardFailCount > 0) return "fail";
  if (
    summary.hardWarnCount > 0 ||
    summary.advisoryFailCount > 0 ||
    summary.advisoryWarnCount > 0
  ) {
    return "warn";
  }

  return "pass";
};

const dataCheck = (dataCounts: DraftReadyDataCounts): DraftReadyCheck => {
  const missingInputs = [
    dataCounts.projections > 0 ? undefined : "projections",
    dataCounts.historicalRecords > 0 ? undefined : "historical records",
    dataCounts.keepers > 0 ? undefined : "keepers",
  ].filter((input): input is string => input !== undefined);
  const keeperCoverageIsPartial =
    missingInputs.length === 0 &&
    dataCounts.keepers < leagueConfig.teams;

  return {
    key: "data-inputs",
    label: "Data inputs",
    status: missingInputs.length === 0 ? (keeperCoverageIsPartial ? "warn" : "pass") : "fail",
    severity: "hard",
    message: missingInputs.length
      ? `Missing required input data: ${missingInputs.join(", ")}.`
      : keeperCoverageIsPartial
        ? `${dataCounts.projections} projections, ${dataCounts.historicalRecords} historical records, and ${dataCounts.keepers}/${leagueConfig.teams} keeper declarations loaded. Confirm missing owners before draft night.`
        : `${dataCounts.projections} projections, ${dataCounts.historicalRecords} historical records, and ${dataCounts.keepers} keeper declarations loaded.`,
  };
};

const qaCheck = (qaReport: QaReport): DraftReadyCheck => ({
  key: "qa",
  label: "Engine QA",
  status: qaReport.recommendedExitCode === 1 ? "fail" : qaReport.status,
  severity: "hard",
  message: qaReport.recommendedExitCode === 1
    ? `${qaReport.summary.hardFailCount} hard QA failure(s) need attention.`
    : `QA status is ${qaReport.status}; ${qaReport.summary.hardFailCount} hard failure(s).`,
});

const draftPlanMatchCheck = (
  report: DraftPlanReport,
  minimumMatches: number,
): DraftReadyCheck => {
  const matchedRunCount = report.matchedRunCount;
  let status: QaStatus = "pass";

  if (matchedRunCount === 0) {
    status = "fail";
  } else if (matchedRunCount < minimumMatches) {
    status = "warn";
  }

  return {
    key: "draft-plan-matches",
    label: "Draft plan matches",
    status,
    severity: "hard",
    message: `${matchedRunCount}/${report.runCount} run(s) produced matching ${report.strategy.label} plans; target is ${minimumMatches}.`,
  };
};

const rosterValidityCheck = (batch: MockBatch): DraftReadyCheck => {
  const invalidRosterCount = batch.summary.scenarios.reduce(
    (total, scenario) => total + scenario.invalidRosterCount,
    0,
  );

  return {
    key: "roster-validity",
    label: "Roster validity",
    status: invalidRosterCount === 0 ? "pass" : "fail",
    severity: "hard",
    message: invalidRosterCount === 0
      ? "All draft-plan simulation rosters were valid."
      : `${invalidRosterCount} invalid draft-plan roster(s) found.`,
  };
};

const candidateShapeCheck = (report: DraftPlanReport): DraftReadyCheck => {
  const candidate = report.candidates[0];
  if (!candidate) {
    return {
      key: "top-candidate-shape",
      label: "Top candidate shape",
      status: "fail",
      severity: "hard",
      message: "No top plan passed the required strategy shape.",
    };
  }

  const valid = report.strategy.key === "three-rb"
    ? candidate.rbCore.length === 3 &&
      candidate.rosterSpend <= leagueConfig.auctionBudget &&
      candidate.rbCoreSpend >= report.strategy.thresholds.rbCoreSpendMinimum
    : candidate.lineup.length >= 9 &&
      candidate.rosterSpend <= leagueConfig.auctionBudget &&
      candidate.players.length >= leagueConfig.rosterSize;

  return {
    key: "top-candidate-shape",
    label: "Top candidate shape",
    status: valid ? "pass" : "fail",
    severity: "hard",
    message: report.strategy.key === "three-rb"
      ? valid
        ? `Top plan has a $${candidate.rbCoreSpend} RB core and $${candidate.rosterSpend} total spend.`
        : `Top plan shape missed the strategy constraints: $${candidate.rbCoreSpend} RB core, $${candidate.rosterSpend} total spend.`
      : valid
        ? `Top ${report.strategy.label} plan has a legal lineup, ${candidate.players.length} players, and $${candidate.rosterSpend} total spend.`
        : `Top ${report.strategy.label} plan missed lineup, roster-size, or budget constraints: ${candidate.lineup.length} starters, ${candidate.players.length} players, $${candidate.rosterSpend} total spend.`,
  };
};

const topCandidateFor = (report: DraftPlanReport): DraftReadyTopCandidate | undefined => {
  const candidate = report.candidates[0];
  if (!candidate) return undefined;

  return {
    seed: candidate.seed,
    rosterSpend: candidate.rosterSpend,
    budgetRemaining: candidate.budgetRemaining,
    weeks1To4Score: candidate.weeks1To4Score,
    rbCoreSpend: candidate.rbCoreSpend,
    rbCore: candidate.rbCore.map(player => `${player.name} $${player.price}`),
  };
};

export const buildDraftReadyReport = ({
  options,
  dataCounts,
  qaReport,
  draftPlanReport,
  planBatch,
}: BuildDraftReadyReportOptions): DraftReadyReport => {
  const topCandidate = topCandidateFor(draftPlanReport);
  const checks = [
    dataCheck(dataCounts),
    qaCheck(qaReport),
    draftPlanMatchCheck(draftPlanReport, options.minimumMatches),
    rosterValidityCheck(planBatch),
    candidateShapeCheck(draftPlanReport),
  ];
  const summary = checkSummary(checks);

  return {
    status: overallStatus(summary),
    recommendedExitCode: summary.hardFailCount > 0 ? 1 : 0,
    options,
    summary,
    checks,
    dataCounts,
    qa: {
      status: qaReport.status,
      recommendedExitCode: qaReport.recommendedExitCode,
      hardFailCount: qaReport.summary.hardFailCount,
      hardWarnCount: qaReport.summary.hardWarnCount,
    },
    draftPlan: {
      engineMode: draftPlanReport.engineMode,
      runCount: draftPlanReport.runCount,
      matchedRunCount: draftPlanReport.matchedRunCount,
      candidateLimit: draftPlanReport.candidateLimit,
      ...(topCandidate ? { topCandidate } : {}),
    },
  };
};
