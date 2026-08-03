import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ownerOrder } from "../config/league.js";
import {
  createLiveDraftServer,
  type CreateLiveDraftServerOptions,
} from "../src/liveDraftServer.js";
import type { MockBatch, RunMockBatchOptions } from "../src/modeling/mockBatch.js";

const tempSessionDirectory = async (): Promise<string> =>
  mkdtemp(join(tmpdir(), "mockd-live-draft-server-"));

type TestServer = Awaited<ReturnType<typeof createLiveDraftServer>>["server"];

const mockSaleCommand = "Beaton drafted Jahmyr Gibbs for 74";
const realSaleCommand = "Jakub drafted Christian McCaffrey for 80";
const mockAiSaleCommands = [
  mockSaleCommand,
  "Mello drafted Puka Nacua for 74",
] as const;

const interactiveMockDraft: NonNullable<CreateLiveDraftServerOptions["interactiveMockDraft"]> = {
  buildInteractiveMockDraftState: options => ({
    phase: options.nominatedPlayer
      ? "human-decision"
      : options.commands.length >= 3
        ? "complete"
        : options.commands.length >= 2
          ? "human-decision"
          : "ai-sale",
    pickNumber: options.commands.length + 1,
    aiSaleCommand: mockAiSaleCommands[options.commands.length] ?? mockAiSaleCommands[1],
    nomination: options.nominatedPlayer ? { player: options.nominatedPlayer } : { player: "Breece Hall" },
    auction: {
      status: "cam-decision",
      player: options.nominatedPlayer ?? "Breece Hall",
      currentBid: options.commands.length >= 2 ? 41 : 40,
      currentBidOwner: "Chip",
      nextCamBid: options.commands.length >= 2 ? 42 : 41,
      openingBid: 37,
      feed: [
        { type: "nomination", text: `Cam nominated ${options.nominatedPlayer ?? "Breece Hall"} for $37` },
        {
          type: "bid",
          owner: "Chip",
          amount: options.commands.length >= 2 ? 41 : 40,
          text: `Chip bid $${options.commands.length >= 2 ? 41 : 40}`,
        },
      ],
    },
    camDecision: options.nominatedPlayer || options.commands.length >= 2
      ? { recommendedBid: 42, maxBid: 44, topAiBid: 41, topAiBidOwner: "Chip" }
      : undefined,
    topTargets: [{ name: "Breece Hall" }],
    commandCount: options.commands.length,
    nominatedPlayer: options.nominatedPlayer,
    seed: options.seed,
    strategyKey: options.strategyKey,
  }),
  resolveInteractiveMockDraftAction: (mockDraft, action) => {
    const draft = mockDraft as {
      aiSaleCommand?: string;
      nominatedPlayer?: string;
      nomination?: { player?: string };
      auction?: { currentBid?: number; feed?: unknown[] };
    };
    if (action === "cam-bid") {
      const nominatedPlayer = draft.nominatedPlayer ?? draft.nomination?.player ?? "Breece Hall";
      if (draft.auction?.currentBid === 41) {
        return {
          mockDraft: {
            ...draft,
            phase: "human-decision",
            auction: {
              ...draft.auction,
              currentBid: 43,
              currentBidOwner: "Chip",
              nextCamBid: 44,
              feed: [
                ...(draft.auction.feed ?? []),
                { type: "bid", owner: "Cam", amount: 42, text: "Cam bid $42" },
                { type: "bid", owner: "Chip", amount: 43, text: "Chip bid $43" },
              ],
            },
            camDecision: { recommendedBid: 44, maxBid: 44, topAiBid: 44, topAiBidOwner: "Chip" },
          },
        };
      }
      return { command: `Cam drafted ${nominatedPlayer} for 42` };
    }
    if (action !== "advance") throw new Error(`Unexpected test action: ${action}`);

    return { command: draft.aiSaleCommand ?? mockSaleCommand };
  },
};

const testPlayer = (
  name: string,
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DST",
  price: number,
  week1: number,
) => ({
  name,
  position,
  price,
  week1,
  weeks1To4: week1 * 4,
});

const testRosterPlayers = (owner: string) => [
  testPlayer(`${owner} QB`, "QB", 2, 18),
  testPlayer(`${owner} RB starter low`, "RB", 45, 6),
  testPlayer(`${owner} RB starter high`, "RB", 60, 22),
  testPlayer(`${owner} RB flex`, "RB", 25, 14),
  testPlayer(`${owner} RB bench`, "RB", 4, 4),
  testPlayer(`${owner} WR starter high`, "WR", 28, 20),
  testPlayer(`${owner} WR starter low`, "WR", 14, 15),
  testPlayer(`${owner} WR bench`, "WR", 3, 5),
  testPlayer(`${owner} TE`, "TE", 8, 10),
  testPlayer(`${owner} TE bench`, "TE", 1, 2),
  testPlayer(`${owner} K`, "K", 1, 8),
  testPlayer(`${owner} DST`, "DST", 1, 7),
  testPlayer(`${owner} Bench WR 1`, "WR", 1, 3),
  testPlayer(`${owner} Bench WR 2`, "WR", 1, 2),
  testPlayer(`${owner} Bench RB 1`, "RB", 1, 1),
  testPlayer(`${owner} Bench RB 2`, "RB", 1, 0.5),
];

const mockBatchRunner: NonNullable<CreateLiveDraftServerOptions["mockBatchRunner"]> = options => {
  const runCount = options.runsPerScenario ?? 1;
  const runs: MockBatch["runs"] = Array.from({ length: runCount }, (_, index) => {
    const rosters = ownerOrder.map((owner, ownerIndex) => {
      const players = testRosterPlayers(owner);
      const spend = players.reduce((total, player) => total + player.price, 0);
      const week1Score = 104 + ownerIndex + index;
      return {
        owner,
        spend,
        budgetRemaining: 200 - spend,
        week1Score,
        weeks1To4Score: week1Score * 4,
        valid: true,
        errors: [],
        players,
        positionSpend: { QB: 2, RB: 136, WR: 47, TE: 9, K: 1, DST: 1 },
      };
    });

    return {
      seed: `test-seed-${index + 1}`,
      keeperScenario: {
        key: "expected",
        label: "Expected",
        includedKeeperStatuses: ["confirmed", "assumed"],
        keeperCounts: { QB: 1, RB: 6, WR: 6, TE: 1, K: 0, DST: 0 },
        totalKeeperCost: 100,
        openAuctionDollars: 2700,
        globalFactor: 1.04,
        positionFactors: { QB: 1, RB: 1.04, WR: 1.03, TE: 1.02, K: 1, DST: 1 },
      },
      inputCounts: {
        pricedPlayers: 500,
        auctionPlayers: 220,
        lockedKeepers: 6,
      },
      pickCount: 218,
      picks: [],
      budgetTrajectory: [],
      rosters,
      invalidRosterCount: 0,
      unsoldPlayerCount: 0,
    };
  });

  return {
    options: {
      scenarioKeys: [...(options.scenarioKeys ?? ["expected"])],
      runsPerScenario: runCount,
      seedPrefix: options.seedPrefix ?? "test",
      ...(options.diagnosticsMode === undefined ? {} : { diagnosticsMode: options.diagnosticsMode }),
    },
    runs,
    summary: {
      runCount,
      scenarios: [{
        key: "expected",
        label: "Expected",
        runCount,
        invalidRosterCount: 0,
        averagePickCount: 218,
      }],
      players: [{
        name: "Jahmyr Gibbs",
        position: "RB",
        draftedCount: runCount,
        draftedRate: 1,
        averageMarketPrice: 72,
        averageSalePrice: 77,
        minimumSalePrice: 76,
        maximumSalePrice: 78,
      }, {
        name: "Cam RB starter high",
        position: "RB",
        draftedCount: runCount,
        draftedRate: 1,
        averageMarketPrice: 58,
        averageSalePrice: 60,
        minimumSalePrice: 60,
        maximumSalePrice: 60,
      }, {
        name: "Cam RB flex",
        position: "RB",
        draftedCount: runCount,
        draftedRate: 1,
        averageMarketPrice: 23,
        averageSalePrice: 25,
        minimumSalePrice: 25,
        maximumSalePrice: 25,
      }],
      owners: [{
        owner: "Cam",
        runCount,
        invalidRosterCount: 0,
        averageSpend: 199,
        minimumSpend: 198,
        maximumSpend: 200,
        averageWeek1Score: 104,
        averageWeeks1To4Score: 410,
        averageBudgetRemaining: 1,
        averagePositionSpend: { QB: 2, RB: 150, WR: 40, TE: 5, K: 1, DST: 1 },
      }],
      ownerPlayerExposure: [{
        owner: "Cam",
        player: "Jahmyr Gibbs",
        position: "RB",
        draftedCount: runCount,
        draftedRate: 1,
        averagePrice: 77,
      }],
    },
  };
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

const waitForMockBatchJob = async (baseUrl: string, jobId: string) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const job = await fetch(`${baseUrl}/api/mock-batch/${jobId}`).then(response => response.json());
    if (job.status === "complete" || job.status === "failed") return job;
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  throw new Error(`Mock batch job ${jobId} did not complete in test.`);
};

describe("live draft server", () => {
  const servers: TestServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
    servers.length = 0;
  });

  it("serves the draft board with the same default sourced evidence as prep commands", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const state = await fetch(`${baseUrl}/api/state?strategy=three-rb`).then(response => response.json());
      const gibbs = state.availableTargets.find((target: { name: string }) => target.name === "Jahmyr Gibbs");
      const london = state.availableTargets.find((target: { name: string }) => target.name === "Drake London");

      expect(gibbs).toMatchObject({
        expectedPrice: 72,
        personalValue: 80,
      });
      expect(london).toMatchObject({
        expectedPrice: 46,
        personalValue: 57,
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("serves strategy-aware state and advances interactive mock actions through persisted commands", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const strategyState = await fetch(`${baseUrl}/api/state?strategy=wr-heavy`).then(response => response.json());
      expect(strategyState.strategy.key).toBe("wr-heavy");
      expect(strategyState.draftMode).toBe("real");

      const mockState = await fetch(`${baseUrl}/api/mock/state?draftSession=practice-3rb&strategy=three-rb&seed=server-test`)
        .then(response => response.json());
      expect(mockState.draftMode).toBe("interactive-mock");
      expect(mockState.strategy.key).toBe("three-rb");
      expect(mockState.mockDraft.strategyKey).toBe("three-rb");
      expect(mockState.mockDraft.seed).toBe("server-test");
      expect(mockState.mockDraft.aiSaleCommand).toContain("drafted");

      const advanced = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "server-test",
        action: "advance",
      });
      expect(advanced.status).toBe(200);
      expect(advanced.data.events).toHaveLength(1);
      expect(advanced.data.session.commandCount).toBe(1);
      expect(advanced.data.session.paths.directory).toBe(join(directory, "practice-3rb", "interactive-mock"));
      expect(advanced.data.mockDraft.commandCount).toBe(1);

      const undone = await post(baseUrl, "/api/undo", {
        draftSession: "practice-3rb",
        mode: "interactive-mock",
        strategyKey: "wr-heavy",
      });
      expect(undone.status).toBe(200);
      expect(undone.data.strategy.key).toBe("wr-heavy");
      expect(undone.data.draftMode).toBe("interactive-mock");
      expect(undone.data.session.commandCount).toBe(0);

      const sale = await post(baseUrl, "/api/events", {
        strategyKey: "wr-heavy",
        command: mockSaleCommand,
      });
      expect(sale.status).toBe(200);
      expect(sale.data.strategy.key).toBe("wr-heavy");
      expect(sale.data.session.commandCount).toBe(1);

      const reset = await post(baseUrl, "/api/reset", {
        strategyKey: "balanced",
        confirmReset: true,
        expectedCommandCount: 1,
      });
      expect(reset.status).toBe(200);
      expect(reset.data.strategy.key).toBe("balanced");
      expect(reset.data.session.commandCount).toBe(0);

      const imported = await post(baseUrl, "/api/import", {
        strategyKey: "three-rb",
        confirmImport: true,
        expectedCommandCount: 0,
        commands: [mockSaleCommand],
      });
      expect(imported.status).toBe(200);
      expect(imported.data.strategy.key).toBe("three-rb");
      expect(imported.data.session.commandCount).toBe(1);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("keeps real draft actions, interactive practice actions, and bulk mocks in distinct modes", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const realSale = await post(baseUrl, "/api/events", {
        mode: "real",
        strategyKey: "three-rb",
        command: realSaleCommand,
      });
      expect(realSale.status).toBe(200);
      expect(realSale.data.draftMode).toBe("real");
      expect(realSale.data.session.commandCount).toBe(1);
      expect(realSale.data.session.paths.directory).toBe(directory);
      expect(realSale.data.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);

      const practiceBefore = await fetch(`${baseUrl}/api/state?mode=interactive-mock&strategy=three-rb`)
        .then(response => response.json());
      expect(practiceBefore.draftMode).toBe("interactive-mock");
      expect(practiceBefore.session.commandCount).toBe(0);
      expect(practiceBefore.events).toHaveLength(0);

      const practiceSale = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "separate-mode-test",
        action: "advance",
      });
      expect(practiceSale.status).toBe(200);
      expect(practiceSale.data.draftMode).toBe("interactive-mock");
      expect(practiceSale.data.session.commandCount).toBe(1);
      expect(practiceSale.data.events.map((event: { input: string }) => event.input)).toEqual([mockSaleCommand]);

      const realAfterPractice = await fetch(`${baseUrl}/api/state?mode=real&strategy=three-rb`)
        .then(response => response.json());
      expect(realAfterPractice.draftMode).toBe("real");
      expect(realAfterPractice.session.commandCount).toBe(1);
      expect(realAfterPractice.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);

      const batch = await post(baseUrl, "/api/mock-batch", {
        strategyKey: "three-rb",
        runs: 3,
        seedPrefix: "server-batch",
      });
      expect(batch.status).toBe(202);
      expect(batch.data.status).toMatch(/queued|running|complete/);
      expect(batch.data.totalRuns).toBe(3);

      const completedBatch = await waitForMockBatchJob(baseUrl, batch.data.jobId);
      expect(completedBatch.status).toBe("complete");
      expect(completedBatch.percent).toBe(100);
      expect(completedBatch.result.mode).toBe("batch-mock");
      expect(completedBatch.result.summary.runCount).toBe(3);
      expect(completedBatch.result.cam.owner).toBe("Cam");
      expect(completedBatch.result.camTopExposures).toEqual([
        expect.objectContaining({ player: "Jahmyr Gibbs", draftedRate: 1 }),
      ]);

      const realAfterBatch = await fetch(`${baseUrl}/api/state?mode=real&strategy=three-rb`)
        .then(response => response.json());
      const practiceAfterBatch = await fetch(`${baseUrl}/api/state?draftSession=practice-3rb&mode=interactive-mock&strategy=three-rb`)
        .then(response => response.json());
      expect(realAfterBatch.session.commandCount).toBe(1);
      expect(practiceAfterBatch.session.commandCount).toBe(1);
      expect(practiceAfterBatch.postDraftAudit[0]).toMatchObject({
        player: "Jahmyr Gibbs",
        mockRange: {
          averageSalePrice: 77,
          minimumSalePrice: 76,
          maximumSalePrice: 78,
          draftedRate: 1,
        },
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("protects the live room from unconfirmed or stale reset and import actions", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const sale = await post(baseUrl, "/api/events", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        command: realSaleCommand,
      });
      expect(sale.status).toBe(200);
      expect(sale.data.session.commandCount).toBe(1);

      const unconfirmedReset = await post(baseUrl, "/api/reset", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
      });
      expect(unconfirmedReset.status).toBe(409);
      expect(unconfirmedReset.data.session.commandCount).toBe(1);
      expect(unconfirmedReset.data.errors[0]?.message).toContain("requires confirmation");

      const staleReset = await post(baseUrl, "/api/reset", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        confirmReset: true,
        expectedCommandCount: 0,
      });
      expect(staleReset.status).toBe(409);
      expect(staleReset.data.session.commandCount).toBe(1);
      expect(staleReset.data.errors[0]?.message).toContain("currently has 1");

      const unconfirmedImport = await post(baseUrl, "/api/import", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        expectedCommandCount: 1,
        commands: [mockSaleCommand],
      });
      expect(unconfirmedImport.status).toBe(409);
      expect(unconfirmedImport.data.session.commandCount).toBe(1);
      expect(unconfirmedImport.data.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);

      const staleImport = await post(baseUrl, "/api/import", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        confirmImport: true,
        expectedCommandCount: 0,
        commands: [mockSaleCommand],
      });
      expect(staleImport.status).toBe(409);
      expect(staleImport.data.session.commandCount).toBe(1);
      expect(staleImport.data.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);

      const confirmedImport = await post(baseUrl, "/api/import", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        confirmImport: true,
        expectedCommandCount: 1,
        commands: [mockSaleCommand],
      });
      expect(confirmedImport.status).toBe(200);
      expect(confirmedImport.data.session.commandCount).toBe(1);
      expect(confirmedImport.data.events.map((event: { input: string }) => event.input)).toEqual([mockSaleCommand]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("serializes live sale validation so duplicate concurrent purchases cannot both write", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const [firstSale, duplicateSale] = await Promise.all([
        post(baseUrl, "/api/events", {
          draftSession: "live",
          mode: "real",
          strategyKey: "three-rb",
          command: realSaleCommand,
        }),
        post(baseUrl, "/api/events", {
          draftSession: "live",
          mode: "real",
          strategyKey: "three-rb",
          command: realSaleCommand,
        }),
      ]);
      const statuses = [firstSale.status, duplicateSale.status].sort((left, right) => left - right);
      const state = await fetch(`${baseUrl}/api/state?draftSession=live&mode=real&strategy=three-rb`)
        .then(response => response.json());

      expect(statuses).toEqual([200, 422]);
      expect(state.session.commandCount).toBe(1);
      expect(state.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);
      expect(state.errors).toHaveLength(0);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("keeps named live, practice, and scratch sessions in separate file stores", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const liveSale = await post(baseUrl, "/api/events", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        command: realSaleCommand,
      });
      const practiceSale = await post(baseUrl, "/api/events", {
        draftSession: "practice-3rb",
        mode: "real",
        strategyKey: "three-rb",
        command: mockSaleCommand,
      });
      const scratchSale = await post(baseUrl, "/api/events", {
        draftSession: "scratch:late-room",
        mode: "real",
        strategyKey: "three-rb",
        command: "Seth drafted Derrick Henry for 62",
      });

      expect(liveSale.status).toBe(200);
      expect(practiceSale.status).toBe(200);
      expect(scratchSale.status).toBe(200);

      const liveState = await fetch(`${baseUrl}/api/state?draftSession=live&mode=real`)
        .then(response => response.json());
      const practiceState = await fetch(`${baseUrl}/api/state?draftSession=practice-3rb&mode=real`)
        .then(response => response.json());
      const emptyPracticeState = await fetch(`${baseUrl}/api/state?draftSession=practice-wr-heavy&mode=real`)
        .then(response => response.json());
      const scratchState = await fetch(`${baseUrl}/api/state?draftSession=scratch:late-room&mode=real`)
        .then(response => response.json());

      expect(liveState.activeDraftSession).toMatchObject({ key: "live", label: "Live" });
      expect(liveState.draftSessions.map((session: { key: string }) => session.key)).toEqual(
        expect.arrayContaining(["live", "practice-3rb", "practice-wr-heavy"]),
      );
      expect(liveState.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);
      expect(liveState.session.paths.directory).toBe(directory);

      expect(practiceState.activeDraftSession).toMatchObject({ key: "practice-3rb", label: "Practice 3RB" });
      expect(practiceState.events.map((event: { input: string }) => event.input)).toEqual([mockSaleCommand]);
      expect(practiceState.session.paths.directory).toBe(join(directory, "practice-3rb"));

      expect(emptyPracticeState.events).toHaveLength(0);
      expect(emptyPracticeState.session.paths.directory).toBe(join(directory, "practice-wr-heavy"));

      expect(scratchState.activeDraftSession).toMatchObject({ key: "scratch:late-room", label: "Scratch: late-room" });
      expect(scratchState.events.map((event: { input: string }) => event.input)).toEqual([
        "Seth drafted Derrick Henry for 62",
      ]);
      expect(scratchState.session.paths.directory).toBe(join(directory, "scratch", "late-room"));

      const practiceMock = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "named-session-test",
        action: "advance",
      });
      expect(practiceMock.status).toBe(200);
      expect(practiceMock.data.session.paths.directory).toBe(join(directory, "practice-3rb", "interactive-mock"));
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("locks live draft-night sessions against interactive mock advances", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const lockedAdvance = await post(baseUrl, "/api/mock/advance", {
        draftSession: "live",
        strategyKey: "three-rb",
        seed: "locked-live-session",
        action: "advance",
      });
      expect(lockedAdvance.status).toBe(423);
      expect(lockedAdvance.data.draftNightLock).toMatchObject({ locked: true });
      expect(lockedAdvance.data.errors[0]?.message).toContain("Live session is locked for mock draft advances");

      const liveState = await fetch(`${baseUrl}/api/state?draftSession=live&mode=interactive-mock&strategy=three-rb`)
        .then(response => response.json());
      expect(liveState.draftNightLock).toMatchObject({ locked: true });
      expect(liveState.session.commandCount).toBe(0);
      expect(liveState.events).toHaveLength(0);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("exports a complete one-click draft session bundle", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const sale = await post(baseUrl, "/api/events", {
        draftSession: "practice-wr-heavy",
        mode: "real",
        strategyKey: "wr-heavy",
        command: realSaleCommand,
      });
      expect(sale.status).toBe(200);

      const response = await fetch(`${baseUrl}/api/export-bundle?draftSession=practice-wr-heavy&mode=real&strategy=wr-heavy`);
      expect(response.status).toBe(200);
      const bundle = await response.json();
      expect(bundle.version).toBe(1);
      expect(bundle.activeDraftSession).toMatchObject({ key: "practice-wr-heavy", label: "Practice WR Heavy" });
      expect(bundle.draftMode).toBe("real");
      expect(bundle.session.commandCount).toBe(1);
      expect(bundle.readiness.status).toMatch(/pass|warn/);
      expect(bundle.currentSnapshot.commands).toEqual([realSaleCommand]);
      expect(bundle.backupSnapshot.commands).toEqual([realSaleCommand]);
      expect(bundle.commandsJson).toContain(realSaleCommand);
      expect(bundle.commandsCsv).toContain("index,command");
      expect(bundle.commandsCsv).toContain(realSaleCommand);
      expect(bundle.auditLogJsonl).toContain(realSaleCommand);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("returns a compact import conflict review without replacing the session", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const rejected = await post(baseUrl, "/api/import", {
        draftSession: "practice-3rb",
        mode: "real",
        strategyKey: "three-rb",
        commands: [
          "cam drafted brown for 12",
          "nobody drafted Jahmyr Gibbs for 1",
        ],
      });

      expect(rejected.status).toBe(422);
      expect(rejected.data.session.commandCount).toBe(0);
      expect(rejected.data.events).toHaveLength(0);
      expect(rejected.data.conflictReview).toMatchObject({
        title: "Import needs review",
        importedCount: 2,
        issueCount: 2,
      });
      expect(rejected.data.conflictReview.issues).toEqual([
        expect.objectContaining({
          index: 1,
          type: "ambiguous-player",
          input: "cam drafted brown for 12",
          matchOptions: expect.arrayContaining(["A.J. Brown", "Chase Brown"]),
        }),
        expect.objectContaining({
          index: 2,
          type: "invalid-command",
          input: "nobody drafted Jahmyr Gibbs for 1",
          matchOptions: [],
        }),
      ]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("previews Cam-selected mock nominations before appending the sale command", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const nominationPreview = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "server-cam-nomination",
        action: "cam-nominate",
        nominatedPlayer: "Breece Hall",
      });
      expect(nominationPreview.status).toBe(200);
      expect(nominationPreview.data.session.commandCount).toBe(0);
      expect(nominationPreview.data.mockDraft.nominatedPlayer).toBe("Breece Hall");

      const camBid = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "server-cam-nomination",
        action: "cam-bid",
        nominatedPlayer: "Breece Hall",
      });
      expect(camBid.status).toBe(200);
      expect(camBid.data.session.commandCount).toBe(1);
      expect(camBid.data.events.map((event: { input: string }) => event.input)).toEqual([
        "Cam drafted Breece Hall for 42",
      ]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("returns an updated mock auction when AI keeps bidding after Cam raises", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const aiRaise = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "server-auction-bid",
        action: "cam-bid",
        nominatedPlayer: "Breece Hall",
        mockAuction: {
          currentBid: 41,
          feed: [
            { type: "nomination", text: "Cam nominated Breece Hall for $37" },
            { type: "bid", owner: "Chip", amount: 41, text: "Chip bid $41" },
          ],
        },
      });

      expect(aiRaise.status).toBe(200);
      expect(aiRaise.data.session.commandCount).toBe(0);
      expect(aiRaise.data.events).toHaveLength(0);
      expect(aiRaise.data.mockDraft.auction).toMatchObject({
        currentBid: 43,
        currentBidOwner: "Chip",
        nextCamBid: 44,
      });
      expect(aiRaise.data.mockDraft.auction.feed.map((event: { text: string }) => event.text)).toEqual([
        "Cam nominated Breece Hall for $37",
        "Chip bid $41",
        "Cam bid $42",
        "Chip bid $43",
      ]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("runs interactive mock speed controls through persisted sale commands", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const nextCamDecision = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-wr-heavy",
        strategyKey: "wr-heavy",
        seed: "server-speed-controls",
        action: "next-cam-decision",
      });
      expect(nextCamDecision.status).toBe(200);
      expect(nextCamDecision.data.session.commandCount).toBe(2);
      expect(nextCamDecision.data.events.map((event: { input: string }) => event.input)).toEqual([
        mockAiSaleCommands[0],
        mockAiSaleCommands[1],
      ]);
      expect(nextCamDecision.data.mockDraft.phase).toBe("human-decision");

      const complete = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-wr-heavy",
        strategyKey: "wr-heavy",
        seed: "server-speed-controls",
        action: "complete-mock",
      });
      expect(complete.status).toBe(200);
      expect(complete.data.session.commandCount).toBe(3);
      expect(complete.data.events.map((event: { input: string }) => event.input)).toContain(
        "Cam drafted Breece Hall for 42",
      );
      expect(complete.data.mockDraft.phase).toBe("complete");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("serves mock results and returns complete optimized 14-team run payloads", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const resultsPage = await fetch(`${baseUrl}/mock-results`);
      expect(resultsPage.status).toBe(200);
      expect(await resultsPage.text()).toContain("id=\"mock-results-view\"");

      const started = await post(baseUrl, "/api/mock-batch", {
        strategyKey: "three-rb",
        runs: 2,
        seedPrefix: "results-test",
      });
      const completed = await waitForMockBatchJob(baseUrl, started.data.jobId);
      expect(completed.result.runs).toHaveLength(2);
      expect(completed.result.runs[0].label).toBe("Run 1: 3rb");
      expect(completed.result.runs[0].teams).toHaveLength(ownerOrder.length);
      expect(completed.result.runs[0].rankings).toHaveLength(ownerOrder.length);
      expect(completed.result.runs[0].bestBuild.owner).toBe("Mello");
      expect(completed.result.runs[0].worstBuild.owner).toBe("Beaton");
      expect(completed.result.runs[0].bestBuild.corePlayers).toHaveLength(3);
      expect(completed.result.runs[0].camOutcome.owner).toBe("Cam");
      expect(completed.result.runs[0].camOutcome.rank).toBeGreaterThan(1);
      expect(completed.result.runs[0].camOutcome.headline).toContain("projected");
      expect(completed.result.runs[0].rankings[0].explanation).toContain("Projected 1st");

      const cam = completed.result.runs[0].teams.find((team: { owner: string }) => team.owner === "Cam");
      expect(cam.players).toHaveLength(16);
      expect(cam.projectedRank).toBe(completed.result.runs[0].camOutcome.rank);
      expect(cam.rankExplanation).toContain("Projected");
      expect(cam.topStarter.name).toBe("Cam RB starter high");
      expect(cam.starters.map((player: { slot: string }) => player.slot)).toEqual([
        "QB",
        "RB1",
        "RB2",
        "WR1",
        "WR2",
        "TE",
        "FLEX",
        "K",
        "DST",
      ]);
      expect(cam.starters.find((player: { slot: string }) => player.slot === "RB1").name).toBe("Cam RB starter high");
      expect(cam.starters.find((player: { slot: string }) => player.slot === "RB2").name).toBe("Cam RB flex");
      expect(cam.starters.find((player: { slot: string }) => player.slot === "FLEX").name).toBe("Cam RB starter low");

      const latest = await fetch(`${baseUrl}/api/mock-batch/latest`).then(response => response.json());
      expect(latest.jobId).toBe(started.data.jobId);
      expect(latest.result.runs[1].label).toBe("Run 2: 3rb");
      expect(latest.result.runStrategyKeys).toEqual(["three-rb", "three-rb"]);
      expect(latest.result.analytics.strategyLeaderboard).toEqual([
        expect.objectContaining({
          strategyKey: "three-rb",
          runCount: 2,
          averageCamRank: (completed.result.runs[0].camOutcome.rank + completed.result.runs[1].camOutcome.rank) / 2,
        }),
      ]);
      expect(latest.result.analytics.camScoreRange).toEqual(expect.objectContaining({
        minimumWeek1Score: completed.result.runs[0].camOutcome.week1Score,
        maximumWeek1Score: completed.result.runs[1].camOutcome.week1Score,
        minimumWeeks1To4Score: completed.result.runs[0].camOutcome.weeks1To4Score,
        maximumWeeks1To4Score: completed.result.runs[1].camOutcome.weeks1To4Score,
      }));
      expect(latest.result.analytics.topCamRosterPaths[0]).toEqual(expect.objectContaining({
        count: 2,
        draftedRate: 1,
      }));
      expect(latest.result.analytics.strategyCoach).toEqual(expect.objectContaining({
        headline: expect.stringContaining("sampled"),
        blueprint: expect.arrayContaining([
          expect.objectContaining({
            slot: "RB1",
            targetNames: expect.arrayContaining(["Cam RB starter high"]),
          }),
        ]),
      }));
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("accepts scripted mock targets and applies Cam max-bid caps to the batch job", async () => {
    const directory = await tempSessionDirectory();
    let capturedOptions: RunMockBatchOptions | undefined;
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner: options => {
          capturedOptions = options;
          return mockBatchRunner(options);
        },
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const started = await post(baseUrl, "/api/mock-batch", {
        strategyKey: "three-rb",
        runs: 25,
        seedPrefix: "script-test",
        script: "run 2 mocks where i target jadarian price, where im not willing to pay over $20",
      });
      const completed = await waitForMockBatchJob(baseUrl, started.data.jobId);

      expect(capturedOptions?.runsPerScenario).toBe(2);
      expect(capturedOptions?.auctionConfigOverrides?.ownerPlayerTargetMaxBids?.Cam?.["Jadarian Price"]).toBe(20);
      expect(completed.result.script).toMatchObject({
        label: "Target Jadarian Price up to $20",
        targetOutcomes: [
          expect.objectContaining({
            owner: "Cam",
            player: "Jadarian Price",
            maxBid: 20,
            runCount: 2,
          }),
        ],
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
