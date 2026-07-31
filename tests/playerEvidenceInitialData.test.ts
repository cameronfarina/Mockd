import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  factualPlayerContextCategories,
  type FactualPlayerContextCategory,
} from "../config/playerContext.js";
import { parsePlayerContextEvidenceCsv } from "../src/data/playerContextEvidenceImports.js";

const evidencePath = "data/raw/player-evidence-2026-initial.csv";
const highPriorityPlayers = [
  "Jahmyr Gibbs",
  "Puka Nacua",
  "Bijan Robinson",
  "Ja'Marr Chase",
  "Christian McCaffrey",
  "Amon-Ra St. Brown",
  "Jonathan Taylor",
  "CeeDee Lamb",
  "De'Von Achane",
  "Justin Jefferson",
  "Drake London",
  "Rashee Rice",
  "Jeremiyah Love",
  "James Cook III",
] as const;
const requiredTopAuctionPlayers = [
  ...highPriorityPlayers,
  "Ashton Jeanty",
  "Omarion Hampton",
] as const;

describe("initial 2026 player evidence data", () => {
  it("covers every required top auction player with sourced factual categories", async () => {
    const rows = parsePlayerContextEvidenceCsv(await readFile(evidencePath, "utf8"));

    for (const player of requiredTopAuctionPlayers) {
      const playerRows = rows.filter(row => row.player === player);
      const coveredCategories = new Set<FactualPlayerContextCategory>(
        playerRows.map(row => row.category),
      );

      expect(playerRows.length, player).toBeGreaterThanOrEqual(factualPlayerContextCategories.length);
      expect([...coveredCategories].sort(), player).toEqual([...factualPlayerContextCategories].sort());
      expect(playerRows.every(row => row.source?.startsWith("https://")), player).toBe(true);
      expect(playerRows.every(row => row.note && row.note.length >= 24), player).toBe(true);
      expect(playerRows.every(row => row.score >= -2 && row.score <= 2), player).toBe(true);
      expect(playerRows.every(row => row.confidence >= 0 && row.confidence <= 1), player).toBe(true);
    }
  });
});
