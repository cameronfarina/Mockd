export const liveDraftHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mockd Draft Room</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #050b12;
      --sidebar: #07111d;
      --workspace: #07131f;
      --surface: #081826;
      --surface-2: #0c2033;
      --surface-3: #0f2b45;
      --text: #d9e7f5;
      --muted: #7f9ab5;
      --line: #15324d;
      --line-soft: #10283f;
      --accent: #63a8ff;
      --accent-strong: #2d8cff;
      --green: #1fcf8f;
      --amber: #f2a93b;
      --danger: #ff716a;
      --purple: #a78bfa;
      --shadow: 0 14px 40px rgba(0, 0, 0, 0.28);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: radial-gradient(circle at top left, rgba(45, 140, 255, 0.12), transparent 34vw), var(--bg);
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
      background: rgba(12, 32, 51, 0.9);
      color: var(--text);
      cursor: pointer;
      transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
    }

    button:hover:not(:disabled) {
      border-color: rgba(99, 168, 255, 0.58);
      background: rgba(15, 43, 69, 0.98);
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.58;
    }

    button.primary {
      border-color: rgba(99, 168, 255, 0.72);
      background: #63a8ff;
      color: #06101a;
      font-weight: 750;
    }

    button.icon {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border-color: rgba(31, 207, 143, 0.74);
      color: var(--green);
      background: rgba(31, 207, 143, 0.08);
      font-weight: 750;
      line-height: 1;
    }

    input, select {
      height: 34px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0 9px;
      background-color: rgba(5, 11, 18, 0.7);
      color: var(--text);
      outline: 0;
    }

    input::placeholder {
      color: #62809e;
    }

    input:focus, select:focus {
      border-color: rgba(99, 168, 255, 0.92);
      box-shadow: 0 0 0 3px rgba(99, 168, 255, 0.12);
    }

    select {
      appearance: none;
      -webkit-appearance: none;
      padding-right: 34px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%237f9ab5' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      background-size: 16px 16px;
    }

    .app {
      display: grid;
      grid-template-columns: 300px minmax(0, 1fr);
      min-height: 100vh;
      background: linear-gradient(180deg, rgba(8, 24, 38, 0.96), rgba(5, 11, 18, 0.98));
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
      padding: 18px 18px 20px;
      border-right: 1px solid var(--line);
      background: linear-gradient(180deg, #07111d 0%, #050b12 100%);
    }

    .window-controls {
      display: flex;
      gap: 8px;
      align-items: center;
      height: 18px;
    }

    .window-dot {
      width: 11px;
      height: 11px;
      border-radius: 50%;
    }

    .window-dot.red {
      background: #ff5f57;
    }

    .window-dot.yellow {
      background: #ffbd2e;
    }

    .window-dot.green {
      background: #28c840;
    }

    .brand {
      display: grid;
      gap: 2px;
      padding: 2px 0 4px;
    }

    .brand strong {
      color: #f4f8fc;
      font-size: 20px;
      line-height: 1.1;
    }

    .brand span {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .workspace {
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      min-width: 0;
      min-height: 100vh;
      overflow: hidden;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-width: 0;
      min-height: 64px;
      padding: 0 24px;
      border-bottom: 1px solid var(--line);
      background: rgba(5, 11, 18, 0.54);
    }

    h1 {
      margin: 0;
      color: #f4f8fc;
      font-size: 20px;
      line-height: 1.1;
      letter-spacing: 0;
    }

    .search {
      width: 100%;
      height: 36px;
      background-color: rgba(8, 24, 38, 0.84);
    }

    .quick-sale {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
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
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
      align-items: center;
    }

    .top-actions button {
      height: 34px;
      padding: 0 11px;
      color: #b9cbe0;
    }

    .file-input {
      display: none;
    }

    .sidebar-section {
      display: grid;
      gap: 8px;
      min-width: 0;
      padding: 12px;
      border: 1px solid rgba(21, 50, 77, 0.82);
      border-radius: 8px;
      background: rgba(8, 24, 38, 0.68);
    }

    .sidebar-section .section-label {
      padding: 0;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(5, minmax(120px, 1fr));
      gap: 12px;
      min-width: 0;
      padding: 16px 24px;
      border-bottom: 1px solid var(--line);
      background: rgba(7, 19, 31, 0.76);
    }

    .metric {
      min-width: 0;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(8, 24, 38, 0.92);
      box-shadow: var(--shadow);
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
      color: #f4f8fc;
      font-size: 19px;
      line-height: 1.15;
      letter-spacing: 0;
      white-space: nowrap;
    }

    main {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(360px, 430px);
      gap: 16px;
      min-width: 0;
      min-height: 0;
      padding: 16px 24px 22px;
    }

    section, aside {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(8, 24, 38, 0.92);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .board-panel {
      background: rgba(8, 24, 38, 0.92);
    }

    .decision-panel {
      background: rgba(8, 24, 38, 0.92);
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 48px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      background: rgba(5, 11, 18, 0.34);
    }

    h2 {
      margin: 0;
      font-size: 13px;
      line-height: 1.2;
      letter-spacing: 0;
      text-transform: uppercase;
      color: #b9cbe0;
    }

    .board-count {
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }

    .board-toolbar {
      display: grid;
      grid-template-columns: minmax(320px, 1fr) auto minmax(130px, 160px) minmax(112px, 130px) minmax(132px, 160px) minmax(160px, 190px);
      gap: 8px;
      align-items: center;
      overflow-x: auto;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      background: rgba(7, 19, 31, 0.82);
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
      background: rgba(5, 11, 18, 0.45);
      font-size: 12px;
      font-weight: 650;
    }

    .filter-chip[aria-pressed="true"] {
      border-color: var(--accent);
      background: rgba(99, 168, 255, 0.18);
      color: #e7f2ff;
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
      padding: 10px 14px;
      border-bottom: 1px solid var(--line);
      background: rgba(5, 11, 18, 0.26);
    }

    .market-pill {
      display: inline-flex;
      gap: 5px;
      align-items: baseline;
      padding: 4px 8px;
      border: 1px solid rgba(21, 50, 77, 0.86);
      border-radius: 6px;
      background: rgba(12, 32, 51, 0.64);
      color: var(--muted);
      font-size: 11px;
      white-space: nowrap;
    }

    .market-pill strong {
      color: #f4f8fc;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }

    .scroll {
      overflow: auto;
      max-height: calc(100vh - 236px);
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
      background: rgba(5, 11, 18, 0.38);
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

    .board-table {
      min-width: 920px;
    }

    th, td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--line-soft);
      text-align: left;
      vertical-align: middle;
      overflow-wrap: normal;
    }

    th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: #07131f;
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
      white-space: nowrap;
    }

    tbody tr:hover {
      background: rgba(99, 168, 255, 0.055);
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
      color: #f4f8fc;
      font-weight: 700;
      line-height: 1.18;
      overflow-wrap: normal;
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
      background: rgba(99, 168, 255, 0.14);
      color: #a9d3ff;
      font-size: 11px;
      line-height: 1.2;
    }

    .tag.value {
      background: rgba(31, 207, 143, 0.13);
      color: #7af0bd;
    }

    .tag.warning {
      background: rgba(242, 169, 59, 0.16);
      color: var(--amber);
    }

    .gap-positive {
      color: #7af0bd;
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
      padding: 12px;
      border-bottom: 1px solid var(--line);
      background: rgba(7, 19, 31, 0.82);
    }

    .selected-player {
      grid-column: 1 / -1;
      min-height: 38px;
      padding: 10px;
      border: 1px solid var(--line-soft);
      border-radius: 6px;
      background: rgba(5, 11, 18, 0.42);
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
      background: rgba(12, 32, 51, 0.62);
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
      padding: 12px;
      border-bottom: 1px solid var(--line);
      background: rgba(5, 11, 18, 0.34);
    }

    .roster-summary {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }

    .mini-metric {
      min-width: 0;
      padding: 8px 9px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: rgba(12, 32, 51, 0.7);
    }

    .mini-metric span {
      display: block;
      color: var(--muted);
      font-size: 11px;
    }

    .mini-metric strong {
      display: block;
      margin-top: 2px;
      color: #f4f8fc;
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
      background: rgba(12, 32, 51, 0.7);
      color: var(--muted);
      font-size: 11px;
      font-weight: 650;
      line-height: 1.1;
      white-space: nowrap;
    }

    .summary-list {
      display: grid;
      gap: 6px;
      padding: 0 10px 8px;
    }

    .summary-item {
      display: grid;
      gap: 2px;
      min-width: 0;
      padding: 8px 9px;
      border: 1px solid var(--line-soft);
      border-radius: 6px;
      background: rgba(5, 11, 18, 0.32);
    }

    .summary-item strong {
      line-height: 1.15;
    }

    .summary-item.warn {
      border-color: rgba(242, 169, 59, 0.48);
      background: rgba(242, 169, 59, 0.08);
    }

    .summary-item.fail {
      border-color: rgba(255, 113, 106, 0.46);
      background: rgba(255, 113, 106, 0.08);
    }

    .mock-draft-panel {
      display: grid;
      gap: 8px;
      padding: 0 10px 8px;
    }

    .mock-draft-details {
      display: grid;
      gap: 6px;
    }

    .mock-actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }

    .mock-actions button {
      min-height: 32px;
      padding: 0 7px;
      font-size: 12px;
      font-weight: 650;
      line-height: 1.15;
    }

    .raw-command {
      display: block;
      margin-top: 4px;
      padding: 3px 5px;
      border-radius: 4px;
      background: rgba(2, 7, 12, 0.58);
      color: #b9cbe0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 11px;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    .side-scroll {
      overflow: auto;
      max-height: calc(100vh - 382px);
    }

    .slot {
      width: 58px;
      color: var(--muted);
      font-weight: 650;
      white-space: nowrap;
    }

    .empty {
      color: #5e778f;
    }

    .section-label {
      padding: 12px 12px 7px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 650;
      text-transform: uppercase;
    }

    .error {
      padding: 8px 10px;
      border-bottom: 1px solid rgba(255, 113, 106, 0.46);
      background: rgba(255, 113, 106, 0.08);
      color: var(--danger);
      font-size: 13px;
    }

    .delta-up {
      color: #ff9a94;
      font-weight: 700;
    }

    .delta-down {
      color: #7af0bd;
      font-weight: 700;
    }

    @media (max-width: 1160px) {
      .app {
        grid-template-columns: 1fr;
      }

      .sidebar {
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }

      header {
        min-height: 56px;
      }

      .board-toolbar {
        grid-template-columns: 1fr 1fr;
      }

      .segmented {
        grid-column: 1 / -1;
      }

      .top-actions {
        grid-template-columns: repeat(3, minmax(0, 1fr));
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
    <nav class="sidebar" aria-label="Draft room controls">
      <div class="window-controls" aria-hidden="true">
        <span class="window-dot red"></span>
        <span class="window-dot yellow"></span>
        <span class="window-dot green"></span>
      </div>
      <div class="brand">
        <strong>Mockd</strong>
        <span>Draft Room</span>
      </div>
      <input class="search" id="board-search" autocomplete="off" placeholder="Search player, position, or team">
      <div class="sidebar-section">
        <div class="section-label">Sale Command</div>
        <form class="quick-sale" id="quick-sale-form">
          <input id="quick-sale-command" autocomplete="off" placeholder="Quick sale: jakub kittle 28">
          <button class="primary" type="submit">Log</button>
        </form>
      </div>
      <div class="sidebar-section">
        <div class="section-label">Session</div>
        <div class="top-actions">
          <button type="button" id="export-json-button">Export JSON</button>
          <button type="button" id="export-csv-button">CSV</button>
          <button type="button" id="import-log-button">Import</button>
          <input class="file-input" id="import-log-file" type="file" accept=".json,.csv,application/json,text/csv">
          <button type="button" id="undo-button">Undo</button>
          <button type="button" id="reset-button">Reset</button>
        </div>
      </div>
    </nav>
    <div class="workspace">
      <header>
        <h1>Dashboard</h1>
      </header>
      <div class="metrics" id="metrics"></div>
      <main>
      <section class="board-panel">
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
          <select id="team-filter" aria-label="NFL team filter"></select>
          <select id="bye-filter" aria-label="Bye week filter"></select>
          <select id="strategy-select" aria-label="Draft strategy">
            <option value="balanced">Balanced</option>
            <option value="three-rb" selected>True 3RB</option>
            <option value="hero-rb">Hero RB</option>
            <option value="wr-heavy">WR Heavy</option>
          </select>
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
                <th class="money" style="width:70px">Score</th>
              </tr>
            </thead>
            <tbody id="board"></tbody>
          </table>
        </div>
        <div class="board-cards" id="board-cards"></div>
      </section>
      <aside class="side decision-panel">
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
          <div class="section-label">Mock Draft</div>
          <div class="mock-draft-panel" id="mock-draft-panel">
            <div class="mock-draft-details" id="mock-draft-details">
              <div class="summary-item">
                <strong>Loading</strong>
                <span class="subtle">Preparing the interactive mock.</span>
              </div>
            </div>
            <div class="mock-actions">
              <button type="button" id="mock-advance-button" disabled>Advance AI Sale</button>
              <button type="button" id="mock-cam-win-button" disabled>Bid</button>
              <button type="button" id="mock-pass-button" disabled>Pass</button>
            </div>
          </div>
          <div class="section-label">Readiness</div>
          <div class="summary-list" id="readiness-checks"></div>
          <div class="section-label">Cam Shortlist</div>
          <div class="summary-list" id="shortlist"></div>
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
          <div class="section-label">Needs / Blockers</div>
          <div class="summary-list" id="position-context"></div>
          <div class="section-label">Sales</div>
          <table>
            <tbody id="events"></tbody>
          </table>
        </div>
      </aside>
      </main>
    </div>
  </div>
  <script>
    let currentState = null;
    let selectedTargetName = null;
    let selectedRosterOwner = 'Cam';
    let boardPositionFilter = 'ALL';
    let boardSortKey = 'valueScore';
    let boardSortDirection = 'desc';
    let currentStrategyKey = 'three-rb';

    const boardPositions = ['ALL', 'RB', 'WR', 'TE', 'QB', 'FLEX', 'K', 'DST'];
    const strategyKeys = ['balanced', 'three-rb', 'hero-rb', 'wr-heavy'];
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
    const stateUrl = () => '/api/state?strategy=' + currentStrategyKey;
    const mockDraftUrl = () => '/api/mock/state?strategy=' + currentStrategyKey + '&seed=live-ui';

    const textElement = (tagName, text, className) => {
      const element = document.createElement(tagName);
      element.textContent = cleanText(text);
      if (className) element.className = className;
      return element;
    };

    const focusCommandInput = () => {
      requestAnimationFrame(() => byId('quick-sale-command').focus());
    };

    const postJson = async (url, body) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ strategyKey: currentStrategyKey, ...(body || {}) })
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
      if (tierDrop >= 6) tags.push({ label: 'next ' + target.position + ' -' + money(tierDrop), className: 'tag warning' });
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

      byId('strategy-select').value = currentStrategyKey;
      byId('sort-select').value = boardSortKey + ':' + boardSortDirection;
      for (const button of document.querySelectorAll('[data-sort-key]')) {
        const key = button.dataset.sortKey;
        const marker = key === boardSortKey ? (boardSortDirection === 'asc' ? ' ^' : ' v') : '';
        button.textContent = sortLabels[key] + marker;
      }
    };

    const syncStrategy = state => {
      const key = state.strategy && strategyKeys.includes(state.strategy.key) ? state.strategy.key : currentStrategyKey;
      currentStrategyKey = key;
      byId('strategy-select').value = currentStrategyKey;
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

    const renderReadiness = state => {
      const checks = state.readiness && state.readiness.checks ? state.readiness.checks : [];
      byId('readiness-checks').replaceChildren(...checks.map(check => {
        const item = document.createElement('div');
        item.className = 'summary-item ' + check.status;
        item.replaceChildren(
          textElement('strong', check.label + ' - ' + check.status.toUpperCase()),
          textElement('span', check.detail, 'subtle')
        );
        return item;
      }));
    };

    const renderShortlist = state => {
      const rows = (state.shortlist || []).slice(0, 8).map(target => {
        const item = document.createElement('div');
        item.className = 'summary-item';
        item.replaceChildren(
          textElement('strong', target.name + ' - ' + target.position + ' ' + money(target.personalValue)),
          textElement(
            'span',
            (target.teamAbbreviation || '-') + ' bye ' + (target.byeWeek || '-') + ' - live ' + money(target.liveExpectedPrice) + ' - gap ' + deltaMoney(target.valueGap),
            'subtle'
          ),
          textElement('span', target.reasons.join(' - '), 'subtle')
        );
        item.addEventListener('click', () => {
          selectedTargetName = target.name;
          byId('add-price').value = String(target.personalValue);
          renderSelected(currentState);
        });
        return item;
      });

      byId('shortlist').replaceChildren(...rows);
    };

    const renderPositionContext = state => {
      const rows = (state.positionContexts || []).map(context => {
        const item = document.createElement('div');
        item.className = 'summary-item';
        item.replaceChildren(
          textElement('strong', context.position + ' - ' + context.ownersNeeding.length + ' need'),
          textElement(
            'span',
            'Blockers: ' + (context.blockers.length ? context.blockers.join(', ') + ' up to ' + money(context.strongestBlockerMaxBid) : 'none'),
            'subtle'
          ),
          textElement('span', 'Needs: ' + (context.ownersNeeding.length ? context.ownersNeeding.join(', ') : 'none'), 'subtle')
        );
        return item;
      });

      byId('position-context').replaceChildren(...rows);
    };

    const mockDraftItem = (label, value) => {
      const item = document.createElement('div');
      item.className = 'summary-item';
      item.replaceChildren(textElement('strong', label), textElement('span', value || '-', 'subtle'));
      return item;
    };

    const mockDraftCommandItem = command => {
      const item = document.createElement('div');
      item.className = 'summary-item';
      const rawCommand = document.createElement('code');
      rawCommand.className = 'raw-command';
      rawCommand.textContent = command || '-';
      item.replaceChildren(textElement('strong', 'AI sale command'), rawCommand);
      return item;
    };

    const bidText = bid => {
      const amount = bid.recommendedBid ?? bid.amount ?? bid.bid ?? bid.price ?? bid.maxBid;
      return bid.owner + (amount == null ? '' : ' ' + money(amount));
    };

    const syncMockNominationSelection = mockDraft => {
      if (!currentState || !mockDraft || !mockDraft.nomination || !mockDraft.nomination.player) return;

      const target = currentState.availableTargets.find(candidate => candidate.name === mockDraft.nomination.player);
      if (!target || selectedTargetName === target.name) return;

      selectedTargetName = target.name;
      const nominationPrice = mockDraft.camDecision ? mockDraft.camDecision.recommendedBid : target.personalValue;
      byId('add-price').value = String(nominationPrice);
      renderSelected(currentState);
      renderBoard(currentState);
    };

    const renderMockDraft = mockDraft => {
      const details = byId('mock-draft-details');
      const phase = mockDraft ? mockDraft.phase : '';
      const camBidButton = byId('mock-cam-win-button');
      byId('mock-advance-button').disabled = phase !== 'ai-sale';
      camBidButton.disabled = phase !== 'human-decision' || !mockDraft.camDecision;
      camBidButton.textContent = mockDraft && mockDraft.camDecision ? 'Bid ' + money(mockDraft.camDecision.recommendedBid) : 'Bid';
      byId('mock-pass-button').disabled = phase !== 'human-decision';

      if (!mockDraft) {
        details.replaceChildren(mockDraftItem('Mock draft', 'Loading interactive state.'));
        return;
      }

      const nomination = mockDraft.nomination || {};
      const nominationText = nomination.player || nomination.name || mockDraft.nominatedPlayer || '-';
      const aiBids = (mockDraft.aiBids || []).slice(0, 5);
      const currentNomination = mockDraft.nominator && nominationText !== '-'
        ? mockDraft.nominator + ' nominated ' + nominationText
        : nominationText;
      const items = [
        mockDraftItem('Current nomination', currentNomination),
        mockDraftCommandItem(mockDraft.aiSaleCommand),
        mockDraftItem('Top AI bids', aiBids.length ? aiBids.map(bidText).join(' / ') : '-')
      ];

      if (mockDraft.camDecision) {
        const recommended = mockDraft.camDecision.recommendedBid == null
          ? '-'
          : money(mockDraft.camDecision.recommendedBid);
        const maxBid = mockDraft.camDecision.maxBid == null ? '-' : money(mockDraft.camDecision.maxBid);
        const topAiOwner = mockDraft.camDecision.topAiBidOwner || (aiBids[0] && aiBids[0].owner) || 'AI';
        const topAiBid = mockDraft.camDecision.topAiBid == null ? '-' : money(mockDraft.camDecision.topAiBid);
        items.push(mockDraftItem('Cam bid', recommended + ' beats ' + topAiOwner + ' bid ' + topAiBid + ' / Cam max ' + maxBid));
      } else if (aiBids.length) {
        items.push(mockDraftItem('Cam bid', aiBids[0].owner + ' can go to ' + money(aiBids[0].amount) + '. Use AI sale unless you want to manually override.'));
      }

      details.replaceChildren(...items);
      syncMockNominationSelection(mockDraft);
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
      const rows = state.events.slice().reverse().map(event => {
        const row = document.createElement('tr');
        const sale = tableCell(row, '', '');
        const rawCommand = document.createElement('code');
        rawCommand.className = 'raw-command';
        rawCommand.textContent = event.input;
        sale.replaceChildren(
          textElement('div', event.owner + ' - ' + event.player, 'player-name'),
          textElement('div', event.position + ' - exp ' + money(event.expectedPrice) + ' - ' + event.playerSource, 'subtle'),
          rawCommand
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
      syncStrategy(state);
      if (!state.owners.some(owner => owner.owner === selectedRosterOwner)) selectedRosterOwner = 'Cam';
      syncOwnerSelects(state);
      syncBoardFilterOptions(state);
      renderMetrics(state);
      renderPositionMarket(state);
      renderBoard(state);
      renderSelected(state);
      renderReadiness(state);
      renderShortlist(state);
      renderRoster(state);
      renderOwners(state);
      renderPositionContext(state);
      renderEvents(state);
      renderErrors(state);
      if (state.mockDraft) renderMockDraft(state.mockDraft);
    };

    const refreshMockDraft = async () => {
      renderMockDraft(null);
      try {
        const response = await fetch(mockDraftUrl());
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load mock draft.');
        renderMockDraft(data.mockDraft || data);
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load mock draft.';
        byId('mock-draft-details').replaceChildren(mockDraftItem('Mock draft unavailable', message));
        byId('mock-advance-button').disabled = true;
        byId('mock-cam-win-button').disabled = true;
        byId('mock-pass-button').disabled = true;
        return null;
      }
    };

    const refreshState = async () => {
      const response = await fetch(stateUrl());
      const state = await response.json();
      render(state);
      return state;
    };

    const refreshDraftRoom = async () => {
      const state = await refreshState();
      await refreshMockDraft();
      return state;
    };

    const postJsonAndRefresh = async (url, body) => {
      const data = await postJson(url, body);
      await refreshMockDraft();
      focusCommandInput();
      return data;
    };

    const submitCommand = async command => {
      const data = await postJson('/api/events', { command });
      if (!data.errors.length) {
        selectedTargetName = data.availableTargets[0] ? data.availableTargets[0].name : null;
        render(data);
      }
      await refreshMockDraft();
      focusCommandInput();
      return data;
    };

    const advanceMockDraft = async action => {
      const data = await postJson('/api/mock/advance', {
        strategyKey: currentStrategyKey,
        seed: 'live-ui',
        action
      });
      if (!data.mockDraft) await refreshMockDraft();
      focusCommandInput();
      return data;
    };

    const downloadText = (filename, content, contentType) => {
      const blob = new Blob([content], { type: contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    };

    const exportLog = async format => {
      const response = await fetch('/api/export?format=' + format);
      const content = await response.text();
      if (!response.ok) {
        if (currentState) render({ ...currentState, errors: [{ input: '', message: content || 'Could not export draft log.' }] });
        await refreshMockDraft();
        focusCommandInput();
        return;
      }

      downloadText(
        'mockd-live-draft-log.' + format,
        content,
        format === 'csv' ? 'text/csv' : 'application/json'
      );
      await refreshMockDraft();
      focusCommandInput();
    };

    const importDraftLogFile = async file => {
      if (!file) return;
      const format = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
      const content = await file.text();
      await postJson('/api/import', { format, content });
      await refreshMockDraft();
      byId('import-log-file').value = '';
      focusCommandInput();
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

    for (const input of [byId('my-needs-filter'), byId('team-filter'), byId('bye-filter')]) {
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

    byId('strategy-select').addEventListener('change', async event => {
      currentStrategyKey = strategyKeys.includes(event.target.value) ? event.target.value : 'three-rb';
      await refreshDraftRoom();
      focusCommandInput();
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
        focusCommandInput();
        return;
      }
      const command = owner + ' drafted ' + target.name + ' for ' + price;
      await submitCommand(command);
    });

    byId('export-json-button').addEventListener('click', () => exportLog('json'));
    byId('export-csv-button').addEventListener('click', () => exportLog('csv'));
    byId('import-log-button').addEventListener('click', () => byId('import-log-file').click());
    byId('import-log-file').addEventListener('change', event => importDraftLogFile(event.target.files[0]));
    byId('undo-button').addEventListener('click', () => postJsonAndRefresh('/api/undo'));
    byId('reset-button').addEventListener('click', () => postJsonAndRefresh('/api/reset'));
    byId('mock-advance-button').addEventListener('click', () => advanceMockDraft('advance'));
    byId('mock-cam-win-button').addEventListener('click', () => advanceMockDraft('cam-bid'));
    byId('mock-pass-button').addEventListener('click', () => advanceMockDraft('pass'));

    refreshDraftRoom().then(() => {
      focusCommandInput();
    });
  </script>
</body>
</html>`;
