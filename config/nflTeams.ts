export interface NflTeamMetadata {
  abbreviation: string;
  byeWeek: number;
}

export const nflByeWeekSource = "https://www.nfl.com/news/2026-nfl-schedule-release-every-team-bye-week";

export const nflTeamByEspnProTeamId: Record<number, NflTeamMetadata | undefined> = {
  1: { abbreviation: "ATL", byeWeek: 11 },
  2: { abbreviation: "BUF", byeWeek: 7 },
  3: { abbreviation: "CHI", byeWeek: 10 },
  4: { abbreviation: "CIN", byeWeek: 6 },
  5: { abbreviation: "CLE", byeWeek: 11 },
  6: { abbreviation: "DAL", byeWeek: 14 },
  7: { abbreviation: "DEN", byeWeek: 10 },
  8: { abbreviation: "DET", byeWeek: 6 },
  9: { abbreviation: "GB", byeWeek: 11 },
  10: { abbreviation: "TEN", byeWeek: 9 },
  11: { abbreviation: "IND", byeWeek: 13 },
  12: { abbreviation: "KC", byeWeek: 5 },
  13: { abbreviation: "LV", byeWeek: 13 },
  14: { abbreviation: "LAR", byeWeek: 11 },
  15: { abbreviation: "MIA", byeWeek: 6 },
  16: { abbreviation: "MIN", byeWeek: 6 },
  17: { abbreviation: "NE", byeWeek: 11 },
  18: { abbreviation: "NO", byeWeek: 8 },
  19: { abbreviation: "NYG", byeWeek: 8 },
  20: { abbreviation: "NYJ", byeWeek: 13 },
  21: { abbreviation: "PHI", byeWeek: 10 },
  22: { abbreviation: "ARI", byeWeek: 14 },
  23: { abbreviation: "PIT", byeWeek: 9 },
  24: { abbreviation: "LAC", byeWeek: 7 },
  25: { abbreviation: "SF", byeWeek: 8 },
  26: { abbreviation: "SEA", byeWeek: 11 },
  27: { abbreviation: "TB", byeWeek: 10 },
  28: { abbreviation: "WAS", byeWeek: 7 },
  29: { abbreviation: "CAR", byeWeek: 5 },
  30: { abbreviation: "JAX", byeWeek: 7 },
  33: { abbreviation: "BAL", byeWeek: 13 },
  34: { abbreviation: "HOU", byeWeek: 8 },
};
