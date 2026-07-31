import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("CLI player evidence imports", () => {
  it("uses sourced evidence rows as auditable pricing context", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-cli-evidence-"));
    const evidencePath = join(directory, "evidence.csv");
    await writeFile(evidencePath, [
      "player,category,score,confidence,source,note",
      "Drake London,opportunity,1,1,targets,Target volume remains strong",
      "Drake London,defensiveAttention,-1,0.8,coverage,More WR1 defensive attention",
      "Drake London,skillFit,-0.5,1,separation,Separation profile trims upside",
    ].join("\n"));

    const { stdout } = await execFileAsync(
      "npm",
      ["run", "--silent", "prices", "--", `--player-evidence=${evidencePath}`],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const result = JSON.parse(stdout) as {
      config: {
        playerContext: {
          enabled: boolean;
          evidencePath?: string;
        };
      };
      prices: {
        name: string;
        contextSignals: Record<string, number>;
        contextNotes?: Record<string, string>;
        contextEvidence?: unknown[];
      }[];
    };
    const london = result.prices.find(price => price.name === "Drake London");

    expect(result.config.playerContext.enabled).toBe(true);
    expect(result.config.playerContext.evidencePath).toBe(evidencePath);
    expect(london?.contextSignals).toMatchObject({
      opportunity: 1,
      defensiveAttention: -0.8,
      skillFit: -0.5,
    });
    expect(london?.contextNotes).toMatchObject({
      defensiveAttention: "coverage: More WR1 defensive attention",
    });
    expect(london?.contextEvidence).toHaveLength(3);
  });
});
