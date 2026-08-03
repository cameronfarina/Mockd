import { type Owner } from "../../config/league.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";

export interface MockDraftScriptTargetMaxBid {
  owner: Owner;
  player: string;
  maxBid: number;
}

export interface MockDraftScript {
  raw: string;
  label: string;
  targetMaxBids: MockDraftScriptTargetMaxBid[];
  runsPerScenario?: number;
}

const defaultOwner: Owner = "Cam";

const cleanPlayerName = (value: string): string =>
  value
    .replace(/,?\s*\bwhere\s+i(?:'m|m| am)?\s*$/i, "")
    .replace(/\bwhere\s+i(?:'m| am)?\s*$/i, "")
    .replace(/\bwhere\s*$/i, "")
    .replace(/\bi(?:'m|m| am)?\s*$/i, "")
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "")
    .trim()
    .replace(/\s+/g, " ");

const normalizedScriptText = (raw: string): string =>
  raw.replace(/[’‘]/g, "'");

const runsPerScenarioFrom = (raw: string): number | undefined => {
  const match = /\b(?:run|running)\s+(\d+)\s+mocks?\b/i.exec(raw) ??
    /^\s*(\d+)\s+mocks?\b/i.exec(raw);
  if (!match) return undefined;

  const count = Number(match[1]);
  return Number.isInteger(count) && count > 0 ? count : undefined;
};

const capMatchFor = (raw: string): RegExpExecArray | undefined =>
  /(?:where\s+)?(?:i(?:'m|m| am)?\s*)?(?:not\s+willing\s+to\s+pay\s+over|not\s+paying\s+over|not\s+over|no\s+more\s+than|up\s+to|max(?:imum)?|cap(?:ped)?(?:\s+at)?|under|<=)\s*\$?(\d+)\b/i.exec(raw) ??
  /:\s*\$?(\d+)\s*$/i.exec(raw) ??
  undefined;

const targetNameFrom = (rawBeforeCap: string): string => {
  const withoutRunPrefix = rawBeforeCap
    .replace(/\b(?:run|running)\s+\d+\s+mocks?\s+(?:where\s+)?/i, "")
    .trim();
  const targetMatch = /\b(?:target(?:ing)?|try\s+for|chase|get)\s+(.+)$/i.exec(withoutRunPrefix);
  return cleanPlayerName(targetMatch?.[1] ?? withoutRunPrefix);
};

const parseTarget = (raw: string): MockDraftScriptTargetMaxBid | undefined => {
  const match = capMatchFor(raw);
  if (!match?.[1] || match.index === undefined) return undefined;

  const player = targetNameFrom(raw.slice(0, match.index));
  const maxBid = Number(match[1]);
  if (!player || !Number.isInteger(maxBid) || maxBid < 1) return undefined;

  return { owner: defaultOwner, player, maxBid };
};

const scriptParts = (raw: string): string[] =>
  raw
    .split(/[\n;]+/)
    .map(part => part.trim())
    .filter(Boolean);

const scriptLabelFor = (targets: readonly MockDraftScriptTargetMaxBid[]): string =>
  targets
    .map(target => `Target ${target.player} up to $${target.maxBid}`)
    .join(" / ");

const scriptPlayerSearchKey = (value: string): string =>
  normalizePlayerName(value).toLowerCase();

const canonicalPlayerNameFor = (
  player: string,
  playerNames: readonly string[],
): string => {
  const searchKey = scriptPlayerSearchKey(player);
  const exactMatch = playerNames.find(candidate => scriptPlayerSearchKey(candidate) === searchKey);
  if (exactMatch) return normalizePlayerName(exactMatch);

  const partialMatch = playerNames.find(candidate => scriptPlayerSearchKey(candidate).includes(searchKey));
  return normalizePlayerName(partialMatch ?? player);
};

export const canonicalizeMockDraftScript = (
  script: MockDraftScript,
  playerNames: readonly string[],
): MockDraftScript => {
  const targetMaxBids = script.targetMaxBids.map(target => ({
    ...target,
    player: canonicalPlayerNameFor(target.player, playerNames),
  }));

  return {
    ...script,
    label: scriptLabelFor(targetMaxBids),
    targetMaxBids,
  };
};

export const parseMockDraftScript = (
  rawValue: string,
): MockDraftScript | undefined => {
  const raw = normalizedScriptText(rawValue).trim();
  if (!raw) return undefined;

  const targetMaxBids = scriptParts(raw)
    .map(parseTarget)
    .filter((target): target is MockDraftScriptTargetMaxBid => target !== undefined);
  if (targetMaxBids.length === 0) {
    throw new Error("Mock script must include a target, like \"target Jadarian Price max 20\".");
  }

  const runsPerScenario = runsPerScenarioFrom(raw);
  return {
    raw,
    label: scriptLabelFor(targetMaxBids),
    targetMaxBids,
    ...(runsPerScenario === undefined ? {} : { runsPerScenario }),
  };
};
