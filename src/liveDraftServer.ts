import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "./data/parseHistoricalBoards.js";
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
import { loadEspnWeeksOneToFour } from "./projections.js";

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

const main = async (): Promise<void> => {
  const projections = await loadEspnWeeksOneToFour(projectionPath);
  const historicalRecords = await loadHistoricalAuctionRecords();
  const port = portFromOptions();
  const sessionDirectory = sessionDirectoryFromOptions();
  const store = new FileBackedLiveDraftSessionStore(
    sessionDirectory === undefined ? {} : { directory: sessionDirectory },
  );
  await store.load();
  const stateFor = (nextCommands = store.currentCommands()): LiveDraftStateResponse => {
    const state = buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Cam",
      scenarioKey: "expected",
      commands: nextCommands,
      targetLimit: liveTargetLimit,
    });
    const session = store.status();
    return {
      ...state,
      session,
      readiness: readinessWithSession(state.readiness, session),
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
        sendJson(response, 200, stateFor());
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
        const command = typeof body.command === "string" ? body.command.trim() : "";
        if (!command) {
          sendJson(response, 422, { ...stateFor(), errors: [{ input: "", message: "Command is required." }] });
          return;
        }

        const trialCommands = [...store.currentCommands(), command];
        const trialState = stateFor(trialCommands);
        const commandError = trialState.errors.find(error => error.input === command);
        if (commandError) {
          sendJson(response, 422, { ...stateFor(), errors: [commandError] });
          return;
        }

        await store.appendCommand(command);
        sendJson(response, 200, stateFor());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/import") {
        const body = await parseJsonBody(request);
        const importedCommands = Array.isArray(body.commands)
          ? parseLiveDraftCommandImport(JSON.stringify({ commands: body.commands }), "json")
          : parseLiveDraftCommandImport(
            typeof body.content === "string" ? body.content : "",
            importFormatFor(body.format),
          );
        const trialState = stateFor(importedCommands);
        if (trialState.errors.length) {
          sendJson(response, 422, { ...stateFor(), errors: trialState.errors });
          return;
        }

        await store.importCommands(importedCommands);
        sendJson(response, 200, stateFor());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/undo") {
        await store.undo();
        sendJson(response, 200, stateFor());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/reset") {
        await store.reset();
        sendJson(response, 200, stateFor());
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Unknown live draft server error.",
      });
    }
  });

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
