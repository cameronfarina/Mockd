import type { LineupEntry, MockRoster, Player } from "./types.js";

const byMetric = (metric: "week1" | "weeks1To4") => (a: Player, b: Player): number =>
  b[metric] - a[metric] || a.price - b.price || a.name.localeCompare(b.name);

export const optimizeLineup = (
  roster: MockRoster,
  metric: "week1" | "weeks1To4",
): LineupEntry[] => {
  const grouped = roster.players.reduce<Map<Player["position"], Player[]>>((map, player) => {
    const group = map.get(player.position) ?? [];
    group.push(player);
    map.set(player.position, group);
    return map;
  }, new Map());
  const sorted = (position: Player["position"]): Player[] =>
    [...(grouped.get(position) ?? [])].sort(byMetric(metric));

  const qb = sorted("QB");
  const rb = sorted("RB");
  const wr = sorted("WR");
  const te = sorted("TE");
  const k = sorted("K");
  const dst = sorted("DST");

  if (qb.length < 1 || rb.length < 2 || wr.length < 2 || te.length < 1 || k.length < 1 || dst.length < 1) {
    throw new Error("Roster cannot form a legal starting lineup.");
  }

  const lineup: LineupEntry[] = [
    { player: qb[0]!, slot: "QB" },
    { player: rb[0]!, slot: "RB1" },
    { player: rb[1]!, slot: "RB2" },
    { player: wr[0]!, slot: "WR1" },
    { player: wr[1]!, slot: "WR2" },
    { player: te[0]!, slot: "TE" },
    { player: k[0]!, slot: "K" },
    { player: dst[0]!, slot: "DST" },
  ];

  const used = new Set(lineup.map(entry => entry.player.name));
  const flex = roster.players
    .filter(player => ["RB", "WR", "TE"].includes(player.position) && !used.has(player.name))
    .sort(byMetric(metric))[0];

  if (!flex) throw new Error("Roster cannot fill FLEX.");
  lineup.push({ player: flex, slot: "FLEX" });
  return lineup;
};

export const lineupScore = (
  lineup: LineupEntry[],
  metric: "week1" | "weeks1To4",
): number => lineup.reduce((total, entry) => total + entry.player[metric], 0);
