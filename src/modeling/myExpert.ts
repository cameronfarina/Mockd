import type { Position } from "../../config/league.js";

export type MyExpertAdviceType = "add-drop" | "bye-coverage" | "injury-watch" | "lineup" | "trade-target";
export type MyExpertPriority = "high" | "medium" | "low";
export type MyExpertRosterRole = "starter" | "bench" | "injured-reserve";
export type MyExpertLineupSlot = Position | "FLEX";

export interface MyExpertLeagueSettings {
  lineup: Partial<Record<Position | "FLEX", number>>;
  rosterMaximums: Partial<Record<Position, number>>;
}

export interface MyExpertPlayerSignals {
  opportunityScore?: number | undefined;
  matchupScore?: number | undefined;
  usageScore?: number | undefined;
  injuryRisk?: number | undefined;
  trendScore?: number | undefined;
  weatherRisk?: number | undefined;
}

export interface MyExpertPlayer {
  id: string;
  name: string;
  position: Position;
  teamAbbreviation?: string | undefined;
  projectedPoints: number;
  rosteredRole?: MyExpertRosterRole | undefined;
  byeWeek?: number | undefined;
  rosteredPercent?: number | undefined;
  signals?: MyExpertPlayerSignals | undefined;
}

export interface MyExpertMatchupSignal {
  playerId: string;
  week: number;
  opponent?: string | undefined;
  score: number;
  label?: string | undefined;
}

export interface MyExpertNewsSignal {
  playerId: string;
  headline: string;
  impact: "positive" | "watch" | "negative";
  severity?: number | undefined;
  sourceDate?: string | undefined;
}

export interface MyExpertTradeCandidate {
  id: string;
  name: string;
  position: Position;
  teamAbbreviation?: string | undefined;
  projectedPoints: number;
  managerNeed?: string | undefined;
  acquisitionCost?: "low" | "fair" | "high" | undefined;
  signals?: MyExpertPlayerSignals | undefined;
}

export interface BuildMyExpertAdviceOptions {
  currentWeek: number;
  leagueSettings: MyExpertLeagueSettings;
  roster: readonly MyExpertPlayer[];
  availablePlayers: readonly MyExpertPlayer[];
  matchups: readonly MyExpertMatchupSignal[];
  news: readonly MyExpertNewsSignal[];
  tradeCandidates: readonly MyExpertTradeCandidate[];
}

export interface MyExpertAdviceAction {
  kind: "recommendation";
  readOnly: true;
  label: string;
}

export interface MyExpertLineupSelection {
  slot: MyExpertLineupSlot;
  playerId: string;
  name: string;
  position: Position;
  projectedPoints: number;
  adjustedScore: number;
  reason: string;
  evidence: string[];
  risk: string;
}

export interface MyExpertLineupRecommendation {
  starters: MyExpertLineupSelection[];
  flexChoice: MyExpertLineupSelection;
  flexCandidates: MyExpertLineupSelection[];
}

export interface MyExpertAdviceCard {
  id: string;
  type: MyExpertAdviceType;
  title: string;
  priority: MyExpertPriority;
  playerIds: string[];
  action: MyExpertAdviceAction;
  summary: string;
  reasons: string[];
  lineup?: MyExpertLineupRecommendation | undefined;
}

export interface MyExpertReadOnlyPolicy {
  mode: "read-only";
  allowedActions: readonly ["recommend"];
  blockedActions: readonly ["add", "drop", "trade", "set-lineup", "submit-waiver-claim"];
}

export interface MyExpertAdvice {
  currentWeek: number;
  policy: MyExpertReadOnlyPolicy;
  cards: MyExpertAdviceCard[];
}

type MyExpertPlayerWithBye = MyExpertPlayer & { byeWeek: number };
type RankedLineupPlayer = {
  player: MyExpertPlayer;
  adjustedScore: number;
};

const readOnlyPolicy: MyExpertReadOnlyPolicy = {
  mode: "read-only",
  allowedActions: ["recommend"],
  blockedActions: ["add", "drop", "trade", "set-lineup", "submit-waiver-claim"],
};

const lineupPositionOrder = ["QB", "RB", "WR", "TE", "K", "DST"] as const satisfies readonly Position[];
const flexEligiblePositions = new Set<Position>(["RB", "WR", "TE"]);
const minimumFlexCandidatesForAdvice = 2;
const highLineupEdge = 4;
const mediumLineupEdge = 1.5;
const defaultPositiveNewsSeverity = 1;
const defaultWatchNewsSeverity = 2;
const defaultNegativeNewsSeverity = 3;

const slugFor = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "player";

const formatOneDecimal = (value: number): string => value.toFixed(1);

const roundToOneDecimal = (value: number): number => Number(formatOneDecimal(value));

const formatSigned = (value: number): string => `${value >= 0 ? "+" : ""}${formatOneDecimal(value)}`;

const sentenceFrom = (value: string): string => value.trim().replace(/[.!?]+$/g, "");

const signalTotal = (signals: MyExpertPlayerSignals | undefined): number =>
  (signals?.opportunityScore ?? 0) +
  (signals?.matchupScore ?? 0) +
  (signals?.usageScore ?? 0) +
  (signals?.trendScore ?? 0) -
  (signals?.injuryRisk ?? 0) -
  (signals?.weatherRisk ?? 0);

const playerScore = (player: MyExpertPlayer | MyExpertTradeCandidate): number =>
  player.projectedPoints + signalTotal(player.signals);

const playerScoreWithMatchups = (
  player: MyExpertPlayer | MyExpertTradeCandidate,
  matchupScores: ReadonlyMap<string, number>,
): number =>
  playerScore(player) + (matchupScores.get(player.id) ?? 0);

const dropScore = (player: MyExpertPlayer, matchupScores: ReadonlyMap<string, number>): number => {
  const positionalPenalty = player.position === "K" ? 4 : player.position === "DST" ? 2 : 0;
  return playerScoreWithMatchups(player, matchupScores) - positionalPenalty;
};

const byScoreDesc = <PlayerType extends MyExpertPlayer | MyExpertTradeCandidate>(
  matchupScores: ReadonlyMap<string, number>,
) => (
  left: PlayerType,
  right: PlayerType,
): number => playerScoreWithMatchups(right, matchupScores) - playerScoreWithMatchups(left, matchupScores) || left.name.localeCompare(right.name);

const benchDropCandidates = (
  roster: readonly MyExpertPlayer[],
  matchupScores: ReadonlyMap<string, number>,
): MyExpertPlayer[] =>
  roster
    .filter(player => (player.rosteredRole ?? "bench") === "bench")
    .sort((left, right) => dropScore(left, matchupScores) - dropScore(right, matchupScores) || left.name.localeCompare(right.name));

const positionCountsFor = (roster: readonly MyExpertPlayer[]): Partial<Record<Position, number>> =>
  roster.reduce<Partial<Record<Position, number>>>((counts, player) => ({
    ...counts,
    [player.position]: (counts[player.position] ?? 0) + 1,
  }), {});

const canAddAfterDrop = (
  leagueSettings: MyExpertLeagueSettings,
  roster: readonly MyExpertPlayer[],
  add: MyExpertPlayer,
  drop: MyExpertPlayer,
): boolean => {
  const maximum = leagueSettings.rosterMaximums[add.position];
  if (maximum === undefined) return true;

  const counts = positionCountsFor(roster);
  const adjustedCount = (counts[add.position] ?? 0) - (drop.position === add.position ? 1 : 0);
  return adjustedCount < maximum;
};

const matchupScoresFor = (
  currentWeek: number,
  matchups: readonly MyExpertMatchupSignal[],
): ReadonlyMap<string, number> => {
  const scores = new Map<string, number>();
  for (const matchup of matchups.filter(item => item.week === currentWeek)) {
    scores.set(matchup.playerId, (scores.get(matchup.playerId) ?? 0) + matchup.score);
  }
  return scores;
};

const matchupSignalsByPlayerFor = (
  currentWeek: number,
  matchups: readonly MyExpertMatchupSignal[],
): ReadonlyMap<string, readonly MyExpertMatchupSignal[]> => {
  const signalsByPlayer = new Map<string, MyExpertMatchupSignal[]>();
  for (const matchup of matchups.filter(item => item.week === currentWeek)) {
    const signals = signalsByPlayer.get(matchup.playerId) ?? [];
    signals.push(matchup);
    signalsByPlayer.set(matchup.playerId, signals);
  }
  for (const signals of signalsByPlayer.values()) {
    signals.sort((left, right) =>
      right.score - left.score ||
      (left.label ?? "").localeCompare(right.label ?? "") ||
      (left.opponent ?? "").localeCompare(right.opponent ?? "")
    );
  }
  return signalsByPlayer;
};

const newsByPlayerFor = (
  news: readonly MyExpertNewsSignal[],
): ReadonlyMap<string, readonly MyExpertNewsSignal[]> => {
  const newsByPlayer = new Map<string, MyExpertNewsSignal[]>();
  for (const item of news) {
    const playerNews = newsByPlayer.get(item.playerId) ?? [];
    playerNews.push(item);
    newsByPlayer.set(item.playerId, playerNews);
  }
  for (const playerNews of newsByPlayer.values()) {
    playerNews.sort((left, right) =>
      (right.severity ?? 0) - (left.severity ?? 0) ||
      left.headline.localeCompare(right.headline)
    );
  }
  return newsByPlayer;
};

const newsSeverityFor = (news: MyExpertNewsSignal): number => {
  if (news.severity !== undefined) return news.severity;
  if (news.impact === "positive") return defaultPositiveNewsSeverity;
  if (news.impact === "watch") return defaultWatchNewsSeverity;
  return defaultNegativeNewsSeverity;
};

const newsAdjustmentFor = (news: MyExpertNewsSignal): number =>
  news.impact === "positive" ? newsSeverityFor(news) : -newsSeverityFor(news);

const newsAdjustmentTotal = (news: readonly MyExpertNewsSignal[]): number =>
  news.reduce((total, item) => total + newsAdjustmentFor(item), 0);

const lineupScoreFor = (
  player: MyExpertPlayer,
  matchupScores: ReadonlyMap<string, number>,
  newsByPlayer: ReadonlyMap<string, readonly MyExpertNewsSignal[]>,
): number =>
  playerScoreWithMatchups(player, matchupScores) + newsAdjustmentTotal(newsByPlayer.get(player.id) ?? []);

const priorityForGain = (gain: number): MyExpertPriority => {
  if (gain >= 6) return "high";
  if (gain >= 3) return "medium";
  return "low";
};

const priorityForWeek = (currentWeek: number, week: number): MyExpertPriority => {
  if (week <= currentWeek + 1) return "high";
  if (week <= currentWeek + 2) return "medium";
  return "low";
};

const priorityForNews = (news: MyExpertNewsSignal): MyExpertPriority => {
  const severity = news.severity ?? (news.impact === "negative" ? 3 : 2);
  if (severity >= 4 || news.impact === "negative") return "high";
  if (severity >= 2 || news.impact === "watch") return "medium";
  return "low";
};

const priorityForLineupEdge = (edge: number): MyExpertPriority => {
  if (edge >= highLineupEdge) return "high";
  if (edge >= mediumLineupEdge) return "medium";
  return "low";
};

const needsStarter = (leagueSettings: MyExpertLeagueSettings, position: Position): boolean =>
  (leagueSettings.lineup[position] ?? 0) > 0;

const hasKnownBye = (player: MyExpertPlayer): player is MyExpertPlayerWithBye =>
  player.byeWeek !== undefined;

const hasRosterCover = (
  roster: readonly MyExpertPlayer[],
  starter: MyExpertPlayer,
  byeWeek: number,
): boolean =>
  roster.some(player =>
    player.id !== starter.id &&
    player.position === starter.position &&
    player.rosteredRole !== "injured-reserve" &&
    player.byeWeek !== byeWeek
  );

const rankedLineupPlayersFor = (
  roster: readonly MyExpertPlayer[],
  matchupScores: ReadonlyMap<string, number>,
  newsByPlayer: ReadonlyMap<string, readonly MyExpertNewsSignal[]>,
): RankedLineupPlayer[] =>
  roster
    .filter(player => player.rosteredRole !== "injured-reserve")
    .map(player => ({
      player,
      adjustedScore: lineupScoreFor(player, matchupScores, newsByPlayer),
    }))
    .sort((left, right) =>
      right.adjustedScore - left.adjustedScore ||
      right.player.projectedPoints - left.player.projectedPoints ||
      left.player.name.localeCompare(right.player.name)
    );

const signalEvidenceFor = (label: string, value: number | undefined): string[] =>
  value === undefined || value === 0 ? [] : [`${label} signal ${formatSigned(value)}.`];

const matchupEvidenceFor = (
  player: MyExpertPlayer,
  matchupSignalsByPlayer: ReadonlyMap<string, readonly MyExpertMatchupSignal[]>,
): string[] =>
  (matchupSignalsByPlayer.get(player.id) ?? []).map(matchup => {
    const context = matchup.label ?? (matchup.opponent ? `vs ${matchup.opponent}` : undefined);
    return context
      ? `Matchup signal ${formatSigned(matchup.score)}: ${sentenceFrom(context)}.`
      : `Matchup signal ${formatSigned(matchup.score)}.`;
  });

const newsEvidenceFor = (news: readonly MyExpertNewsSignal[]): string[] =>
  news
    .filter(item => item.impact === "positive")
    .map(item => `Positive news: ${sentenceFrom(item.headline)}.`);

const lineupEvidenceFor = (
  player: MyExpertPlayer,
  matchupSignalsByPlayer: ReadonlyMap<string, readonly MyExpertMatchupSignal[]>,
  newsByPlayer: ReadonlyMap<string, readonly MyExpertNewsSignal[]>,
): string[] => [
  `${formatOneDecimal(player.projectedPoints)} projected points.`,
  ...signalEvidenceFor("Opportunity", player.signals?.opportunityScore),
  ...signalEvidenceFor("Usage", player.signals?.usageScore),
  ...signalEvidenceFor("Matchup", player.signals?.matchupScore),
  ...signalEvidenceFor("Trend", player.signals?.trendScore),
  ...matchupEvidenceFor(player, matchupSignalsByPlayer),
  ...newsEvidenceFor(newsByPlayer.get(player.id) ?? []),
];

const lineupRiskFor = (
  player: MyExpertPlayer,
  newsByPlayer: ReadonlyMap<string, readonly MyExpertNewsSignal[]>,
): string => {
  const risks = [
    ...(player.signals?.weatherRisk ? [`Weather risk -${formatOneDecimal(player.signals.weatherRisk)}.`] : []),
    ...(player.signals?.injuryRisk ? [`Injury risk -${formatOneDecimal(player.signals.injuryRisk)}.`] : []),
    ...(newsByPlayer.get(player.id) ?? [])
      .filter(item => item.impact !== "positive")
      .map(item => `${item.impact === "negative" ? "Negative" : "Watch"} news: ${sentenceFrom(item.headline)}.`),
  ];
  return risks.length ? risks.join(" ") : "No major risk flags.";
};

const lineupSelectionFor = (
  rankedPlayer: RankedLineupPlayer,
  slot: MyExpertLineupSlot,
  matchupSignalsByPlayer: ReadonlyMap<string, readonly MyExpertMatchupSignal[]>,
  newsByPlayer: ReadonlyMap<string, readonly MyExpertNewsSignal[]>,
  reason: string,
): MyExpertLineupSelection => ({
  slot,
  playerId: rankedPlayer.player.id,
  name: rankedPlayer.player.name,
  position: rankedPlayer.player.position,
  projectedPoints: roundToOneDecimal(rankedPlayer.player.projectedPoints),
  adjustedScore: roundToOneDecimal(rankedPlayer.adjustedScore),
  reason,
  evidence: lineupEvidenceFor(rankedPlayer.player, matchupSignalsByPlayer, newsByPlayer),
  risk: lineupRiskFor(rankedPlayer.player, newsByPlayer),
});

const lineupAdvisorCardFor = (
  currentWeek: number,
  leagueSettings: MyExpertLeagueSettings,
  roster: readonly MyExpertPlayer[],
  matchupScores: ReadonlyMap<string, number>,
  matchupSignalsByPlayer: ReadonlyMap<string, readonly MyExpertMatchupSignal[]>,
  newsByPlayer: ReadonlyMap<string, readonly MyExpertNewsSignal[]>,
): MyExpertAdviceCard | undefined => {
  const rankedPlayers = rankedLineupPlayersFor(roster, matchupScores, newsByPlayer);
  const usedPlayerIds = new Set<string>();
  const requiredStarters: { slot: Position; rankedPlayer: RankedLineupPlayer }[] = [];

  for (const position of lineupPositionOrder) {
    const starterCount = leagueSettings.lineup[position] ?? 0;
    const starters = rankedPlayers
      .filter(candidate => candidate.player.position === position && !usedPlayerIds.has(candidate.player.id))
      .slice(0, starterCount);
    if (starters.length < starterCount) return undefined;

    for (const rankedPlayer of starters) {
      usedPlayerIds.add(rankedPlayer.player.id);
      requiredStarters.push({ slot: position, rankedPlayer });
    }
  }

  const flexCount = leagueSettings.lineup.FLEX ?? 0;
  if (flexCount <= 0) return undefined;

  const flexCandidates = rankedPlayers
    .filter(candidate => flexEligiblePositions.has(candidate.player.position) && !usedPlayerIds.has(candidate.player.id));
  if (flexCandidates.length < Math.max(minimumFlexCandidatesForAdvice, flexCount + 1)) return undefined;

  const flexStarters = flexCandidates.slice(0, flexCount);
  const flexChoice = flexStarters[0];
  const nextFlexCandidate = flexCandidates[flexCount];
  if (!flexChoice) return undefined;

  const requiredStarterSelections = requiredStarters.map(({ slot, rankedPlayer }) =>
    lineupSelectionFor(
      rankedPlayer,
      slot,
      matchupSignalsByPlayer,
      newsByPlayer,
      `Top ${slot} option by adjusted weekly score.`,
    )
  );
  const flexStarterSelections = flexStarters.map(rankedPlayer =>
    lineupSelectionFor(
      rankedPlayer,
      "FLEX",
      matchupSignalsByPlayer,
      newsByPlayer,
      "Best legal FLEX by adjusted weekly score.",
    )
  );
  const flexCandidateSelections = flexCandidates.map((rankedPlayer, index) =>
    lineupSelectionFor(
      rankedPlayer,
      "FLEX",
      matchupSignalsByPlayer,
      newsByPlayer,
      index < flexCount ? "Best legal FLEX by adjusted weekly score." : "FLEX alternative ranked by adjusted weekly score.",
    )
  );
  const selectedStarters = [...requiredStarterSelections, ...flexStarterSelections];
  const flexSelection = flexCandidateSelections[0];
  if (!flexSelection) return undefined;

  const reasons = [
    `${flexSelection.name} leads FLEX candidates at ${formatOneDecimal(flexSelection.adjustedScore)} adjusted points.`,
    ...(nextFlexCandidate ? [`Next FLEX option: ${nextFlexCandidate.player.name} at ${formatOneDecimal(nextFlexCandidate.adjustedScore)} adjusted points.`] : []),
  ];
  const lineupEdge = nextFlexCandidate ? flexChoice.adjustedScore - nextFlexCandidate.adjustedScore : highLineupEdge;

  return {
    id: `lineup-advisor-week-${currentWeek}`,
    type: "lineup",
    title: `Start ${flexSelection.name} at FLEX`,
    priority: priorityForLineupEdge(lineupEdge),
    playerIds: selectedStarters.map(starter => starter.playerId),
    action: {
      kind: "recommendation",
      readOnly: true,
      label: "Review lineup advice",
    },
    summary: `${flexSelection.name} is the best legal FLEX after filling required starters.`,
    reasons,
    lineup: {
      starters: selectedStarters,
      flexChoice: flexSelection,
      flexCandidates: flexCandidateSelections,
    },
  };
};

const addDropCardFor = (
  leagueSettings: MyExpertLeagueSettings,
  roster: readonly MyExpertPlayer[],
  availablePlayers: readonly MyExpertPlayer[],
  matchupScores: ReadonlyMap<string, number>,
): MyExpertAdviceCard | undefined => {
  const pairs = availablePlayers.flatMap(add =>
    benchDropCandidates(roster, matchupScores)
      .filter(drop => canAddAfterDrop(leagueSettings, roster, add, drop))
      .map(drop => {
        const addScore = playerScoreWithMatchups(add, matchupScores);
        const dropCandidateScore = dropScore(drop, matchupScores);
        return {
          add,
          drop,
          addScore,
          dropCandidateScore,
          gain: addScore - dropCandidateScore,
        };
      })
  );
  const pair = pairs
    .filter(candidate => candidate.gain >= 3)
    .sort((left, right) =>
      right.gain - left.gain ||
      right.addScore - left.addScore ||
      left.add.name.localeCompare(right.add.name) ||
      left.drop.name.localeCompare(right.drop.name)
    )[0];
  if (!pair) return undefined;

  return {
    id: `add-drop-${slugFor(pair.add.name)}-${slugFor(pair.drop.name)}`,
    type: "add-drop",
    title: `Add ${pair.add.name}, drop ${pair.drop.name}`,
    priority: priorityForGain(pair.gain),
    playerIds: [pair.add.id, pair.drop.id],
    action: {
      kind: "recommendation",
      readOnly: true,
      label: "Review add/drop",
    },
    summary: `${pair.add.name} projects as a better year-long roster bet than ${pair.drop.name}.`,
    reasons: [
      `${pair.add.name} score: ${pair.addScore.toFixed(1)}.`,
      `${pair.drop.name} score: ${pair.dropCandidateScore.toFixed(1)}.`,
    ],
  };
};

const byeCoverageCardFor = (
  currentWeek: number,
  leagueSettings: MyExpertLeagueSettings,
  roster: readonly MyExpertPlayer[],
  availablePlayers: readonly MyExpertPlayer[],
  matchupScores: ReadonlyMap<string, number>,
): MyExpertAdviceCard | undefined => {
  const starterOptions = roster
    .filter(hasKnownBye)
    .filter(player =>
      player.rosteredRole === "starter" &&
      player.byeWeek >= currentWeek &&
      player.byeWeek <= currentWeek + 2 &&
      needsStarter(leagueSettings, player.position) &&
      !hasRosterCover(roster, player, player.byeWeek)
    )
    .sort((left, right) => left.byeWeek - right.byeWeek || left.position.localeCompare(right.position) || left.name.localeCompare(right.name));

  const starter = starterOptions.find(player =>
    availablePlayers.some(cover => cover.position === player.position && cover.byeWeek !== player.byeWeek)
  );
  if (!starter) return undefined;

  const cover = availablePlayers
    .filter(player => player.position === starter.position && player.byeWeek !== starter.byeWeek)
    .sort(byScoreDesc(matchupScores))[0];
  if (!cover) return undefined;

  return {
    id: `bye-coverage-week-${starter.byeWeek}-${starter.position.toLowerCase()}-${slugFor(cover.name)}`,
    type: "bye-coverage",
    title: `Cover Week ${starter.byeWeek} ${starter.position} bye with ${cover.name}`,
    priority: priorityForWeek(currentWeek, starter.byeWeek),
    playerIds: [starter.id, cover.id],
    action: {
      kind: "recommendation",
      readOnly: true,
      label: "Review bye coverage",
    },
    summary: `${starter.name} is on bye in Week ${starter.byeWeek}, and the roster has no same-position cover.`,
    reasons: [
      `${cover.name} is available and is not on bye in Week ${starter.byeWeek}.`,
    ],
  };
};

const injuryWatchCardFor = (
  roster: readonly MyExpertPlayer[],
  news: readonly MyExpertNewsSignal[],
): MyExpertAdviceCard | undefined => {
  const rosterById = new Map(roster.map(player => [player.id, player]));
  const injuryNews = news
    .filter(item => item.impact === "negative" || item.impact === "watch")
    .map(item => ({ item, player: rosterById.get(item.playerId) }))
    .filter((entry): entry is { item: MyExpertNewsSignal; player: MyExpertPlayer } => Boolean(entry.player))
    .sort((left, right) =>
      (right.item.severity ?? 0) - (left.item.severity ?? 0) ||
      left.player.name.localeCompare(right.player.name)
    )[0];
  if (!injuryNews) return undefined;

  return {
    id: `injury-watch-${slugFor(injuryNews.player.name)}`,
    type: "injury-watch",
    title: `Watch ${injuryNews.player.name} injury status`,
    priority: priorityForNews(injuryNews.item),
    playerIds: [injuryNews.player.id],
    action: {
      kind: "recommendation",
      readOnly: true,
      label: "Review injury plan",
    },
    summary: injuryNews.item.headline,
    reasons: [
      `${injuryNews.player.name} is on your roster, so the news should affect contingency planning before any move is submitted manually.`,
    ],
  };
};

const bestRosterScoreFor = (
  roster: readonly MyExpertPlayer[],
  position: Position,
  matchupScores: ReadonlyMap<string, number>,
): number =>
  roster
    .filter(player => player.position === position && player.rosteredRole !== "injured-reserve")
    .reduce((best, player) => Math.max(best, playerScoreWithMatchups(player, matchupScores)), 0);

const tradeTargetCardFor = (
  leagueSettings: MyExpertLeagueSettings,
  roster: readonly MyExpertPlayer[],
  tradeCandidates: readonly MyExpertTradeCandidate[],
  matchupScores: ReadonlyMap<string, number>,
): MyExpertAdviceCard | undefined => {
  const target = tradeCandidates
    .filter(candidate => needsStarter(leagueSettings, candidate.position) && candidate.acquisitionCost !== "high")
    .map(candidate => ({
      candidate,
      gain: playerScoreWithMatchups(candidate, matchupScores) - bestRosterScoreFor(roster, candidate.position, matchupScores),
    }))
    .filter(entry => entry.gain >= 3)
    .sort((left, right) =>
      right.gain - left.gain ||
      playerScoreWithMatchups(right.candidate, matchupScores) - playerScoreWithMatchups(left.candidate, matchupScores) ||
      left.candidate.name.localeCompare(right.candidate.name)
    )[0];
  if (!target) return undefined;

  return {
    id: `trade-target-${slugFor(target.candidate.name)}`,
    type: "trade-target",
    title: `Explore trade target ${target.candidate.name}`,
    priority: priorityForGain(target.gain),
    playerIds: [target.candidate.id],
    action: {
      kind: "recommendation",
      readOnly: true,
      label: "Review trade idea",
    },
    summary: `${target.candidate.name} would raise the ${target.candidate.position} outlook without constructing or submitting an offer.`,
    reasons: [
      `${target.candidate.name} scores ${target.gain.toFixed(1)} points above your best rostered ${target.candidate.position}.`,
      ...(target.candidate.managerNeed ? [`Other manager may need ${target.candidate.managerNeed}.`] : []),
    ],
  };
};

export const buildMyExpertAdvice = ({
  currentWeek,
  leagueSettings,
  roster,
  availablePlayers,
  matchups,
  news,
  tradeCandidates,
}: BuildMyExpertAdviceOptions): MyExpertAdvice => {
  const matchupScores = matchupScoresFor(currentWeek, matchups);
  const matchupSignalsByPlayer = matchupSignalsByPlayerFor(currentWeek, matchups);
  const newsByPlayer = newsByPlayerFor(news);
  const cards = [
    lineupAdvisorCardFor(currentWeek, leagueSettings, roster, matchupScores, matchupSignalsByPlayer, newsByPlayer),
    addDropCardFor(leagueSettings, roster, availablePlayers, matchupScores),
    byeCoverageCardFor(currentWeek, leagueSettings, roster, availablePlayers, matchupScores),
    injuryWatchCardFor(roster, news),
    tradeTargetCardFor(leagueSettings, roster, tradeCandidates, matchupScores),
  ].filter((card): card is MyExpertAdviceCard => Boolean(card));

  return {
    currentWeek,
    policy: readOnlyPolicy,
    cards,
  };
};
