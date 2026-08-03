import type { PlayerContextEvidence } from "../../config/playerContext.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import type { RawPlayerNewsItem } from "../data/playerNewsProviderAdapters.js";

export type PlayerNewsCategory =
  | "Injury"
  | "Practice"
  | "Transaction"
  | "Depth chart"
  | "Role"
  | "Matchup"
  | "Team context"
  | "Market"
  | "News";

export type PlayerNewsDraftAction = "Move up" | "Watch" | "Fade" | "No model change";
export type PlayerNewsAvailabilityStatus = "available" | "drafted" | "keeper" | "unavailable";
export type PlayerNewsSourceMode = "local" | "rotowire-rss" | "all";

export interface PlayerNewsDraftTarget {
  name: string;
  normalizedPlayerName?: string;
  position: string;
  teamAbbreviation?: string;
  expectedPrice: number;
  liveExpectedPrice: number;
  personalValue: number;
  recommendedMaxBid: number;
  valueScore: number;
  tags?: readonly string[];
}

export interface PlayerNewsDraftEvent {
  player: string;
  normalizedPlayerName?: string;
  owner: string;
  price: number;
}

export interface PlayerNewsRosterPlayer {
  name: string;
  position: string;
  price: number;
  source: string;
}

export interface PlayerNewsOwnerState {
  owner: string;
  roster: readonly PlayerNewsRosterPlayer[];
}

export interface PlayerNewsDraftState {
  availableTargets: readonly PlayerNewsDraftTarget[];
  events: readonly PlayerNewsDraftEvent[];
  owners: readonly PlayerNewsOwnerState[];
}

export interface PlayerNewsAuctionSnapshot {
  status: PlayerNewsAvailabilityStatus;
  expectedPrice?: number;
  liveExpectedPrice?: number;
  personalValue?: number;
  recommendedMaxBid?: number;
  valueScore?: number;
  tags: string[];
}

export interface PlayerNewsAvailability {
  status: PlayerNewsAvailabilityStatus;
  detail: string;
}

export interface PlayerNewsSource {
  provider: string;
  url?: string;
  quality?: string;
}

export interface PlayerNewsItem {
  id: string;
  providerItemId: string;
  player: string;
  normalizedPlayerName: string;
  position?: string;
  teamAbbreviation?: string;
  category: PlayerNewsCategory;
  headline: string;
  fantasyImpact: string;
  sourceDate?: string;
  fetchedAt?: string;
  source: PlayerNewsSource;
  draftAction: PlayerNewsDraftAction;
  impactScore: number;
  auction: PlayerNewsAuctionSnapshot;
  availability: PlayerNewsAvailability;
}

export interface PlayerNewsProviderStatus {
  key: string;
  label: string;
  status: "active" | "available" | "candidate";
  detail: string;
}

export interface PlayerNewsFilters {
  source?: PlayerNewsSourceMode;
  query?: string;
  category?: string;
  draftAction?: string;
}

export interface PlayerNewsSummary {
  totalCount: number;
  filteredCount: number;
  moveUpCount: number;
  watchCount: number;
  fadeCount: number;
  noChangeCount: number;
}

export interface PlayerNewsFeed {
  sourceMode: PlayerNewsSourceMode;
  generatedAt: string;
  summary: PlayerNewsSummary;
  providers: PlayerNewsProviderStatus[];
  items: PlayerNewsItem[];
}

export interface BuildPlayerNewsFeedOptions {
  evidenceRows?: readonly PlayerContextEvidence[];
  rawNewsItems?: readonly RawPlayerNewsItem[];
  draftState: PlayerNewsDraftState;
  filters?: PlayerNewsFilters;
  generatedAt?: string;
  localEvidencePath?: string;
}

interface PlayerNewsDraftContext {
  targetsByPlayer: Map<string, PlayerNewsDraftTarget>;
  eventsByPlayer: Map<string, PlayerNewsDraftEvent>;
  rosterByPlayer: Map<string, { owner: string; player: PlayerNewsRosterPlayer }>;
}

const providerStatuses = (localEvidencePath: string): PlayerNewsProviderStatus[] => [
  {
    key: "local-evidence",
    label: "Local evidence",
    status: "active",
    detail: localEvidencePath,
  },
  {
    key: "rotowire-rss",
    label: "RotoWire RSS",
    status: "available",
    detail: "No-key NFL RSS feed with recent player news headlines.",
  },
  {
    key: "sleeper",
    label: "Sleeper",
    status: "candidate",
    detail: "Free player metadata, injury statuses, and add/drop trends.",
  },
  {
    key: "sportsdataio",
    label: "SportsDataIO",
    status: "candidate",
    detail: "Licensed player news, injuries, depth charts, and practice reports.",
  },
  {
    key: "rotoballer",
    label: "RotoBaller",
    status: "candidate",
    detail: "Commercial fantasy player-news XML/RSS/JSON feeds.",
  },
  {
    key: "rotowire",
    label: "RotoWire licensed",
    status: "candidate",
    detail: "Commercial RotoWire data access through direct or brokered integrations.",
  },
];

const actionLabels: readonly PlayerNewsDraftAction[] = ["Move up", "Watch", "Fade", "No model change"];
const categoryLabels: readonly PlayerNewsCategory[] = [
  "Injury",
  "Practice",
  "Transaction",
  "Depth chart",
  "Role",
  "Matchup",
  "Team context",
  "Market",
  "News",
];

const keyFor = (value: string): string =>
  normalizePlayerName(value).toLowerCase();

const slugFor = (value: string): string =>
  keyFor(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "news";

const ensureSentence = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const normalizedDate = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return value.includes("T") ? new Date(parsed).toISOString() : value;
};

const factFromNote = (note: string | undefined): string => {
  if (!note) return "";
  const match = note.match(/Fact:\s*(.+?)(?:;\s*inference:|$)/i);
  return ensureSentence(match?.[1] ?? note);
};

const inferenceFromNote = (note: string | undefined): string => {
  if (!note) return "";
  const match = note.match(/inference:\s*(.+)$/i);
  return ensureSentence(match?.[1] ?? note);
};

const evidenceCategoryFor = (evidence: PlayerContextEvidence): PlayerNewsCategory => {
  const text = `${evidence.category} ${evidence.note ?? ""}`.toLowerCase();
  if (/injur|hamstring|knee|ankle|shoulder|foot|pcl|practice|limited|illness|holdout|suspend|jail/.test(text)) {
    return "Injury";
  }
  if (/depth chart|depth-chart/.test(text)) return "Depth chart";
  if (/contract|trade|sign|free agent|waiver|departed/.test(text)) return "Transaction";

  switch (evidence.category) {
    case "opportunity":
    case "skillFit":
      return "Role";
    case "defensiveAttention":
      return "Matchup";
    case "environment":
      return "Team context";
    case "risk":
      return "Market";
  }
};

const confirmedFadeText = (text: string): boolean =>
  /\b(ruled out|out for|will miss|expected to miss|set to miss|not expected to play|placed on ir|injured reserve|season-ending|multi-week|multiple weeks|surgery|torn|fracture|suspended for|serving (?:a )?suspension|will serve (?:a )?suspension)\b/.test(text);

const watchRiskText = (text: string): boolean =>
  /\b(limited|missed practice|misses practice|not practicing|sidelined|injur|hamstring|knee|ankle|shoulder|foot|undisclosed|recovery|questionable|day-to-day)\b/.test(text);

const actionForImpact = (impactScore: number, text = ""): PlayerNewsDraftAction => {
  if (impactScore >= 0.85) return "Move up";
  if (impactScore < 0 && confirmedFadeText(text)) return "Fade";
  if (Math.abs(impactScore) >= 0.35) return "Watch";
  return "No model change";
};

const actionForRawNews = (item: RawPlayerNewsItem): PlayerNewsDraftAction => {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (confirmedFadeText(text)) return "Fade";
  if (watchRiskText(text)) return "Watch";
  if (/starter|first-team|role|signed|traded/.test(text)) return "Watch";
  return "No model change";
};

const categoryForRawNews = (item: RawPlayerNewsItem): PlayerNewsCategory => {
  const tag = item.tags.find(candidate => categoryLabels.includes(candidate as PlayerNewsCategory));
  return tag ? tag as PlayerNewsCategory : "News";
};

const targetMapFor = (
  targets: readonly PlayerNewsDraftTarget[],
): Map<string, PlayerNewsDraftTarget> =>
  new Map(targets.map(target => [keyFor(target.normalizedPlayerName ?? target.name), target]));

const eventMapFor = (
  events: readonly PlayerNewsDraftEvent[],
): Map<string, PlayerNewsDraftEvent> =>
  new Map(events.map(event => [keyFor(event.normalizedPlayerName ?? event.player), event]));

const rosterMapFor = (
  owners: readonly PlayerNewsOwnerState[],
): Map<string, { owner: string; player: PlayerNewsRosterPlayer }> => {
  const rosters = new Map<string, { owner: string; player: PlayerNewsRosterPlayer }>();
  for (const owner of owners) {
    for (const player of owner.roster) {
      rosters.set(keyFor(player.name), { owner: owner.owner, player });
    }
  }
  return rosters;
};

const draftContextFor = (draftState: PlayerNewsDraftState): PlayerNewsDraftContext => ({
  targetsByPlayer: targetMapFor(draftState.availableTargets),
  eventsByPlayer: eventMapFor(draftState.events),
  rosterByPlayer: rosterMapFor(draftState.owners),
});

const auctionFor = (
  player: string,
  draftContext: PlayerNewsDraftContext,
): { auction: PlayerNewsAuctionSnapshot; availability: PlayerNewsAvailability; target?: PlayerNewsDraftTarget } => {
  const key = keyFor(player);
  const target = draftContext.targetsByPlayer.get(key);
  if (target) {
    return {
      target,
      auction: {
        status: "available",
        expectedPrice: target.expectedPrice,
        liveExpectedPrice: target.liveExpectedPrice,
        personalValue: target.personalValue,
        recommendedMaxBid: target.recommendedMaxBid,
        valueScore: target.valueScore,
        tags: [...(target.tags ?? [])],
      },
      availability: {
        status: "available",
        detail: `$${target.liveExpectedPrice} live / $${target.recommendedMaxBid} max`,
      },
    };
  }

  const event = draftContext.eventsByPlayer.get(key);
  if (event) {
    return {
      auction: { status: "drafted", tags: [] },
      availability: {
        status: "drafted",
        detail: `${event.owner} bought for $${event.price}`,
      },
    };
  }

  const rosterEntry = draftContext.rosterByPlayer.get(key);
  if (rosterEntry?.player.source === "keeper") {
    return {
      auction: { status: "keeper", tags: [] },
      availability: {
        status: "keeper",
        detail: `${rosterEntry.owner} keeper at $${rosterEntry.player.price}`,
      },
    };
  }

  return {
    auction: { status: "unavailable", tags: [] },
    availability: {
      status: "unavailable",
      detail: "Outside the current auction pool",
    },
  };
};

const itemFromEvidence = (
  evidence: PlayerContextEvidence,
  index: number,
  draftContext: PlayerNewsDraftContext,
): PlayerNewsItem => {
  const player = evidence.player;
  const impactScore = evidence.adjustedSignal;
  const market = auctionFor(player, draftContext);
  const headlineFact = factFromNote(evidence.note);
  const category = evidenceCategoryFor(evidence);
  const sourceDate = normalizedDate(evidence.sourceDate);
  const actionText = `${evidence.category} ${evidence.note ?? ""}`.toLowerCase();

  return {
    id: `local-${slugFor(player)}-${slugFor(evidence.category)}-${index + 1}`,
    providerItemId: `local-evidence-${index + 1}`,
    player,
    normalizedPlayerName: keyFor(player),
    ...(market.target?.position ? { position: market.target.position } : {}),
    ...(market.target?.teamAbbreviation ? { teamAbbreviation: market.target.teamAbbreviation } : {}),
    category,
    headline: headlineFact ? `${player} ${headlineFact}` : `${player} ${category.toLowerCase()} note.`,
    fantasyImpact: inferenceFromNote(evidence.note),
    ...(sourceDate ? { sourceDate } : {}),
    source: {
      provider: evidence.provider ?? "Local evidence",
      ...(evidence.source ? { url: evidence.source } : {}),
      ...(evidence.sourceQuality ? { quality: evidence.sourceQuality } : {}),
    },
    draftAction: actionForImpact(impactScore, actionText),
    impactScore,
    auction: market.auction,
    availability: market.availability,
  };
};

const itemFromRawNews = (
  item: RawPlayerNewsItem,
  index: number,
  draftContext: PlayerNewsDraftContext,
): PlayerNewsItem => {
  const player = item.playerName ?? "NFL";
  const market = auctionFor(player, draftContext);
  const draftAction = actionForRawNews(item);
  const impactScore = draftAction === "Fade" ? -1 : draftAction === "Watch" ? -0.5 : 0;
  const sourceDate = normalizedDate(item.publishedAt);

  return {
    id: `${item.provider}-${slugFor(item.providerItemId || item.title)}-${index + 1}`,
    providerItemId: item.providerItemId,
    player,
    normalizedPlayerName: keyFor(player),
    ...(market.target?.position ? { position: market.target.position } : {}),
    ...(market.target?.teamAbbreviation ? { teamAbbreviation: market.target.teamAbbreviation } : {}),
    category: categoryForRawNews(item),
    headline: `${player}: ${ensureSentence(item.title)}`,
    fantasyImpact: ensureSentence(item.summary),
    ...(sourceDate ? { sourceDate } : {}),
    fetchedAt: item.fetchedAt,
    source: {
      provider: "RotoWire RSS",
      ...(item.canonicalUrl ? { url: item.canonicalUrl } : {}),
      quality: "unreviewed",
    },
    draftAction,
    impactScore,
    auction: market.auction,
    availability: market.availability,
  };
};

const sortableTime = (item: PlayerNewsItem): number => {
  const parsed = Date.parse(item.sourceDate ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const matchesFilters = (item: PlayerNewsItem, filters: PlayerNewsFilters): boolean => {
  if (filters.category && filters.category !== "All" && item.category !== filters.category) return false;
  if (filters.draftAction && filters.draftAction !== "All" && item.draftAction !== filters.draftAction) return false;

  const query = filters.query?.trim().toLowerCase();
  if (!query) return true;

  const haystack = [
    item.player,
    item.position,
    item.teamAbbreviation,
    item.category,
    item.headline,
    item.fantasyImpact,
    item.draftAction,
    item.source.provider,
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query);
};

const summaryFor = (
  items: readonly PlayerNewsItem[],
  filteredItems: readonly PlayerNewsItem[],
): PlayerNewsSummary => ({
  totalCount: items.length,
  filteredCount: filteredItems.length,
  moveUpCount: items.filter(item => item.draftAction === "Move up").length,
  watchCount: items.filter(item => item.draftAction === "Watch").length,
  fadeCount: items.filter(item => item.draftAction === "Fade").length,
  noChangeCount: items.filter(item => item.draftAction === "No model change").length,
});

const sourceModeFrom = (value: string | undefined): PlayerNewsSourceMode => {
  if (value === "local" || value === "rotowire-rss" || value === "all") return value;
  return "all";
};

export const isPlayerNewsCategory = (value: string): value is PlayerNewsCategory =>
  categoryLabels.includes(value as PlayerNewsCategory);

export const isPlayerNewsDraftAction = (value: string): value is PlayerNewsDraftAction =>
  actionLabels.includes(value as PlayerNewsDraftAction);

export const buildPlayerNewsFeed = ({
  evidenceRows = [],
  rawNewsItems = [],
  draftState,
  filters = {},
  generatedAt = new Date().toISOString(),
  localEvidencePath = "data/raw/player-evidence-2026-initial.csv",
}: BuildPlayerNewsFeedOptions): PlayerNewsFeed => {
  const sourceMode = sourceModeFrom(filters.source);
  const draftContext = draftContextFor(draftState);
  const localItems = sourceMode === "rotowire-rss"
    ? []
    : evidenceRows.map((evidence, index) => itemFromEvidence(evidence, index, draftContext));
  const rawItems = sourceMode === "local"
    ? []
    : rawNewsItems.map((item, index) => itemFromRawNews(item, index, draftContext));
  const items = [...localItems, ...rawItems]
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((left, right) => sortableTime(right.item) - sortableTime(left.item) || left.originalIndex - right.originalIndex)
    .map(({ item }) => item);
  const filteredItems = items.filter(item => matchesFilters(item, filters));

  return {
    sourceMode,
    generatedAt,
    summary: summaryFor(items, filteredItems),
    providers: providerStatuses(localEvidencePath),
    items: filteredItems,
  };
};
