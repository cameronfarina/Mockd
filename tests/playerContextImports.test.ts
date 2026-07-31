import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PlayerContextOverride } from "../config/playerContext.js";
import {
  loadPlayerContextOverrides,
  mergePlayerContextOverrides,
  parsePlayerContextCsv,
  parsePlayerContextJson,
} from "../src/data/playerContextImports.js";

describe("player context imports", () => {
  it("parses CSV signal and note columns into player context overrides", () => {
    const overrides = parsePlayerContextCsv([
      "player,role,injury,contract,coaching,schedule,bye,role_note,injury_note",
      "\"Puka Nacua\",1.5,-0.5,,0.25,,,Featured target,\"Practice report risk\"",
    ].join("\n"));

    expect(overrides).toEqual([
      {
        player: "Puka Nacua",
        signals: {
          role: 1.5,
          injury: -0.5,
          coaching: 0.25,
        },
        notes: {
          role: "Featured target",
          injury: "Practice report risk",
        },
      },
    ]);
  });

  it("parses JSON overrides from either a raw array or an overrides object", () => {
    expect(parsePlayerContextJson(JSON.stringify({
      overrides: [
        {
          player: "Malik Nabers",
          signals: {
            role: 1,
            schedule: -0.25,
          },
          notes: {
            schedule: "Opening month is tougher than baseline.",
          },
        },
      ],
    }))).toEqual([
      {
        player: "Malik Nabers",
        signals: {
          role: 1,
          schedule: -0.25,
        },
        notes: {
          schedule: "Opening month is tougher than baseline.",
        },
      },
    ]);

    expect(parsePlayerContextJson(JSON.stringify([
      {
        player: "Josh Allen",
        signals: {
          contract: 0.5,
        },
      },
    ]))).toEqual([
      {
        player: "Josh Allen",
        signals: {
          contract: 0.5,
        },
      },
    ]);
  });

  it("loads CSV and JSON files by extension", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-context-"));
    const csvPath = join(directory, "context.csv");
    const jsonPath = join(directory, "context.json");
    await writeFile(csvPath, "player,role\nAmon-Ra St. Brown,0.75\n");
    await writeFile(jsonPath, JSON.stringify([{ player: "CeeDee Lamb", signals: { injury: -1 } }]));

    await expect(loadPlayerContextOverrides(csvPath)).resolves.toEqual([
      {
        player: "Amon-Ra St. Brown",
        signals: {
          role: 0.75,
        },
      },
    ]);
    await expect(loadPlayerContextOverrides(jsonPath)).resolves.toEqual([
      {
        player: "CeeDee Lamb",
        signals: {
          injury: -1,
        },
      },
    ]);
  });

  it("rejects malformed CSV input", () => {
    expect(() => parsePlayerContextCsv("player,role\n\"Puka Nacua,1\n")).toThrow(
      "Unterminated quoted field in player context CSV.",
    );
  });

  it("merges imported overrides over manual overrides by normalized player name", () => {
    const manual: PlayerContextOverride[] = [
      {
        player: "J.K. Dobbins",
        signals: {
          role: -0.5,
          injury: -1,
        },
        notes: {
          role: "Manual role note.",
          injury: "Manual injury note.",
        },
      },
    ];
    const imported: PlayerContextOverride[] = [
      {
        player: "JK Dobbins",
        signals: {
          injury: -0.25,
          contract: 0.5,
        },
        notes: {
          injury: "Imported injury note.",
          contract: "Imported contract note.",
        },
      },
    ];

    expect(mergePlayerContextOverrides(manual, imported)).toEqual([
      {
        player: "JK Dobbins",
        signals: {
          role: -0.5,
          injury: -0.25,
          contract: 0.5,
        },
        notes: {
          role: "Manual role note.",
          injury: "Imported injury note.",
          contract: "Imported contract note.",
        },
      },
    ]);
  });
});
