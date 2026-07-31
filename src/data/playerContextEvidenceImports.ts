import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import {
  factualPlayerContextCategories,
  type FactualPlayerContextCategory,
  type PlayerContextEvidence,
  type PlayerContextNotes,
  type PlayerContextOverride,
  type PlayerContextSignals,
} from "../../config/playerContext.js";
import { normalizePlayerName } from "./normalizePlayerName.js";
import { parseCsvRecords, type CsvRow } from "./playerContextImports.js";

const evidenceCategorySet = new Set<string>(factualPlayerContextCategories);
const maxEvidenceSignal = 2;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const isEvidenceCategory = (value: string): value is FactualPlayerContextCategory =>
  evidenceCategorySet.has(value);

const numberValue = (rawValue: string | undefined, field: string, player: string): number => {
  if (rawValue === undefined || rawValue === "") {
    throw new Error(`Player evidence rows for ${player} must include ${field}.`);
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid ${field} for ${player}: "${rawValue}".`);
  }

  return value;
};

const confidenceValue = (rawValue: string | undefined, player: string): number => {
  if (rawValue === undefined || rawValue === "") return 1;

  const value = numberValue(rawValue, "confidence", player);
  if (value < 0 || value > 1) {
    throw new Error(`Player evidence confidence for ${player} must be between 0 and 1.`);
  }

  return value;
};

const optionalStringValue = (
  row: CsvRow,
  field: string,
  fallbackField?: string,
): string | undefined => {
  const value = row[field]?.trim() || (fallbackField ? row[fallbackField]?.trim() : "");
  return value || undefined;
};

const evidenceForRow = (row: CsvRow): PlayerContextEvidence => {
  const player = row.player?.trim();
  if (!player) throw new Error("Player evidence CSV rows must include a player value.");

  const category = row.category?.trim();
  if (!category || !isEvidenceCategory(category)) {
    throw new Error(`Invalid player evidence category for ${player}: "${category ?? ""}".`);
  }

  const score = numberValue(row.score, "score", player);
  const confidence = confidenceValue(row.confidence, player);
  const source = row.source?.trim();
  const note = row.note?.trim();
  const provider = optionalStringValue(row, "provider");
  const sourceDate = optionalStringValue(row, "source_date", "sourceDate");
  const sourceQuality = optionalStringValue(row, "source_quality", "sourceQuality");

  return {
    player,
    category,
    score,
    confidence,
    adjustedSignal: score * confidence,
    ...(source ? { source } : {}),
    ...(note ? { note } : {}),
    ...(provider ? { provider } : {}),
    ...(sourceDate ? { sourceDate } : {}),
    ...(sourceQuality ? { sourceQuality } : {}),
  };
};

export const parsePlayerContextEvidenceCsv = (content: string): PlayerContextEvidence[] =>
  parseCsvRecords(content).map(evidenceForRow);

export const playerContextEvidenceOverrides = (
  evidenceRows: readonly PlayerContextEvidence[],
): PlayerContextOverride[] => {
  const byName = new Map<string, {
    player: string;
    signals: PlayerContextSignals;
    notes: PlayerContextNotes;
    evidence: PlayerContextEvidence[];
  }>();

  for (const evidence of evidenceRows) {
    const key = normalizePlayerName(evidence.player);
    const existing = byName.get(key) ?? {
      player: evidence.player,
      signals: {},
      notes: {},
      evidence: [],
    };
    const currentSignal = existing.signals[evidence.category] ?? 0;
    existing.signals[evidence.category] = clamp(
      currentSignal + evidence.adjustedSignal,
      -maxEvidenceSignal,
      maxEvidenceSignal,
    );

    const note = [evidence.source, evidence.note].filter(Boolean).join(": ");
    if (note) {
      existing.notes[evidence.category] = existing.notes[evidence.category]
        ? `${existing.notes[evidence.category]} | ${note}`
        : note;
    }
    existing.evidence.push(evidence);
    byName.set(key, existing);
  }

  return [...byName.values()].map(({ player, signals, notes, evidence }) => ({
    player,
    signals,
    ...(Object.keys(notes).length > 0 ? { notes } : {}),
    evidence,
  }));
};

export const loadPlayerContextEvidenceOverrides = async (path: string): Promise<PlayerContextOverride[]> => {
  const content = await readFile(path, "utf8");
  const extension = extname(path).toLowerCase();

  if (extension !== ".csv") {
    throw new Error(`Unsupported player evidence file extension "${extension}". Use .csv.`);
  }

  return playerContextEvidenceOverrides(parsePlayerContextEvidenceCsv(content));
};
