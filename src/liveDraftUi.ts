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

    button:disabled {
      cursor: not-allowed;
      opacity: 0.58;
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
      grid-template-columns: minmax(160px, 220px) minmax(320px, 1fr) minmax(280px, 420px) auto;
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

    .quick-sale {
      display: grid;
      grid-template-columns: minmax(180px, 1fr) auto;
      gap: 8px;
      min-width: 0;
    }

    .quick-sale input {
      height: 34px;
    }

    .quick-sale button {
      height: 34px;
      padding: 0 12px;
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

    .board-toolbar {
      display: grid;
      grid-template-columns: minmax(360px, 1fr) auto auto minmax(130px, 160px) minmax(112px, 130px) minmax(160px, 190px);
      gap: 8px;
      align-items: center;
      padding: 8px 10px;
      border-bottom: 1px solid var(--line);
      background: #fff;
    }

    .segmented {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
      min-width: 0;
    }

    .filter-chip {
      height: 28px;
      padding: 0 9px;
      border-color: var(--line);
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
    }

    .filter-chip[aria-pressed="true"] {
      border-color: var(--accent);
      background: #e7f0ec;
      color: var(--accent-strong);
    }

    .toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
      white-space: nowrap;
    }

    .toggle input {
      width: 14px;
      height: 14px;
      margin: 0;
      accent-color: var(--accent);
    }

    .board-toolbar select {
      width: 100%;
      height: 30px;
      font-size: 12px;
    }

    .market-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 7px 10px;
      border-bottom: 1px solid var(--line);
      background: #fbfcfa;
    }

    .market-pill {
      display: inline-flex;
      gap: 5px;
      align-items: baseline;
      padding: 3px 7px;
      border: 1px solid var(--line-soft);
      border-radius: 6px;
      background: #fff;
      color: var(--muted);
      font-size: 11px;
      white-space: nowrap;
    }

    .market-pill strong {
      color: var(--text);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }

    .scroll {
      overflow: auto;
      max-height: calc(100vh - 178px);
    }

    .board-cards {
      display: none;
      padding: 8px;
    }

    .target-card {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 8px;
      padding: 10px 0;
      border-bottom: 1px solid var(--line-soft);
    }

    .target-card:last-child {
      border-bottom: 0;
    }

    .target-card-body {
      min-width: 0;
    }

    .target-card-top {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }

    .target-card-meta {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.25;
      white-space: nowrap;
    }

    .target-card-values {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      margin-top: 8px;
    }

    .target-card-value {
      min-width: 0;
      padding: 6px 7px;
      border: 1px solid var(--line-soft);
      border-radius: 6px;
      background: #fbfcfa;
    }

    .target-card-value span {
      display: block;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.1;
    }

    .target-card-value strong {
      display: block;
      margin-top: 2px;
      font-size: 15px;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
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

    .sort-heading {
      width: 100%;
      height: auto;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      font-weight: inherit;
      text-align: inherit;
      cursor: pointer;
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

    .tag.value {
      background: #edf7ed;
      color: #146c2e;
    }

    .tag.warning {
      background: #fff5d8;
      color: var(--amber);
    }

    .gap-positive {
      color: #146c2e;
      font-weight: 750;
    }

    .gap-negative {
      color: var(--danger);
      font-weight: 750;
    }

    .side {
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      min-height: 0;
    }

    .add-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 90px;
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

    .selected-values {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      margin-top: 7px;
    }

    .selected-value {
      min-width: 0;
      padding: 5px 6px;
      border: 1px solid var(--line-soft);
      border-radius: 5px;
      background: #fff;
      font-variant-numeric: tabular-nums;
    }

    .selected-value span {
      display: block;
      color: var(--muted);
      font-size: 10px;
      line-height: 1.1;
    }

    .selected-value strong {
      margin-top: 1px;
      font-size: 13px;
    }

    .sale-warning {
      grid-column: 1 / -1;
      min-height: 0;
      color: var(--danger);
      font-size: 12px;
      line-height: 1.25;
    }

    .add-form button {
      grid-column: 1 / 2;
      height: 34px;
      padding: 0 10px;
    }

    .add-form select:last-child {
      grid-column: 2 / 3;
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

    .owner-needs {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      min-height: 24px;
    }

    .need-chip {
      padding: 3px 6px;
      border: 1px solid var(--line);
      border-radius: 5px;
      background: #fff;
      color: var(--muted);
      font-size: 11px;
      font-weight: 650;
      line-height: 1.1;
      white-space: nowrap;
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

      .board-toolbar {
        grid-template-columns: 1fr 1fr;
      }

      .segmented {
        grid-column: 1 / -1;
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

      .board-toolbar {
        grid-template-columns: 1fr;
      }

      .scroll {
        display: none;
      }

      .board-cards {
        display: block;
      }
    }
  </style>
</head>
<body>
  <div class="app">
    <header>
      <h1>Mockd Draft Room</h1>
      <input class="search" id="board-search" autocomplete="off" placeholder="Search player, position, or team">
      <form class="quick-sale" id="quick-sale-form">
        <input id="quick-sale-command" autocomplete="off" placeholder="Quick sale: jakub kittle 28">
        <button class="primary" type="submit">Log</button>
      </form>
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
        <div class="board-toolbar">
          <div class="segmented" id="position-filters" aria-label="Position filter">
            <button class="filter-chip" type="button" data-position-filter="ALL" aria-pressed="true">All</button>
            <button class="filter-chip" type="button" data-position-filter="RB" aria-pressed="false">RB</button>
            <button class="filter-chip" type="button" data-position-filter="WR" aria-pressed="false">WR</button>
            <button class="filter-chip" type="button" data-position-filter="TE" aria-pressed="false">TE</button>
            <button class="filter-chip" type="button" data-position-filter="QB" aria-pressed="false">QB</button>
            <button class="filter-chip" type="button" data-position-filter="FLEX" aria-pressed="false">FLEX</button>
            <button class="filter-chip" type="button" data-position-filter="K" aria-pressed="false">K</button>
            <button class="filter-chip" type="button" data-position-filter="DST" aria-pressed="false">DST</button>
          </div>
          <label class="toggle"><input type="checkbox" id="my-needs-filter"> My needs</label>
          <label class="toggle"><input type="checkbox" id="hide-deep-filter"> Hide $1/fallback</label>
          <select id="team-filter" aria-label="NFL team filter"></select>
          <select id="bye-filter" aria-label="Bye week filter"></select>
          <select id="sort-select" aria-label="Board sort">
            <option value="valueScore:desc">Best score</option>
            <option value="valueGap:desc">Best value gap</option>
            <option value="tierDrop:desc">Biggest tier drop</option>
            <option value="personalValue:desc">Our value</option>
            <option value="recommendedMaxBid:desc">Max bid</option>
            <option value="liveExpectedPrice:desc">Live price</option>
            <option value="expectedPrice:desc">Expected price</option>
            <option value="byeWeek:asc">Bye week</option>
            <option value="position:asc">Position</option>
            <option value="teamAbbreviation:asc">NFL team</option>
          </select>
        </div>
        <div class="market-strip" id="position-market"></div>
        <div class="scroll">
          <table class="board-table">
            <thead>
              <tr>
                <th class="center" style="width:42px">Add</th>
                <th>Player</th>
                <th style="width:52px"><button class="sort-heading" type="button" data-sort-key="position">Pos</button></th>
                <th style="width:62px"><button class="sort-heading" type="button" data-sort-key="teamAbbreviation">Team</button></th>
                <th class="center" style="width:54px"><button class="sort-heading" type="button" data-sort-key="byeWeek">Bye</button></th>
                <th class="money" style="width:66px"><button class="sort-heading" type="button" data-sort-key="expectedPrice">Exp</button></th>
                <th class="money" style="width:66px"><button class="sort-heading" type="button" data-sort-key="liveExpectedPrice">Live</button></th>
                <th class="money" style="width:66px"><button class="sort-heading" type="button" data-sort-key="personalValue">Our</button></th>
                <th class="money" style="width:66px"><button class="sort-heading" type="button" data-sort-key="valueGap">Gap</button></th>
                <th class="money" style="width:66px"><button class="sort-heading" type="button" data-sort-key="recommendedMaxBid">Max</button></th>
                <th class="money" style="width:70px"><button class="sort-heading" type="button" data-sort-key="valueScore">Score</button></th>
              </tr>
            </thead>
            <tbody id="board"></tbody>
          </table>
        </div>
        <div class="board-cards" id="board-cards"></div>
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
          <div class="sale-warning" id="sale-warning"></div>
          <button class="primary" id="add-submit" type="submit">Add</button>
          <select id="roster-owner"></select>
        </form>
        <div class="roster-toolbar">
          <div class="roster-summary" id="roster-summary"></div>
          <div class="owner-needs" id="owner-needs"></div>
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
    let boardPositionFilter = 'ALL';
    let boardSortKey = 'valueScore';
    let boardSortDirection = 'desc';

    const boardPositions = ['ALL', 'RB', 'WR', 'TE', 'QB', 'FLEX', 'K', 'DST'];
    const flexPositions = ['RB', 'WR', 'TE'];
    const rosterMaximums = { QB: 2, RB: 6, WR: 6, TE: 2, K: 1, DST: 1 };
    const positionOrder = { RB: 1, WR: 2, TE: 3, QB: 4, K: 5, DST: 6 };
    const sortLabels = {
      position: 'Pos',
      teamAbbreviation: 'Team',
      byeWeek: 'Bye',
      expectedPrice: 'Exp',
      liveExpectedPrice: 'Live',
      personalValue: 'Our',
      valueGap: 'Gap',
      recommendedMaxBid: 'Max',
      valueScore: 'Score'
    };

    const byId = id => document.getElementById(id);
    const money = value => '$' + Math.round(Number(value || 0));
    const deltaMoney = value => {
      const rounded = Math.round(Number(value || 0));
      if (rounded === 0) return '$0';
      return (rounded > 0 ? '+' : '-') + '$' + Math.abs(rounded);
    };
    const cleanText = value => String(value == null ? '' : value);
    const valueGapFor = target => target.personalValue - target.liveExpectedPrice;
    const isFlexPosition = position => flexPositions.includes(position);
    const selectedTarget = () => currentState && currentState.availableTargets.find(target => target.name === selectedTargetName);
    const ownerByName = name => currentState.owners.find(owner => owner.owner === name) || currentState.watchOwner;
    const currentOwner = () => ownerByName(selectedRosterOwner);
    const priceInputValue = () => Number(byId('add-price').value);
    const gapClassFor = gap => gap > 0 ? 'gap-positive' : gap < 0 ? 'gap-negative' : '';

    const textElement = (tagName, text, className) => {
      const element = document.createElement(tagName);
      element.textContent = cleanText(text);
      if (className) element.className = className;
      return element;
    };

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

    const metricTile = (label, value, className) => {
      const element = document.createElement('div');
      element.className = className;
      element.append(textElement('span', label), textElement('strong', value));
      return element;
    };

    const shortPlayerName = name => {
      const parts = cleanText(name).split(' ').filter(Boolean);
      return parts[parts.length - 1] || cleanText(name);
    };

    const addTargetButton = (target, className) => {
      const button = document.createElement('button');
      button.className = className;
      button.type = 'button';
      button.textContent = '+';
      button.title = 'Add ' + target.name;
      button.addEventListener('click', () => {
        selectedTargetName = target.name;
        byId('add-price').value = String(target.personalValue);
        renderSelected(currentState);
      });
      return button;
    };

    const ownerNeedsFor = owner => {
      const starterNeeds = owner.slots
        .filter(slot => !slot.player && !slot.slot.startsWith('BENCH'))
        .map(slot => slot.slot);
      if (starterNeeds.length) return starterNeeds;
      return owner.rosterSlotsRemaining > 0 ? ['BENCH x' + owner.rosterSlotsRemaining] : ['Roster full'];
    };

    const targetFitsOwnerNeed = (target, owner) => {
      if (owner.rosterSlotsRemaining <= 0) return false;
      if (owner.positionCounts[target.position] >= rosterMaximums[target.position]) return false;
      const openSlots = owner.slots.filter(slot => !slot.player).map(slot => slot.slot);
      if (openSlots.includes(target.position)) return true;
      if (target.position === 'RB' && (openSlots.includes('RB1') || openSlots.includes('RB2') || owner.positionCounts.RB < 3)) return true;
      if (target.position === 'WR' && (openSlots.includes('WR1') || openSlots.includes('WR2') || owner.positionCounts.WR < 3)) return true;
      if (target.position === 'TE' && openSlots.includes('TE')) return true;
      return openSlots.includes('FLEX') && isFlexPosition(target.position);
    };

    const saleWarningsFor = (target, owner, price) => {
      if (!target) return [];
      const warnings = [];
      if (!Number.isInteger(price) || price <= 0) warnings.push('Enter a positive whole-dollar price.');
      if (owner.rosterSlotsRemaining <= 0) warnings.push(owner.owner + ' has no open roster slots.');
      if (price > owner.maxBid) warnings.push(owner.owner + ' can only bid up to ' + money(owner.maxBid) + '.');
      if (owner.positionCounts[target.position] >= rosterMaximums[target.position]) {
        warnings.push(owner.owner + ' already has the maximum ' + target.position + ' roster count.');
      }
      return warnings;
    };

    const tierDropsFor = targets => {
      const drops = new Map();
      for (const position of ['QB', 'RB', 'WR', 'TE', 'K', 'DST']) {
        const samePosition = targets
          .filter(target => target.position === position)
          .sort((left, right) =>
            right.liveExpectedPrice - left.liveExpectedPrice ||
            right.valueScore - left.valueScore ||
            left.name.localeCompare(right.name)
          );
        samePosition.forEach((target, index) => {
          const next = samePosition[index + 1];
          drops.set(target.name, next ? Math.max(0, target.liveExpectedPrice - next.liveExpectedPrice) : 0);
        });
      }
      return drops;
    };

    const targetTagData = (target, tierDrop) => {
      const tags = target.tags.map(label => ({ label, className: label === 'not affordable' ? 'tag warning' : 'tag' }));
      const gap = valueGapFor(target);
      if (gap >= 6) tags.unshift({ label: 'value ' + deltaMoney(gap), className: 'tag value' });
      if (gap <= -6) tags.unshift({ label: 'tax ' + deltaMoney(gap), className: 'tag warning' });
      if (tierDrop >= 6) tags.push({ label: 'tier drop ' + money(tierDrop), className: 'tag warning' });
      if (target.recommendedMaxBid >= currentOwner().maxBid) tags.push({ label: 'max bid cap', className: 'tag warning' });
      return tags.slice(0, 5);
    };

    const targetTags = (target, tierDrop) => {
      const tagData = targetTagData(target, tierDrop);
      if (!tagData.length) return null;
      const tags = document.createElement('div');
      tags.className = 'subtle';
      tags.replaceChildren(...tagData.map(tag => {
        const element = document.createElement('span');
        element.className = tag.className;
        element.textContent = tag.label;
        return element;
      }));
      return tags;
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

    const syncSelectOptions = (select, values, allLabel) => {
      const previous = select.value;
      const options = [textElement('option', allLabel)];
      options[0].value = '';
      for (const value of values) {
        const option = textElement('option', value);
        option.value = value;
        options.push(option);
      }
      select.replaceChildren(...options);
      select.value = values.includes(previous) ? previous : '';
    };

    const syncBoardFilterOptions = state => {
      const teams = [...new Set(state.availableTargets.map(target => target.teamAbbreviation).filter(Boolean))].sort();
      const byes = [...new Set(state.availableTargets.map(target => target.byeWeek).filter(Boolean))]
        .sort((left, right) => left - right)
        .map(String);
      syncSelectOptions(byId('team-filter'), teams, 'All teams');
      syncSelectOptions(byId('bye-filter'), byes, 'All byes');
    };

    const syncBoardControls = () => {
      for (const button of document.querySelectorAll('[data-position-filter]')) {
        button.setAttribute('aria-pressed', String(button.dataset.positionFilter === boardPositionFilter));
      }

      byId('sort-select').value = boardSortKey + ':' + boardSortDirection;
      for (const button of document.querySelectorAll('[data-sort-key]')) {
        const key = button.dataset.sortKey;
        const marker = key === boardSortKey ? (boardSortDirection === 'asc' ? ' ^' : ' v') : '';
        button.textContent = sortLabels[key] + marker;
      }
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

    const targetMatchesPosition = target => {
      if (boardPositionFilter === 'ALL') return true;
      if (boardPositionFilter === 'FLEX') return isFlexPosition(target.position);
      return target.position === boardPositionFilter;
    };

    const targetMatchesFilters = (target, query, owner) => {
      if (!targetMatchesQuery(target, query)) return false;
      if (!targetMatchesPosition(target)) return false;
      if (byId('team-filter').value && target.teamAbbreviation !== byId('team-filter').value) return false;
      if (byId('bye-filter').value && String(target.byeWeek || '') !== byId('bye-filter').value) return false;
      if (byId('my-needs-filter').checked && !targetFitsOwnerNeed(target, owner)) return false;
      if (byId('hide-deep-filter').checked && (target.source === 'projectionFallback' || target.expectedPrice <= 1)) return false;
      return true;
    };

    const sortValueFor = (target, tierDrops) => {
      if (boardSortKey === 'valueGap') return valueGapFor(target);
      if (boardSortKey === 'tierDrop') return tierDrops.get(target.name) || 0;
      if (boardSortKey === 'position') return positionOrder[target.position] || 99;
      if (boardSortKey === 'teamAbbreviation') return target.teamAbbreviation || 'ZZZ';
      if (boardSortKey === 'byeWeek') return target.byeWeek || 99;
      return target[boardSortKey] == null ? 0 : target[boardSortKey];
    };

    const sortedTargets = (targets, tierDrops) => [...targets].sort((left, right) => {
      const leftValue = sortValueFor(left, tierDrops);
      const rightValue = sortValueFor(right, tierDrops);
      const direction = boardSortDirection === 'asc' ? 1 : -1;
      if (typeof leftValue === 'string' || typeof rightValue === 'string') {
        return direction * cleanText(leftValue).localeCompare(cleanText(rightValue)) || right.valueScore - left.valueScore;
      }
      return direction * (leftValue - rightValue) || right.valueScore - left.valueScore || left.name.localeCompare(right.name);
    });

    const renderMetrics = state => {
      const metrics = [
        ['Inflation', state.room.liveInflationFactor.toFixed(2) + 'x'],
        ['Room Left', money(state.room.remainingBudget)],
        ['Open Slots', String(state.room.remainingRosterSlots)],
        ['Paid vs Exp', deltaMoney(state.room.saleVsExpected)],
        ['Cam Left', money(state.watchOwner.budgetRemaining)],
        ['Cam Max', money(state.watchOwner.maxBid)]
      ];

      byId('metrics').replaceChildren(...metrics.map(([label, value]) => metricTile(label, value, 'metric')));
    };

    const renderPositionMarket = state => {
      const saleDeltaByPosition = new Map();
      for (const event of state.events) {
        saleDeltaByPosition.set(event.position, (saleDeltaByPosition.get(event.position) || 0) + event.saleVsExpected);
      }

      const pills = ['RB', 'WR', 'TE', 'QB', 'K', 'DST'].map(position => {
        const targets = state.availableTargets.filter(target => target.position === position);
        const expected = targets.reduce((total, target) => total + target.expectedPrice, 0);
        const live = targets.reduce((total, target) => total + target.liveExpectedPrice, 0);
        const factor = expected > 0 ? (live / expected).toFixed(2) + 'x' : '-';
        const delta = saleDeltaByPosition.get(position) || 0;
        const pill = document.createElement('div');
        pill.className = 'market-pill';
        pill.append(
          textElement('strong', position),
          document.createTextNode(factor + ' - ' + targets.length + ' left' + (delta ? ' - ' + deltaMoney(delta) : ''))
        );
        return pill;
      });

      byId('position-market').replaceChildren(...pills);
    };

    const renderBoard = state => {
      syncBoardControls();
      const owner = currentOwner();
      const query = byId('board-search').value.trim().toLowerCase();
      const tierDrops = tierDropsFor(state.availableTargets);
      const filtered = state.availableTargets.filter(target => targetMatchesFilters(target, query, owner));
      const matches = sortedTargets(filtered, tierDrops).slice(0, 120);
      byId('board-count').textContent = String(matches.length) + ' shown / ' + String(filtered.length) + ' matched / ' + String(state.availableTargets.length) + ' available';

      const rows = matches.map(target => {
        const tierDrop = tierDrops.get(target.name) || 0;
        const row = document.createElement('tr');
        const addCell = tableCell(row, '', 'center');
        addCell.appendChild(addTargetButton(target, 'icon'));

        const playerCell = tableCell(row, '', '');
        playerCell.appendChild(textElement('div', target.name, 'player-name'));
        const tags = targetTags(target, tierDrop);
        if (tags) playerCell.appendChild(tags);

        tableCell(row, target.position);
        tableCell(row, target.teamAbbreviation || '-');
        tableCell(row, target.byeWeek || '-', 'center');
        tableCell(row, money(target.expectedPrice), 'money');
        tableCell(row, money(target.liveExpectedPrice), 'money');
        tableCell(row, money(target.personalValue), 'money');
        tableCell(row, deltaMoney(valueGapFor(target)), 'money ' + gapClassFor(valueGapFor(target)));
        tableCell(row, money(target.recommendedMaxBid), 'money');
        tableCell(row, target.valueScore.toFixed(1), 'money');
        return row;
      });

      byId('board').replaceChildren(...rows);
      byId('board-cards').replaceChildren(...matches.map(target => {
        const tierDrop = tierDrops.get(target.name) || 0;
        const card = document.createElement('div');
        card.className = 'target-card';
        const add = document.createElement('div');
        add.appendChild(addTargetButton(target, 'icon'));
        const body = document.createElement('div');
        body.className = 'target-card-body';
        const top = document.createElement('div');
        top.className = 'target-card-top';
        top.append(
          textElement('div', target.name, 'player-name'),
          textElement('div', target.position + ' ' + (target.teamAbbreviation || '-') + ' - bye ' + (target.byeWeek || '-'), 'target-card-meta')
        );

        const values = document.createElement('div');
        values.className = 'target-card-values';
        for (const [label, value, className] of [
          ['Exp', money(target.expectedPrice), ''],
          ['Live', money(target.liveExpectedPrice), ''],
          ['Our', money(target.personalValue), ''],
          ['Gap', deltaMoney(valueGapFor(target)), gapClassFor(valueGapFor(target))]
        ]) {
          const cell = document.createElement('div');
          cell.className = 'target-card-value ' + className;
          cell.append(textElement('span', label), textElement('strong', value));
          values.appendChild(cell);
        }

        const tags = targetTags(target, tierDrop);
        body.append(top);
        if (tags) body.appendChild(tags);
        body.appendChild(values);
        card.append(add, body);
        return card;
      }));
    };

    const renderSaleControls = state => {
      const target = selectedTarget();
      const owner = ownerByName(byId('add-owner').value || selectedRosterOwner);
      const price = priceInputValue();
      const warnings = saleWarningsFor(target, owner, price);
      const submit = byId('add-submit');
      submit.disabled = warnings.length > 0;
      submit.textContent = target ? 'Add ' + shortPlayerName(target.name) + ' to ' + owner.owner + ' for ' + money(price || target.personalValue) : 'Add';
      byId('sale-warning').textContent = warnings.join(' ');
    };

    const renderSelected = state => {
      const target = selectedTarget();
      const root = byId('selected-player');
      if (!target) {
        const first = state.availableTargets[0];
        selectedTargetName = first ? first.name : null;
        if (first) byId('add-price').value = String(first.personalValue);
        if (first) renderSelected(state);
        return;
      }

      const meta = textElement(
        'span',
        target.position + ' ' + (target.teamAbbreviation || '-') + ' - bye ' + (target.byeWeek || '-'),
        'subtle'
      );
      const values = document.createElement('div');
      values.className = 'selected-values';
      for (const [label, value, className] of [
        ['Exp', money(target.expectedPrice), ''],
        ['Live', money(target.liveExpectedPrice), ''],
        ['Our', money(target.personalValue), ''],
        ['Gap', deltaMoney(valueGapFor(target)), gapClassFor(valueGapFor(target))]
      ]) {
        const cell = document.createElement('div');
        cell.className = 'selected-value ' + className;
        cell.append(textElement('span', label), textElement('strong', value));
        values.appendChild(cell);
      }

      root.replaceChildren(textElement('strong', target.name), meta, values);
      renderSaleControls(state);
    };

    const renderOwnerNeeds = state => {
      const owner = currentOwner();
      byId('owner-needs').replaceChildren(...ownerNeedsFor(owner).map(need => textElement('span', need, 'need-chip')));
    };

    const renderRoster = state => {
      const owner = currentOwner();
      const summary = [
        ['Left', money(owner.budgetRemaining)],
        ['Max', money(owner.maxBid)],
        ['Slots', String(owner.rosterSlotsRemaining)]
      ];
      byId('roster-summary').replaceChildren(...summary.map(([label, value]) => metricTile(label, value, 'mini-metric')));
      renderOwnerNeeds(state);

      const rows = owner.slots.map(slot => {
        const row = document.createElement('tr');
        tableCell(row, slot.slot, 'slot');
        const playerCell = tableCell(row, '', slot.player ? '' : 'empty');
        if (slot.player) {
          playerCell.replaceChildren(
            textElement('div', slot.player.name, 'player-name'),
            textElement('div', slot.player.position + ' ' + (slot.player.teamAbbreviation || '-') + ' - bye ' + (slot.player.byeWeek || '-'), 'subtle')
          );
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
        sale.replaceChildren(
          textElement('div', event.owner + ' - ' + event.player, 'player-name'),
          textElement('div', event.position + ' - exp ' + money(event.expectedPrice) + ' - ' + event.playerSource, 'subtle')
        );
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
      syncBoardFilterOptions(state);
      renderMetrics(state);
      renderPositionMarket(state);
      renderBoard(state);
      renderSelected(state);
      renderRoster(state);
      renderOwners(state);
      renderEvents(state);
      renderErrors(state);
    };

    const submitCommand = async command => {
      const data = await postJson('/api/events', { command });
      if (!data.errors.length) {
        selectedTargetName = data.availableTargets[0] ? data.availableTargets[0].name : null;
        render(data);
      }
      return data;
    };

    byId('board-search').addEventListener('input', () => {
      if (currentState) renderBoard(currentState);
    });

    byId('quick-sale-form').addEventListener('submit', async event => {
      event.preventDefault();
      const input = byId('quick-sale-command');
      const command = input.value.trim();
      if (!command) return;
      const data = await submitCommand(command);
      if (!data.errors.length) input.value = '';
    });

    for (const button of document.querySelectorAll('[data-position-filter]')) {
      button.addEventListener('click', event => {
        const nextPosition = event.currentTarget.dataset.positionFilter;
        boardPositionFilter = boardPositions.includes(nextPosition) ? nextPosition : 'ALL';
        if (currentState) renderBoard(currentState);
      });
    }

    for (const input of [byId('my-needs-filter'), byId('hide-deep-filter'), byId('team-filter'), byId('bye-filter')]) {
      input.addEventListener('input', () => {
        if (currentState) renderBoard(currentState);
      });
    }

    byId('sort-select').addEventListener('change', event => {
      const [key, direction] = event.target.value.split(':');
      boardSortKey = key;
      boardSortDirection = direction;
      if (currentState) renderBoard(currentState);
    });

    for (const button of document.querySelectorAll('[data-sort-key]')) {
      button.addEventListener('click', event => {
        const key = event.currentTarget.dataset.sortKey;
        if (boardSortKey === key) {
          boardSortDirection = boardSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          boardSortKey = key;
          boardSortDirection = key === 'byeWeek' || key === 'position' || key === 'teamAbbreviation' ? 'asc' : 'desc';
        }
        if (currentState) renderBoard(currentState);
      });
    }

    byId('add-price').addEventListener('input', () => {
      if (currentState) renderSaleControls(currentState);
    });

    byId('add-owner').addEventListener('change', event => {
      selectedRosterOwner = event.target.value;
      byId('roster-owner').value = selectedRosterOwner;
      if (currentState) {
        renderSelected(currentState);
        renderRoster(currentState);
        renderBoard(currentState);
      }
    });

    byId('roster-owner').addEventListener('change', event => {
      selectedRosterOwner = event.target.value;
      byId('add-owner').value = selectedRosterOwner;
      if (currentState) {
        renderSelected(currentState);
        renderRoster(currentState);
        renderBoard(currentState);
      }
    });

    byId('add-form').addEventListener('submit', async event => {
      event.preventDefault();
      const target = selectedTarget();
      if (!target) return;
      const owner = byId('add-owner').value;
      const price = Number(byId('add-price').value);
      if (saleWarningsFor(target, ownerByName(owner), price).length) {
        renderSaleControls(currentState);
        return;
      }
      const command = owner + ' drafted ' + target.name + ' for ' + price;
      await submitCommand(command);
    });

    byId('undo-button').addEventListener('click', () => postJson('/api/undo'));
    byId('reset-button').addEventListener('click', () => postJson('/api/reset'));

    fetch('/api/state').then(response => response.json()).then(render);
  </script>
</body>
</html>`;
