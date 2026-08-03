import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { keepers } from "../config/keepers.js";
import { ownerOrder } from "../config/league.js";
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
const defaultLiveDraftSessionKey = "live";
const defaultLiveDraftSessionDirectory = "data/live-draft";
const interactiveMockSessionDirectoryName = "interactive-mock";
const maximumBatchRunsPerScenario = 250;

export type LiveDraftSessionMode = "real" | "interactive-mock";

interface LiveDraftSessionDescriptor {
  key: string;
  label: string;
  description: string;
}

interface LiveDraftModeDescriptor {
  key: LiveDraftSessionMode;
  label: string;
  description: string;
}

interface DraftNightLockStatus {
  locked: boolean;
  reason?: string;
}

const liveDraftNightLockReason =
  "Live session is locked for mock draft advances. Switch to a practice session to run interactive mocks.";

const draftNightLockFor = (draftSessionKey: string): DraftNightLockStatus =>
  draftSessionKey === defaultLiveDraftSessionKey
    ? { locked: true, reason: liveDraftNightLockReason }
    : { locked: false };

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

const presetDraftSessions: readonly LiveDraftSessionDescriptor[] = [
  {
    key: "live",
    label: "Live",
    description: "Draft-night room. Writes to the main live-draft files.",
  },
  {
    key: "practice-3rb",
    label: "Practice 3RB",
    description: "Practice room for true-three-RB prep.",
  },
  {
    key: "practice-wr-heavy",
    label: "Practice WR Heavy",
    description: "Practice room for receiver-heavy builds.",
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

const isMissingFileError = (error: unknown): boolean =>
  error instanceof Error &&
  "code" in error &&
  (error as NodeJS.ErrnoException).code === "ENOENT";

const readTextFileIfPresent = async (path: string): Promise<string> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) return "";
    throw error;
  }
};

const readJsonFileIfPresent = async (path: string): Promise<unknown | null> => {
  const content = await readTextFileIfPresent(path);
  return content ? JSON.parse(content) : null;
};

interface LiveDraftStateResponse extends LiveDraftState {
  draftMode: LiveDraftSessionMode;
  draftModes: readonly LiveDraftModeDescriptor[];
  activeDraftSession: LiveDraftSessionDescriptor;
  draftSessions: readonly LiveDraftSessionDescriptor[];
  draftNightLock: DraftNightLockStatus;
  session: LiveDraftSessionStatus;
  readiness: LiveDraftReadiness;
}

interface LiveDraftSessionExportBundle {
  version: 1;
  exportedAt: string;
  activeDraftSession: LiveDraftSessionDescriptor;
  draftMode: LiveDraftSessionMode;
  session: LiveDraftSessionStatus;
  readiness: LiveDraftReadiness;
  currentSnapshot: unknown | null;
  backupSnapshot: unknown | null;
  auditLogJsonl: string;
  commandsJson: string;
  commandsCsv: string;
}

type LiveDraftImportConflictType = "ambiguous-player" | "invalid-command" | "invalid-import";

interface LiveDraftImportConflictIssue {
  index: number;
  input: string;
  type: LiveDraftImportConflictType;
  message: string;
  matchOptions: string[];
}

interface LiveDraftImportConflictReview {
  title: string;
  importedCount: number;
  issueCount: number;
  issues: LiveDraftImportConflictIssue[];
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
    nominatedPlayer?: string;
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

const scratchSessionPrefix = "scratch:";

const scratchSlugFromValue = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (!slug) throw new Error("Scratch session name is required.");
  return slug;
};

const draftSessionKeyFromValue = (
  value: unknown,
  fallback = defaultLiveDraftSessionKey,
): string => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") throw new Error("Draft session must be a string.");

  const trimmed = value.trim();
  if (presetDraftSessions.some(session => session.key === trimmed)) return trimmed;
  if (trimmed.startsWith(scratchSessionPrefix)) {
    return `${scratchSessionPrefix}${scratchSlugFromValue(trimmed.slice(scratchSessionPrefix.length))}`;
  }

  throw new Error("Draft session must be live, practice-3rb, practice-wr-heavy, or scratch:<name>.");
};

const draftSessionKeyFromQuery = (
  url: URL,
  fallback = defaultLiveDraftSessionKey,
): string =>
  draftSessionKeyFromValue(url.searchParams.get("draftSession") ?? url.searchParams.get("session"), fallback);

const draftSessionKeyFromBody = (
  body: Record<string, unknown>,
  fallback = defaultLiveDraftSessionKey,
): string =>
  draftSessionKeyFromValue(body.draftSession ?? body.sessionKey ?? body.session, fallback);

const draftSessionDirectoryFor = (baseDirectory: string, draftSessionKey: string): string => {
  if (draftSessionKey === defaultLiveDraftSessionKey) return baseDirectory;
  if (draftSessionKey.startsWith(scratchSessionPrefix)) {
    return join(baseDirectory, "scratch", draftSessionKey.slice(scratchSessionPrefix.length));
  }
  return join(baseDirectory, draftSessionKey);
};

const activeDraftSessionDescriptorFor = (draftSessionKey: string): LiveDraftSessionDescriptor => {
  const preset = presetDraftSessions.find(session => session.key === draftSessionKey);
  if (preset) return preset;

  return {
    key: draftSessionKey,
    label: `Scratch: ${draftSessionKey.slice(scratchSessionPrefix.length)}`,
    description: "Custom scratch room. Isolated from live and preset practice rooms.",
  };
};

const draftSessionDescriptorsFor = (draftSessionKey: string): readonly LiveDraftSessionDescriptor[] => {
  const active = activeDraftSessionDescriptorFor(draftSessionKey);
  if (presetDraftSessions.some(session => session.key === active.key)) return presetDraftSessions;
  return [...presetDraftSessions, active];
};

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

const nominatedPlayerFromValue = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;

  const nominatedPlayer = value.trim();
  return nominatedPlayer ? nominatedPlayer : undefined;
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

const ambiguousPlayerMatchOptionsFor = (message: string): string[] => {
  const matchesText = message.match(/ Matches: (.+)\.$/)?.[1];
  if (!matchesText) return [];
  return matchesText.split(",").map(match => match.trim()).filter(Boolean);
};

const importConflictTypeFor = (message: string): LiveDraftImportConflictType => {
  if (message.startsWith("Ambiguous player")) return "ambiguous-player";
  return "invalid-command";
};

const importConflictReviewFor = (
  commands: readonly string[],
  errors: readonly { input: string; message: string }[],
  title = "Import needs review",
): LiveDraftImportConflictReview => ({
  title,
  importedCount: commands.length,
  issueCount: errors.length,
  issues: errors.map((error, errorIndex) => {
    const commandIndex = commands.findIndex(command => command === error.input);
    return {
      index: commandIndex >= 0 ? commandIndex + 1 : errorIndex + 1,
      input: error.input,
      type: title === "Import could not be read" ? "invalid-import" : importConflictTypeFor(error.message),
      message: error.message,
      matchOptions: ambiguousPlayerMatchOptionsFor(error.message),
    };
  }),
});

const mockDraftRequestFor = (
  strategyKey: LiveDraftStrategyKey,
  seed: string | undefined,
  nominatedPlayer?: string,
): { strategyKey: LiveDraftStrategyKey; seed?: string; nominatedPlayer?: string } => ({
  strategyKey,
  ...(seed === undefined ? {} : { seed }),
  ...(nominatedPlayer === undefined ? {} : { nominatedPlayer }),
});

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

const mockSpeedActions = new Set(["next-ai-sale", "next-cam-decision", "next-round", "complete-mock"]);

const mockDraftRecord = (mockDraft: unknown): Record<string, unknown> =>
  mockDraft && typeof mockDraft === "object" ? mockDraft as Record<string, unknown> : {};

const mockDraftPhaseFor = (mockDraft: unknown): string => {
  const phase = mockDraftRecord(mockDraft).phase;
  return typeof phase === "string" ? phase : "";
};

const mockDraftPickNumberFor = (mockDraft: unknown): number => {
  const pickNumber = mockDraftRecord(mockDraft).pickNumber;
  return typeof pickNumber === "number" && Number.isFinite(pickNumber) ? pickNumber : 1;
};

const mockDraftTopTargetNameFor = (mockDraft: unknown): string | undefined => {
  const topTargets = mockDraftRecord(mockDraft).topTargets;
  if (!Array.isArray(topTargets)) return undefined;
  const candidate = topTargets[0];
  if (!candidate || typeof candidate !== "object") return undefined;
  const name = (candidate as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name.trim() : undefined;
};

const mockDraftRoundForPick = (pickNumber: number): number =>
  Math.floor((Math.max(1, pickNumber) - 1) / ownerOrder.length);

export const createLiveDraftServer = async (
  options: CreateLiveDraftServerOptions = {},
): Promise<LiveDraftServerApp> => {
  const projections = options.projections ?? (await loadEspnWeeksOneToFour(projectionPath));
  const historicalRecords = options.historicalRecords ?? (await loadHistoricalAuctionRecords());
  const baseSessionDirectory = options.sessionDirectory ?? defaultLiveDraftSessionDirectory;
  const sessionStorePairs = new Map<string, Promise<{
    real: FileBackedLiveDraftSessionStore;
    interactiveMock: FileBackedLiveDraftSessionStore;
  }>>();
  const storePairFor = (draftSessionKey: string): Promise<{
    real: FileBackedLiveDraftSessionStore;
    interactiveMock: FileBackedLiveDraftSessionStore;
  }> => {
    const existing = sessionStorePairs.get(draftSessionKey);
    if (existing) return existing;

    const sessionDirectory = draftSessionDirectoryFor(baseSessionDirectory, draftSessionKey);
    const real = new FileBackedLiveDraftSessionStore({ directory: sessionDirectory });
    const interactiveMock = new FileBackedLiveDraftSessionStore({
      directory: join(sessionDirectory, interactiveMockSessionDirectoryName),
    });
    const loaded = Promise.all([real.load(), interactiveMock.load()])
      .then(() => ({ real, interactiveMock }));
    sessionStorePairs.set(draftSessionKey, loaded);
    return loaded;
  };
  const storeFor = async (
    draftSessionKey: string,
    mode: LiveDraftSessionMode,
  ): Promise<FileBackedLiveDraftSessionStore> => {
    const pair = await storePairFor(draftSessionKey);
    return mode === "interactive-mock" ? pair.interactiveMock : pair.real;
  };
  await storePairFor(defaultLiveDraftSessionKey);
  const stateFor = async ({
    draftSessionKey = defaultLiveDraftSessionKey,
    mode = defaultLiveDraftSessionMode,
    commands,
    strategyKey = defaultLiveDraftStrategyKey,
  }: {
    draftSessionKey?: string;
    mode?: LiveDraftSessionMode;
    commands?: readonly string[];
    strategyKey?: LiveDraftStrategyKey;
  } = {}): Promise<LiveDraftStateResponse> => {
    const store = await storeFor(draftSessionKey, mode);
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
      activeDraftSession: activeDraftSessionDescriptorFor(draftSessionKey),
      draftSessions: draftSessionDescriptorsFor(draftSessionKey),
      draftNightLock: draftNightLockFor(draftSessionKey),
      session,
      readiness: readinessWithSession(state.readiness, session),
    };
  };
  const mockDraftFor = async ({
    draftSessionKey = defaultLiveDraftSessionKey,
    commands,
    strategyKey,
    seed,
    nominatedPlayer,
  }: {
    draftSessionKey?: string;
    commands?: readonly string[];
    strategyKey: LiveDraftStrategyKey;
    seed?: string;
    nominatedPlayer?: string;
  }): Promise<unknown> => {
    const interactiveMockDraft = await loadInteractiveMockDraftModule(options.interactiveMockDraft);
    const interactiveMockStore = await storeFor(draftSessionKey, "interactive-mock");
    return interactiveMockDraft.buildInteractiveMockDraftState({
      projections,
      historicalRecords,
      keepers,
      commands: commands ?? interactiveMockStore.currentCommands(),
      watchOwner: "Cam",
      strategyKey,
      ...(seed === undefined ? {} : { seed }),
      ...(nominatedPlayer === undefined ? {} : { nominatedPlayer }),
    });
  };
  const stateWithMockDraft = async ({
    draftSessionKey = defaultLiveDraftSessionKey,
    strategyKey,
    seed,
    nominatedPlayer,
  }: {
    draftSessionKey?: string;
    strategyKey: LiveDraftStrategyKey;
    seed?: string;
    nominatedPlayer?: string;
  }): Promise<LiveDraftStateResponse & { mockDraft: unknown }> => {
    const interactiveMockStore = await storeFor(draftSessionKey, "interactive-mock");
    const commands = interactiveMockStore.currentCommands();
    return {
      ...await stateFor({ draftSessionKey, mode: "interactive-mock", commands, strategyKey }),
      mockDraft: await mockDraftFor({
        ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer),
        draftSessionKey,
        commands,
      }),
    };
  };
  const exportBundleFor = async ({
    draftSessionKey,
    mode,
    strategyKey,
  }: {
    draftSessionKey: string;
    mode: LiveDraftSessionMode;
    strategyKey: LiveDraftStrategyKey;
  }): Promise<LiveDraftSessionExportBundle> => {
    const store = await storeFor(draftSessionKey, mode);
    const state = await stateFor({ draftSessionKey, mode, strategyKey });
    const commands = store.currentCommands();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      activeDraftSession: state.activeDraftSession,
      draftMode: state.draftMode,
      session: state.session,
      readiness: state.readiness,
      currentSnapshot: await readJsonFileIfPresent(state.session.paths.currentPath),
      backupSnapshot: await readJsonFileIfPresent(state.session.paths.backupPath),
      auditLogJsonl: await readTextFileIfPresent(state.session.paths.logPath),
      commandsJson: liveDraftCommandsJson(commands),
      commandsCsv: liveDraftCommandsCsv(commands),
    };
  };
  const appendInteractiveMockCommand = async ({
    store,
    draftSessionKey,
    strategyKey,
    command,
  }: {
    store: FileBackedLiveDraftSessionStore;
    draftSessionKey: string;
    strategyKey: LiveDraftStrategyKey;
    command: string;
  }): Promise<{ input: string; message: string } | undefined> => {
    const trialCommands = [...store.currentCommands(), command];
    const trialState = await stateFor({
      draftSessionKey,
      mode: "interactive-mock",
      commands: trialCommands,
      strategyKey,
    });
    const commandError = trialState.errors.find(error => error.input === command);
    if (commandError) return commandError;

    await store.appendCommand(command);
    return undefined;
  };
  const runMockSpeedAction = async ({
    draftSessionKey,
    strategyKey,
    seed,
    action,
    nominatedPlayer,
  }: {
    draftSessionKey: string;
    strategyKey: LiveDraftStrategyKey;
    seed?: string;
    action: string;
    nominatedPlayer?: string;
  }): Promise<{ status: number; body: LiveDraftStateResponse & { mockDraft: unknown; errors?: { input: string; message: string }[] } }> => {
    const interactiveMockDraft = await loadInteractiveMockDraftModule(options.interactiveMockDraft);
    const interactiveMockStore = await storeFor(draftSessionKey, "interactive-mock");
    const maximumSteps = ownerOrder.length * 20;
    let appendedCount = 0;
    let startRound: number | undefined;
    let nextNominatedPlayer = nominatedPlayer;

    for (let step = 0; step < maximumSteps; step += 1) {
      const mockDraft = await mockDraftFor({
        ...mockDraftRequestFor(strategyKey, seed, nextNominatedPlayer),
        draftSessionKey,
      });
      const phase = mockDraftPhaseFor(mockDraft);
      const pickNumber = mockDraftPickNumberFor(mockDraft);
      startRound ??= mockDraftRoundForPick(pickNumber);

      if (action === "next-ai-sale" && appendedCount > 0) break;
      if ((action === "next-cam-decision" || action === "next-round") && (
        phase === "human-decision" ||
        phase === "human-nomination" ||
        phase === "complete" ||
        phase === "blocked"
      )) break;
      if (action === "next-round" && appendedCount > 0 && mockDraftRoundForPick(pickNumber) !== startRound) break;
      if (action === "complete-mock" && (phase === "complete" || phase === "blocked")) break;

      let command: string | undefined;
      if (phase === "ai-sale") {
        command = commandFromInteractiveMockAction(
          interactiveMockDraft.resolveInteractiveMockDraftAction(mockDraft, "advance"),
        );
      } else if (phase === "human-decision" && action === "complete-mock") {
        command = commandFromInteractiveMockAction(
          interactiveMockDraft.resolveInteractiveMockDraftAction(mockDraft, "cam-bid"),
        );
      } else if (phase === "human-nomination" && action === "complete-mock") {
        const automaticNomination = mockDraftTopTargetNameFor(mockDraft);
        if (!automaticNomination) break;
        const nominatedMockDraft = await mockDraftFor({
          ...mockDraftRequestFor(strategyKey, seed, automaticNomination),
          draftSessionKey,
        });
        const nominatedPhase = mockDraftPhaseFor(nominatedMockDraft);
        command = commandFromInteractiveMockAction(
          interactiveMockDraft.resolveInteractiveMockDraftAction(
            nominatedMockDraft,
            nominatedPhase === "human-decision" ? "cam-bid" : "advance",
          ),
        );
      } else {
        break;
      }

      const commandError = await appendInteractiveMockCommand({
        store: interactiveMockStore,
        draftSessionKey,
        strategyKey,
        command,
      });
      if (commandError) {
        return {
          status: 422,
          body: {
            ...await stateWithMockDraft({ ...mockDraftRequestFor(strategyKey, seed, nextNominatedPlayer), draftSessionKey }),
            errors: [commandError],
          },
        };
      }

      appendedCount += 1;
      nextNominatedPlayer = undefined;
    }

    return {
      status: 200,
      body: await stateWithMockDraft({ ...mockDraftRequestFor(strategyKey, seed), draftSessionKey }),
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
        sendJson(response, 200, await stateFor({
          draftSessionKey: draftSessionKeyFromQuery(url),
          mode: sessionModeFromQuery(url),
          strategyKey: strategyKeyFromQuery(url),
        }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/mock/state") {
        const strategyKey = strategyKeyFromQuery(url);
        const seed = seedFromValue(url.searchParams.get("seed"));
        const nominatedPlayer = nominatedPlayerFromValue(url.searchParams.get("nominatedPlayer"));
        sendJson(response, 200, await stateWithMockDraft({
          ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer),
          draftSessionKey: draftSessionKeyFromQuery(url),
        }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/export") {
        const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
        const store = await storeFor(draftSessionKeyFromQuery(url), sessionModeFromQuery(url));
        const commands = store.currentCommands();
        if (format === "csv") {
          sendText(response, 200, "text/csv", liveDraftCommandsCsv(commands));
        } else {
          sendText(response, 200, "application/json", liveDraftCommandsJson(commands));
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/export-bundle") {
        sendText(response, 200, "application/json", `${JSON.stringify(await exportBundleFor({
          draftSessionKey: draftSessionKeyFromQuery(url),
          mode: sessionModeFromQuery(url),
          strategyKey: strategyKeyFromQuery(url),
        }), null, 2)}\n`);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/events") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const mode = sessionModeFromBody(body);
        const draftSessionKey = draftSessionKeyFromBody(body);
        const store = await storeFor(draftSessionKey, mode);
        const command = typeof body.command === "string" ? body.command.trim() : "";
        if (!command) {
          sendJson(response, 422, {
            ...await stateFor({ draftSessionKey, mode, strategyKey }),
            errors: [{ input: "", message: "Command is required." }],
          });
          return;
        }

        const trialCommands = [...store.currentCommands(), command];
        const trialState = await stateFor({ draftSessionKey, mode, commands: trialCommands, strategyKey });
        const commandError = trialState.errors.find(error => error.input === command);
        if (commandError) {
          sendJson(response, 422, { ...await stateFor({ draftSessionKey, mode, strategyKey }), errors: [commandError] });
          return;
        }

        await store.appendCommand(command);
        sendJson(response, 200, await stateFor({ draftSessionKey, mode, strategyKey }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/mock/advance") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const draftSessionKey = draftSessionKeyFromBody(body);
        const seed = seedFromValue(body.seed);
        const nominatedPlayer = nominatedPlayerFromValue(body.nominatedPlayer);
        const action = typeof body.action === "string" ? body.action.trim() : "";
        const lock = draftNightLockFor(draftSessionKey);
        if (lock.locked) {
          sendJson(response, 423, {
            ...await stateFor({ draftSessionKey, mode: "interactive-mock", strategyKey }),
            errors: [{ input: "", message: lock.reason ?? "Live session is locked for mock draft advances." }],
          });
          return;
        }

        if (!action) {
          sendJson(response, 422, {
            ...await stateWithMockDraft({ ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer), draftSessionKey }),
            errors: [{ input: "", message: "Mock draft action is required." }],
          });
          return;
        }

        if (mockSpeedActions.has(action)) {
          const result = await runMockSpeedAction({
            draftSessionKey,
            strategyKey,
            action,
            ...(seed === undefined ? {} : { seed }),
            ...(nominatedPlayer === undefined ? {} : { nominatedPlayer }),
          });
          sendJson(response, result.status, result.body);
          return;
        }

        if (action === "cam-nominate") {
          if (!nominatedPlayer) {
            sendJson(response, 422, {
              ...await stateWithMockDraft({ ...mockDraftRequestFor(strategyKey, seed), draftSessionKey }),
              errors: [{ input: "", message: "Select a player for Cam to nominate." }],
            });
            return;
          }

          sendJson(response, 200, await stateWithMockDraft({
            ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer),
            draftSessionKey,
          }));
          return;
        }

        const interactiveMockDraft = await loadInteractiveMockDraftModule(options.interactiveMockDraft);
        const interactiveMockStore = await storeFor(draftSessionKey, "interactive-mock");
        const mockDraft = await mockDraftFor({ ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer), draftSessionKey });
        const command = commandFromInteractiveMockAction(
          interactiveMockDraft.resolveInteractiveMockDraftAction(mockDraft, action),
        );
        const trialCommands = [...interactiveMockStore.currentCommands(), command];
        const trialState = await stateFor({
          draftSessionKey,
          mode: "interactive-mock",
          commands: trialCommands,
          strategyKey,
        });
        const commandError = trialState.errors.find(error => error.input === command);
        if (commandError) {
          sendJson(response, 422, {
            ...await stateWithMockDraft({ ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer), draftSessionKey }),
            errors: [commandError],
          });
          return;
        }

        await interactiveMockStore.appendCommand(command);
        sendJson(response, 200, await stateWithMockDraft({ ...mockDraftRequestFor(strategyKey, seed), draftSessionKey }));
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
        const draftSessionKey = draftSessionKeyFromBody(body);
        const store = await storeFor(draftSessionKey, mode);
        let importedCommands: string[];
        try {
          importedCommands = Array.isArray(body.commands)
            ? parseLiveDraftCommandImport(JSON.stringify({ commands: body.commands }), "json")
            : parseLiveDraftCommandImport(
              typeof body.content === "string" ? body.content : "",
              importFormatFor(body.format),
            );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Draft log import could not be read.";
          const parseError = { input: "", message };
          sendJson(response, 422, {
            ...await stateFor({ draftSessionKey, mode, strategyKey }),
            errors: [parseError],
            conflictReview: importConflictReviewFor([], [parseError], "Import could not be read"),
          });
          return;
        }

        const trialState = await stateFor({ draftSessionKey, mode, commands: importedCommands, strategyKey });
        if (trialState.errors.length) {
          sendJson(response, 422, {
            ...await stateFor({ draftSessionKey, mode, strategyKey }),
            errors: trialState.errors,
            conflictReview: importConflictReviewFor(importedCommands, trialState.errors),
          });
          return;
        }

        await store.importCommands(importedCommands);
        sendJson(response, 200, await stateFor({ draftSessionKey, mode, strategyKey }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/undo") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const mode = sessionModeFromBody(body);
        const draftSessionKey = draftSessionKeyFromBody(body);
        const store = await storeFor(draftSessionKey, mode);
        await store.undo();
        sendJson(response, 200, await stateFor({ draftSessionKey, mode, strategyKey }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/reset") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const mode = sessionModeFromBody(body);
        const draftSessionKey = draftSessionKeyFromBody(body);
        const store = await storeFor(draftSessionKey, mode);
        await store.reset();
        sendJson(response, 200, await stateFor({ draftSessionKey, mode, strategyKey }));
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
