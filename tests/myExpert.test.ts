import { describe, expect, it } from "vitest";
import { buildMyExpertAdvice } from "../src/modeling/myExpert.js";

describe("my expert advice model", () => {
  it("recommends high-upside waiver adds with explicit drop candidates without submitting moves", () => {
    const advice = buildMyExpertAdvice({
      currentWeek: 4,
      leagueSettings: {
        lineup: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1 },
        rosterMaximums: { QB: 3, RB: 6, WR: 6, TE: 2, K: 2, DST: 2 },
      },
      roster: [
        { id: "qb-1", name: "Reliable QB", position: "QB", teamAbbreviation: "BUF", projectedPoints: 19, rosteredRole: "starter" },
        { id: "rb-1", name: "Anchor RB", position: "RB", teamAbbreviation: "ATL", projectedPoints: 16, rosteredRole: "starter" },
        { id: "rb-2", name: "Floor RB", position: "RB", teamAbbreviation: "CHI", projectedPoints: 11, rosteredRole: "starter" },
        { id: "wr-1", name: "Target Hog", position: "WR", teamAbbreviation: "DAL", projectedPoints: 15, rosteredRole: "starter" },
        { id: "wr-2", name: "Route Winner", position: "WR", teamAbbreviation: "SEA", projectedPoints: 13, rosteredRole: "starter" },
        { id: "te-1", name: "Starting TE", position: "TE", teamAbbreviation: "DET", projectedPoints: 9, rosteredRole: "starter" },
        { id: "k-1", name: "Bench Kicker", position: "K", teamAbbreviation: "KC", projectedPoints: 6, rosteredRole: "bench" },
        { id: "dst-1", name: "Bench Defense", position: "DST", teamAbbreviation: "SF", projectedPoints: 5, rosteredRole: "bench" },
        { id: "wr-bench", name: "Bench WR", position: "WR", teamAbbreviation: "NYJ", projectedPoints: 7, rosteredRole: "bench" },
      ],
      availablePlayers: [
        {
          id: "wr-waiver",
          name: "Breakout WR",
          position: "WR",
          teamAbbreviation: "LAR",
          projectedPoints: 12,
          rosteredPercent: 42,
          signals: { opportunityScore: 3, matchupScore: 1 },
        },
      ],
      matchups: [],
      news: [],
      tradeCandidates: [],
    });

    expect(advice.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "add-drop-breakout-wr-bench-kicker",
        type: "add-drop",
        title: "Add Breakout WR, drop Bench Kicker",
        playerIds: ["wr-waiver", "k-1"],
        priority: "high",
        action: {
          kind: "recommendation",
          readOnly: true,
          label: "Review add/drop",
        },
      }),
    ]));
    expect(advice.policy).toEqual({
      mode: "read-only",
      allowedActions: ["recommend"],
      blockedActions: ["add", "drop", "trade", "set-lineup", "submit-waiver-claim"],
    });
  });

  it("flags imminent starter byes and recommends a waiver cover option", () => {
    const advice = buildMyExpertAdvice({
      currentWeek: 6,
      leagueSettings: {
        lineup: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1 },
        rosterMaximums: { QB: 3, RB: 6, WR: 6, TE: 2, K: 2, DST: 2 },
      },
      roster: [
        { id: "qb-1", name: "Bye QB", position: "QB", teamAbbreviation: "BUF", projectedPoints: 20, rosteredRole: "starter", byeWeek: 7 },
        { id: "rb-1", name: "Anchor RB", position: "RB", teamAbbreviation: "ATL", projectedPoints: 16, rosteredRole: "starter", byeWeek: 11 },
        { id: "rb-2", name: "Floor RB", position: "RB", teamAbbreviation: "CHI", projectedPoints: 11, rosteredRole: "starter", byeWeek: 10 },
        { id: "wr-1", name: "Target Hog", position: "WR", teamAbbreviation: "DAL", projectedPoints: 15, rosteredRole: "starter", byeWeek: 14 },
        { id: "wr-2", name: "Route Winner", position: "WR", teamAbbreviation: "SEA", projectedPoints: 13, rosteredRole: "starter", byeWeek: 11 },
        { id: "te-1", name: "Starting TE", position: "TE", teamAbbreviation: "DET", projectedPoints: 9, rosteredRole: "starter", byeWeek: 6 },
        { id: "k-1", name: "Kicker", position: "K", teamAbbreviation: "KC", projectedPoints: 6, rosteredRole: "starter", byeWeek: 5 },
        { id: "dst-1", name: "Defense", position: "DST", teamAbbreviation: "SF", projectedPoints: 5, rosteredRole: "starter", byeWeek: 8 },
      ],
      availablePlayers: [
        {
          id: "qb-waiver",
          name: "Streamer QB",
          position: "QB",
          teamAbbreviation: "LAC",
          projectedPoints: 16,
          byeWeek: 12,
          signals: { matchupScore: 2 },
        },
      ],
      matchups: [],
      news: [],
      tradeCandidates: [],
    });

    expect(advice.cards).toEqual([
      expect.objectContaining({
        id: "bye-coverage-week-7-qb-streamer-qb",
        type: "bye-coverage",
        title: "Cover Week 7 QB bye with Streamer QB",
        playerIds: ["qb-1", "qb-waiver"],
        priority: "high",
        action: {
          kind: "recommendation",
          readOnly: true,
          label: "Review bye coverage",
        },
      }),
    ]);
  });

  it("turns roster injury news into watch cards without proposing a move", () => {
    const advice = buildMyExpertAdvice({
      currentWeek: 5,
      leagueSettings: {
        lineup: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1 },
        rosterMaximums: { QB: 3, RB: 6, WR: 6, TE: 2, K: 2, DST: 2 },
      },
      roster: [
        { id: "rb-1", name: "Anchor RB", position: "RB", teamAbbreviation: "ATL", projectedPoints: 17, rosteredRole: "starter", byeWeek: 11 },
        { id: "rb-2", name: "Healthy RB", position: "RB", teamAbbreviation: "CHI", projectedPoints: 11, rosteredRole: "starter", byeWeek: 10 },
      ],
      availablePlayers: [],
      matchups: [],
      news: [
        {
          playerId: "rb-1",
          headline: "Anchor RB missed a second straight practice with a hamstring issue.",
          impact: "negative",
          severity: 4,
          sourceDate: "2026-09-30",
        },
      ],
      tradeCandidates: [],
    });

    expect(advice.cards).toEqual([
      expect.objectContaining({
        id: "injury-watch-anchor-rb",
        type: "injury-watch",
        title: "Watch Anchor RB injury status",
        playerIds: ["rb-1"],
        priority: "high",
        action: {
          kind: "recommendation",
          readOnly: true,
          label: "Review injury plan",
        },
      }),
    ]);
  });

  it("suggests trade target ideas for weak roster positions without constructing an offer", () => {
    const advice = buildMyExpertAdvice({
      currentWeek: 8,
      leagueSettings: {
        lineup: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1 },
        rosterMaximums: { QB: 3, RB: 6, WR: 6, TE: 2, K: 2, DST: 2 },
      },
      roster: [
        { id: "te-1", name: "Replacement TE", position: "TE", teamAbbreviation: "DET", projectedPoints: 5, rosteredRole: "starter", byeWeek: 6 },
        { id: "wr-1", name: "Extra WR", position: "WR", teamAbbreviation: "DAL", projectedPoints: 10, rosteredRole: "bench", byeWeek: 14 },
      ],
      availablePlayers: [],
      matchups: [],
      news: [],
      tradeCandidates: [
        {
          id: "te-trade",
          name: "Upside TE",
          position: "TE",
          teamAbbreviation: "MIN",
          projectedPoints: 11,
          acquisitionCost: "fair",
          managerNeed: "WR depth",
          signals: { opportunityScore: 2 },
        },
      ],
    });

    expect(advice.cards).toEqual([
      expect.objectContaining({
        id: "trade-target-upside-te",
        type: "trade-target",
        title: "Explore trade target Upside TE",
        playerIds: ["te-trade"],
        priority: "high",
        action: {
          kind: "recommendation",
          readOnly: true,
          label: "Review trade idea",
        },
      }),
    ]);
  });

  it("uses current-week matchup signals when ranking waiver ideas", () => {
    const advice = buildMyExpertAdvice({
      currentWeek: 4,
      leagueSettings: {
        lineup: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1 },
        rosterMaximums: { QB: 3, RB: 6, WR: 6, TE: 2, K: 2, DST: 2 },
      },
      roster: [
        { id: "k-1", name: "Bench Kicker", position: "K", teamAbbreviation: "KC", projectedPoints: 6, rosteredRole: "bench" },
      ],
      availablePlayers: [
        { id: "safe-wr", name: "Safe WR", position: "WR", teamAbbreviation: "SEA", projectedPoints: 11, rosteredPercent: 50 },
        { id: "matchup-wr", name: "Matchup WR", position: "WR", teamAbbreviation: "LAR", projectedPoints: 10, rosteredPercent: 35 },
      ],
      matchups: [
        {
          playerId: "matchup-wr",
          week: 4,
          opponent: "ARI",
          score: 4,
          label: "soft coverage matchup",
        },
      ],
      news: [],
      tradeCandidates: [],
    });

    expect(advice.cards[0]).toEqual(expect.objectContaining({
      id: "add-drop-matchup-wr-bench-kicker",
      title: "Add Matchup WR, drop Bench Kicker",
      playerIds: ["matchup-wr", "k-1"],
    }));
  });

  it("respects roster position maximums when pairing add/drop advice", () => {
    const advice = buildMyExpertAdvice({
      currentWeek: 4,
      leagueSettings: {
        lineup: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1 },
        rosterMaximums: { QB: 3, RB: 6, WR: 2, TE: 2, K: 2, DST: 2 },
      },
      roster: [
        { id: "wr-1", name: "Locked WR", position: "WR", teamAbbreviation: "DAL", projectedPoints: 15, rosteredRole: "starter" },
        { id: "wr-2", name: "Bench WR", position: "WR", teamAbbreviation: "SEA", projectedPoints: 8, rosteredRole: "bench" },
        { id: "k-1", name: "Bench Kicker", position: "K", teamAbbreviation: "KC", projectedPoints: 6, rosteredRole: "bench" },
      ],
      availablePlayers: [
        { id: "wr-waiver", name: "High WR Add", position: "WR", teamAbbreviation: "LAR", projectedPoints: 20 },
        { id: "rb-waiver", name: "Legal RB Add", position: "RB", teamAbbreviation: "ATL", projectedPoints: 12 },
      ],
      matchups: [],
      news: [],
      tradeCandidates: [],
    });

    expect(advice.cards[0]).toEqual(expect.objectContaining({
      id: "add-drop-high-wr-add-bench-wr",
      title: "Add High WR Add, drop Bench WR",
      playerIds: ["wr-waiver", "wr-2"],
    }));
  });

  it("builds a read-only weekly lineup advisor with ranked legal starters and a specific flex choice", () => {
    const advice = buildMyExpertAdvice({
      currentWeek: 2,
      leagueSettings: {
        lineup: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1 },
        rosterMaximums: { QB: 3, RB: 6, WR: 6, TE: 2, K: 2, DST: 2 },
      },
      roster: [
        { id: "qb-1", name: "Sure QB", position: "QB", teamAbbreviation: "BUF", projectedPoints: 19.4, rosteredRole: "starter" },
        { id: "rb-1", name: "Bijan Robinson", position: "RB", teamAbbreviation: "ATL", projectedPoints: 19.2, rosteredRole: "starter" },
        { id: "rb-2", name: "Jahmyr Gibbs", position: "RB", teamAbbreviation: "DET", projectedPoints: 18.4, rosteredRole: "starter" },
        {
          id: "kenneth-walker",
          name: "Kenneth Walker",
          position: "RB",
          teamAbbreviation: "SEA",
          projectedPoints: 13.8,
          rosteredRole: "bench",
          signals: { usageScore: 1.5, trendScore: 0.6 },
        },
        { id: "wr-1", name: "Ja'Marr Chase", position: "WR", teamAbbreviation: "CIN", projectedPoints: 19.2, rosteredRole: "starter" },
        { id: "wr-2", name: "Amon-Ra St. Brown", position: "WR", teamAbbreviation: "DET", projectedPoints: 18.7, rosteredRole: "starter" },
        {
          id: "mike-evans",
          name: "Mike Evans",
          position: "WR",
          teamAbbreviation: "TB",
          projectedPoints: 14.2,
          rosteredRole: "bench",
          signals: { opportunityScore: 0.5, weatherRisk: 1.2 },
        },
        {
          id: "zay-flowers",
          name: "Zay Flowers",
          position: "WR",
          teamAbbreviation: "BAL",
          projectedPoints: 13.1,
          rosteredRole: "bench",
          signals: { trendScore: 1.0 },
        },
        {
          id: "devonta-smith",
          name: "DeVonta Smith",
          position: "WR",
          teamAbbreviation: "PHI",
          projectedPoints: 13.4,
          rosteredRole: "bench",
        },
        { id: "te-1", name: "Reliable TE", position: "TE", teamAbbreviation: "ARI", projectedPoints: 10.1, rosteredRole: "starter" },
        { id: "k-1", name: "Safe Kicker", position: "K", teamAbbreviation: "DAL", projectedPoints: 7.4, rosteredRole: "starter" },
        { id: "dst-1", name: "Safe Defense", position: "DST", teamAbbreviation: "NYJ", projectedPoints: 8.2, rosteredRole: "starter" },
      ],
      availablePlayers: [],
      matchups: [
        {
          playerId: "kenneth-walker",
          week: 2,
          opponent: "ARI",
          score: 0.7,
          label: "soft front seven",
        },
        {
          playerId: "zay-flowers",
          week: 2,
          opponent: "CLE",
          score: 0.6,
          label: "slot target funnel",
        },
        {
          playerId: "devonta-smith",
          week: 2,
          opponent: "NYG",
          score: 0.9,
          label: "secondary injuries",
        },
      ],
      news: [
        {
          playerId: "kenneth-walker",
          headline: "Seahawks expect Kenneth Walker to handle a full workload.",
          impact: "positive",
          severity: 1,
          sourceDate: "2026-09-15",
        },
        {
          playerId: "devonta-smith",
          headline: "DeVonta Smith was limited with a late-week ankle issue.",
          impact: "watch",
          severity: 2,
          sourceDate: "2026-09-15",
        },
      ],
      tradeCandidates: [],
    });

    const lineupCard = advice.cards.find(card => card.type === "lineup");

    expect(lineupCard).toEqual(expect.objectContaining({
      id: "lineup-advisor-week-2",
      title: "Start Kenneth Walker at FLEX",
      priority: "medium",
      playerIds: [
        "qb-1",
        "rb-1",
        "rb-2",
        "wr-1",
        "wr-2",
        "te-1",
        "k-1",
        "dst-1",
        "kenneth-walker",
      ],
      action: {
        kind: "recommendation",
        readOnly: true,
        label: "Review lineup advice",
      },
      summary: "Kenneth Walker is the best legal FLEX after filling required starters.",
      reasons: [
        "Kenneth Walker leads FLEX candidates at 17.6 adjusted points.",
        "Next FLEX option: Zay Flowers at 14.7 adjusted points.",
      ],
    }));
    expect(lineupCard?.lineup?.starters.map(starter => `${starter.slot}:${starter.name}`)).toEqual([
      "QB:Sure QB",
      "RB:Bijan Robinson",
      "RB:Jahmyr Gibbs",
      "WR:Ja'Marr Chase",
      "WR:Amon-Ra St. Brown",
      "TE:Reliable TE",
      "K:Safe Kicker",
      "DST:Safe Defense",
      "FLEX:Kenneth Walker",
    ]);
    expect(lineupCard?.lineup?.flexChoice).toEqual(expect.objectContaining({
      slot: "FLEX",
      playerId: "kenneth-walker",
      name: "Kenneth Walker",
      position: "RB",
      projectedPoints: 13.8,
      adjustedScore: 17.6,
      reason: "Best legal FLEX by adjusted weekly score.",
      risk: "No major risk flags.",
      evidence: [
        "13.8 projected points.",
        "Usage signal +1.5.",
        "Trend signal +0.6.",
        "Matchup signal +0.7: soft front seven.",
        "Positive news: Seahawks expect Kenneth Walker to handle a full workload.",
      ],
    }));
    expect(lineupCard?.lineup?.flexCandidates.map(candidate => candidate.name)).toEqual([
      "Kenneth Walker",
      "Zay Flowers",
      "Mike Evans",
      "DeVonta Smith",
    ]);
    expect(lineupCard?.lineup?.flexCandidates.find(candidate => candidate.name === "Mike Evans")?.risk).toBe("Weather risk -1.2.");
    expect(lineupCard?.lineup?.flexCandidates.find(candidate => candidate.name === "DeVonta Smith")?.risk)
      .toBe("Watch news: DeVonta Smith was limited with a late-week ankle issue.");
  });
});
