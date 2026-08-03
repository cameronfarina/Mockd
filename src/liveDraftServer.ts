import http, { type IncomingMessage, type ServerResponse } from "node:http";
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
import {
  defaultLiveDraftStrategyKey,
  parseLiveDraftStrategyKey,
  type LiveDraftStrategyKey,
} from "./modeling/liveDraftStrategies.js";
import { loadEspnWeeksOneToFour, type ProjectionRecord } from "./projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const defaultPort = 4317;
const liveTargetLimit = 500;

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

export interface CreateLiveDraftServerOptions {
  sessionDirectory?: string;
  projections?: readonly ProjectionRecord[];
  historicalRecords?: readonly HistoricalAuctionRecord[];
  interactiveMockDraft?: InteractiveMockDraftModule;
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

export const createLiveDraftServer = async (
  options: CreateLiveDraftServerOptions = {},
): Promise<LiveDraftServerApp> => {
  const projections = options.projections ?? (await loadEspnWeeksOneToFour(projectionPath));
  const historicalRecords = options.historicalRecords ?? (await loadHistoricalAuctionRecords());
  const sessionDirectory = options.sessionDirectory;
  const store = new FileBackedLiveDraftSessionStore(
    sessionDirectory === undefined ? {} : { directory: sessionDirectory },
  );
  await store.load();
  const stateFor = ({
    commands = store.currentCommands(),
    strategyKey = defaultLiveDraftStrategyKey,
  }: {
    commands?: readonly string[];
    strategyKey?: LiveDraftStrategyKey;
  } = {}): LiveDraftStateResponse => {
    const state = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Cam",
      scenarioKey: "expected",
      strategyKey,
      commands,
      targetLimit: liveTargetLimit,
    });
    const session = store.status();
    return {
      ...state,
      session,
      readiness: readinessWithSession(state.readiness, session),
    };
  };
  const mockDraftFor = async ({
    commands = store.currentCommands(),
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
    const commands = store.currentCommands();
    return {
      ...stateFor({ commands, strategyKey }),
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
        sendJson(response, 200, stateFor({ strategyKey: strategyKeyFromQuery(url) }));
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
        const command = typeof body.command === "string" ? body.command.trim() : "";
        if (!command) {
          sendJson(response, 422, {
            ...stateFor({ strategyKey }),
            errors: [{ input: "", message: "Command is required." }],
          });
          return;
        }

        const trialCommands = [...store.currentCommands(), command];
        const trialState = stateFor({ commands: trialCommands, strategyKey });
        const commandError = trialState.errors.find(error => error.input === command);
        if (commandError) {
          sendJson(response, 422, { ...stateFor({ strategyKey }), errors: [commandError] });
          return;
        }

        await store.appendCommand(command);
        sendJson(response, 200, stateFor({ strategyKey }));
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
        const trialCommands = [...store.currentCommands(), command];
        const trialState = stateFor({ commands: trialCommands, strategyKey });
        const commandError = trialState.errors.find(error => error.input === command);
        if (commandError) {
          sendJson(response, 422, {
            ...await stateWithMockDraft(mockDraftRequestFor(strategyKey, seed)),
            errors: [commandError],
          });
          return;
        }

        await store.appendCommand(command);
        sendJson(response, 200, await stateWithMockDraft(mockDraftRequestFor(strategyKey, seed)));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/import") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const importedCommands = Array.isArray(body.commands)
          ? parseLiveDraftCommandImport(JSON.stringify({ commands: body.commands }), "json")
          : parseLiveDraftCommandImport(
            typeof body.content === "string" ? body.content : "",
            importFormatFor(body.format),
          );
        const trialState = stateFor({ commands: importedCommands, strategyKey });
        if (trialState.errors.length) {
          sendJson(response, 422, { ...stateFor({ strategyKey }), errors: trialState.errors });
          return;
        }

        await store.importCommands(importedCommands);
        sendJson(response, 200, stateFor({ strategyKey }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/undo") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        await store.undo();
        sendJson(response, 200, stateFor({ strategyKey }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/reset") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        await store.reset();
        sendJson(response, 200, stateFor({ strategyKey }));
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
