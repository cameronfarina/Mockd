import fs from "node:fs/promises";
import type { Position } from "../config/league.js";

const positionMap: Record<number, Position | undefined> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "DST",
};

export interface ProjectionRecord {
  id: number;
  name: string;
  position: Position;
  weeks: Record<number, number>;
  weeks1To4: number;
  espnRank?: number;
  espnAuctionValue?: number;
}

export const loadEspnWeeksOneToFour = async (path: string): Promise<ProjectionRecord[]> => {
  const parsed = JSON.parse(await fs.readFile(path, "utf8")) as any;
  const records = new Map<number, ProjectionRecord>();

  for (const weekEntry of parsed.weeks ?? []) {
    const week = Number(weekEntry.week);
    for (const entry of weekEntry.data?.players ?? []) {
      const player = entry.player ?? {};
      const id = Number(player.id ?? entry.id);
      const position = positionMap[Number(player.defaultPositionId)];
      if (!id || !position) continue;

      const stat = (player.stats ?? []).find((candidate: any) =>
        candidate.seasonId === 2026 &&
        candidate.scoringPeriodId === week &&
        candidate.statSourceId === 1 &&
        candidate.statSplitTypeId === 1,
      );

      const existing = records.get(id) ?? {
        id,
        name: String(player.fullName ?? ""),
        position,
        weeks: {},
        weeks1To4: 0,
      };

      existing.weeks[week] = Number(stat?.appliedTotal ?? 0);
      existing.weeks1To4 = Object.values(existing.weeks).reduce((sum, points) => sum + points, 0);
      const ppr = player.draftRanksByRankType?.PPR;
      if (typeof ppr?.rank === "number") existing.espnRank = ppr.rank;
      if (typeof ppr?.auctionValue === "number") existing.espnAuctionValue = ppr.auctionValue;
      records.set(id, existing);
    }
  }

  return [...records.values()];
};
