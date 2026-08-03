import { keepers as defaultKeepers, type KeeperDeclaration } from "../../config/keepers.js";
import { leagueConfig, ownerOrder, type Owner, type Position } from "../../config/league.js";
import { nflTeamByEspnProTeamId } from "../../config/nflTeams.js";
import { cleanPlayerName, normalizePlayerName } from "../data/normalizePlayerName.js";
import type { HistoricalAuctionRecord } from "../data/parseHistoricalBoards.js";
import type { ProjectionRecord } from "../projections.js";
import type { Player } from "../types.js";
import {
  buildInitialRostersFromKeepers,
  type InitialRostersByOwner,
} from "./auctionEngine.js";
import {
  buildBasePrices,
  defaultPricingConfig,
  type PricingConfig,
} from "./basePricing.js";
import {
  applyKeeperScenarioToPrices,
  buildKeeperScenarios,
  type KeeperScenario,
  type KeeperScenarioKey,
  type ScenarioAdjustedPrice,
} from "./keeperInflation.js";
import { buildProjectionRankings, type ProjectionRanking } from "./projectionRankings.js";

export type LiveDraftPlayerSource = "pricedPool" | "projectionFallback";

export interface ParsedLiveDraftSaleCommand {
  ownerText: string;
  playerText: string;
  price: number;
}

export interface LiveDraftEvent {
  input: string;
  owner: Owner;
  player: string;
  normalizedPlayerName: string;
  position: Position;
  price: number;
  expectedPrice: number;
  saleVsExpected: number;
  playerSource: LiveDraftPlayerSource;
}

export interface LiveDraftCommandError {
  input: string;
  message: string;
}

export interface LiveDraftRosterPlayer {
  name: string;
  position: Position;
  price: number;
  expectedPrice: number;
  source: "keeper" | LiveDraftPlayerSource;
  teamAbbreviation?: string;
  byeWeek?: number;
}

export type LiveDraftRosterSlotKey =
  | "QB"
  | "RB1"
  | "RB2"
  | "WR1"
  | "WR2"
  | "TE"
  | "FLEX"
  | "K"
  | "DST"
  | "BENCH1"
  | "BENCH2"
  | "BENCH3"
  | "BENCH4"
  | "BENCH5"
  | "BENCH6"
  | "BENCH7";

export interface LiveDraftRosterSlot {
  slot: LiveDraftRosterSlotKey;
  player?: LiveDraftRosterPlayer;
}

export interface LiveDraftOwnerState {
  owner: Owner;
  roster: LiveDraftRosterPlayer[];
  slots: LiveDraftRosterSlot[];
  spent: number;
  budgetRemaining: number;
  rosterSlotsRemaining: number;
  maxBid: number;
  positionCounts: Record<Position, number>;
}

export interface LiveDraftRoomState {
  scenarioKey: KeeperScenarioKey;
  totalBudget: number;
  initialKeeperSpend: number;
  actualAuctionSpend: number;
  expectedAuctionSpend: number;
  saleVsExpected: number;
  remainingBudget: number;
  remainingRosterSlots: number;
  remainingExpectedSpend: number;
  liveInflationFactor: number;
}

export interface LiveDraftTarget {
  name: string;
  position: Position;
  teamAbbreviation?: string;
  byeWeek?: number;
  expectedPrice: number;
  liveExpectedPrice: number;
  personalValue: number;
  recommendedMaxBid: number;
  valueScore: number;
  weeks1To4: number;
  projectionRank?: number;
  espnRank?: number;
  source: LiveDraftPlayerSource;
  tags: string[];
}

export interface LiveDraftState {
  scenario: KeeperScenario;
  room: LiveDraftRoomState;
  watchOwner: LiveDraftOwnerState;
  owners: LiveDraftOwnerState[];
  events: LiveDraftEvent[];
  errors: LiveDraftCommandError[];
  availableTargets: LiveDraftTarget[];
}

export interface BuildLiveDraftStateOptions {
  projections: readonly ProjectionRecord[];
  historicalRecords: readonly HistoricalAuctionRecord[];
  keepers?: readonly KeeperDeclaration[];
  scenarioKey?: KeeperScenarioKey;
  watchOwner?: Owner;
  commands?: readonly string[];
  pricingConfig?: PricingConfig;
  targetLimit?: number;
}

interface LiveDraftPlayerRecord {
  name: string;
  normalizedName: string;
  position: Position;
  expectedPrice: number;
  week1: number;
  weeks1To4: number;
  source: LiveDraftPlayerSource;
  teamAbbreviation?: string;
  byeWeek?: number;
  projectionRank?: number;
  espnRank?: number;
}

interface ResolvedSale {
  owner: Owner;
  player: LiveDraftPlayerRecord;
  parsed: ParsedLiveDraftSaleCommand;
}

const defaultScenarioKey: KeeperScenarioKey = "expected";
const defaultWatchOwner: Owner = "Cam";
const defaultTargetLimit = 80;
const compactWordPattern = /[^a-z0-9]+/g;
const lineupSlotKeys = [
  "QB",
  "RB1",
  "RB2",
  "WR1",
  "WR2",
  "TE",
  "FLEX",
  "K",
  "DST",
  "BENCH1",
  "BENCH2",
  "BENCH3",
  "BENCH4",
  "BENCH5",
  "BENCH6",
  "BENCH7",
] as const satisfies readonly LiveDraftRosterSlotKey[];
const flexEligiblePositions = ["RB", "WR", "TE"] as const satisfies readonly Position[];

const emptyPositionCounts = (): Record<Position, number> => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const roundPrice = (value: number): number =>
  Math.max(1, Math.round(value));

const teamMetadataFor = (
  proTeamId: number | undefined,
): { teamAbbreviation?: string; byeWeek?: number } => {
  const metadata = proTeamId === undefined ? undefined : nflTeamByEspnProTeamId[proTeamId];
  return metadata ? { teamAbbreviation: metadata.abbreviation, byeWeek: metadata.byeWeek } : {};
};

const searchKeyFor = (value: string): string =>
  normalizePlayerName(cleanPlayerName(value))
    .toLowerCase()
    .replace(compactWordPattern, " ")
    .trim();

const lastSearchToken = (value: string): string | undefined =>
  searchKeyFor(value).split(" ").filter(Boolean).at(-1);

const countPositions = (players: readonly LiveDraftRosterPlayer[]): Record<Position, number> => {
  const counts = emptyPositionCounts();
  for (const player of players) counts[player.position] += 1;
  return counts;
};

const maxBidFor = (budgetRemaining: number, rosterSlotsRemaining: number): number => {
  if (rosterSlotsRemaining <= 0) return 0;
  return Math.max(0, budgetRemaining - Math.max(0, rosterSlotsRemaining - 1));
};

export const parseLiveDraftSaleCommand = (input: string): ParsedLiveDraftSaleCommand => {
  const cleaned = input.trim().replace(/\s+/g, " ");
  const salePattern = /^(\S+)\s+(?:drafted|bought|won|got|took)\s+(.+?)\s+(?:for|at|@)\s+\$?(\d+)$/i;
  const compactPattern = /^(\S+)\s+(.+?)\s+\$?(\d+)$/i;
  const match = cleaned.match(salePattern) ?? cleaned.match(compactPattern);

  if (!match) {
    throw new Error(`Could not parse live draft sale command: "${input}".`);
  }

  const [, ownerText = "", playerText = "", priceText = ""] = match;
  const price = Number(priceText);
  if (!Number.isInteger(price) || price <= 0) {
    throw new Error(`Sale price must be a positive whole dollar amount: "${input}".`);
  }

  return {
    ownerText,
    playerText: cleanPlayerName(playerText),
    price,
  };
};

const ownerForText = (ownerText: string): Owner => {
  const key = ownerText.toLowerCase();
  const owner = ownerOrder.find(candidate => candidate.toLowerCase() === key);
  if (!owner) throw new Error(`Unknown owner "${ownerText}". Use one of: ${ownerOrder.join(", ")}.`);
  return owner;
};

const projectionPriceFor = (projection: ProjectionRanking, scenario: KeeperScenario): number => {
  const publicAnchor = projection.espnAuctionValue ?? 0;
  const scenarioFactor = scenario.positionFactors[projection.position];
  return roundPrice(Math.max(publicAnchor, 1) * scenarioFactor);
};

const liveRecordFromPrice = (price: ScenarioAdjustedPrice): LiveDraftPlayerRecord => ({
  name: price.name,
  normalizedName: price.normalizedName,
  position: price.position,
  expectedPrice: price.scenarioPrice,
  week1: price.weeks[1] ?? 0,
  weeks1To4: price.weeks1To4,
  source: "pricedPool",
  ...teamMetadataFor(price.proTeamId),
  projectionRank: price.projectionRank,
  ...(price.espnRank === undefined ? {} : { espnRank: price.espnRank }),
});

const liveRecordFromProjection = (
  projection: ProjectionRanking,
  scenario: KeeperScenario,
): LiveDraftPlayerRecord => ({
  name: projection.name,
  normalizedName: projection.normalizedName,
  position: projection.position,
  expectedPrice: projectionPriceFor(projection, scenario),
  week1: projection.weeks[1] ?? 0,
  weeks1To4: projection.weeks1To4,
  source: "projectionFallback",
  ...teamMetadataFor(projection.proTeamId),
  projectionRank: projection.projectionRank,
  ...(projection.espnRank === undefined ? {} : { espnRank: projection.espnRank }),
});

const buildLivePlayerUniverse = ({
  projections,
  prices,
  scenario,
  unavailableKeeperNames,
}: {
  projections: readonly ProjectionRecord[];
  prices: readonly ScenarioAdjustedPrice[];
  scenario: KeeperScenario;
  unavailableKeeperNames: ReadonlySet<string>;
}): LiveDraftPlayerRecord[] => {
  const recordsByName = new Map<string, LiveDraftPlayerRecord>();

  for (const price of prices) {
    recordsByName.set(price.normalizedName, liveRecordFromPrice(price));
  }

  for (const projection of buildProjectionRankings(projections)) {
    if (recordsByName.has(projection.normalizedName)) continue;
    if (unavailableKeeperNames.has(projection.normalizedName)) continue;
    recordsByName.set(projection.normalizedName, liveRecordFromProjection(projection, scenario));
  }

  return [...recordsByName.values()];
};

const playerMatchScore = (record: LiveDraftPlayerRecord, playerText: string): number => {
  const query = searchKeyFor(playerText);
  const name = searchKeyFor(record.name);
  const lastToken = lastSearchToken(record.name);
  const tokens = name.split(" ");

  if (!query) return 0;
  if (name === query) return 100;
  if (lastToken === query) return 90;
  if (tokens.some(token => token === query)) return 80;
  if (name.includes(query)) return 60;
  return 0;
};

const resolvePlayer = (
  playerText: string,
  records: readonly LiveDraftPlayerRecord[],
): LiveDraftPlayerRecord => {
  const matches = records
    .map(record => ({ record, score: playerMatchScore(record, playerText) }))
    .filter(match => match.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.record.expectedPrice - left.record.expectedPrice ||
        right.record.weeks1To4 - left.record.weeks1To4 ||
        left.record.name.localeCompare(right.record.name),
    );
  const best = matches[0];

  if (!best) throw new Error(`Unknown player "${playerText}".`);

  const tiedMatches = matches.filter(match => match.score === best.score);
  if (tiedMatches.length > 1) {
    throw new Error(
      `Ambiguous player "${playerText}". Matches: ${tiedMatches.slice(0, 6).map(match => match.record.name).join(", ")}.`,
    );
  }

  return best.record;
};

const resolveSale = (
  input: string,
  records: readonly LiveDraftPlayerRecord[],
): ResolvedSale => {
  const parsed = parseLiveDraftSaleCommand(input);
  return {
    parsed,
    owner: ownerForText(parsed.ownerText),
    player: resolvePlayer(parsed.playerText, records),
  };
};

const playerForRoster = (
  player: Player,
  source: LiveDraftRosterPlayer["source"],
  expectedPrice = player.price,
): LiveDraftRosterPlayer => ({
  name: player.name,
  position: player.position,
  price: player.price,
  expectedPrice,
  source,
  ...teamMetadataFor(player.proTeamId),
});

const livePlayerForRoster = (
  record: LiveDraftPlayerRecord,
  price: number,
): LiveDraftRosterPlayer => ({
  name: record.name,
  position: record.position,
  price,
  expectedPrice: record.expectedPrice,
  source: record.source,
  ...(record.teamAbbreviation === undefined ? {} : { teamAbbreviation: record.teamAbbreviation }),
  ...(record.byeWeek === undefined ? {} : { byeWeek: record.byeWeek }),
});

const rostersFromKeepers = (
  initialRostersByOwner: InitialRostersByOwner,
): Map<Owner, LiveDraftRosterPlayer[]> =>
  new Map(ownerOrder.map(owner => [
    owner,
    [...(initialRostersByOwner[owner] ?? [])].map(player => playerForRoster(player, "keeper")),
  ]));

const sortRosterPlayers = (players: readonly LiveDraftRosterPlayer[]): LiveDraftRosterPlayer[] =>
  [...players].sort(
    (left, right) =>
      right.price - left.price ||
      right.expectedPrice - left.expectedPrice ||
      left.name.localeCompare(right.name),
  );

const emptyRosterSlots = (): LiveDraftRosterSlot[] =>
  lineupSlotKeys.map(slot => ({ slot }));

const slotIndexByKey = (slots: readonly LiveDraftRosterSlot[]): Map<LiveDraftRosterSlotKey, number> =>
  new Map(slots.map((slot, index) => [slot.slot, index]));

const placeInSlot = (
  slots: LiveDraftRosterSlot[],
  indexes: ReadonlyMap<LiveDraftRosterSlotKey, number>,
  slot: LiveDraftRosterSlotKey,
  player: LiveDraftRosterPlayer | undefined,
): void => {
  if (!player) return;

  const index = indexes.get(slot);
  if (index === undefined) return;
  slots[index] = { slot, player };
};

const firstEmptyBenchSlot = (slots: readonly LiveDraftRosterSlot[]): LiveDraftRosterSlotKey | undefined =>
  slots.find(slot => slot.slot.startsWith("BENCH") && !slot.player)?.slot;

const isFlexEligible = (position: Position): boolean =>
  flexEligiblePositions.some(flexPosition => flexPosition === position);

const rosterSlotsFor = (roster: readonly LiveDraftRosterPlayer[]): LiveDraftRosterSlot[] => {
  const slots = emptyRosterSlots();
  const indexes = slotIndexByKey(slots);
  const usedPlayers = new Set<LiveDraftRosterPlayer>();
  const sortedByPosition = (position: Position): LiveDraftRosterPlayer[] =>
    sortRosterPlayers(roster.filter(player => player.position === position));

  const qbs = sortedByPosition("QB");
  const rbs = sortedByPosition("RB");
  const wrs = sortedByPosition("WR");
  const tes = sortedByPosition("TE");
  const kickers = sortedByPosition("K");
  const defenses = sortedByPosition("DST");
  const primaryAssignments: [LiveDraftRosterSlotKey, LiveDraftRosterPlayer | undefined][] = [
    ["QB", qbs[0]],
    ["RB1", rbs[0]],
    ["RB2", rbs[1]],
    ["WR1", wrs[0]],
    ["WR2", wrs[1]],
    ["TE", tes[0]],
    ["K", kickers[0]],
    ["DST", defenses[0]],
  ];

  for (const [slot, player] of primaryAssignments) {
    placeInSlot(slots, indexes, slot, player);
    if (player) usedPlayers.add(player);
  }

  const flex = sortRosterPlayers(
    roster.filter(player => isFlexEligible(player.position) && !usedPlayers.has(player)),
  )[0];
  placeInSlot(slots, indexes, "FLEX", flex);
  if (flex) usedPlayers.add(flex);

  for (const player of sortRosterPlayers(roster.filter(candidate => !usedPlayers.has(candidate)))) {
    const benchSlot = firstEmptyBenchSlot(slots);
    if (!benchSlot) break;
    placeInSlot(slots, indexes, benchSlot, player);
  }

  return slots;
};

const ownerStateFor = (
  owner: Owner,
  roster: readonly LiveDraftRosterPlayer[],
): LiveDraftOwnerState => {
  const spent = roster.reduce((total, player) => total + player.price, 0);
  const rosterSlotsRemaining = leagueConfig.rosterSize - roster.length;
  const budgetRemaining = leagueConfig.auctionBudget - spent;

  return {
    owner,
    roster: [...roster],
    slots: rosterSlotsFor(roster),
    spent,
    budgetRemaining,
    rosterSlotsRemaining,
    maxBid: maxBidFor(budgetRemaining, rosterSlotsRemaining),
    positionCounts: countPositions(roster),
  };
};

const validateSaleFitsOwner = (
  sale: ResolvedSale,
  ownerState: LiveDraftOwnerState,
): void => {
  if (ownerState.rosterSlotsRemaining <= 0) {
    throw new Error(`${sale.owner} has no open roster slots.`);
  }

  if (sale.parsed.price > ownerState.maxBid) {
    throw new Error(`${sale.owner} can only bid up to $${ownerState.maxBid}.`);
  }

  const positionMaximum = leagueConfig.rosterMaximums[sale.player.position];
  if (ownerState.positionCounts[sale.player.position] >= positionMaximum) {
    throw new Error(`${sale.owner} already has the maximum ${sale.player.position} roster count (${positionMaximum}).`);
  }
};

const buildOwnerStates = (
  rostersByOwner: ReadonlyMap<Owner, readonly LiveDraftRosterPlayer[]>,
): LiveDraftOwnerState[] =>
  ownerOrder.map(owner => ownerStateFor(owner, rostersByOwner.get(owner) ?? []));

const totalKeeperSpend = (rostersByOwner: ReadonlyMap<Owner, readonly LiveDraftRosterPlayer[]>): number =>
  [...rostersByOwner.values()].reduce(
    (total, roster) => total + roster
      .filter(player => player.source === "keeper")
      .reduce((rosterTotal, player) => rosterTotal + player.price, 0),
    0,
  );

const draftableExpectedSpend = (
  records: readonly LiveDraftPlayerRecord[],
  soldNames: ReadonlySet<string>,
  remainingRosterSlots: number,
): number =>
  records
    .filter(record => !soldNames.has(record.normalizedName))
    .sort(
      (left, right) =>
        right.expectedPrice - left.expectedPrice ||
        right.weeks1To4 - left.weeks1To4 ||
        left.name.localeCompare(right.name),
    )
    .slice(0, remainingRosterSlots)
    .reduce((total, player) => total + player.expectedPrice, 0);

const buildRoomState = ({
  scenario,
  owners,
  events,
  records,
  soldNames,
  initialKeeperSpend,
}: {
  scenario: KeeperScenario;
  owners: readonly LiveDraftOwnerState[];
  events: readonly LiveDraftEvent[];
  records: readonly LiveDraftPlayerRecord[];
  soldNames: ReadonlySet<string>;
  initialKeeperSpend: number;
}): LiveDraftRoomState => {
  const actualAuctionSpend = events.reduce((total, event) => total + event.price, 0);
  const expectedAuctionSpend = events.reduce((total, event) => total + event.expectedPrice, 0);
  const remainingBudget = owners.reduce((total, owner) => total + owner.budgetRemaining, 0);
  const remainingRosterSlots = owners.reduce((total, owner) => total + owner.rosterSlotsRemaining, 0);
  const remainingExpectedSpend = draftableExpectedSpend(records, soldNames, remainingRosterSlots);

  return {
    scenarioKey: scenario.key,
    totalBudget: leagueConfig.teams * leagueConfig.auctionBudget,
    initialKeeperSpend,
    actualAuctionSpend,
    expectedAuctionSpend,
    saleVsExpected: actualAuctionSpend - expectedAuctionSpend,
    remainingBudget,
    remainingRosterSlots,
    remainingExpectedSpend,
    liveInflationFactor: roundToTwo(remainingBudget / Math.max(1, remainingExpectedSpend)),
  };
};

const targetTagsFor = (
  player: LiveDraftPlayerRecord,
  watchOwner: LiveDraftOwnerState,
): string[] => {
  const tags: string[] = [];
  const counts = watchOwner.positionCounts;

  if (counts[player.position] < leagueConfig.lineup[player.position]) tags.push("starter need");
  if (player.position === "RB" && counts.RB < 3) tags.push("3RB core");
  if ((player.position === "WR" || player.position === "TE") && counts.RB + counts.WR + counts.TE < 5) {
    tags.push("flex need");
  }
  if (player.source === "projectionFallback") tags.push("projection fallback");
  if (player.expectedPrice > watchOwner.maxBid) tags.push("not affordable");

  return tags;
};

const positionNeedMultiplierFor = (
  player: LiveDraftPlayerRecord,
  watchOwner: LiveDraftOwnerState,
): number => {
  const counts = watchOwner.positionCounts;
  let multiplier = 1;

  if (counts[player.position] < leagueConfig.lineup[player.position]) multiplier += 0.75;
  if (player.position === "RB" && counts.RB < 3) multiplier += 0.5;
  if (player.position === "WR" && counts.WR < 3) multiplier += 0.25;
  if (player.position === "TE" && counts.TE < 1) multiplier += 0.2;
  if (player.position === "K" || player.position === "DST") multiplier -= 0.4;

  return multiplier;
};

const personalPremiumFor = (
  player: LiveDraftPlayerRecord,
  watchOwner: LiveDraftOwnerState,
): number => {
  const counts = watchOwner.positionCounts;
  let premium = 0;

  if (counts[player.position] < leagueConfig.lineup[player.position]) premium += 6;
  if (player.position === "RB" && counts.RB < 3) premium += 4;
  if (player.position === "WR" && counts.WR < 3) premium += 3;
  if (player.position === "TE" && counts.TE < 1) premium += 2;
  if (player.position === "K" || player.position === "DST") premium -= 1;

  return premium;
};

const canWatchOwnerRosterPlayer = (
  player: LiveDraftPlayerRecord,
  watchOwner: LiveDraftOwnerState,
): boolean =>
  watchOwner.rosterSlotsRemaining > 0 &&
  watchOwner.positionCounts[player.position] < leagueConfig.rosterMaximums[player.position];

const buildTargets = ({
  records,
  soldNames,
  watchOwner,
  room,
  targetLimit,
}: {
  records: readonly LiveDraftPlayerRecord[];
  soldNames: ReadonlySet<string>;
  watchOwner: LiveDraftOwnerState;
  room: LiveDraftRoomState;
  targetLimit: number;
}): LiveDraftTarget[] =>
  records
    .filter(player => !soldNames.has(player.normalizedName))
    .filter(player => canWatchOwnerRosterPlayer(player, watchOwner))
    .map(player => {
      const liveExpectedPrice = roundPrice(player.expectedPrice * room.liveInflationFactor);
      const needMultiplier = positionNeedMultiplierFor(player, watchOwner);
      const positionCeiling = defaultPricingConfig.hardPriceCeilings[player.position];
      const uncappedPersonalValue = roundPrice(liveExpectedPrice + personalPremiumFor(player, watchOwner));
      const personalValue = Math.min(
        watchOwner.maxBid,
        positionCeiling,
        player.expectedPrice + 12,
        Math.max(1, uncappedPersonalValue),
      );
      const recommendedMaxBid = personalValue;
      const valueScore = roundToTwo((player.weeks1To4 * needMultiplier) - recommendedMaxBid * 0.35);

      return {
        name: player.name,
        position: player.position,
        ...(player.teamAbbreviation === undefined ? {} : { teamAbbreviation: player.teamAbbreviation }),
        ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
        expectedPrice: player.expectedPrice,
        liveExpectedPrice,
        personalValue,
        recommendedMaxBid,
        valueScore,
        weeks1To4: roundToTwo(player.weeks1To4),
        ...(player.projectionRank === undefined ? {} : { projectionRank: player.projectionRank }),
        ...(player.espnRank === undefined ? {} : { espnRank: player.espnRank }),
        source: player.source,
        tags: targetTagsFor(player, watchOwner),
      };
    })
    .sort(
      (left, right) =>
        Number(!right.tags.includes("not affordable")) - Number(!left.tags.includes("not affordable")) ||
        right.valueScore - left.valueScore ||
        right.expectedPrice - left.expectedPrice ||
        left.name.localeCompare(right.name),
    )
    .slice(0, targetLimit);

export const buildLiveDraftState = ({
  projections,
  historicalRecords,
  keepers = defaultKeepers,
  scenarioKey = defaultScenarioKey,
  watchOwner = defaultWatchOwner,
  commands = [],
  pricingConfig = defaultPricingConfig,
  targetLimit = defaultTargetLimit,
}: BuildLiveDraftStateOptions): LiveDraftState => {
  const prices = buildBasePrices(projections, historicalRecords, pricingConfig);
  const scenario = buildKeeperScenarios(keepers).find(candidate => candidate.key === scenarioKey);
  if (!scenario) throw new Error(`Unknown keeper scenario "${scenarioKey}".`);

  const appliedScenario = applyKeeperScenarioToPrices(prices, scenario, keepers);
  const unavailableKeeperNames = new Set(
    appliedScenario.unavailableKeepers.map(keeper => normalizePlayerName(keeper.player)),
  );
  const records = buildLivePlayerUniverse({
    projections,
    prices: appliedScenario.availablePrices,
    scenario,
    unavailableKeeperNames,
  });
  const initialRostersByOwner = buildInitialRostersFromKeepers(
    keepers,
    projections,
    scenario.includedKeeperStatuses,
  );
  const rostersByOwner = rostersFromKeepers(initialRostersByOwner);
  const initialKeeperSpend = totalKeeperSpend(rostersByOwner);
  const soldNames = new Set(unavailableKeeperNames);
  const events: LiveDraftEvent[] = [];
  const errors: LiveDraftCommandError[] = [];

  for (const input of commands) {
    try {
      const sale = resolveSale(input, records);
      if (soldNames.has(sale.player.normalizedName)) {
        throw new Error(`${sale.player.name} is already unavailable.`);
      }

      const roster = rostersByOwner.get(sale.owner) ?? [];
      validateSaleFitsOwner(sale, ownerStateFor(sale.owner, roster));
      roster.push(livePlayerForRoster(sale.player, sale.parsed.price));
      rostersByOwner.set(sale.owner, roster);
      soldNames.add(sale.player.normalizedName);
      events.push({
        input,
        owner: sale.owner,
        player: sale.player.name,
        normalizedPlayerName: sale.player.normalizedName,
        position: sale.player.position,
        price: sale.parsed.price,
        expectedPrice: sale.player.expectedPrice,
        saleVsExpected: sale.parsed.price - sale.player.expectedPrice,
        playerSource: sale.player.source,
      });
    } catch (error) {
      errors.push({
        input,
        message: error instanceof Error ? error.message : "Unknown live draft command error.",
      });
    }
  }

  const owners = buildOwnerStates(rostersByOwner);
  const room = buildRoomState({
    scenario,
    owners,
    events,
    records,
    soldNames,
    initialKeeperSpend,
  });
  const currentWatchOwner = owners.find(owner => owner.owner === watchOwner);
  if (!currentWatchOwner) throw new Error(`Unknown watch owner "${watchOwner}".`);

  return {
    scenario,
    room,
    watchOwner: currentWatchOwner,
    owners,
    events,
    errors,
    availableTargets: buildTargets({
      records,
      soldNames,
      watchOwner: currentWatchOwner,
      room,
      targetLimit,
    }),
  };
};
