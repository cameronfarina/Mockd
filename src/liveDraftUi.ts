export const liveDraftHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mockd Draft Room</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f4;
      --surface: #ffffff;
      --surface-2: #f0f3f5;
      --text: #111817;
      --muted: #69746f;
      --line: #d5ddd8;
      --line-soft: #edf1ee;
      --accent: #0f766e;
      --accent-strong: #0b4f4a;
      --blue: #1d4ed8;
      --amber: #9a6700;
      --danger: #b33b31;
      --shadow: 0 1px 2px rgba(17, 24, 23, 0.06);
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

    button, input, select {
      font: inherit;
    }

    button {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
    }

    button.primary {
      border-color: var(--accent);
      background: var(--accent);
      color: #fff;
    }

    button.icon {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border-color: var(--accent);
      color: var(--accent-strong);
      font-weight: 750;
      line-height: 1;
    }

    input, select {
      height: 34px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0 9px;
      background: #fff;
      color: var(--text);
    }

    .app {
      display: grid;
      grid-template-rows: auto auto 1fr;
      min-height: 100vh;
    }

    header {
      display: grid;
      grid-template-columns: minmax(160px, 220px) minmax(340px, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--line);
      background: var(--surface);
    }

    h1 {
      margin: 0;
      font-size: 19px;
      line-height: 1.1;
      letter-spacing: 0;
    }

    .search {
      width: 100%;
      height: 38px;
    }

    .top-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
    }

    .top-actions button {
      height: 34px;
      padding: 0 11px;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(6, minmax(120px, 1fr));
      gap: 1px;
      border-bottom: 1px solid var(--line);
      background: var(--line);
    }

    .metric {
      min-width: 0;
      padding: 10px 12px;
      background: var(--surface-2);
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
      white-space: nowrap;
    }

    main {
      display: grid;
      grid-template-columns: minmax(680px, 1fr) 390px;
      gap: 12px;
      min-height: 0;
      padding: 12px 16px 16px;
    }

    section, aside {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 42px;
      padding: 8px 10px;
      border-bottom: 1px solid var(--line);
      background: #fbfcfa;
    }

    h2 {
      margin: 0;
      font-size: 13px;
      line-height: 1.2;
      letter-spacing: 0;
      text-transform: uppercase;
      color: var(--muted);
    }

    .board-count {
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }

    .scroll {
      overflow: auto;
      max-height: calc(100vh - 178px);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th, td {
      padding: 7px 8px;
      border-bottom: 1px solid var(--line-soft);
      text-align: left;
      vertical-align: middle;
      overflow-wrap: anywhere;
    }

    th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: #fbfcfa;
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
      white-space: nowrap;
    }

    td.money, th.money, td.center, th.center {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    td.center, th.center {
      text-align: center;
    }

    .player-name {
      font-weight: 700;
      line-height: 1.18;
    }

    .subtle {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.25;
    }

    .tag {
      display: inline-block;
      margin: 3px 4px 0 0;
      padding: 2px 5px;
      border-radius: 4px;
      background: #e7f0ec;
      color: var(--accent-strong);
      font-size: 11px;
      line-height: 1.2;
    }

    .side {
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      min-height: 0;
    }

    .add-form {
      display: grid;
      grid-template-columns: 1fr 90px;
      gap: 8px;
      padding: 10px;
      border-bottom: 1px solid var(--line);
      background: #fff;
    }

    .selected-player {
      grid-column: 1 / -1;
      min-height: 38px;
      padding: 8px 9px;
      border: 1px solid var(--line-soft);
      border-radius: 6px;
      background: #fafbf9;
    }

    .selected-player strong {
      display: block;
      line-height: 1.2;
    }

    .add-form button {
      height: 34px;
      padding: 0 10px;
    }

    .roster-toolbar {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 10px;
      border-bottom: 1px solid var(--line);
      background: var(--surface-2);
    }

    .roster-summary {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }

    .mini-metric {
      min-width: 0;
      padding: 7px 8px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
    }

    .mini-metric span {
      display: block;
      color: var(--muted);
      font-size: 11px;
    }

    .mini-metric strong {
      display: block;
      margin-top: 2px;
      font-size: 14px;
      font-variant-numeric: tabular-nums;
    }

    .side-scroll {
      overflow: auto;
      max-height: calc(100vh - 332px);
    }

    .slot {
      width: 58px;
      color: var(--muted);
      font-weight: 650;
      white-space: nowrap;
    }

    .empty {
      color: #9aa39f;
    }

    .section-label {
      padding: 10px 10px 6px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
      text-transform: uppercase;
    }

    .error {
      padding: 8px 10px;
      border-bottom: 1px solid #f0d4cf;
      background: #fff5f3;
      color: var(--danger);
      font-size: 13px;
    }

    .delta-up {
      color: var(--danger);
      font-weight: 700;
    }

    .delta-down {
      color: var(--accent-strong);
      font-weight: 700;
    }

    @media (max-width: 1160px) {
      header {
        grid-template-columns: 1fr;
      }

      .top-actions {
        justify-content: flex-start;
      }

      main {
        grid-template-columns: 1fr;
      }

      .scroll, .side-scroll {
        max-height: none;
      }
    }

    @media (max-width: 760px) {
      .metrics {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      main {
        padding: 10px;
      }

      .board-table th:nth-child(7),
      .board-table td:nth-child(7),
      .board-table th:nth-child(9),
      .board-table td:nth-child(9) {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="app">
    <header>
      <h1>Mockd Draft Room</h1>
      <input class="search" id="board-search" autocomplete="off" placeholder="Search player, position, or team">
      <div class="top-actions">
        <button type="button" id="undo-button">Undo</button>
        <button type="button" id="reset-button">Reset</button>
      </div>
    </header>
    <div class="metrics" id="metrics"></div>
    <main>
      <section>
        <div class="panel-header">
          <h2>Board</h2>
          <div class="board-count" id="board-count"></div>
        </div>
        <div class="scroll">
          <table class="board-table">
            <thead>
              <tr>
                <th class="center" style="width:42px">Add</th>
                <th>Player</th>
                <th style="width:52px">Pos</th>
                <th style="width:62px">Team</th>
                <th class="center" style="width:54px">Bye</th>
                <th class="money" style="width:66px">Exp</th>
                <th class="money" style="width:66px">Live</th>
                <th class="money" style="width:66px">Our</th>
                <th class="money" style="width:66px">Max</th>
                <th class="money" style="width:70px">Score</th>
              </tr>
            </thead>
            <tbody id="board"></tbody>
          </table>
        </div>
      </section>
      <aside class="side">
        <div class="panel-header">
          <h2>Team</h2>
          <span class="subtle" id="sale-count"></span>
        </div>
        <div id="errors"></div>
        <form class="add-form" id="add-form">
          <div class="selected-player" id="selected-player"></div>
          <select id="add-owner"></select>
          <input id="add-price" inputmode="numeric" pattern="[0-9]*">
          <button class="primary" type="submit">Add</button>
          <select id="roster-owner"></select>
        </form>
        <div class="roster-toolbar">
          <div class="roster-summary" id="roster-summary"></div>
        </div>
        <div class="side-scroll">
          <div class="section-label">Roster</div>
          <table>
            <tbody id="roster-slots"></tbody>
          </table>
          <div class="section-label">Budgets</div>
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
          <div class="section-label">Sales</div>
          <table>
            <tbody id="events"></tbody>
          </table>
        </div>
      </aside>
    </main>
  </div>
  <script>
    let currentState = null;
    let selectedTargetName = null;
    let selectedRosterOwner = 'Cam';

    const byId = id => document.getElementById(id);
    const money = value => '$' + Math.round(Number(value || 0));
    const deltaMoney = value => {
      const rounded = Math.round(Number(value || 0));
      if (rounded === 0) return '$0';
      return (rounded > 0 ? '+' : '-') + '$' + Math.abs(rounded);
    };
    const cleanText = value => String(value == null ? '' : value);

    const postJson = async (url, body) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {})
      });
      const data = await response.json();
      render(data);
      return data;
    };

    const tableCell = (row, text, className) => {
      const element = document.createElement('td');
      element.textContent = cleanText(text);
      if (className) element.className = className;
      row.appendChild(element);
      return element;
    };

    const ownerByName = name => currentState.owners.find(owner => owner.owner === name) || currentState.watchOwner;
    const selectedTarget = () => currentState && currentState.availableTargets.find(target => target.name === selectedTargetName);

    const renderMetrics = state => {
      const metrics = [
        ['Inflation', state.room.liveInflationFactor.toFixed(2) + 'x'],
        ['Room Left', money(state.room.remainingBudget)],
        ['Open Slots', String(state.room.remainingRosterSlots)],
        ['Paid vs Exp', deltaMoney(state.room.saleVsExpected)],
        ['Cam Left', money(state.watchOwner.budgetRemaining)],
        ['Cam Max', money(state.watchOwner.maxBid)]
      ];

      byId('metrics').replaceChildren(...metrics.map(([label, value]) => {
        const element = document.createElement('div');
        element.className = 'metric';
        element.innerHTML = '<span>' + label + '</span><strong>' + value + '</strong>';
        return element;
      }));
    };

    const optionList = state => state.owners.map(owner => {
      const option = document.createElement('option');
      option.value = owner.owner;
      option.textContent = owner.owner;
      return option;
    });

    const syncOwnerSelects = state => {
      const addOwner = byId('add-owner');
      const rosterOwner = byId('roster-owner');
      if (addOwner.options.length !== state.owners.length) {
        addOwner.replaceChildren(...optionList(state));
        rosterOwner.replaceChildren(...optionList(state));
      }
      addOwner.value = selectedRosterOwner;
      rosterOwner.value = selectedRosterOwner;
    };

    const targetMatchesQuery = (target, query) => {
      if (!query) return true;
      const haystack = [
        target.name,
        target.position,
        target.teamAbbreviation || '',
        String(target.byeWeek || '')
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    };

    const renderBoard = state => {
      const query = byId('board-search').value.trim().toLowerCase();
      const matches = state.availableTargets.filter(target => targetMatchesQuery(target, query)).slice(0, 120);
      byId('board-count').textContent = String(matches.length) + ' shown / ' + String(state.availableTargets.length) + ' available';

      const rows = matches.map(target => {
        const row = document.createElement('tr');
        const addCell = tableCell(row, '', 'center');
        const button = document.createElement('button');
        button.className = 'icon';
        button.type = 'button';
        button.textContent = '+';
        button.title = 'Add ' + target.name;
        button.addEventListener('click', () => {
          selectedTargetName = target.name;
          byId('add-price').value = String(target.personalValue);
          renderSelected(state);
        });
        addCell.appendChild(button);

        const playerCell = tableCell(row, '', '');
        const name = document.createElement('div');
        name.className = 'player-name';
        name.textContent = target.name;
        playerCell.appendChild(name);
        if (target.tags.length) {
          const tags = document.createElement('div');
          tags.className = 'subtle';
          tags.innerHTML = target.tags.slice(0, 3).map(tag => '<span class="tag">' + tag + '</span>').join('');
          playerCell.appendChild(tags);
        }

        tableCell(row, target.position);
        tableCell(row, target.teamAbbreviation || '-');
        tableCell(row, target.byeWeek || '-', 'center');
        tableCell(row, money(target.expectedPrice), 'money');
        tableCell(row, money(target.liveExpectedPrice), 'money');
        tableCell(row, money(target.personalValue), 'money');
        tableCell(row, money(target.recommendedMaxBid), 'money');
        tableCell(row, target.valueScore.toFixed(1), 'money');
        return row;
      });

      byId('board').replaceChildren(...rows);
    };

    const renderSelected = state => {
      const target = selectedTarget();
      const root = byId('selected-player');
      if (!target) {
        const first = state.availableTargets[0];
        selectedTargetName = first ? first.name : null;
        if (first) byId('add-price').value = String(first.personalValue);
        renderSelected(state);
        return;
      }

      root.innerHTML = '<strong>' + target.name + '</strong><span class="subtle">' +
        target.position + ' ' + (target.teamAbbreviation || '-') + ' - bye ' + (target.byeWeek || '-') +
        ' - exp ' + money(target.expectedPrice) + ' - our ' + money(target.personalValue) + '</span>';
    };

    const renderRoster = state => {
      const owner = ownerByName(selectedRosterOwner);
      const summary = [
        ['Left', money(owner.budgetRemaining)],
        ['Max', money(owner.maxBid)],
        ['Slots', String(owner.rosterSlotsRemaining)]
      ];
      byId('roster-summary').replaceChildren(...summary.map(([label, value]) => {
        const element = document.createElement('div');
        element.className = 'mini-metric';
        element.innerHTML = '<span>' + label + '</span><strong>' + value + '</strong>';
        return element;
      }));

      const rows = owner.slots.map(slot => {
        const row = document.createElement('tr');
        tableCell(row, slot.slot, 'slot');
        const playerCell = tableCell(row, '', slot.player ? '' : 'empty');
        if (slot.player) {
          playerCell.innerHTML = '<div class="player-name">' + slot.player.name + '</div><div class="subtle">' +
            slot.player.position + ' ' + (slot.player.teamAbbreviation || '-') + ' - bye ' + (slot.player.byeWeek || '-') + '</div>';
          tableCell(row, money(slot.player.price), 'money');
        } else {
          playerCell.textContent = '-';
          tableCell(row, '', 'money');
        }
        return row;
      });
      byId('roster-slots').replaceChildren(...rows);
    };

    const renderOwners = state => {
      const rows = state.owners.map(owner => {
        const row = document.createElement('tr');
        tableCell(row, owner.owner, 'player-name');
        tableCell(row, money(owner.budgetRemaining), 'money');
        tableCell(row, money(owner.maxBid), 'money');
        tableCell(row, String(owner.rosterSlotsRemaining), 'money');
        return row;
      });
      byId('owners').replaceChildren(...rows);
    };

    const renderEvents = state => {
      byId('sale-count').textContent = String(state.events.length) + ' sales';
      const rows = state.events.slice().reverse().slice(0, 18).map(event => {
        const row = document.createElement('tr');
        const sale = tableCell(row, '', '');
        sale.innerHTML = '<div class="player-name">' + event.owner + ' - ' + event.player + '</div><div class="subtle">' +
          event.position + ' - exp ' + money(event.expectedPrice) + ' - ' + event.playerSource + '</div>';
        tableCell(row, money(event.price), 'money');
        const delta = tableCell(row, deltaMoney(event.saleVsExpected), 'money');
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
      currentState = state;
      if (!state.owners.some(owner => owner.owner === selectedRosterOwner)) selectedRosterOwner = 'Cam';
      syncOwnerSelects(state);
      renderMetrics(state);
      renderBoard(state);
      renderSelected(state);
      renderRoster(state);
      renderOwners(state);
      renderEvents(state);
      renderErrors(state);
    };

    byId('board-search').addEventListener('input', () => {
      if (currentState) renderBoard(currentState);
    });

    byId('add-owner').addEventListener('change', event => {
      selectedRosterOwner = event.target.value;
      byId('roster-owner').value = selectedRosterOwner;
      if (currentState) renderRoster(currentState);
    });

    byId('roster-owner').addEventListener('change', event => {
      selectedRosterOwner = event.target.value;
      byId('add-owner').value = selectedRosterOwner;
      if (currentState) renderRoster(currentState);
    });

    byId('add-form').addEventListener('submit', async event => {
      event.preventDefault();
      const target = selectedTarget();
      if (!target) return;
      const owner = byId('add-owner').value;
      const price = Number(byId('add-price').value);
      if (!Number.isInteger(price) || price <= 0) return;
      const command = owner + ' drafted ' + target.name + ' for ' + price;
      await postJson('/api/events', { command });
      selectedTargetName = currentState && currentState.availableTargets[0] ? currentState.availableTargets[0].name : null;
    });

    byId('undo-button').addEventListener('click', () => postJson('/api/undo'));
    byId('reset-button').addEventListener('click', () => postJson('/api/reset'));

    fetch('/api/state').then(response => response.json()).then(render);
  </script>
</body>
</html>`;
