import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import {
  factualPlayerContextCategories,
  type FactualPlayerContextCategory,
  type PlayerContextEvidence,
} from "../../config/playerContext.js";
import { parseCsvRecords, type CsvRow } from "./playerContextImports.js";

export type PlayerEvidenceSourceAdapterKey = "scored-local";

export interface LoadPlayerEvidenceSourceRowsOptions {
  path: string;
  adapter?: PlayerEvidenceSourceAdapterKey;
}

type EvidenceJsonValue = {
  evidence?: unknown[];
};

type CsvValue = string | number | boolean | undefined;

const evidenceCategorySet = new Set<string>(factualPlayerContextCategories);

const isEvidenceCategory = (value: string): value is FactualPlayerContextCategory =>
  evidenceCategorySet.has(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringField = (
  value: unknown,
  field: string,
  player = "evidence row",
): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Player evidence rows for ${player} must include ${field}.`);
  }

  return value.trim();
};

const numberField = (
  value: unknown,
  field: string,
  player: string,
): number => {
  if (value === undefined || value === "") {
    throw new Error(`Player evidence rows for ${player} must include ${field}.`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${field} for ${player}: "${String(value)}".`);
  }

  return parsed;
};

const confidenceField = (
  value: unknown,
  player: string,
): number => {
  if (value === undefined || value === "") return 1;

  const confidence = numberField(value, "confidence", player);
  if (confidence < 0 || confidence > 1) {
    throw new Error(`Player evidence confidence for ${player} must be between 0 and 1.`);
  }

  return confidence;
};

const evidenceForRecord = (
  value: Record<string, unknown>,
): PlayerContextEvidence => {
  const player = stringField(value.player, "player");
  const category = stringField(value.category, "category", player);
  if (!isEvidenceCategory(category)) {
    throw new Error(`Invalid player evidence category for ${player}: "${category}".`);
  }

  const score = numberField(value.score, "score", player);
  if (score < -2 || score > 2) {
    throw new Error(`Player evidence score for ${player} must be between -2 and 2.`);
  }

  const confidence = confidenceField(value.confidence, player);
  const source = stringField(value.source, "source", player);
  const note = stringField(value.note, "note", player);

  return {
    player,
    category,
    score,
    confidence,
    adjustedSignal: score * confidence,
    source,
    note,
  };
};

const evidenceForCsvRow = (row: CsvRow): PlayerContextEvidence =>
  evidenceForRecord(row);

const evidenceValuesFromJson = (parsed: unknown): unknown[] => {
  if (Array.isArray(parsed)) return parsed;
  if (isRecord(parsed) && Array.isArray((parsed as EvidenceJsonValue).evidence)) {
    return (parsed as EvidenceJsonValue).evidence ?? [];
  }

  throw new Error("Player evidence JSON must be an evidence array or an object with an evidence array.");
};

const parseScoredLocalJson = (content: string): PlayerContextEvidence[] =>
  evidenceValuesFromJson(JSON.parse(content) as unknown).map(value => {
    if (!isRecord(value)) throw new Error("Player evidence JSON rows must be objects.");
    return evidenceForRecord(value);
  });

const parseScoredLocalCsv = (content: string): PlayerContextEvidence[] =>
  parseCsvRecords(content).map(evidenceForCsvRow);

export const loadPlayerEvidenceSourceRows = async ({
  path,
  adapter = "scored-local",
}: LoadPlayerEvidenceSourceRowsOptions): Promise<PlayerContextEvidence[]> => {
  if (adapter !== "scored-local") throw new Error(`Unsupported player evidence source adapter "${adapter}".`);

  const content = await readFile(path, "utf8");
  const extension = extname(path).toLowerCase();
  if (extension === ".csv") return parseScoredLocalCsv(content);
  if (extension === ".json") return parseScoredLocalJson(content);

  throw new Error(`Unsupported player evidence source file extension "${extension}". Use .csv or .json.`);
};

const csvCell = (value: CsvValue): string => {
  const text = value === undefined ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

export const playerContextEvidenceCsv = (
  rows: readonly PlayerContextEvidence[],
): string =>
  [
    "player,category,score,confidence,source,note",
    ...rows.map(row => [
      row.player,
      row.category,
      row.score,
      row.confidence,
      row.source,
      row.note,
    ].map(csvCell).join(",")),
  ].join("\n");
