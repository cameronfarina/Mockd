import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createLiveDraftServer,
  type CreateLiveDraftServerOptions,
} from "../src/liveDraftServer.js";

const tempSessionDirectory = async (): Promise<string> =>
  mkdtemp(join(tmpdir(), "mockd-live-draft-server-"));

type TestServer = Awaited<ReturnType<typeof createLiveDraftServer>>["server"];

const mockSaleCommand = "Beaton drafted Jahmyr Gibbs for 74";

const interactiveMockDraft: NonNullable<CreateLiveDraftServerOptions["interactiveMockDraft"]> = {
  buildInteractiveMockDraftState: options => ({
    aiSaleCommand: mockSaleCommand,
    commandCount: options.commands.length,
    seed: options.seed,
    strategyKey: options.strategyKey,
  }),
  resolveInteractiveMockDraftAction: (_mockDraft, action) => {
    if (action !== "advance") throw new Error(`Unexpected test action: ${action}`);

    return { command: mockSaleCommand };
  },
};

const listen = async (server: TestServer): Promise<string> =>
  new Promise(resolve => {
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP test server address.");
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });

const post = async (baseUrl: string, path: string, body: Record<string, unknown> = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    data: await response.json(),
  };
};

describe("live draft server", () => {
  const servers: TestServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
    servers.length = 0;
  });

  it("serves strategy-aware state and advances interactive mock actions through persisted commands", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const strategyState = await fetch(`${baseUrl}/api/state?strategy=wr-heavy`).then(response => response.json());
      expect(strategyState.strategy.key).toBe("wr-heavy");

      const mockState = await fetch(`${baseUrl}/api/mock/state?strategy=three-rb&seed=server-test`)
        .then(response => response.json());
      expect(mockState.strategy.key).toBe("three-rb");
      expect(mockState.mockDraft.strategyKey).toBe("three-rb");
      expect(mockState.mockDraft.seed).toBe("server-test");
      expect(mockState.mockDraft.aiSaleCommand).toContain("drafted");

      const advanced = await post(baseUrl, "/api/mock/advance", {
        strategyKey: "three-rb",
        seed: "server-test",
        action: "advance",
      });
      expect(advanced.status).toBe(200);
      expect(advanced.data.events).toHaveLength(1);
      expect(advanced.data.session.commandCount).toBe(1);
      expect(advanced.data.mockDraft.commandCount).toBe(1);

      const undone = await post(baseUrl, "/api/undo", { strategyKey: "wr-heavy" });
      expect(undone.status).toBe(200);
      expect(undone.data.strategy.key).toBe("wr-heavy");
      expect(undone.data.session.commandCount).toBe(0);

      const sale = await post(baseUrl, "/api/events", {
        strategyKey: "wr-heavy",
        command: mockSaleCommand,
      });
      expect(sale.status).toBe(200);
      expect(sale.data.strategy.key).toBe("wr-heavy");
      expect(sale.data.session.commandCount).toBe(1);

      const reset = await post(baseUrl, "/api/reset", { strategyKey: "balanced" });
      expect(reset.status).toBe(200);
      expect(reset.data.strategy.key).toBe("balanced");
      expect(reset.data.session.commandCount).toBe(0);

      const imported = await post(baseUrl, "/api/import", {
        strategyKey: "three-rb",
        commands: [mockSaleCommand],
      });
      expect(imported.status).toBe(200);
      expect(imported.data.strategy.key).toBe("three-rb");
      expect(imported.data.session.commandCount).toBe(1);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
