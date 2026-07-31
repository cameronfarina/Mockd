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

  it("skips untouched local template rows without dropping completed evidence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-source-adapter-incomplete-"));
    const inputPath = join(directory, "template.csv");
    await writeFile(inputPath, [
      "player,category,score,confidence,source,note,priority,rank,research_prompt",
      "Drake London,opportunity,1,0.9,https://example.com/targets,Target share remained elite,high,11,Check targets",
      "Drake London,defensiveAttention,,,,,high,11,Check coverage",
      "Puka Nacua,risk,,,,,medium,8,Check injury history",
    ].join("\n"));

    const rows = await loadPlayerEvidenceSourceRows({
      path: inputPath,
      adapter: "scored-local",
    });

    expect(rows).toEqual([
      expect.objectContaining({
        player: "Drake London",
        category: "opportunity",
        adjustedSignal: 0.9,
      }),
    ]);
  });

  it("returns no evidence rows when a local template has not been filled", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-source-adapter-blank-template-"));
    const inputPath = join(directory, "template.csv");
    await writeFile(inputPath, [
      "player,category,score,confidence,source,note,priority,rank,research_prompt",
      "Drake London,opportunity,,,,,high,11,Check targets",
      "Puka Nacua,risk,,,,,medium,8,Check injury history",
    ].join("\n"));

    await expect(loadPlayerEvidenceSourceRows({
      path: inputPath,
      adapter: "scored-local",
    })).resolves.toEqual([]);
  });

  it("accepts zero score and confidence values as completed evidence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-source-adapter-zeroes-"));
    const inputPath = join(directory, "template.csv");
    await writeFile(inputPath, [
      "player,category,score,confidence,source,note,priority,rank",
      "Drake London,opportunity,0,0,https://example.com/targets,Neutral evidence,high,11",
    ].join("\n"));

    await expect(loadPlayerEvidenceSourceRows({
      path: inputPath,
      adapter: "scored-local",
    })).resolves.toEqual([
      expect.objectContaining({
        score: 0,
        confidence: 0,
        adjustedSignal: 0,
      }),
    ]);
  });

  it("rejects partially filled local template rows", async () => {
    const cases = [
      ["score only", "Drake London,opportunity,1,,,,high,11"],
      ["source only", "Drake London,opportunity,,,https://example.com/targets,,high,11"],
      ["note only", "Drake London,opportunity,,,,Target share remained elite,high,11"],
      ["confidence only", "Drake London,opportunity,,0.5,,,high,11"],
      ["missing source", "Drake London,opportunity,1,, ,Target share remained elite,high,11"],
      ["missing note", "Drake London,opportunity,1,,https://example.com/targets,,high,11"],
    ] as const;

    for (const [name, row] of cases) {
      const directory = await mkdtemp(join(tmpdir(), `mockd-source-adapter-partial-${name}-`));
      const inputPath = join(directory, "template.csv");
      await writeFile(inputPath, [
        "player,category,score,confidence,source,note,priority,rank",
        row,
      ].join("\n"));

      await expect(loadPlayerEvidenceSourceRows({
        path: inputPath,
        adapter: "scored-local",
      })).rejects.toThrow("Incomplete player evidence row for Drake London");
    }
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

  it("rejects JSON evidence values that are not real numbers", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-source-adapter-json-invalid-"));
    const scorePath = join(directory, "bad-score.json");
    const confidencePath = join(directory, "bad-confidence.json");
    await writeFile(scorePath, JSON.stringify([{
      player: "Puka Nacua",
      category: "skillFit",
      score: null,
      confidence: 1,
      source: "https://example.com/routes",
      note: "Null score should not coerce to zero",
    }]));
    await writeFile(confidencePath, JSON.stringify([{
      player: "Puka Nacua",
      category: "skillFit",
      score: 1,
      confidence: false,
      source: "https://example.com/routes",
      note: "Boolean confidence should not coerce to zero",
    }]));

    await expect(loadPlayerEvidenceSourceRows({
      path: scorePath,
      adapter: "scored-local",
    })).rejects.toThrow("Invalid score for Puka Nacua");
    await expect(loadPlayerEvidenceSourceRows({
      path: confidencePath,
      adapter: "scored-local",
    })).rejects.toThrow("Invalid confidence for Puka Nacua");
  });
});
