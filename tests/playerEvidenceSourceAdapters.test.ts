import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadPlayerEvidenceSourceRows,
  playerContextEvidenceCsv,
} from "../src/data/playerEvidenceSourceAdapters.js";

describe("player evidence source adapters", () => {
  it("normalizes completed local CSV templates into canonical evidence rows", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-source-adapter-"));
    const inputPath = join(directory, "template.csv");
    await writeFile(inputPath, [
      "player,category,score,confidence,source,note,priority,rank",
      "Drake London,opportunity,1,0.9,https://example.com/targets,Target share remained elite,high,11",
      "Drake London,defensiveAttention,-0.5,,https://example.com/coverage,More WR1 coverage expected,high,11",
    ].join("\n"));

    const rows = await loadPlayerEvidenceSourceRows({
      path: inputPath,
      adapter: "scored-local",
    });

    expect(rows).toEqual([
      {
        player: "Drake London",
        category: "opportunity",
        score: 1,
        confidence: 0.9,
        adjustedSignal: 0.9,
        source: "https://example.com/targets",
        note: "Target share remained elite",
      },
      {
        player: "Drake London",
        category: "defensiveAttention",
        score: -0.5,
        confidence: 1,
        adjustedSignal: -0.5,
        source: "https://example.com/coverage",
        note: "More WR1 coverage expected",
      },
    ]);
    expect(playerContextEvidenceCsv(rows)).toBe([
      "player,category,score,confidence,source,note",
      "Drake London,opportunity,1,0.9,https://example.com/targets,Target share remained elite",
      "Drake London,defensiveAttention,-0.5,1,https://example.com/coverage,More WR1 coverage expected",
    ].join("\n"));
  });

  it("normalizes local JSON arrays and evidence envelopes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-source-adapter-json-"));
    const arrayPath = join(directory, "evidence-array.json");
    const envelopePath = join(directory, "evidence-envelope.json");
    const evidence = [{
      player: "Puka Nacua",
      category: "skillFit",
      score: 1.25,
      confidence: 0.8,
      source: "https://example.com/routes",
      note: "Elite yards per route evidence",
    }];
    await writeFile(arrayPath, JSON.stringify(evidence));
    await writeFile(envelopePath, JSON.stringify({ evidence }));

    await expect(loadPlayerEvidenceSourceRows({
      path: arrayPath,
      adapter: "scored-local",
    })).resolves.toEqual(await loadPlayerEvidenceSourceRows({
      path: envelopePath,
      adapter: "scored-local",
    }));
  });

  it("rejects invalid scored local evidence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-source-adapter-invalid-"));
    const inputPath = join(directory, "bad.csv");
    await writeFile(inputPath, [
      "player,category,score,confidence,source,note",
      "Example WR,role,3,1,https://example.com,Not a factual category",
    ].join("\n"));

    await expect(loadPlayerEvidenceSourceRows({
      path: inputPath,
      adapter: "scored-local",
    })).rejects.toThrow("Invalid player evidence category");
  });
});
