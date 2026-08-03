import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FileBackedLiveDraftSessionStore,
  liveDraftCommandsCsv,
  liveDraftCommandsJson,
  parseLiveDraftCommandImport,
} from "../src/liveDraftSessionStore.js";

const tempSessionDirectory = async (): Promise<string> =>
  mkdtemp(join(tmpdir(), "mockd-live-draft-"));

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, "utf8")) as T;

describe("live draft session store", () => {
  it("persists mutations to current, backup, and append-only audit files", async () => {
    const directory = await tempSessionDirectory();
    try {
      const store = new FileBackedLiveDraftSessionStore({ directory });

      await expect(store.load()).resolves.toEqual([]);
      await expect(store.appendCommand("jakub drafted kittle for 28")).resolves.toEqual([
        "jakub drafted kittle for 28",
      ]);

      const current = await readJson<{ commands: string[]; commandCount: number }>(store.paths.currentPath);
      const backup = await readJson<{ commands: string[]; commandCount: number }>(store.paths.backupPath);
      const logLines = (await readFile(store.paths.logPath, "utf8")).trim().split("\n");

      expect(current).toMatchObject({
        commandCount: 1,
        commands: ["jakub drafted kittle for 28"],
      });
      expect(backup).toMatchObject(current);
      expect(logLines).toHaveLength(2);
      expect(JSON.parse(logLines[1] ?? "{}")).toMatchObject({
        sequence: 2,
        mutation: {
          type: "sale",
          command: "jakub drafted kittle for 28",
        },
        commandCount: 1,
      });

      const reloadedStore = new FileBackedLiveDraftSessionStore({ directory });
      await expect(reloadedStore.load()).resolves.toEqual(["jakub drafted kittle for 28"]);

      await expect(reloadedStore.undo()).resolves.toEqual([]);
      await expect(reloadedStore.importCommands([
        "cam drafted jahmyr gibbs for 80",
        "jakub drafted george kittle for 28",
      ])).resolves.toEqual([
        "cam drafted jahmyr gibbs for 80",
        "jakub drafted george kittle for 28",
      ]);
      await expect(reloadedStore.reset()).resolves.toEqual([]);

      const finalSnapshot = await readJson<{ commands: string[]; commandCount: number }>(
        reloadedStore.paths.currentPath,
      );
      expect(finalSnapshot).toMatchObject({ commandCount: 0, commands: [] });
      expect((await readFile(reloadedStore.paths.logPath, "utf8")).trim().split("\n")).toHaveLength(5);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("round-trips command imports and exports as JSON and CSV", () => {
    const commands = [
      "cam drafted jahmyr gibbs for 80",
      "jakub drafted george kittle for 28",
    ];

    expect(parseLiveDraftCommandImport(liveDraftCommandsJson(commands), "json")).toEqual(commands);
    expect(parseLiveDraftCommandImport(JSON.stringify(commands), "json")).toEqual(commands);
    expect(liveDraftCommandsCsv(commands)).toBe(
      "index,command\n1,cam drafted jahmyr gibbs for 80\n2,jakub drafted george kittle for 28\n",
    );
    expect(parseLiveDraftCommandImport(liveDraftCommandsCsv(commands), "csv")).toEqual(commands);
  });
});
