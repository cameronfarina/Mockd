import type {
  PlayerEvidenceQueue,
  PlayerEvidenceQueuePriority,
  PlayerEvidenceQueueRow,
} from "./playerEvidenceQueue.js";

export type EvidenceCoverageStatus = "pass" | "warn" | "fail";

export interface EvidenceCoverageGate {
  key: string;
  label: string;
  status: EvidenceCoverageStatus;
  target: number;
  actual: number;
  delta: number;
  warnThreshold: number;
  failThreshold: number;
}

export interface MissingEvidencePlayer {
  priority: PlayerEvidenceQueuePriority;
  rank: number;
  player: string;
  position: string;
  scenarioPrice: number;
  categories: PlayerEvidenceQueueRow["categories"];
}

export interface EvidenceCoverageAudit {
  summary: {
    status: EvidenceCoverageStatus;
    playerCount: number;
    coveredPlayerCount: number;
    completeEvidenceCount: number;
    missingEvidenceCount: number;
    partialEvidenceCount: number;
    highPriorityMissingCount: number;
    coverageRate: number;
    completeEvidenceRate: number;
  };
  gates: {
    summary: {
      status: EvidenceCoverageStatus;
      gateCount: number;
      passCount: number;
      warnCount: number;
      failCount: number;
    };
    items: EvidenceCoverageGate[];
  };
  missingPlayers: MissingEvidencePlayer[];
}

type CsvValue = string | number | boolean | undefined;

const defaultMinimumCoverageRate = 0.8;
const defaultFailingCoverageRate = 0.5;
const defaultMinimumCompleteEvidenceRate = 0.6;
const defaultFailingCompleteEvidenceRate = 0.25;

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const rate = (count: number, total: number): number =>
  total === 0 ? 1 : roundToTwo(count / total);

const rateGateStatus = (
  actual: number,
  warnThreshold: number,
  failThreshold: number,
): EvidenceCoverageStatus => {
  if (actual < failThreshold) return "fail";
  if (actual < warnThreshold) return "warn";
  return "pass";
};

const highPriorityMissingGateStatus = (actual: number): EvidenceCoverageStatus =>
  actual > 0 ? "fail" : "pass";

const worstStatus = (
  statuses: readonly EvidenceCoverageStatus[],
): EvidenceCoverageStatus => {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warn")) return "warn";
  return "pass";
};

const gateSummary = (
  items: readonly EvidenceCoverageGate[],
): EvidenceCoverageAudit["gates"]["summary"] => ({
  status: worstStatus(items.map(item => item.status)),
  gateCount: items.length,
  passCount: items.filter(item => item.status === "pass").length,
  warnCount: items.filter(item => item.status === "warn").length,
  failCount: items.filter(item => item.status === "fail").length,
});

const missingPlayerFor = (
  row: PlayerEvidenceQueueRow,
): MissingEvidencePlayer => ({
  priority: row.priority,
  rank: row.rank,
  player: row.player,
  position: row.position,
  scenarioPrice: row.scenarioPrice,
  categories: row.categories,
});

export const buildPlayerEvidenceCoverageAudit = (
  queue: PlayerEvidenceQueue,
): EvidenceCoverageAudit => {
  const playerCount = queue.rows.length;
  const missingRows = queue.rows.filter(row => row.evidenceStatus === "missing");
  const partialEvidenceCount = queue.rows.filter(row => row.evidenceStatus === "partial").length;
  const completeEvidenceCount = queue.rows.filter(row => row.evidenceStatus === "present").length;
  const coveredPlayerCount = partialEvidenceCount + completeEvidenceCount;
  const highPriorityMissingCount = missingRows.filter(row => row.priority === "high").length;
  const coverageRate = rate(coveredPlayerCount, playerCount);
  const completeEvidenceRate = rate(completeEvidenceCount, playerCount);
  const gates: EvidenceCoverageGate[] = [
    {
      key: "high-priority-missing",
      label: "High-priority missing evidence",
      status: highPriorityMissingGateStatus(highPriorityMissingCount),
      target: 0,
      actual: highPriorityMissingCount,
      delta: highPriorityMissingCount,
      warnThreshold: 1,
      failThreshold: 1,
    },
    {
      key: "evidence-coverage-rate",
      label: "Evidence coverage rate",
      status: rateGateStatus(
        coverageRate,
        defaultMinimumCoverageRate,
        defaultFailingCoverageRate,
      ),
      target: defaultMinimumCoverageRate,
      actual: coverageRate,
      delta: roundToTwo(coverageRate - defaultMinimumCoverageRate),
      warnThreshold: defaultMinimumCoverageRate,
      failThreshold: defaultFailingCoverageRate,
    },
    {
      key: "complete-evidence-rate",
      label: "Complete evidence rate",
      status: rateGateStatus(
        completeEvidenceRate,
        defaultMinimumCompleteEvidenceRate,
        defaultFailingCompleteEvidenceRate,
      ),
      target: defaultMinimumCompleteEvidenceRate,
      actual: completeEvidenceRate,
      delta: roundToTwo(completeEvidenceRate - defaultMinimumCompleteEvidenceRate),
      warnThreshold: defaultMinimumCompleteEvidenceRate,
      failThreshold: defaultFailingCompleteEvidenceRate,
    },
  ];
  const summary = gateSummary(gates);

  return {
    summary: {
      status: summary.status,
      playerCount,
      coveredPlayerCount,
      completeEvidenceCount,
      missingEvidenceCount: missingRows.length,
      partialEvidenceCount,
      highPriorityMissingCount,
      coverageRate,
      completeEvidenceRate,
    },
    gates: {
      summary,
      items: gates,
    },
    missingPlayers: missingRows.map(missingPlayerFor),
  };
};

const csvCell = (value: CsvValue): string => {
  const text = value === undefined ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

export const playerEvidenceCoverageGatesCsv = (
  audit: EvidenceCoverageAudit,
): string =>
  [
    [
      "key",
      "label",
      "status",
      "target",
      "actual",
      "delta",
      "warn_threshold",
      "fail_threshold",
    ].map(csvCell).join(","),
    ...audit.gates.items.map(gate => [
      gate.key,
      gate.label,
      gate.status,
      gate.target,
      gate.actual,
      gate.delta,
      gate.warnThreshold,
      gate.failThreshold,
    ].map(csvCell).join(",")),
  ].join("\n");
