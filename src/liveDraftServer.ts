import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { keepers } from "../config/keepers.js";
import {
  loadHistoricalAuctionRecords,
  type HistoricalAuctionRecord,
} from "./data/parseHistoricalBoards.js";
import {
  FileBackedLiveDraftSessionStore,
  liveDraftCommandsCsv,
  liveDraftCommandsJson,
  parseLiveDraftCommandImport,
  type LiveDraftCommandImportFormat,
  type LiveDraftSessionStatus,
} from "./liveDraftSessionStore.js";
import { liveDraftHtml } from "./liveDraftUi.js";
import {
  buildLiveDraftState,
  type LiveDraftReadiness,
  type LiveDraftReadinessCheck,
  type LiveDraftReadinessStatus,
  type LiveDraftState,
} from "./modeling/liveDraft.js";
import { strategyAuctionOverridesFor } from "./modeling/interactiveMockDraft.js";
import {
  defaultLiveDraftStrategyKey,
  liveDraftStrategies,
  parseLiveDraftStrategyKey,
  type LiveDraftStrategyKey,
} from "./modeling/liveDraftStrategies.js";
import {
  runMockBatchProgressively,
  type MockBatch,
  type RunMockBatchOptions,
} from "./modeling/mockBatch.js";
import { buildMockResultsReport, type MockResultsReport } from "./modeling/mockResults.js";
import { loadEspnWeeksOneToFour, type ProjectionRecord } from "./projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const defaultPort = 4317;
const liveTargetLimit = 500;
const defaultLiveDraftSessionMode = "real";
const interactiveMockSessionDirectoryName = "interactive-mock";
const maximumBatchRunsPerScenario = 250;

export type LiveDraftSessionMode = "real" | "interactive-mock";

interface LiveDraftModeDescriptor {
  key: LiveDraftSessionMode;
  label: string;
  description: string;
}

const liveDraftModes: readonly LiveDraftModeDescriptor[] = [
  {
    key: "real",
    label: "Real draft",
    description: "Draft-night logger. Writes to the real live-draft files.",
  },
  {
    key: "interactive-mock",
    label: "Mock draft",
    description: "Practice room. Cam controls Cam while AI owners bid and nominate.",
  },
];

const optionValue = (name: string): string | undefined => {
  const option = process.argv.find(arg => arg.startsWith(`${name}=`));
  return option?.slice(name.length + 1);
};

const portFromOptions = (): number => {
  const value = optionValue("--port") ?? process.env.PORT;
  if (!value) return defaultPort;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("--port must be a positive integer.");
  return parsed;
};

const sessionDirectoryFromOptions = (): string | undefined =>
  optionValue("--session-dir") ?? process.env.MOCKD_LIVE_DRAFT_DIR;

const readRequestBody = async (request: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });

const sendJson = (response: ServerResponse, statusCode: number, body: unknown): void => {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
};

const sendText = (
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  body: string,
): void => {
  response.writeHead(statusCode, {
    "content-type": `${contentType}; charset=utf-8`,
    "cache-control": "no-store",
  });
  response.end(body);
};

const sendHtml = (response: ServerResponse): void => {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(liveDraftHtml);
};

const readinessStatusFor = (checks: readonly LiveDraftReadinessCheck[]): LiveDraftReadinessStatus => {
  if (checks.some(check => check.status === "fail")) return "fail";
  if (checks.some(check => check.status === "warn")) return "warn";
  return "pass";
};

const readinessWithSession = (
  readiness: LiveDraftReadiness,
  session: LiveDraftSessionStatus,
): LiveDraftReadiness => {
  const checks: LiveDraftReadinessCheck[] = [
    ...readiness.checks,
    {
      key: "session-store",
      label: "Session store",
      status: "pass",
      detail: `${session.commandCount} command${session.commandCount === 1 ? "" : "s"} loaded from disk.`,
    },
    {
      key: "sale-log",
      label: "Sale log",
      status: "pass",
      detail: session.paths.logPath,
    },
    {
      key: "backup-file",
      label: "Backup file",
      status: "pass",
      detail: session.paths.backupPath,
    },
  ];

  return {
    status: readinessStatusFor(checks),
    checks,
  };
};

const importFormatFor = (value: unknown): LiveDraftCommandImportFormat => {
  if (value === "csv") return "csv";
  if (value === "json" || value === undefined) return "json";
  throw new Error("Import format must be json or csv.");
};

const parseJsonBody = async (request: IncomingMessage): Promise<Record<string, unknown>> =>
  JSON.parse(await readRequestBody(request) || "{}") as Record<string, unknown>;

interface LiveDraftStateResponse extends LiveDraftState {
  draftMode: LiveDraftSessionMode;
  draftModes: readonly LiveDraftModeDescriptor[];
  session: LiveDraftSessionStatus;
  readiness: LiveDraftReadiness;
}

interface InteractiveMockDraftModule {
  buildInteractiveMockDraftState(options: {
    projections: readonly ProjectionRecord[];
    historicalRecords: readonly HistoricalAuctionRecord[];
    keepers: typeof keepers;
    commands: readonly string[];
    watchOwner: "Cam";
    strategyKey: LiveDraftStrategyKey;
    seed?: string;
  }): unknown;
  resolveInteractiveMockDraftAction(mockDraft: unknown, action: string): unknown;
}

type MockBatchRunner = (options: RunMockBatchOptions) => MockBatch;

type MockBatchJobStatus = "queued" | "running" | "complete" | "failed";

interface MockBatchJob {
  jobId: string;
  status: MockBatchJobStatus;
  strategyKey: LiveDraftStrategyKey;
  runStrategyKeys: readonly LiveDraftStrategyKey[];
  totalRuns: number;
  completedRuns: number;
  percent: number;
  startedAt: string;
  updatedAt: string;
  result?: MockResultsReport;
  error?: string;
}

export interface CreateLiveDraftServerOptions {
  sessionDirectory?: string;
  projections?: readonly ProjectionRecord[];
  historicalRecords?: readonly HistoricalAuctionRecord[];
  interactiveMockDraft?: InteractiveMockDraftModule;
  mockBatchRunner?: MockBatchRunner;
}

export interface LiveDraftServerApp {
  server: http.Server;
}

const interactiveMockDraftModuleSpecifier = "./modeling/interactiveMockDraft.js";

const hasInteractiveMockDraftModule = (value: unknown): value is InteractiveMockDraftModule => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return typeof candidate.buildInteractiveMockDraftState === "function" &&
    typeof candidate.resolveInteractiveMockDraftAction === "function";
};

const loadInteractiveMockDraftModule = async (
  providedModule: InteractiveMockDraftModule | undefined,
): Promise<InteractiveMockDraftModule> => {
  if (providedModule) return providedModule;

  const moduleExports = await import(interactiveMockDraftModuleSpecifier) as unknown;
  if (!hasInteractiveMockDraftModule(moduleExports)) {
    throw new Error("Interactive mock draft module is missing required exports.");
  }

  return moduleExports;
};

const strategyKeyFromQuery = (url: URL): LiveDraftStrategyKey =>
  parseLiveDraftStrategyKey(url.searchParams.get("strategy") ?? undefined);

const strategyKeyFromBody = (body: Record<string, unknown>): LiveDraftStrategyKey =>
  parseLiveDraftStrategyKey(body.strategyKey);

const sessionModeFromValue = (
  value: unknown,
  fallback: LiveDraftSessionMode = defaultLiveDraftSessionMode,
): LiveDraftSessionMode => {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === "real" || value === "interactive-mock") return value;
  throw new Error("Draft mode must be real or interactive-mock.");
};

const sessionModeFromQuery = (
  url: URL,
  fallback: LiveDraftSessionMode = defaultLiveDraftSessionMode,
): LiveDraftSessionMode =>
  sessionModeFromValue(url.searchParams.get("mode"), fallback);

const sessionModeFromBody = (
  body: Record<string, unknown>,
  fallback: LiveDraftSessionMode = defaultLiveDraftSessionMode,
): LiveDraftSessionMode =>
  sessionModeFromValue(body.mode, fallback);

const batchRunsPerScenarioFromValue = (value: unknown): number => {
  const parsed = value === undefined ? 25 : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Mock batch runs must be a positive integer.");
  }
  return Math.min(parsed, maximumBatchRunsPerScenario);
};

const seedPrefixFromValue = (value: unknown): string => {
  if (typeof value !== "string") return "live-ui-batch";
  const seedPrefix = value.trim();
  return seedPrefix || "live-ui-batch";
};

const seedFromValue = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;

  const seed = value.trim();
  return seed ? seed : undefined;
};

const commandFromInteractiveMockAction = (result: unknown): string => {
  if (!result || typeof result !== "object") {
    throw new Error("Interactive mock action did not return a sale command.");
  }

  const command = (result as Record<string, unknown>).command;
  if (typeof command !== "string" || !command.trim()) {
    throw new Error("Interactive mock action did not return a sale command.");
  }

  return command.trim();
};

const mockDraftRequestFor = (
  strategyKey: LiveDraftStrategyKey,
  seed: string | undefined,
): { strategyKey: LiveDraftStrategyKey; seed?: string } =>
  seed === undefined ? { strategyKey } : { strategyKey, seed };

const mockBatchStrategySequence = (
  preferredStrategyKey: LiveDraftStrategyKey,
  runCount: number,
): LiveDraftStrategyKey[] => {
  const strategyOrder = [
    preferredStrategyKey,
    ...(Object.keys(liveDraftStrategies) as LiveDraftStrategyKey[])
      .filter(strategyKey => strategyKey !== preferredStrategyKey),
  ];

  return Array.from(
    { length: runCount },
    (_value, index) => strategyOrder[index % strategyOrder.length] ?? preferredStrategyKey,
  );
};

export const createLiveDraftServer = async (
  options: CreateLiveDraftServerOptions = {},
): Promise<LiveDraftServerApp> => {
  const projections = options.projections ?? (await loadEspnWeeksOneToFour(projectionPath));
  const historicalRecords = options.historicalRecords ?? (await loadHistoricalAuctionRecords());
  const sessionDirectory = options.sessionDirectory;
  const realStore = new FileBackedLiveDraftSessionStore(
    sessionDirectory === undefined ? {} : { directory: sessionDirectory },
  );
  const interactiveMockStore = new FileBackedLiveDraftSessionStore({
    directory: join(realStore.paths.directory, interactiveMockSessionDirectoryName),
  });
  const storeFor = (mode: LiveDraftSessionMode): FileBackedLiveDraftSessionStore =>
    mode === "interactive-mock" ? interactiveMockStore : realStore;
  await Promise.all([realStore.load(), interactiveMockStore.load()]);
  const stateFor = ({
    mode = defaultLiveDraftSessionMode,
    commands,
    strategyKey = defaultLiveDraftStrategyKey,
  }: {
    mode?: LiveDraftSessionMode;
    commands?: readonly string[];
    strategyKey?: LiveDraftStrategyKey;
  } = {}): LiveDraftStateResponse => {
    const store = storeFor(mode);
    const state = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Cam",
      scenarioKey: "expected",
      strategyKey,
      commands: commands ?? store.currentCommands(),
      targetLimit: liveTargetLimit,
    });
    const session = store.status();
    return {
      ...state,
      draftMode: mode,
      draftModes: liveDraftModes,
      session,
      readiness: readinessWithSession(state.readiness, session),
    };
  };
  const mockDraftFor = async ({
    commands = interactiveMockStore.currentCommands(),
    strategyKey,
    seed,
  }: {
    commands?: readonly string[];
    strategyKey: LiveDraftStrategyKey;
    seed?: string;
  }): Promise<unknown> => {
    const interactiveMockDraft = await loadInteractiveMockDraftModule(options.interactiveMockDraft);
    return interactiveMockDraft.buildInteractiveMockDraftState({
      projections,
      historicalRecords,
      keepers,
      commands,
      watchOwner: "Cam",
      strategyKey,
      ...(seed === undefined ? {} : { seed }),
    });
  };
  const stateWithMockDraft = async ({
    strategyKey,
    seed,
  }: {
    strategyKey: LiveDraftStrategyKey;
    seed?: string;
  }): Promise<LiveDraftStateResponse & { mockDraft: unknown }> => {
    const commands = interactiveMockStore.currentCommands();
    return {
      ...stateFor({ mode: "interactive-mock", commands, strategyKey }),
      mockDraft: await mockDraftFor({ ...mockDraftRequestFor(strategyKey, seed), commands }),
    };
  };
  const mockBatchJobs = new Map<string, MockBatchJob>();
  let latestMockBatchJobId: string | undefined;

  const mockBatchJobResponseFor = (job: MockBatchJob): MockBatchJob => ({
    jobId: job.jobId,
    status: job.status,
    strategyKey: job.strategyKey,
    runStrategyKeys: job.runStrategyKeys,
    totalRuns: job.totalRuns,
    completedRuns: job.completedRuns,
    percent: job.percent,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    ...(job.result === undefined ? {} : { result: job.result }),
    ...(job.error === undefined ? {} : { error: job.error }),
  });

  const updateMockBatchJobProgress = (
    job: MockBatchJob,
    completedRuns: number,
  ): void => {
    job.completedRuns = completedRuns;
    job.percent = job.totalRuns <= 0 ? 100 : Math.round((completedRuns / job.totalRuns) * 100);
    job.updatedAt = new Date().toISOString();
  };

  const yieldToEventLoop = async (): Promise<void> =>
    new Promise(resolve => {
      setTimeout(resolve, 0);
    });

  const runMockBatchJob = async ({
    job,
    runsPerScenario,
    seedPrefix,
  }: {
    job: MockBatchJob;
    runsPerScenario: number;
    seedPrefix: string;
  }): Promise<void> => {
    job.status = "running";
    job.updatedAt = new Date().toISOString();

    try {
      const batch = options.mockBatchRunner
        ? options.mockBatchRunner({
          projections,
          historicalRecords,
          keepers,
          scenarioKeys: ["expected"],
          runsPerScenario,
          seedPrefix,
          auctionConfigOverrides: strategyAuctionOverridesFor("Cam", job.strategyKey),
          diagnosticsMode: "summary",
        })
        : await runMockBatchProgressively({
          projections,
          historicalRecords,
          keepers,
          scenarioKeys: ["expected"],
          runsPerScenario,
          seedPrefix,
          auctionConfigOverridesForRun: context =>
            strategyAuctionOverridesFor("Cam", job.runStrategyKeys[context.completedRuns] ?? job.strategyKey),
          diagnosticsMode: "summary",
          onRunComplete: async progress => {
            updateMockBatchJobProgress(job, progress.completedRuns);
            await yieldToEventLoop();
          },
        });

      updateMockBatchJobProgress(job, job.totalRuns);
      job.status = "complete";
      job.result = buildMockResultsReport(batch, job.strategyKey, job.runStrategyKeys);
      job.updatedAt = new Date().toISOString();
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Unknown mock batch error.";
      job.updatedAt = new Date().toISOString();
    }
  };

  const startMockBatchJob = ({
    strategyKey,
    runsPerScenario,
    seedPrefix,
  }: {
    strategyKey: LiveDraftStrategyKey;
    runsPerScenario: number;
    seedPrefix: string;
  }): MockBatchJob => {
    const now = new Date().toISOString();
    const job: MockBatchJob = {
      jobId: `mock-batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      status: "queued",
      strategyKey,
      runStrategyKeys: mockBatchStrategySequence(strategyKey, runsPerScenario),
      totalRuns: runsPerScenario,
      completedRuns: 0,
      percent: 0,
      startedAt: now,
      updatedAt: now,
    };

    mockBatchJobs.set(job.jobId, job);
    latestMockBatchJobId = job.jobId;
    void runMockBatchJob({ job, runsPerScenario, seedPrefix });
    return job;
  };

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

      if (request.method === "GET" && url.pathname === "/") {
        sendHtml(response);
        return;
      }

      if (request.method === "GET" && url.pathname === "/mock-results") {
        sendHtml(response);
        return;
      }

      if (request.method === "GET" && url.pathname === "/favicon.ico") {
        response.writeHead(204, { "cache-control": "no-store" });
        response.end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/state") {
        sendJson(response, 200, stateFor({
          mode: sessionModeFromQuery(url),
          strategyKey: strategyKeyFromQuery(url),
        }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/mock/state") {
        const strategyKey = strategyKeyFromQuery(url);
        const seed = seedFromValue(url.searchParams.get("seed"));
        sendJson(response, 200, await stateWithMockDraft(mockDraftRequestFor(strategyKey, seed)));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/export") {
        const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
        const store = storeFor(sessionModeFromQuery(url));
        const commands = store.currentCommands();
        if (format === "csv") {
          sendText(response, 200, "text/csv", liveDraftCommandsCsv(commands));
        } else {
          sendText(response, 200, "application/json", liveDraftCommandsJson(commands));
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/events") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const mode = sessionModeFromBody(body);
        const store = storeFor(mode);
        const command = typeof body.command === "string" ? body.command.trim() : "";
        if (!command) {
          sendJson(response, 422, {
            ...stateFor({ mode, strategyKey }),
            errors: [{ input: "", message: "Command is required." }],
          });
          return;
        }

        const trialCommands = [...store.currentCommands(), command];
        const trialState = stateFor({ mode, commands: trialCommands, strategyKey });
        const commandError = trialState.errors.find(error => error.input === command);
        if (commandError) {
          sendJson(response, 422, { ...stateFor({ mode, strategyKey }), errors: [commandError] });
          return;
        }

        await store.appendCommand(command);
        sendJson(response, 200, stateFor({ mode, strategyKey }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/mock/advance") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const seed = seedFromValue(body.seed);
        const action = typeof body.action === "string" ? body.action.trim() : "";
        if (!action) {
          sendJson(response, 422, {
            ...await stateWithMockDraft(mockDraftRequestFor(strategyKey, seed)),
            errors: [{ input: "", message: "Mock draft action is required." }],
          });
          return;
        }

        const interactiveMockDraft = await loadInteractiveMockDraftModule(options.interactiveMockDraft);
        const mockDraft = await mockDraftFor(mockDraftRequestFor(strategyKey, seed));
        const command = commandFromInteractiveMockAction(
          interactiveMockDraft.resolveInteractiveMockDraftAction(mockDraft, action),
        );
        const trialCommands = [...interactiveMockStore.currentCommands(), command];
        const trialState = stateFor({ mode: "interactive-mock", commands: trialCommands, strategyKey });
        const commandError = trialState.errors.find(error => error.input === command);
        if (commandError) {
          sendJson(response, 422, {
            ...await stateWithMockDraft(mockDraftRequestFor(strategyKey, seed)),
            errors: [commandError],
          });
          return;
        }

        await interactiveMockStore.appendCommand(command);
        sendJson(response, 200, await stateWithMockDraft(mockDraftRequestFor(strategyKey, seed)));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/mock-batch") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const runsPerScenario = batchRunsPerScenarioFromValue(body.runs ?? body.runsPerScenario);
        const seedPrefix = seedPrefixFromValue(body.seedPrefix);
        const job = startMockBatchJob({
          strategyKey,
          runsPerScenario,
          seedPrefix,
        });
        sendJson(response, 202, mockBatchJobResponseFor(job));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/mock-batch/latest") {
        const job = latestMockBatchJobId === undefined ? undefined : mockBatchJobs.get(latestMockBatchJobId);
        if (!job) {
          sendJson(response, 404, { error: "No mock batch job has run yet." });
          return;
        }

        sendJson(response, 200, mockBatchJobResponseFor(job));
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/mock-batch/")) {
        const jobId = decodeURIComponent(url.pathname.slice("/api/mock-batch/".length));
        const job = mockBatchJobs.get(jobId);
        if (!job) {
          sendJson(response, 404, { error: `Unknown mock batch job "${jobId}".` });
          return;
        }

        sendJson(response, 200, mockBatchJobResponseFor(job));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/import") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const mode = sessionModeFromBody(body);
        const store = storeFor(mode);
        const importedCommands = Array.isArray(body.commands)
          ? parseLiveDraftCommandImport(JSON.stringify({ commands: body.commands }), "json")
          : parseLiveDraftCommandImport(
            typeof body.content === "string" ? body.content : "",
            importFormatFor(body.format),
          );
        const trialState = stateFor({ mode, commands: importedCommands, strategyKey });
        if (trialState.errors.length) {
          sendJson(response, 422, { ...stateFor({ mode, strategyKey }), errors: trialState.errors });
          return;
        }

        await store.importCommands(importedCommands);
        sendJson(response, 200, stateFor({ mode, strategyKey }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/undo") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const mode = sessionModeFromBody(body);
        const store = storeFor(mode);
        await store.undo();
        sendJson(response, 200, stateFor({ mode, strategyKey }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/reset") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const mode = sessionModeFromBody(body);
        const store = storeFor(mode);
        await store.reset();
        sendJson(response, 200, stateFor({ mode, strategyKey }));
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Unknown live draft server error.",
      });
    }
  });

  return { server };
};

const main = async (): Promise<void> => {
  const port = portFromOptions();
  const sessionDirectory = sessionDirectoryFromOptions();
  const { server } = await createLiveDraftServer(
    sessionDirectory === undefined ? {} : { sessionDirectory },
  );

  server.listen(port, () => {
    console.log(`Mockd live draft UI: http://localhost:${port}`);
  });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
