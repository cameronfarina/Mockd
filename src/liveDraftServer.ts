import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "./data/parseHistoricalBoards.js";
import { liveDraftHtml } from "./liveDraftUi.js";
import { buildLiveDraftState } from "./modeling/liveDraft.js";
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

const sendHtml = (response: ServerResponse): void => {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(liveDraftHtml);
};

const main = async (): Promise<void> => {
  const projections = await loadEspnWeeksOneToFour(projectionPath);
  const historicalRecords = await loadHistoricalAuctionRecords();
  const port = portFromOptions();
  const commands: string[] = [];
  const stateFor = (nextCommands = commands) =>
    buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Cam",
      scenarioKey: "expected",
      commands: nextCommands,
      targetLimit: liveTargetLimit,
    });

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

      if (request.method === "POST" && url.pathname === "/api/events") {
        const body = JSON.parse(await readRequestBody(request) || "{}") as { command?: unknown };
        const command = typeof body.command === "string" ? body.command.trim() : "";
        if (!command) {
          sendJson(response, 422, { ...stateFor(), errors: [{ input: "", message: "Command is required." }] });
          return;
        }

        const trialCommands = [...commands, command];
        const trialState = stateFor(trialCommands);
        const commandError = trialState.errors.find(error => error.input === command);
        if (commandError) {
          sendJson(response, 422, { ...stateFor(), errors: [commandError] });
          return;
        }

        commands.push(command);
        sendJson(response, 200, trialState);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/undo") {
        commands.pop();
        sendJson(response, 200, stateFor());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/reset") {
        commands.length = 0;
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

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
