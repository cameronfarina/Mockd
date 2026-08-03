import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "./data/parseHistoricalBoards.js";
import { buildLiveDraftState } from "./modeling/liveDraft.js";
import { loadEspnWeeksOneToFour } from "./projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const defaultPort = 4317;

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

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mockd Draft Room</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8f5;
      --surface: #ffffff;
      --surface-soft: #eef3ef;
      --text: #17201b;
      --muted: #657167;
      --line: #cfd8d0;
      --accent: #146c5a;
      --accent-strong: #0c4d41;
      --danger: #a33b2f;
      --warn: #8a6114;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
    }

    button, input {
      font: inherit;
    }

    .app {
      display: grid;
      grid-template-rows: auto auto 1fr;
      min-height: 100vh;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 20px 12px;
      border-bottom: 1px solid var(--line);
      background: var(--surface);
    }

    h1 {
      margin: 0;
      font-size: 20px;
      line-height: 1.1;
      letter-spacing: 0;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(5, minmax(120px, 1fr));
      gap: 10px;
      padding: 12px 20px;
      border-bottom: 1px solid var(--line);
      background: var(--surface-soft);
    }

    .metric {
      min-width: 0;
    }

    .metric span {
      display: block;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.2;
    }

    .metric strong {
      display: block;
      margin-top: 3px;
      font-size: 18px;
      line-height: 1.15;
      letter-spacing: 0;
    }

    .controls {
      display: flex;
      gap: 8px;
      align-items: center;
      width: min(820px, 100%);
    }

    .controls input {
      width: 100%;
      min-width: 180px;
      height: 38px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0 11px;
      background: #fff;
      color: var(--text);
    }

    .controls button {
      height: 38px;
      border: 1px solid var(--accent);
      border-radius: 6px;
      padding: 0 12px;
      background: var(--accent);
      color: #fff;
      cursor: pointer;
      white-space: nowrap;
    }

    .controls button.secondary {
      border-color: var(--line);
      background: #fff;
      color: var(--text);
    }

    main {
      display: grid;
      grid-template-columns: minmax(260px, 330px) minmax(520px, 1fr) minmax(260px, 360px);
      gap: 14px;
      padding: 14px 20px 20px;
      min-height: 0;
    }

    section {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      overflow: hidden;
    }

    section h2 {
      margin: 0;
      padding: 11px 12px;
      border-bottom: 1px solid var(--line);
      font-size: 13px;
      line-height: 1.2;
      letter-spacing: 0;
      text-transform: uppercase;
      color: var(--muted);
      background: #fbfcfa;
    }

    .scroll {
      overflow: auto;
      max-height: calc(100vh - 190px);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th, td {
      padding: 8px 9px;
      border-bottom: 1px solid #edf0eb;
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
    }

    th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: #fbfcfa;
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
    }

    td.money, th.money {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .player {
      font-weight: 650;
    }

    .subtle {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.25;
    }

    .tag {
      display: inline-block;
      margin: 2px 4px 0 0;
      padding: 2px 5px;
      border-radius: 4px;
      background: #e5eee9;
      color: var(--accent-strong);
      font-size: 11px;
      line-height: 1.2;
    }

    .delta-up {
      color: var(--danger);
      font-weight: 650;
    }

    .delta-down {
      color: var(--accent-strong);
      font-weight: 650;
    }

    .error {
      padding: 9px 12px;
      border-bottom: 1px solid #f0d4cf;
      background: #fff5f3;
      color: var(--danger);
    }

    @media (max-width: 1120px) {
      main {
        grid-template-columns: 1fr;
      }

      .scroll {
        max-height: none;
      }
    }

    @media (max-width: 760px) {
      header {
        align-items: stretch;
        flex-direction: column;
      }

      .controls {
        flex-wrap: wrap;
      }

      .controls input {
        flex-basis: 100%;
      }

      .metrics {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  </style>
</head>
<body>
  <div class="app">
    <header>
      <h1>Mockd Draft Room</h1>
      <form class="controls" id="sale-form">
        <input id="sale-input" autocomplete="off" placeholder="Jakub drafted Kittle for 28">
        <button type="submit">Add</button>
        <button class="secondary" type="button" id="undo-button">Undo</button>
        <button class="secondary" type="button" id="reset-button">Reset</button>
      </form>
    </header>
    <div class="metrics" id="metrics"></div>
    <main>
      <section>
        <h2>Cam</h2>
        <div id="watch-owner"></div>
      </section>
      <section>
        <h2>Targets</h2>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th style="width:54px">Pos</th>
                <th class="money" style="width:70px">Exp</th>
                <th class="money" style="width:70px">Live</th>
                <th class="money" style="width:70px">Max</th>
                <th class="money" style="width:78px">Score</th>
              </tr>
            </thead>
            <tbody id="targets"></tbody>
          </table>
        </div>
      </section>
      <section>
        <h2>Room</h2>
        <div id="errors"></div>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Owner</th>
                <th class="money">Left</th>
                <th class="money">Max</th>
                <th class="money">Slots</th>
              </tr>
            </thead>
            <tbody id="owners"></tbody>
          </table>
          <table>
            <thead>
              <tr>
                <th>Sale</th>
                <th class="money">Paid</th>
                <th class="money">Delta</th>
              </tr>
            </thead>
            <tbody id="events"></tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
  <script>
    const money = value => '$' + Math.round(value);
    const byId = id => document.getElementById(id);

    const postJson = async (url, body) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {})
      });
      const data = await response.json();
      render(data);
    };

    const cell = (row, text, className) => {
      const element = document.createElement('td');
      element.textContent = text;
      if (className) element.className = className;
      row.appendChild(element);
      return element;
    };

    const renderMetrics = state => {
      const metrics = [
        ['Inflation', state.room.liveInflationFactor.toFixed(2) + 'x'],
        ['Room Left', money(state.room.remainingBudget)],
        ['Slots', String(state.room.remainingRosterSlots)],
        ['Paid vs Exp', (state.room.saleVsExpected >= 0 ? '+' : '') + money(state.room.saleVsExpected).replace('$-', '-$')],
        ['Cam Max', money(state.watchOwner.maxBid)]
      ];
      byId('metrics').replaceChildren(...metrics.map(([label, value]) => {
        const element = document.createElement('div');
        element.className = 'metric';
        element.innerHTML = '<span>' + label + '</span><strong>' + value + '</strong>';
        return element;
      }));
    };

    const renderWatchOwner = state => {
      const root = byId('watch-owner');
      const rows = state.watchOwner.roster.map(player => {
        const row = document.createElement('tr');
        cell(row, player.name, 'player');
        cell(row, player.position);
        cell(row, money(player.price), 'money');
        return row;
      });
      const summary = document.createElement('div');
      summary.style.padding = '10px 12px';
      summary.innerHTML = '<strong>' + money(state.watchOwner.budgetRemaining) + '</strong> left - <strong>' + money(state.watchOwner.maxBid) + '</strong> max bid - <strong>' + state.watchOwner.rosterSlotsRemaining + '</strong> slots';
      const table = document.createElement('table');
      table.innerHTML = '<thead><tr><th>Player</th><th style="width:54px">Pos</th><th class="money" style="width:70px">Paid</th></tr></thead>';
      const body = document.createElement('tbody');
      body.replaceChildren(...rows);
      table.appendChild(body);
      root.replaceChildren(summary, table);
    };

    const renderTargets = state => {
      const rows = state.availableTargets.slice(0, 45).map(target => {
        const row = document.createElement('tr');
        const player = cell(row, target.name, 'player');
        if (target.tags.length) {
          const tags = document.createElement('div');
          tags.className = 'subtle';
          tags.innerHTML = target.tags.map(tag => '<span class="tag">' + tag + '</span>').join('');
          player.appendChild(tags);
        }
        cell(row, target.position);
        cell(row, money(target.expectedPrice), 'money');
        cell(row, money(target.liveExpectedPrice), 'money');
        cell(row, money(target.recommendedMaxBid), 'money');
        cell(row, target.valueScore.toFixed(2), 'money');
        return row;
      });
      byId('targets').replaceChildren(...rows);
    };

    const renderOwners = state => {
      const rows = state.owners.map(owner => {
        const row = document.createElement('tr');
        cell(row, owner.owner, 'player');
        cell(row, money(owner.budgetRemaining), 'money');
        cell(row, money(owner.maxBid), 'money');
        cell(row, String(owner.rosterSlotsRemaining), 'money');
        return row;
      });
      byId('owners').replaceChildren(...rows);
    };

    const renderEvents = state => {
      const rows = state.events.slice().reverse().map(event => {
        const row = document.createElement('tr');
        const label = cell(row, event.owner + ' - ' + event.player, 'player');
        const detail = document.createElement('div');
        detail.className = 'subtle';
        detail.textContent = event.position + ' - exp ' + money(event.expectedPrice) + ' - ' + event.playerSource;
        label.appendChild(detail);
        cell(row, money(event.price), 'money');
        const delta = cell(row, (event.saleVsExpected >= 0 ? '+' : '') + money(event.saleVsExpected).replace('$-', '-$'), 'money');
        delta.classList.add(event.saleVsExpected >= 0 ? 'delta-up' : 'delta-down');
        return row;
      });
      byId('events').replaceChildren(...rows);
    };

    const renderErrors = state => {
      const errors = state.errors.map(error => {
        const element = document.createElement('div');
        element.className = 'error';
        element.textContent = error.message;
        return element;
      });
      byId('errors').replaceChildren(...errors);
    };

    const render = state => {
      renderMetrics(state);
      renderWatchOwner(state);
      renderTargets(state);
      renderOwners(state);
      renderEvents(state);
      renderErrors(state);
    };

    byId('sale-form').addEventListener('submit', event => {
      event.preventDefault();
      const input = byId('sale-input');
      const command = input.value.trim();
      if (!command) return;
      postJson('/api/events', { command });
      input.value = '';
      input.focus();
    });
    byId('undo-button').addEventListener('click', () => postJson('/api/undo'));
    byId('reset-button').addEventListener('click', () => postJson('/api/reset'));

    fetch('/api/state').then(response => response.json()).then(render);
  </script>
</body>
</html>`;

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
  response.end(html);
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
    });

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

      if (request.method === "GET" && url.pathname === "/") {
        sendHtml(response);
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
