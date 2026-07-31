import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { parsePlayerContextEvidenceCsv } from "../src/data/playerContextEvidenceImports.js";

const execFileAsync = promisify(execFile);

describe("CLI player evidence adapter", () => {
  it("prints canonical CSV from a completed local evidence export", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-cli-evidence-adapt-"));
    const inputPath = join(directory, "template.csv");
    await writeFile(inputPath, [
      "player,category,score,confidence,source,note,priority,rank",
      "Drake London,opportunity,1,0.9,https://example.com/targets,Target share remained elite,high,11",
    ].join("\n"));

    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "evidence:adapt",
        "--",
        `--input=${inputPath}`,
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );

    expect(stdout.trim()).toBe([
      "player,category,score,confidence,source,note",
      "Drake London,opportunity,1,0.9,https://example.com/targets,Target share remained elite",
    ].join("\n"));
    expect(parsePlayerContextEvidenceCsv(stdout)).toEqual([
      expect.objectContaining({
        player: "Drake London",
        category: "opportunity",
        adjustedSignal: 0.9,
      }),
    ]);
  }, 15000);
});
