import type { KeeperScenarioKey } from "./keeperInflation.js";

export type QaStatus = "pass" | "warn" | "fail";
export type QaSeverity = "hard" | "advisory";

export interface QaRunOptions {
  scenarioKeys: readonly KeeperScenarioKey[];
  runsPerScenario: number;
  seedPrefix: string;
}

export interface QaGateSummaryInput {
  status: QaStatus;
  credible?: boolean;
  gateCount: number;
  passCount: number;
  warnCount: number;
  failCount: number;
}

export interface QaGateItemInput {
  key: string;
  label?: string;
  status: QaStatus;
}

export interface QaSmokeInput {
  invalidRosterCount: number;
  batch?: {
    invalidRosterCount: number;
  };
  firstTwoRoundSummary: {
    pickCount: number;
  };
  warnings: readonly string[];
}

export interface QaCalibrationInput {
  gates: {
    summary: QaGateSummaryInput;
    items: readonly QaGateItemInput[];
  };
}

export interface QaBacktestInput {
  summary: QaGateSummaryInput;
}

export interface QaEvidenceCoverageInput {
  summary: {
    status: QaStatus;
    highPriorityMissingCount: number;
    missingEvidenceCount: number;
    coverageRate: number;
    completeEvidenceRate: number;
  };
  gates: {
    summary: QaGateSummaryInput;
  };
}

export interface BuildQaReportOptions {
  options: QaRunOptions;
  smoke: QaSmokeInput;
  calibration: QaCalibrationInput;
  backtest: QaBacktestInput;
  evidenceCoverage?: QaEvidenceCoverageInput;
  artifactPaths?: readonly string[];
}

export interface QaCheck {
  key: string;
  label: string;
  status: QaStatus;
  severity: QaSeverity;
  message: string;
  topItems: QaGateItemInput[];
}

export interface QaSummary {
  checkCount: number;
  hardFailCount: number;
  hardWarnCount: number;
  advisoryFailCount: number;
  advisoryWarnCount: number;
}

export interface QaReport {
  status: QaStatus;
  recommendedExitCode: 0 | 1;
  options: QaRunOptions;
  summary: QaSummary;
  checks: QaCheck[];
  artifactPaths: readonly string[];
}

const statusFromGateSummary = (summary: QaGateSummaryInput): QaStatus => {
  if (summary.credible === false || summary.failCount > 0 || summary.status === "fail") return "fail";
  if (summary.warnCount > 0 || summary.status === "warn") return "warn";
  return "pass";
};

const smokeCheckStatus = (smoke: QaSmokeInput): QaStatus => {
  if (
    smoke.invalidRosterCount > 0 ||
    (smoke.batch?.invalidRosterCount ?? 0) > 0 ||
    smoke.firstTwoRoundSummary.pickCount <= 0
  ) {
    return "fail";
  }
  if (smoke.warnings.length > 0) return "warn";
  return "pass";
};

const topGateItems = (items: readonly QaGateItemInput[]): QaGateItemInput[] =>
  items
    .filter(item => item.status !== "pass")
    .sort((left, right) => {
      const statusRank = { fail: 0, warn: 1, pass: 2 } satisfies Record<QaStatus, number>;
      return statusRank[left.status] - statusRank[right.status] ||
        left.key.localeCompare(right.key);
    })
    .slice(0, 5);

const smokeCheck = (smoke: QaSmokeInput): QaCheck => {
  const status = smokeCheckStatus(smoke);
  return {
    key: "smoke",
    label: "Mock smoke",
    status,
    severity: "hard",
    message: status === "pass"
      ? "Smoke mock produced valid rosters and early-round picks."
      : smoke.warnings.join(" ") || "Smoke mock failed roster or early-round checks.",
    topItems: [],
  };
};

const calibrationCheck = (calibration: QaCalibrationInput): QaCheck => {
  const status = statusFromGateSummary(calibration.gates.summary);
  return {
    key: "calibration",
    label: "Historical calibration",
    status,
    severity: "hard",
    message: `${calibration.gates.summary.passCount}/${calibration.gates.summary.gateCount} calibration gates passed.`,
    topItems: topGateItems(calibration.gates.items),
  };
};

const backtestCheck = (backtest: QaBacktestInput): QaCheck => {
  const status = statusFromGateSummary(backtest.summary);
  return {
    key: "backtest",
    label: "Historical backtest",
    status,
    severity: "hard",
    message: `${backtest.summary.passCount}/${backtest.summary.gateCount} backtest gates passed.`,
    topItems: [],
  };
};

const evidenceCoverageCheck = (coverage: QaEvidenceCoverageInput): QaCheck => ({
  key: "evidence-coverage",
  label: "Evidence coverage",
  status: coverage.summary.status,
  severity: "advisory",
  message: `${coverage.summary.missingEvidenceCount} player(s) still missing evidence; ${coverage.summary.highPriorityMissingCount} high-priority missing.`,
  topItems: [],
});

const summarizeChecks = (checks: readonly QaCheck[]): QaSummary => ({
  checkCount: checks.length,
  hardFailCount: checks.filter(check => check.severity === "hard" && check.status === "fail").length,
  hardWarnCount: checks.filter(check => check.severity === "hard" && check.status === "warn").length,
  advisoryFailCount: checks.filter(check => check.severity === "advisory" && check.status === "fail").length,
  advisoryWarnCount: checks.filter(check => check.severity === "advisory" && check.status === "warn").length,
});

const overallStatus = (summary: QaSummary): QaStatus => {
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

export const buildQaReport = ({
  options,
  smoke,
  calibration,
  backtest,
  evidenceCoverage,
  artifactPaths = [],
}: BuildQaReportOptions): QaReport => {
  const checks = [
    smokeCheck(smoke),
    calibrationCheck(calibration),
    backtestCheck(backtest),
    ...(evidenceCoverage ? [evidenceCoverageCheck(evidenceCoverage)] : []),
  ];
  const summary = summarizeChecks(checks);
  const status = overallStatus(summary);

  return {
    status,
    recommendedExitCode: summary.hardFailCount > 0 ? 1 : 0,
    options,
    summary,
    checks,
    artifactPaths,
  };
};
