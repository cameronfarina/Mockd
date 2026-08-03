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
  parseLiveDraftStrategyKey,
  type LiveDraftStrategyKey,
} from "./modeling/liveDraftStrategies.js";
import { runMockBatch, type MockBatch, type RunMockBatchOptions } from "./modeling/mockBatch.js";
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

interface CompactMockBatchReport {
  mode: "batch-mock";
  options: MockBatch["options"] & {
    strategyKey: LiveDraftStrategyKey;
  };
  summary: MockBatch["summary"];
  cam?: MockBatch["summary"]["owners"][number];
  camTopExposures: MockBatch["summary"]["ownerPlayerExposure"];
  topPlayers: MockBatch["summary"]["players"];
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

const compactMockBatchReport = (
  batch: MockBatch,
  strategyKey: LiveDraftStrategyKey,
): CompactMockBatchReport => {
  const cam = batch.summary.owners.find(owner => owner.owner === "Cam");
  return {
    mode: "batch-mock",
    options: {
      ...batch.options,
      strategyKey,
    },
    summary: batch.summary,
    ...(cam === undefined ? {} : { cam }),
    camTopExposures: batch.summary.ownerPlayerExposure
      .filter(exposure => exposure.owner === "Cam")
      .slice(0, 12),
    topPlayers: batch.summary.players.slice(0, 12),
  };
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

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

      if (request.method === "GET" && url.pathname === "/") {
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
        const mockBatchRunner = options.mockBatchRunner ?? runMockBatch;
        const batch = mockBatchRunner({
          projections,
          historicalRecords,
          keepers,
          scenarioKeys: ["expected"],
          runsPerScenario,
          seedPrefix,
          auctionConfigOverrides: strategyAuctionOverridesFor("Cam", strategyKey),
          diagnosticsMode: "summary",
        });
        sendJson(response, 200, compactMockBatchReport(batch, strategyKey));
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
