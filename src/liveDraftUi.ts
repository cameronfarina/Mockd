import { leagueConfig } from "../config/league.js";

const rosterMaximumsJson = JSON.stringify(leagueConfig.rosterMaximums);

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

    [hidden] {
      display: none !important;
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

    button.danger {
      border-color: rgba(255, 113, 106, 0.62);
      background: rgba(255, 113, 106, 0.14);
      color: #ffd7d4;
      font-weight: 750;
    }

    button.danger:hover:not(:disabled) {
      border-color: rgba(255, 113, 106, 0.86);
      background: rgba(255, 113, 106, 0.24);
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

    button.star-button {
      display: inline-grid;
      place-items: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border-color: rgba(99, 168, 255, 0.34);
      background: rgba(99, 168, 255, 0.08);
      color: #8fbdf1;
      font-size: 14px;
      line-height: 1;
    }

    button.star-button[aria-pressed="true"] {
      border-color: rgba(242, 169, 59, 0.72);
      background: rgba(242, 169, 59, 0.14);
      color: var(--amber);
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

    .app.draft-active {
      grid-template-columns: minmax(0, 1fr);
    }

    .app.draft-active .sidebar {
      display: none;
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
      grid-template-rows: auto auto auto minmax(0, 1fr);
      min-width: 0;
      min-height: 100vh;
      overflow: hidden;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      min-width: 0;
      min-height: 64px;
      padding: 0 24px;
      border-bottom: 1px solid var(--line);
      background: rgba(5, 11, 18, 0.54);
    }

    h1 {
      margin: 0;
      flex: 0 0 auto;
      color: #f4f8fc;
      font-size: 20px;
      line-height: 1.1;
      letter-spacing: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      min-width: 0;
      margin-left: auto;
    }

    .search {
      width: 100%;
      height: 36px;
      background-color: rgba(8, 24, 38, 0.84);
    }

    .header-search {
      width: min(34vw, 420px);
      min-width: 220px;
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

    .header-sale-command {
      display: grid;
      grid-template-columns: minmax(280px, 440px) auto;
      gap: 8px;
      min-width: 360px;
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

    .session-picker {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 7px;
      align-items: center;
    }

    .session-picker select,
    .session-picker input {
      width: 100%;
      height: 32px;
    }

    .session-picker select,
    .active-session-label {
      grid-column: 1 / -1;
    }

    .session-picker button {
      height: 32px;
      padding: 0 10px;
      white-space: nowrap;
    }

    .active-session-label {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.25;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mode-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
    }

    .mode-actions button {
      min-height: 34px;
      padding: 0 10px;
      color: #b9cbe0;
      font-size: 12px;
      font-weight: 650;
      line-height: 1.1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mode-actions button[aria-pressed="true"] {
      border-color: rgba(99, 168, 255, 0.72);
      background: rgba(99, 168, 255, 0.18);
      color: #e7f2ff;
    }

    .mock-batch-control {
      display: grid;
      grid-template-columns: 76px minmax(0, 1fr);
      gap: 7px;
    }

    .mock-batch-control input {
      text-align: right;
    }

    #mock-batch-script {
      grid-column: 1 / -1;
      text-align: left;
    }

    #run-mock-batch-button {
      --mock-progress: 0%;
      min-width: 0;
      min-height: 34px;
      background:
        linear-gradient(90deg, rgba(99, 168, 255, 0.58) var(--mock-progress), transparent var(--mock-progress)),
        rgba(12, 32, 51, 0.9);
      color: #d9e7f5;
      font-weight: 750;
    }

    #run-mock-batch-button.mock-batch-running:disabled {
      opacity: 1;
    }

    #run-mock-batch-button.mock-batch-ready {
      border-color: rgba(31, 207, 143, 0.72);
      background:
        linear-gradient(90deg, rgba(31, 207, 143, 0.78) var(--mock-progress), transparent var(--mock-progress)),
        rgba(12, 32, 51, 0.9);
      color: #eafff7;
    }

    #see-mock-results-button {
      grid-column: 2;
      min-height: 34px;
      border-color: rgba(31, 207, 143, 0.58);
      color: #7af0bd;
      font-weight: 750;
    }

    .mode-status {
      display: grid;
      gap: 2px;
      min-height: 54px;
      padding: 8px 9px;
      border: 1px solid var(--line-soft);
      border-radius: 6px;
      background: rgba(5, 11, 18, 0.34);
    }

    .mode-status strong {
      color: #f4f8fc;
      line-height: 1.15;
    }

    .mode-status span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.25;
    }

    .start-draft-button {
      width: 100%;
      min-height: 36px;
    }

    .draft-countdown {
      display: grid;
      place-items: center;
      min-height: 54px;
      border: 1px solid rgba(242, 169, 59, 0.48);
      border-radius: 6px;
      background: rgba(242, 169, 59, 0.1);
      color: #ffd38a;
      font-size: 26px;
      font-weight: 850;
      font-variant-numeric: tabular-nums;
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

    .draft-start-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      min-height: 58px;
      padding: 12px 24px;
      border-bottom: 1px solid rgba(242, 169, 59, 0.36);
      background: rgba(242, 169, 59, 0.1);
      color: #ffd38a;
      font-size: 14px;
      font-weight: 750;
    }

    .draft-start-banner strong {
      color: #fff3d8;
      font-size: 30px;
      line-height: 1;
      font-variant-numeric: tabular-nums;
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

    .mock-auction-feed {
      display: grid;
      gap: 8px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--line);
      background: rgba(5, 11, 18, 0.34);
    }

    .mock-auction-feed[hidden] {
      display: none;
    }

    .mock-auction-nomination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 10px;
      border: 1px solid rgba(99, 168, 255, 0.5);
      border-radius: 6px;
      background: rgba(99, 168, 255, 0.1);
    }

    .mock-auction-nomination strong {
      color: #f4f8fc;
      font-size: 13px;
      line-height: 1.2;
    }

    .mock-auction-phase {
      color: #a9c4df;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .mock-auction-feed-lines {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 1px;
    }

    .mock-feed-line {
      flex: 0 0 auto;
      padding: 5px 7px;
      border: 1px solid var(--line-soft);
      border-radius: 6px;
      background: rgba(8, 24, 38, 0.82);
      color: #a9c4df;
      font-size: 12px;
      line-height: 1.2;
      white-space: nowrap;
    }

    .mock-feed-line.nomination {
      color: #d9e7f5;
    }

    .mock-feed-line.bid {
      color: #cfe4fb;
    }

    .mock-feed-line.countdown {
      min-width: 26px;
      text-align: center;
      color: var(--amber);
    }

    .mock-feed-line.sold {
      border-color: rgba(31, 207, 143, 0.52);
      color: #7af0bd;
      background: rgba(31, 207, 143, 0.1);
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

    .target-card.is-nominated {
      margin: 0 -8px;
      padding-inline: 8px;
      border-radius: 6px;
      background: rgba(31, 207, 143, 0.07);
      outline: 1px solid rgba(31, 207, 143, 0.48);
      outline-offset: -1px;
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
      grid-template-columns: repeat(6, minmax(0, 1fr));
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

    .room-mode-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 7px 10px;
      border: 1px solid var(--line-soft);
      border-radius: 6px;
      background: rgba(12, 32, 51, 0.72);
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
    }

    .room-mode-indicator strong {
      color: var(--text);
      white-space: nowrap;
    }

    .room-mode-indicator span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .room-mode-indicator.mock {
      border-color: rgba(99, 168, 255, 0.52);
      background: rgba(99, 168, 255, 0.14);
    }

    .room-mode-indicator.real {
      border-color: rgba(31, 207, 143, 0.42);
      background: rgba(31, 207, 143, 0.09);
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
      min-width: 1060px;
    }

    .board-table th:first-child,
    .board-table td:first-child {
      position: sticky;
      left: 0;
      z-index: 2;
      background: #081826;
    }

    .board-table th:nth-child(2),
    .board-table td:nth-child(2) {
      position: sticky;
      left: 42px;
      z-index: 2;
      background: #081826;
      box-shadow: 12px 0 18px rgba(0, 0, 0, 0.18);
    }

    .board-table th:first-child,
    .board-table th:nth-child(2) {
      z-index: 4;
      background: #07131f;
    }

    .board-table tbody tr:hover > td:first-child,
    .board-table tbody tr:hover > td:nth-child(2) {
      background: #0b1c2d;
    }

    .board-table tbody tr.is-selected > td:first-child,
    .board-table tbody tr.is-selected > td:nth-child(2) {
      background: #0b2137;
    }

    .board-table tbody tr.keeper-row > td:first-child,
    .board-table tbody tr.keeper-row > td:nth-child(2) {
      background: #0a1825;
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

    tbody tr.is-selected {
      background: rgba(99, 168, 255, 0.1);
    }

    tbody tr.is-nominated {
      outline: 1px solid rgba(31, 207, 143, 0.5);
      outline-offset: -1px;
      background: rgba(31, 207, 143, 0.07);
    }

    tbody tr.keeper-row {
      opacity: 0.56;
      background: rgba(127, 154, 181, 0.045);
    }

    tbody tr.keeper-row:hover {
      background: rgba(127, 154, 181, 0.07);
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

    .player-title {
      display: flex;
      gap: 7px;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-width: 0;
    }

    .player-title .player-name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .player-title .star-button {
      flex: 0 0 auto;
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

    .strategy-values {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
      color: var(--muted);
      font-size: 10px;
      line-height: 1.2;
    }

    .strategy-value {
      padding: 2px 5px;
      border: 1px solid var(--line-soft);
      border-radius: 4px;
      background: rgba(5, 11, 18, 0.32);
      white-space: nowrap;
    }

    .strategy-value.active {
      border-color: rgba(99, 168, 255, 0.5);
      color: #e7f2ff;
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
      grid-template-rows: auto auto auto minmax(0, 1fr);
      min-height: 0;
    }

    .team-heading {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
      min-width: 0;
    }

    .team-heading select {
      width: 100%;
      height: 32px;
      font-weight: 750;
    }

    .side-tabs {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      background: rgba(7, 19, 31, 0.82);
    }

    .side-tabs button {
      height: 30px;
      padding: 0 9px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 750;
      white-space: nowrap;
    }

    .side-tabs button[aria-pressed="true"] {
      border-color: rgba(99, 168, 255, 0.72);
      background: rgba(99, 168, 255, 0.18);
      color: #e7f2ff;
    }

    .side-panel-view {
      display: grid;
      align-content: start;
      min-width: 0;
    }

    .side-panel-view[hidden] {
      display: none;
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
      grid-template-columns: repeat(6, minmax(0, 1fr));
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

    .sale-warning.info {
      color: var(--muted);
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

    .import-conflict-review:empty {
      display: none;
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
      grid-template-columns: repeat(4, minmax(0, 1fr));
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

    .results-view {
      min-height: 100vh;
      background: linear-gradient(180deg, rgba(8, 24, 38, 0.96), rgba(5, 11, 18, 0.98));
      color: var(--text);
    }

    .results-view[hidden], .app[hidden] {
      display: none;
    }

    .results-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      min-height: 72px;
      padding: 0 24px;
      border-bottom: 1px solid var(--line);
      background: rgba(5, 11, 18, 0.72);
    }

    .results-title-block {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .results-header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .results-header-actions button {
      min-height: 34px;
      padding: 0 12px;
      font-weight: 650;
    }

    .results-main {
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
      min-height: auto;
      padding: 18px 24px 28px;
    }

    .results-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
    }

    .run-selector {
      position: relative;
      min-width: 220px;
    }

    #mock-results-run-button {
      width: 100%;
      min-height: 36px;
      padding: 0 12px;
      text-align: left;
      font-weight: 750;
    }

    .run-options {
      position: absolute;
      z-index: 5;
      top: calc(100% + 6px);
      left: 0;
      display: grid;
      width: min(320px, 84vw);
      max-height: 340px;
      overflow: auto;
      padding: 6px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #07131f;
      box-shadow: var(--shadow);
    }

    .run-options[hidden] {
      display: none;
    }

    .run-option {
      width: 100%;
      min-height: 32px;
      padding: 0 9px;
      border: 0;
      background: transparent;
      color: var(--muted);
      text-align: left;
    }

    .run-option[aria-selected="true"] {
      background: rgba(99, 168, 255, 0.16);
      color: #e7f2ff;
    }

    .results-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(220px, 1fr));
      gap: 12px;
      align-items: stretch;
    }

    .results-analytics, .results-intelligence {
      display: grid;
      grid-template-columns: repeat(3, minmax(220px, 1fr));
      gap: 12px;
    }

    .insight-card {
      display: grid;
      gap: 7px;
      min-width: 0;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(8, 24, 38, 0.92);
      box-shadow: var(--shadow);
    }

    .insight-card strong {
      color: #f4f8fc;
      line-height: 1.15;
    }

    .insight-card span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.25;
    }

    .mock-results-card {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      min-width: 0;
      min-height: 430px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(8, 24, 38, 0.92);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .mock-results-card-header {
      display: grid;
      gap: 8px;
      padding: 12px;
      border-bottom: 1px solid var(--line);
      background: rgba(5, 11, 18, 0.34);
    }

    .mock-results-card-header strong {
      color: #f4f8fc;
      font-size: 15px;
      line-height: 1.1;
    }

    .mock-results-reason {
      color: var(--muted);
      font-size: 11px;
      line-height: 1.28;
    }

    .mock-results-scoreline {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }

    .mock-results-scoreline span {
      min-width: 0;
      padding: 5px 6px;
      border: 1px solid var(--line-soft);
      border-radius: 5px;
      background: rgba(12, 32, 51, 0.62);
      color: var(--muted);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      line-height: 1.15;
    }

    .mock-results-scoreline b {
      display: block;
      margin-top: 2px;
      color: #f4f8fc;
      font-size: 13px;
    }

    .mock-results-breakdown {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 5px;
    }

    .mock-results-breakdown-title {
      grid-column: 1 / -1;
      color: var(--muted);
      font-size: 10px;
      font-weight: 750;
      letter-spacing: 0;
      line-height: 1.1;
      text-transform: uppercase;
    }

    .mock-results-breakdown-item {
      min-width: 0;
      padding: 4px 5px;
      border: 1px solid var(--line-soft);
      border-radius: 5px;
      background: rgba(5, 11, 18, 0.34);
      color: var(--muted);
      font-size: 10px;
      line-height: 1.15;
      font-variant-numeric: tabular-nums;
    }

    .mock-results-breakdown-item b {
      display: block;
      margin-top: 1px;
      color: #d9e7f5;
      font-size: 12px;
    }

    .mock-results-player-list {
      display: grid;
      align-content: start;
      gap: 5px;
      min-height: 0;
      overflow: auto;
      padding: 8px;
    }

    .mock-results-player {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) 38px 44px;
      gap: 6px;
      align-items: center;
      min-height: 28px;
      padding: 5px 6px;
      border: 1px solid rgba(21, 50, 77, 0.72);
      border-radius: 5px;
      background: rgba(5, 11, 18, 0.28);
      font-size: 12px;
    }

    .mock-results-player.bench {
      opacity: 0.72;
    }

    .mock-results-slot {
      color: var(--accent);
      font-weight: 750;
      white-space: nowrap;
    }

    .mock-results-name {
      min-width: 0;
      overflow: hidden;
      color: #d9e7f5;
      font-weight: 650;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mock-results-money, .mock-results-score {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .mock-results-score {
      color: var(--muted);
    }

    .rankings-card .mock-results-player {
      grid-template-columns: 28px minmax(0, 1fr) 48px 54px;
      align-items: start;
    }

    .mock-results-ranking-labels {
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr) 48px 54px;
      gap: 6px;
      padding: 0 6px 1px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 750;
      line-height: 1.1;
      text-transform: uppercase;
    }

    .mock-results-ranking-labels span:nth-child(3),
    .mock-results-ranking-labels span:nth-child(4) {
      text-align: right;
    }

    .mock-results-name small {
      display: block;
      margin-top: 2px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 500;
      line-height: 1.2;
      white-space: normal;
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
  <div class="app" id="draft-room-view">
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
        <div class="section-label">Draft Actions</div>
        <div class="mode-actions">
          <button type="button" id="start-real-draft-button" aria-pressed="true" aria-label="Start real draft">Real draft</button>
          <button type="button" id="start-mock-draft-button" aria-pressed="false" aria-label="Start mock draft">Mock draft</button>
        </div>
        <div class="mock-batch-control">
          <input id="mock-batch-runs" inputmode="numeric" pattern="[0-9]*" value="25" aria-label="Mock draft run count">
          <button type="button" id="run-mock-batch-button">Run mocks</button>
          <input id="mock-batch-script" autocomplete="off" placeholder="Script: target Jadarian Price max $20" aria-label="Mock draft script">
          <button type="button" id="see-mock-results-button" hidden>See results</button>
        </div>
        <div class="mode-status" id="draft-mode-status">
          <strong>Real draft</strong>
          <span>Draft-night logger. Writes to the real sale log.</span>
        </div>
        <button class="primary start-draft-button" type="button" id="confirm-start-draft-button" aria-label="Confirm start draft" hidden>Start draft</button>
        <div class="draft-countdown" id="draft-countdown" hidden>5</div>
      </div>
      <div class="sidebar-section">
        <div class="section-label">Sale Command</div>
        <form class="quick-sale" id="quick-sale-form">
          <input id="quick-sale-command" autocomplete="off" placeholder="Quick sale: jakub kittle 28">
          <button class="primary" type="submit">Log</button>
        </form>
      </div>
      <div class="sidebar-section">
        <div class="section-label">Session</div>
        <div class="session-picker">
          <select id="draft-session-select" aria-label="Draft session">
            <option value="live">Live</option>
            <option value="practice-3rb">Practice 3RB</option>
            <option value="practice-wr-heavy">Practice WR Heavy</option>
          </select>
          <input id="scratch-session-name" autocomplete="off" placeholder="Scratch room">
          <button type="button" id="open-scratch-session-button">Open</button>
          <div class="active-session-label" id="active-session-label">Live session</div>
          <div class="active-session-label" id="draft-lock-status">Live session locked</div>
        </div>
        <div class="top-actions">
          <button type="button" id="export-json-button">Export JSON</button>
          <button type="button" id="export-csv-button">CSV</button>
          <button type="button" id="export-bundle-button">Bundle</button>
          <button type="button" id="import-log-button">Import</button>
          <input class="file-input" id="import-log-file" type="file" accept=".json,.csv,application/json,text/csv">
          <button type="button" id="undo-button">Undo</button>
          <button type="button" id="reset-button">Reset</button>
        </div>
      </div>
    </nav>
    <div class="workspace">
      <header>
        <h1 id="room-title">Dashboard</h1>
        <div class="room-mode-indicator" id="room-mode-indicator"></div>
        <div class="header-actions">
          <input class="search header-search" id="header-board-search" autocomplete="off" placeholder="Search player, position, or team" hidden>
          <form class="quick-sale header-sale-command" id="header-quick-sale-form" hidden>
            <input id="header-quick-sale-command" autocomplete="off" placeholder="Quick sale: jakub kittle 28">
            <button class="primary" type="submit">Log</button>
          </form>
          <button class="danger" type="button" id="end-draft-button" aria-label="End active draft" hidden>End draft</button>
        </div>
      </header>
      <div class="draft-start-banner" id="draft-start-banner" hidden>
        <span id="draft-start-label">Draft starts in</span>
        <strong id="draft-countdown-value">5</strong>
      </div>
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
            <option value="liveExpectedPrice:desc">Expected draft price</option>
            <option value="seasonProjection:desc">Season points</option>
            <option value="week1Projection:desc">Week 1 points</option>
            <option value="valueGap:desc">Best value gap</option>
            <option value="tierDrop:desc">Biggest tier drop</option>
            <option value="personalValue:desc">Our value</option>
            <option value="recommendedMaxBid:desc">Max bid</option>
            <option value="expectedPrice:desc">Base price</option>
            <option value="byeWeek:asc">Bye week</option>
            <option value="position:asc">Position</option>
            <option value="teamAbbreviation:asc">NFL team</option>
          </select>
        </div>
        <div class="market-strip" id="position-market"></div>
        <div class="mock-auction-feed" id="mock-auction-feed" hidden>
          <div class="mock-auction-nomination" id="mock-active-nomination"></div>
          <div class="mock-auction-feed-lines" id="mock-auction-feed-lines"></div>
        </div>
        <div class="scroll">
          <table class="board-table">
            <thead>
              <tr>
                <th class="center" style="width:42px">Add</th>
                <th>Player</th>
                <th style="width:52px"><button class="sort-heading" type="button" data-sort-key="position">Pos</button></th>
                <th style="width:62px"><button class="sort-heading" type="button" data-sort-key="teamAbbreviation">Team</button></th>
                <th class="center" style="width:54px"><button class="sort-heading" type="button" data-sort-key="byeWeek">Bye</button></th>
                <th class="money" style="width:64px"><button class="sort-heading" type="button" data-sort-key="week1Projection">W1</button></th>
                <th class="money" style="width:78px"><button class="sort-heading" type="button" data-sort-key="seasonProjection">Season</button></th>
                <th class="money" style="width:66px"><button class="sort-heading" type="button" data-sort-key="expectedPrice">Exp</button></th>
                <th class="money" style="width:66px"><button class="sort-heading" type="button" data-sort-key="liveExpectedPrice">Live</button></th>
                <th class="money" style="width:66px"><button class="sort-heading" type="button" data-sort-key="personalValue">Our</button></th>
                <th class="money" style="width:66px"><button class="sort-heading" type="button" data-sort-key="valueGap">Gap</button></th>
                <th class="money" style="width:66px"><button class="sort-heading" type="button" data-sort-key="recommendedMaxBid">Max</button></th>
              </tr>
            </thead>
            <tbody id="board"></tbody>
          </table>
        </div>
        <div class="board-cards" id="board-cards"></div>
      </section>
      <aside class="side decision-panel">
        <div class="panel-header">
          <div class="team-heading">
            <h2>Team</h2>
            <select id="roster-owner" aria-label="Roster owner"></select>
          </div>
          <span class="subtle" id="sale-count"></span>
        </div>
        <div class="side-tabs" id="side-panel-tabs" aria-label="Team panel view">
          <button type="button" data-side-panel="lineup" aria-pressed="true">Lineup</button>
          <button type="button" data-side-panel="shortlist" aria-pressed="false">My shortlist</button>
          <button type="button" data-side-panel="draft-path" aria-pressed="false">Draft path</button>
        </div>
        <div id="errors" role="alert"></div>
        <div class="summary-list import-conflict-review" id="import-conflict-review"></div>
        <div class="side-scroll">
          <div class="side-panel-view" id="lineup-panel" data-side-panel-view="lineup">
            <form class="add-form" id="add-form">
              <div class="selected-player" id="selected-player"></div>
              <select id="add-owner" aria-label="Sale owner"></select>
              <input id="add-price" inputmode="numeric" pattern="[0-9]*" aria-label="Sale price">
              <div class="sale-warning" id="sale-warning" role="alert"></div>
              <button class="primary" id="add-submit" type="submit">Add</button>
            </form>
            <div class="roster-toolbar">
              <div class="roster-summary" id="roster-summary"></div>
              <div class="owner-needs" id="owner-needs"></div>
            </div>
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
          <div class="side-panel-view" id="shortlist-panel" data-side-panel-view="shortlist" hidden>
            <div class="section-label">My Shortlist</div>
            <div class="summary-list" id="manual-shortlist"></div>
            <div class="section-label">Model Shortlist</div>
            <div class="summary-list" id="model-shortlist"></div>
            <div id="shortlist" hidden></div>
          </div>
          <div class="side-panel-view" id="draft-path-panel" data-side-panel-view="draft-path" hidden>
            <div class="section-label">Draft Path</div>
            <div class="summary-list" id="draft-path"></div>
            <div class="section-label">Needs / Blockers</div>
            <div class="summary-list" id="position-context"></div>
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
                <button type="button" id="mock-nominate-button" disabled>Nominate</button>
                <button type="button" id="mock-cam-win-button" disabled>Bid</button>
                <button type="button" id="mock-pass-button" disabled>Pass</button>
                <button type="button" id="mock-next-decision-button" disabled>Next Cam</button>
                <button type="button" id="mock-next-round-button" disabled>Next Round</button>
                <button type="button" id="mock-complete-button" disabled>Complete</button>
              </div>
            </div>
            <div class="section-label">Mock Results</div>
            <div class="summary-list" id="mock-batch-results">
              <div class="summary-item">
                <strong>No batch run yet</strong>
                <span class="subtle">Run mocks to compare AI-only team outcomes for the selected strategy.</span>
              </div>
            </div>
            <div class="section-label">Post Draft Audit</div>
            <div class="summary-list" id="post-draft-audit"></div>
            <div class="section-label">Readiness</div>
            <div class="summary-list" id="readiness-checks"></div>
          </div>
        </div>
      </aside>
      </main>
    </div>
  </div>
  <div class="results-view" id="mock-results-view" hidden>
    <header class="results-header">
      <div class="results-title-block">
        <h1>Mock Results</h1>
        <div class="subtle" id="mock-results-title">No completed mock batch yet.</div>
      </div>
      <div class="results-header-actions">
        <button type="button" id="mock-results-run-new-button">Run new mocks</button>
        <button type="button" id="back-to-draft-room-button">Draft room</button>
      </div>
    </header>
    <main class="results-main">
      <div class="results-toolbar">
        <div class="run-selector">
          <button type="button" id="mock-results-run-button">Run results</button>
          <div class="run-options" id="mock-results-run-list" hidden></div>
        </div>
        <div class="subtle" id="mock-results-status"></div>
      </div>
      <div class="results-analytics" id="mock-results-analytics"></div>
      <div class="results-intelligence" id="mock-results-intelligence"></div>
      <div class="results-grid" id="mock-results-grid"></div>
    </main>
  </div>
  <script>
    let currentState = null;
    let selectedTargetName = null;
    let selectedRosterOwner = 'Cam';
    let boardPositionFilter = 'ALL';
    let boardSortKey = 'liveExpectedPrice';
    let boardSortDirection = 'desc';
    let currentStrategyKey = 'three-rb';
    let currentDraftMode = 'real';
    let currentDraftSession = 'live';
    let draftLifecycle = 'setup';
    let draftCountdownValue = 0;
    let draftCountdownTimer = null;
    let activeSidePanel = 'lineup';
    let pendingCamNominationName = null;
    let currentMockDraft = null;
    let latestMockBatchReport = null;
    let latestMockBatchJob = null;
    let selectedMockResultsRunIndex = 0;
    let manualShortlistNames = [];

    const boardPositions = ['ALL', 'RB', 'WR', 'TE', 'QB', 'FLEX', 'K', 'DST'];
    const strategyKeys = ['balanced', 'three-rb', 'hero-rb', 'wr-heavy'];
    const draftLifecycles = ['setup', 'ready', 'countdown', 'active'];
    const draftCountdownSeconds = 5;
    const draftLifecycleStorageKey = 'mockd-draft-lifecycle';
    const strategyValueLabels = {
      balanced: 'Bal',
      'three-rb': '3RB',
      'hero-rb': 'Hero',
      'wr-heavy': 'WR'
    };
    const draftModes = ['real', 'interactive-mock'];
    const draftModeCopy = {
      real: {
        label: 'Real draft',
        detail: 'Draft-night logger. Writes to the real sale log.'
      },
      'interactive-mock': {
        label: 'Mock draft',
        detail: 'Practice room. Cam controls Cam while AI owners bid.'
      }
    };
    const flexPositions = ['RB', 'WR', 'TE'];
    const rosterMaximums = ${rosterMaximumsJson};
    const positionOrder = { RB: 1, WR: 2, TE: 3, QB: 4, K: 5, DST: 6 };
    const sortLabels = {
      position: 'Pos',
      teamAbbreviation: 'Team',
      byeWeek: 'Bye',
      week1Projection: 'W1',
      seasonProjection: 'Season',
      expectedPrice: 'Exp',
      liveExpectedPrice: 'Live',
      personalValue: 'Our',
      valueGap: 'Gap',
      recommendedMaxBid: 'Max'
    };

    const byId = id => document.getElementById(id);
    const money = value => '$' + Math.round(Number(value || 0));
    const scoreText = value => Number(value || 0).toFixed(1);
    const deltaMoney = value => {
      const rounded = Math.round(Number(value || 0));
      if (rounded === 0) return '$0';
      return (rounded > 0 ? '+' : '-') + '$' + Math.abs(rounded);
    };
    const cleanText = value => String(value == null ? '' : value);
    const safeFilePart = value => cleanText(value).replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'draft';
    const valueGapFor = target => target.personalValue - target.liveExpectedPrice;
    const activeBidPriceFor = target => {
      const price = priceInputValue();
      return Number.isFinite(price) && price > 0 ? price : target.recommendedMaxBid;
    };
    const valueGapAtPriceFor = (target, price) => target.personalValue - price;
    const isFlexPosition = position => flexPositions.includes(position);
    const selectedTarget = () => currentState && currentState.availableTargets.find(target => target.name === selectedTargetName);
    const ownerByName = name => currentState.owners.find(owner => owner.owner === name) || currentState.watchOwner;
    const currentOwner = () => ownerByName(selectedRosterOwner);
    const currentCommandCount = () => currentState && currentState.session ? currentState.session.commandCount : 0;
    const isLiveRealDraftRoom = () => currentDraftSession === 'live' && currentDraftMode === 'real';
    const priceInputValue = () => Number(byId('add-price').value);
    const gapClassFor = gap => gap > 0 ? 'gap-positive' : gap < 0 ? 'gap-negative' : '';
    const sessionQuery = () => '&draftSession=' + encodeURIComponent(currentDraftSession);
    const stateUrl = () => '/api/state?mode=' + currentDraftMode + '&strategy=' + currentStrategyKey + sessionQuery();
    const mockDraftUrl = () =>
      '/api/mock/state?mode=' + currentDraftMode + '&strategy=' + currentStrategyKey + sessionQuery() + '&seed=live-ui' +
      (pendingCamNominationName ? '&nominatedPlayer=' + encodeURIComponent(pendingCamNominationName) : '');
    const draftNightLockFor = state => {
      if (state && state.activeDraftSession && state.activeDraftSession.key !== currentDraftSession) return currentDraftSession === 'live';
      if (state && state.draftNightLock) return Boolean(state.draftNightLock.locked);
      return currentDraftSession === 'live';
    };
    const draftNightLockReasonFor = state =>
      state && state.draftNightLock && state.draftNightLock.reason
        ? state.draftNightLock.reason
        : 'Live session locked. Switch to a practice session to run mocks.';
    const practiceSessionForStrategy = strategyKey =>
      strategyKey === 'wr-heavy' ? 'practice-wr-heavy' : 'practice-3rb';
    const isActiveDraft = () => draftLifecycle === 'active';
    const isStartingDraft = () => draftLifecycle === 'countdown';
    const normalizeDraftLifecycle = value => {
      if (value === 'countdown') return 'ready';
      if (draftLifecycles.includes(value)) return value;
      return 'setup';
    };
    const persistDraftLifecycle = () => {
      try {
        if (!window.localStorage) return;
        window.localStorage.setItem(draftLifecycleStorageKey, JSON.stringify({
          lifecycle: draftLifecycle,
          mode: currentDraftMode,
          session: currentDraftSession,
          strategy: currentStrategyKey
        }));
      } catch {
        // The draft state still renders correctly without local storage.
      }
    };
    const loadDraftLifecycle = () => {
      try {
        if (!window.localStorage) return;
        const stored = window.localStorage.getItem(draftLifecycleStorageKey);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        if (draftModes.includes(parsed.mode)) currentDraftMode = parsed.mode;
        if (typeof parsed.session === 'string' && parsed.session) currentDraftSession = parsed.session;
        if (strategyKeys.includes(parsed.strategy)) currentStrategyKey = parsed.strategy;
        draftLifecycle = normalizeDraftLifecycle(parsed.lifecycle);
      } catch {
        draftLifecycle = 'setup';
      }
    };
    const realDraftHasStarted = state => currentDraftMode === 'real' && (isActiveDraft() || state.events.length > 0);
    const visibleBoardTargets = state => [
      ...(!realDraftHasStarted(state) ? (state.keeperTargets || []) : []),
      ...(state.availableTargets || [])
    ];
    const shortlistStorageKey = () => 'mockd-shortlist:' + currentDraftSession;
    const loadManualShortlist = () => {
      try {
        const stored = window.localStorage ? window.localStorage.getItem(shortlistStorageKey()) : null;
        const parsed = stored ? JSON.parse(stored) : [];
        manualShortlistNames = Array.isArray(parsed) ? parsed.filter(name => typeof name === 'string') : [];
      } catch {
        manualShortlistNames = [];
      }
    };
    const saveManualShortlist = () => {
      try {
        if (window.localStorage) window.localStorage.setItem(shortlistStorageKey(), JSON.stringify(manualShortlistNames));
      } catch {
        // Draft-room shortcuts should keep working even when storage is unavailable.
      }
    };
    const isShortlisted = target => manualShortlistNames.includes(target.name);

    const textElement = (tagName, text, className) => {
      const element = document.createElement(tagName);
      element.textContent = cleanText(text);
      if (className) element.className = className;
      return element;
    };

    const commandInput = () => {
      if (isActiveDraft() && currentDraftMode === 'real') return byId('header-quick-sale-command');
      if (isActiveDraft() && currentDraftMode === 'interactive-mock') return null;
      return byId('quick-sale-command');
    };

    const boardSearchQuery = () => {
      const headerSearch = byId('header-board-search').value.trim();
      const sidebarSearch = byId('board-search').value.trim();
      return (isActiveDraft() ? headerSearch : sidebarSearch).toLowerCase();
    };

    const focusCommandInput = () => {
      requestAnimationFrame(() => {
        if (byId('draft-room-view').hidden) return;
        const input = commandInput();
        if (input) {
          if (input.id === 'quick-sale-command') byId('quick-sale-command').focus();
          else input.focus();
          return;
        }
        byId('header-board-search').focus();
      });
    };

    const focusPriceInput = () => {
      requestAnimationFrame(() => byId('add-price').focus());
    };

    const postJson = async (url, body) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ strategyKey: currentStrategyKey, mode: currentDraftMode, draftSession: currentDraftSession, ...(body || {}) })
      });
      const data = await response.json();
      render(data);
      return data;
    };

    const alertCommandErrors = data => {
      const messages = (data && Array.isArray(data.errors) ? data.errors : [])
        .map(error => error && error.message)
        .filter(Boolean);
      if (messages.length) window.alert(messages.join('\\n'));
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

    const renderSidePanel = state => {
      for (const button of document.querySelectorAll('[data-side-panel]')) {
        button.setAttribute('aria-pressed', String(button.dataset.sidePanel === activeSidePanel));
      }
      for (const panel of document.querySelectorAll('[data-side-panel-view]')) {
        panel.hidden = panel.dataset.sidePanelView !== activeSidePanel;
      }
      if (state && activeSidePanel === 'shortlist') renderShortlist(state);
    };

    const setSidePanel = panel => {
      activeSidePanel = ['lineup', 'shortlist', 'draft-path'].includes(panel) ? panel : 'lineup';
      if (currentState) renderSidePanel(currentState);
    };

    const selectTargetForSale = target => {
      if (!target || target.draftable === false) return;
      selectedTargetName = target.name;
      byId('add-price').value = String(target.recommendedMaxBid);
      setSidePanel('lineup');
      renderSelected(currentState);
      renderBoard(currentState);
      if (currentDraftMode === 'interactive-mock') focusCommandInput();
      else focusPriceInput();
    };

    const toggleShortlist = target => {
      if (!target || target.draftable === false) return;
      manualShortlistNames = isShortlisted(target)
        ? manualShortlistNames.filter(name => name !== target.name)
        : [...manualShortlistNames, target.name];
      saveManualShortlist();
      setSidePanel('shortlist');
      if (currentState) {
        renderShortlist(currentState);
        renderBoard(currentState);
      }
    };

    const starTargetButton = target => {
      const button = document.createElement('button');
      button.className = 'star-button';
      button.type = 'button';
      button.textContent = isShortlisted(target) ? '★' : '☆';
      button.title = isShortlisted(target) ? 'Remove from shortlist' : 'Add to shortlist';
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', String(isShortlisted(target)));
      button.disabled = target.draftable === false;
      button.addEventListener('click', event => {
        event.stopPropagation();
        toggleShortlist(target);
      });
      return button;
    };

    const addTargetButton = (target, className) => {
      const button = document.createElement('button');
      button.className = className;
      button.type = 'button';
      button.textContent = '+';
      button.title = 'Add ' + target.name;
      if (target.draftable === false) button.disabled = true;
      button.addEventListener('click', () => {
        selectTargetForSale(target);
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
        warnings.push(owner.owner + ' cannot buy ' + target.name + ': roster limit is ' + rosterMaximums[target.position] + ' ' + target.position + 's.');
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
      if (target.draftable === false) {
        return target.tags.map(label => ({ label, className: 'tag warning' }));
      }
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

    const renderStrategyValues = target => {
      if (!target.strategyValues) return null;
      const row = document.createElement('div');
      row.className = 'strategy-values';
      row.replaceChildren(...strategyKeys.map(strategyKey => {
        const value = target.strategyValues[strategyKey];
        const item = document.createElement('span');
        item.className = 'strategy-value' + (strategyKey === currentStrategyKey ? ' active' : '');
        item.textContent = strategyValueLabels[strategyKey] + ' ' + money(value);
        return item;
      }));
      return row;
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
      const targets = visibleBoardTargets(state);
      const teams = [...new Set(targets.map(target => target.teamAbbreviation).filter(Boolean))].sort();
      const byes = [...new Set(targets.map(target => target.byeWeek).filter(Boolean))]
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

    const syncDraftSession = state => {
      if (state && state.activeDraftSession && state.activeDraftSession.key) {
        currentDraftSession = state.activeDraftSession.key;
      }

      const select = byId('draft-session-select');
      const sessions = state && Array.isArray(state.draftSessions) ? state.draftSessions : [];
      const selectedSession = sessions.find(session => session.key === currentDraftSession) ||
        { key: currentDraftSession, label: currentDraftSession };
      const options = sessions.map(session => {
        const option = document.createElement('option');
        option.value = session.key;
        option.textContent = session.label;
        return option;
      });
      if (!sessions.some(session => session.key === currentDraftSession)) {
        const option = document.createElement('option');
        option.value = currentDraftSession;
        option.textContent = selectedSession.label;
        options.push(option);
      }
      select.replaceChildren(...options);
      select.value = currentDraftSession;
      byId('active-session-label').textContent = selectedSession.label + ' - ' + (selectedSession.description || 'Isolated draft room.');
    };

    const activeSessionLabelFor = state => {
      const session = state && state.activeDraftSession;
      return session && session.label ? session.label : currentDraftSession;
    };

    const draftLifecycleLabel = () => {
      if (isActiveDraft()) return 'Active';
      if (isStartingDraft()) return 'Starting';
      if (draftLifecycle === 'ready') return 'Ready';
      return 'Setup';
    };

    const roomTitleFor = isMock => {
      if (isActiveDraft()) return isMock ? 'Mock Draft Room' : 'Live Draft Room';
      if (isStartingDraft()) return 'Starting Draft';
      return 'Draft Setup';
    };

    const draftModeStatusDetailFor = copy => {
      if (draftLifecycle === 'ready') return 'Ready to start. Click Start draft for the countdown.';
      if (isStartingDraft()) return 'Starting now. Draft controls will unlock when the countdown finishes.';
      if (isActiveDraft()) return 'Draft is active. Setup controls are hidden until the draft ends.';
      return copy.detail;
    };

    const renderRoomModeIndicator = state => {
      const copy = draftModeCopy[currentDraftMode] || draftModeCopy.real;
      const isMock = currentDraftMode === 'interactive-mock';
      const indicator = byId('room-mode-indicator');
      byId('room-title').textContent = roomTitleFor(isMock);
      indicator.className = 'room-mode-indicator ' + (isMock ? 'mock' : 'real');
      indicator.replaceChildren(
        textElement('strong', copy.label),
        textElement('span', draftLifecycleLabel() + ' - ' + activeSessionLabelFor(state))
      );
    };

    const renderDraftLifecycle = state => {
      const copy = draftModeCopy[currentDraftMode] || draftModeCopy.real;
      const isMock = currentDraftMode === 'interactive-mock';
      const isReady = draftLifecycle === 'ready';
      const countdownText = String(draftCountdownValue || draftCountdownSeconds);

      byId('draft-room-view').classList.toggle('draft-active', isActiveDraft());
      byId('header-board-search').hidden = !isActiveDraft();
      byId('header-quick-sale-form').hidden = !(isActiveDraft() && currentDraftMode === 'real');
      byId('end-draft-button').hidden = !isActiveDraft();
      byId('end-draft-button').textContent = isMock ? 'End mock draft' : 'End real draft';
      byId('add-form').hidden = isMock;

      byId('confirm-start-draft-button').hidden = !isReady;
      byId('confirm-start-draft-button').disabled = !isReady;
      byId('draft-countdown').hidden = !isStartingDraft();
      byId('draft-countdown').textContent = countdownText;
      byId('draft-start-banner').hidden = !isStartingDraft();
      byId('draft-start-label').textContent = copy.label + ' starts in';
      byId('draft-countdown-value').textContent = countdownText;
      byId('mock-draft-panel').hidden = !(isActiveDraft() && currentDraftMode === 'interactive-mock');

      byId('header-board-search').placeholder = isMock
        ? 'Search players during mock draft'
        : 'Search player, position, or team';
      if (state) renderRoomModeIndicator(state);
    };

    const renderDraftMode = state => {
      if (state && draftModes.includes(state.draftMode)) currentDraftMode = state.draftMode;
      const locked = draftNightLockFor(state);
      if (locked && currentDraftMode === 'interactive-mock') currentDraftMode = 'real';
      const copy = draftModeCopy[currentDraftMode] || draftModeCopy.real;
      const status = byId('draft-mode-status');
      const startMock = byId('start-mock-draft-button');
      renderDraftLifecycle(state);
      const lifecycleCopy = draftModeStatusDetailFor(copy);
      status.replaceChildren(textElement('strong', copy.label), textElement('span', lifecycleCopy));
      byId('start-real-draft-button').setAttribute('aria-pressed', String(currentDraftMode === 'real'));
      startMock.disabled = false;
      startMock.title = locked ? 'Opens a practice session for mocks.' : '';
      startMock.setAttribute('aria-pressed', String(currentDraftMode === 'interactive-mock' && !locked));
      byId('draft-lock-status').textContent = locked
        ? 'Live session locked - practice rooms only for mocks.'
        : 'Practice room unlocked for mocks.';
    };

    const scriptOutcomeText = outcome => {
      if (!outcome) return '';
      const hitRate = Math.round((outcome.draftedByOwnerRate || 0) * 100);
      const saleRange = outcome.minimumSalePrice || outcome.maximumSalePrice
        ? ' / sale range ' + money(outcome.minimumSalePrice) + '-' + money(outcome.maximumSalePrice)
        : '';
      const ownerResult = outcome.owner + ' won ' + outcome.draftedByOwnerCount + '/' + outcome.runCount + ' (' + hitRate + '%)';
      const teamResult = outcome.averageOwnerRankWhenDrafted
        ? ' / avg rank when landed ' + scoreText(outcome.averageOwnerRankWhenDrafted)
        : '';
      return outcome.player + ' up to ' + money(outcome.maxBid) + ': ' + ownerResult + saleRange + teamResult;
    };

    const renderMockBatchResults = report => {
      const root = byId('mock-batch-results');
      latestMockBatchReport = report || latestMockBatchReport;
      if (!latestMockBatchReport) {
        root.replaceChildren(mockDraftItem('No batch run yet', 'Run mocks to compare AI-only team outcomes for the selected strategy.'));
        return;
      }

      const cam = latestMockBatchReport.cam;
      const items = [
        mockDraftItem(
          'Batch mocks',
          latestMockBatchReport.summary.runCount + ' runs - ' + latestMockBatchReport.options.strategyKey + ' - expected keepers'
        )
      ];

      const scriptOutcomes = latestMockBatchReport.script && latestMockBatchReport.script.targetOutcomes
        ? latestMockBatchReport.script.targetOutcomes
        : [];
      if (scriptOutcomes.length) {
        items.push(mockDraftItem(
          'Script result',
          scriptOutcomes.map(scriptOutcomeText).join(' / ')
        ));
      }

      if (cam) {
        items.push(mockDraftItem(
          'Cam average roster',
          money(cam.averageSpend) + ' spend / ' + money(cam.averageBudgetRemaining) + ' left / ' + cam.averageWeeks1To4Score + ' Weeks 1-4'
        ));
      }

      const exposures = (latestMockBatchReport.camTopExposures || []).slice(0, 5);
      if (exposures.length) {
        items.push(mockDraftItem(
          'Likely Cam targets',
          exposures.map(exposure => exposure.player + ' ' + Math.round(exposure.draftedRate * 100) + '% at ' + money(exposure.averagePrice)).join(' / ')
        ));
      }

      const topPlayers = (latestMockBatchReport.topPlayers || []).slice(0, 4);
      if (topPlayers.length) {
        items.push(mockDraftItem(
          'Top room prices',
          topPlayers.map(player => player.name + ' ' + money(player.averageSalePrice)).join(' / ')
        ));
      }

      root.replaceChildren(...items);
    };

    const insightCard = (label, headline, details) => {
      const card = document.createElement('div');
      card.className = 'insight-card';
      card.replaceChildren(
        textElement('strong', label),
        textElement('span', headline || '-'),
        textElement('span', details || '-')
      );
      return card;
    };

    const mockResultsIntelligencePanel = run => {
      const root = byId('mock-results-intelligence');
      if (!run) {
        root.replaceChildren();
        return;
      }

      const cam = run.camOutcome;
      const best = run.bestBuild;
      const worst = run.worstBuild;
      root.replaceChildren(
        insightCard(
          'Cam outcome',
          cam ? cam.headline : 'Cam outcome unavailable',
          cam ? [...(cam.strengths || []).slice(0, 2), ...(cam.risks || []).slice(0, 1)].join(' / ') : '-'
        ),
        insightCard(
          'Best build',
          best ? best.headline : 'Best build unavailable',
          best ? 'Core: ' + best.corePlayers.join(' / ') : '-'
        ),
        insightCard(
          'Worst build',
          worst ? worst.headline : 'Worst build unavailable',
          worst ? 'Core: ' + worst.corePlayers.join(' / ') : '-'
        )
      );
    };

    const strategyLabel = strategyKey => {
      const labels = {
        balanced: 'Balanced',
        'three-rb': '3RB',
        'hero-rb': 'Hero RB',
        'wr-heavy': 'WR heavy'
      };
      return labels[strategyKey] || strategyKey;
    };

    const mockResultsAnalyticsPanel = report => {
      const root = byId('mock-results-analytics');
      if (!report || !report.analytics) {
        root.replaceChildren();
        return;
      }

      const strategyLeader = report.analytics.strategyLeaderboard[0];
      const camScoreRange = report.analytics.camScoreRange;
      const commonPath = report.analytics.topCamRosterPaths[0];
      const strategyCoach = report.analytics.strategyCoach;
      const scriptOutcome = report.script && report.script.targetOutcomes
        ? report.script.targetOutcomes[0]
        : null;
      root.replaceChildren(
        ...(scriptOutcome ? [
          insightCard(
            'Script result',
            report.script.label,
            scriptOutcomeText(scriptOutcome)
          )
        ] : []),
        insightCard(
          'Strategy edge',
          strategyLeader
            ? strategyLabel(strategyLeader.strategyKey) + ' avg rank ' + scoreText(strategyLeader.averageCamRank)
            : 'No strategy data',
          strategyLeader
            ? strategyLeader.runCount + ' runs / W1 ' + scoreText(strategyLeader.averageCamWeek1Score) + ' / Season ' + scoreText(strategyLeader.averageCamSeasonStrengthScore)
            : '-'
        ),
        insightCard(
          'Cam score range',
          camScoreRange
            ? scoreText(camScoreRange.minimumWeek1Score) + '-' + scoreText(camScoreRange.maximumWeek1Score) + ' W1'
            : 'No score range',
          camScoreRange
            ? scoreText(camScoreRange.minimumWeeks1To4Score) + '-' + scoreText(camScoreRange.maximumWeeks1To4Score) + ' W1-4 / best ' + camScoreRange.bestRunLabel
            : '-'
        ),
        insightCard(
          'Common Cam path',
          commonPath ? commonPath.path : 'No common path yet',
          commonPath
            ? Math.round(commonPath.draftedRate * 100) + '% of runs / avg rank ' + scoreText(commonPath.averageRank)
            : '-'
        ),
        insightCard(
          'Strategy coach',
          strategyCoach ? strategyCoach.headline : 'Run 3RB mocks for a coach view',
          strategyCoach
            ? (strategyCoach.blueprint || []).slice(0, 4).map(slot =>
              slot.slot + ' ' + slot.priceBand + ' - ' + [
                ...(slot.lockedNames || []).map(name => name + ' locked'),
                ...(slot.targetNames || []).slice(0, 2)
              ].join(' / ') + (
                slot.fallbackNames && slot.fallbackNames.length
                  ? ' / fallback ' + slot.fallbackPriceBand + ': ' + slot.fallbackNames.slice(0, 2).join(' / ')
                  : ''
              )
            ).join(' / ')
            : '-'
        )
      );
    };

    const mockResultsPlayerRow = player => {
      const row = document.createElement('div');
      row.className = 'mock-results-player' + (player.starter ? '' : ' bench');
      row.replaceChildren(
        textElement('span', player.slot, 'mock-results-slot'),
        textElement('span', player.name, 'mock-results-name'),
        textElement('span', money(player.price), 'mock-results-money'),
        textElement('span', scoreText(player.week1), 'mock-results-score')
      );
      return row;
    };

    const mockResultsSeasonParts = team => {
      const parts = document.createElement('div');
      parts.className = 'mock-results-breakdown';
      parts.appendChild(textElement('span', 'Season parts', 'mock-results-breakdown-title'));

      for (const [label, value] of [
        ['Starters', scoreText(team.starterSeasonScore || team.weeks1To4Score)],
        ['Depth', scoreText(team.depthScore)],
        ['Consistency', scoreText(team.consistencyScore)]
      ]) {
        const item = document.createElement('span');
        item.className = 'mock-results-breakdown-item';
        item.replaceChildren(document.createTextNode(label), textElement('b', value));
        parts.appendChild(item);
      }

      return parts;
    };

    const mockResultsTeamCard = team => {
      const card = document.createElement('div');
      card.className = 'mock-results-card';

      const header = document.createElement('div');
      header.className = 'mock-results-card-header';
      const scoreline = document.createElement('div');
      scoreline.className = 'mock-results-scoreline';
      for (const [label, value] of [
        ['Week 1', scoreText(team.week1Score)],
        ['Season', scoreText(team.seasonStrengthScore || team.projectedFinishScore || team.weeks1To4Score)],
        ['Spend', money(team.spend)]
      ]) {
        const metric = document.createElement('span');
        metric.replaceChildren(document.createTextNode(label), textElement('b', value));
        scoreline.appendChild(metric);
      }
      header.replaceChildren(
        textElement('strong', team.owner + (team.projectedFinishLabel ? ' - ' + team.projectedFinishLabel : '')),
        textElement('div', team.rankExplanation || '-', 'mock-results-reason'),
        scoreline,
        mockResultsSeasonParts(team)
      );

      const players = document.createElement('div');
      players.className = 'mock-results-player-list';
      players.replaceChildren(...team.players.map(mockResultsPlayerRow));
      card.replaceChildren(header, players);
      return card;
    };

    const mockResultsRankingLabels = () => {
      const labels = document.createElement('div');
      labels.className = 'mock-results-ranking-labels';
      labels.replaceChildren(
        textElement('span', 'Rank'),
        textElement('span', 'Owner'),
        textElement('span', 'Week 1'),
        textElement('span', 'Season')
      );
      return labels;
    };

    const renderMockResultsRankingsCard = rankings => {
      const card = document.createElement('div');
      card.className = 'mock-results-card rankings-card';

      const header = document.createElement('div');
      header.className = 'mock-results-card-header';
      const topScore = rankings.length ? scoreText(Math.max(...rankings.map(ranking => ranking.week1Score))) : '0.0';
      const scoreline = document.createElement('div');
      scoreline.className = 'mock-results-scoreline';
      const metric = document.createElement('span');
      metric.replaceChildren(document.createTextNode('Top W1'), textElement('b', topScore));
      scoreline.appendChild(metric);
      header.replaceChildren(textElement('strong', 'AI Rankings'), scoreline);

      const list = document.createElement('div');
      list.className = 'mock-results-player-list';
      list.replaceChildren(mockResultsRankingLabels(), ...rankings.map(ranking => {
        const row = document.createElement('div');
        row.className = 'mock-results-player';
        const owner = document.createElement('span');
        owner.className = 'mock-results-name';
        owner.replaceChildren(
          textElement('span', ranking.owner),
          textElement('small', ranking.explanation)
        );
        row.replaceChildren(
          textElement('span', '#' + ranking.rank, 'mock-results-slot'),
          owner,
          textElement('span', scoreText(ranking.week1Score), 'mock-results-score'),
          textElement('span', scoreText(ranking.seasonStrengthScore || ranking.projectedFinishScore), 'mock-results-score')
        );
        return row;
      }));

      card.replaceChildren(header, list);
      return card;
    };

    const renderMockResultsGrid = run => {
      const root = byId('mock-results-grid');
      if (!run) {
        mockResultsIntelligencePanel(null);
        root.replaceChildren(mockDraftItem('No run selected', 'Run mocks from the draft room first.'));
        return;
      }

      mockResultsIntelligencePanel(run);
      root.replaceChildren(
        ...run.teams.map(mockResultsTeamCard),
        renderMockResultsRankingsCard(run.rankings)
      );
    };

    const renderMockResultsRunSelector = report => {
      const runs = report && report.runs ? report.runs : [];
      const selectedRun = runs[selectedMockResultsRunIndex] || runs[0];
      const button = byId('mock-results-run-button');
      const list = byId('mock-results-run-list');
      button.textContent = selectedRun ? selectedRun.label : 'Run results';
      list.replaceChildren(...runs.map((run, index) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'run-option';
        option.textContent = run.label;
        option.setAttribute('aria-selected', String(index === selectedMockResultsRunIndex));
        option.addEventListener('click', () => {
          selectedMockResultsRunIndex = index;
          list.hidden = true;
          renderMockResultsRoute(latestMockBatchReport);
        });
        return option;
      }));
    };

    const renderMockResultsRoute = report => {
      latestMockBatchReport = report || latestMockBatchReport;
      byId('draft-room-view').hidden = true;
      byId('mock-results-view').hidden = false;

      if (!latestMockBatchReport || !latestMockBatchReport.runs || !latestMockBatchReport.runs.length) {
        byId('mock-results-title').textContent = 'No completed mock batch yet.';
        byId('mock-results-status').textContent = 'Start a batch from the draft room.';
        byId('mock-results-run-button').textContent = 'Run results';
        byId('mock-results-run-list').replaceChildren();
        byId('mock-results-analytics').replaceChildren();
        byId('mock-results-intelligence').replaceChildren();
        byId('mock-results-grid').replaceChildren(mockDraftItem('No results yet', 'Run mocks, wait for the progress bar, then come back here.'));
        return;
      }

      selectedMockResultsRunIndex = Math.min(selectedMockResultsRunIndex, latestMockBatchReport.runs.length - 1);
      const run = latestMockBatchReport.runs[selectedMockResultsRunIndex];
      const strategyNames = [...new Set(latestMockBatchReport.runs.map(candidate => candidate.strategyKey))];
      const strategySummary = strategyNames.length > 1 ? 'strategy comparison' : latestMockBatchReport.options.strategyKey;
      const scriptSummary = latestMockBatchReport.script ? ' - ' + latestMockBatchReport.script.label : '';
      byId('mock-results-title').textContent =
        latestMockBatchReport.summary.runCount + ' completed runs - ' + strategySummary + ' - expected keepers' + scriptSummary;
      byId('mock-results-status').textContent =
        run.label + ' / ' + run.scenarioLabel + ' / seed ' + run.seed;
      renderMockResultsRunSelector(latestMockBatchReport);
      mockResultsAnalyticsPanel(latestMockBatchReport);
      renderMockResultsGrid(run);
    };

    const renderMockResultsLoading = job => {
      byId('draft-room-view').hidden = true;
      byId('mock-results-view').hidden = false;
      byId('mock-results-title').textContent = 'Mock batch running.';
      byId('mock-results-status').textContent = String(job.percent || 0) + '% complete';
      byId('mock-results-run-button').textContent = 'Waiting for results';
      byId('mock-results-run-list').replaceChildren();
      byId('mock-results-analytics').replaceChildren();
      byId('mock-results-intelligence').replaceChildren();
      byId('mock-results-grid').replaceChildren(mockDraftItem('Running mocks', String(job.percent || 0) + '% complete'));
    };

    const renderMockResultsError = message => {
      byId('draft-room-view').hidden = true;
      byId('mock-results-view').hidden = false;
      byId('mock-results-title').textContent = 'Mock results unavailable.';
      byId('mock-results-status').textContent = message;
      byId('mock-results-run-button').textContent = 'Run results';
      byId('mock-results-run-list').replaceChildren();
      byId('mock-results-analytics').replaceChildren();
      byId('mock-results-intelligence').replaceChildren();
      byId('mock-results-grid').replaceChildren(mockDraftItem('Could not load results', message));
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
      if (target.draftable === false && byId('my-needs-filter').checked) return false;
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
      const defaultTieBreak =
        right.liveExpectedPrice - left.liveExpectedPrice ||
        right.seasonProjection - left.seasonProjection ||
        left.name.localeCompare(right.name);
      if ((left.draftable === false) !== (right.draftable === false)) {
        return left.draftable === false ? 1 : -1;
      }
      if (typeof leftValue === 'string' || typeof rightValue === 'string') {
        return direction * cleanText(leftValue).localeCompare(cleanText(rightValue)) || defaultTieBreak;
      }
      return direction * (leftValue - rightValue) || defaultTieBreak;
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

    const mockRangeText = mockRange => {
      if (!mockRange) return '-';
      return money(mockRange.minimumSalePrice) + '-' + money(mockRange.maximumSalePrice) +
        ' avg ' + money(mockRange.averageSalePrice) +
        ' / ' + Math.round(Number(mockRange.draftedRate || 0) * 100) + '% drafted';
    };

    const auditClassFor = audit => {
      if (audit.verdict === 'overpay') return 'summary-item warn';
      if (audit.verdict === 'deal') return 'summary-item';
      return 'summary-item';
    };

    const renderPostDraftAudit = state => {
      const audits = Array.isArray(state.postDraftAudit) ? state.postDraftAudit.slice().reverse() : [];
      if (!audits.length) {
        byId('post-draft-audit').replaceChildren(mockDraftItem('No sales yet', 'Audit appears after purchases are logged.'));
        return;
      }

      byId('post-draft-audit').replaceChildren(...audits.slice(0, 8).map(audit => {
        const item = document.createElement('div');
        item.className = auditClassFor(audit);
        const mockLine = 'Mock ' + mockRangeText(audit.mockRange);
        item.replaceChildren(
          textElement('strong', audit.player + ' - ' + audit.owner + ' ' + money(audit.price) + ' - ' + audit.verdict),
          textElement('span', 'Exp ' + deltaMoney(audit.expectedDelta) + ' / Live ' + deltaMoney(audit.liveDelta) + ' / Our ' + deltaMoney(audit.personalDelta), 'subtle'),
          textElement('span', mockLine, 'subtle')
        );
        return item;
      }));
    };

    const renderImportConflictReview = state => {
      const root = byId('import-conflict-review');
      const review = state.conflictReview;
      if (!review || !Array.isArray(review.issues) || !review.issues.length) {
        root.replaceChildren();
        return;
      }

      const summary = mockDraftItem(
        review.title || 'Import needs review',
        review.issueCount + ' issue' + (review.issueCount === 1 ? '' : 's') + ' across ' + review.importedCount + ' command' + (review.importedCount === 1 ? '' : 's') + '. Current room was not replaced.'
      );
      summary.classList.add('warn');

      const issues = review.issues.map(issue => {
        const item = document.createElement('div');
        item.className = 'summary-item warn';
        const rawCommand = document.createElement('code');
        rawCommand.className = 'raw-command';
        rawCommand.textContent = issue.input || '-';
        item.replaceChildren(
          textElement('strong', '#' + issue.index + ' - ' + cleanText(issue.type).replaceAll('-', ' ')),
          textElement('span', issue.message, 'subtle'),
          rawCommand
        );
        if (issue.matchOptions && issue.matchOptions.length) {
          item.appendChild(textElement('span', 'Options: ' + issue.matchOptions.join(' / '), 'subtle'));
        }
        return item;
      });

      root.replaceChildren(summary, ...issues);
    };

    const renderDraftPath = state => {
      const path = state.draftPath;
      if (!path) {
        byId('draft-path').replaceChildren(mockDraftItem('Path', 'No draft path loaded.'));
        return;
      }

      const nextBand = (path.maxPriceBands || []).find(band => band.status === 'next');
      const target = (path.targetClusters || [])[0];
      const pivot = (path.pivotRules || [])[0];
      const risks = (path.riskAlerts || []).slice(0, 3);
      const deadZone = (path.deadZoneWarnings || [])[0];
      const rows = [
        mockDraftItem('Path', path.summary),
        mockDraftItem(
          'Max',
          nextBand
            ? nextBand.slot + ' ' + money(nextBand.minimumPrice) + '-' + money(nextBand.maximumPrice)
            : 'Follow live max bid discipline.'
        ),
        mockDraftItem(
          'Target',
          target
            ? target.position + ' ' + target.priceBand + ' - ' + (target.targetNames || []).slice(0, 4).join(' / ')
            : 'No target cluster available.'
        ),
        mockDraftItem(
          'Pivot',
          pivot ? pivot.trigger + ' ' + pivot.action : 'No pivot needed yet.'
        ),
        ...risks.map(risk => mockDraftItem('Risk - ' + risk.label, risk.detail)),
        mockDraftItem(
          'Dead zone',
          deadZone || 'None'
        )
      ];

      byId('draft-path').replaceChildren(...rows);
    };

    const renderShortlist = state => {
      const targetByName = new Map((state.availableTargets || []).map(target => [target.name, target]));
      const manualRows = manualShortlistNames
        .map(name => targetByName.get(name))
        .filter(Boolean)
        .map(target => {
          const item = document.createElement('div');
          item.className = 'summary-item';
          item.replaceChildren(
            textElement('strong', target.name + ' - ' + target.position + ' ' + money(target.recommendedMaxBid)),
            textElement(
              'span',
              (target.teamAbbreviation || '-') + ' bye ' + (target.byeWeek || '-') + ' - live ' + money(target.liveExpectedPrice) + ' - gap ' + deltaMoney(valueGapFor(target)),
              'subtle'
            )
          );
          item.addEventListener('click', () => selectTargetForSale(target));
          return item;
        });
      const modelRows = (state.shortlist || []).slice(0, 8).map(target => {
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
          const fullTarget = targetByName.get(target.name);
          if (fullTarget) selectTargetForSale(fullTarget);
        });
        return item;
      });

      byId('manual-shortlist').replaceChildren(
        ...(manualRows.length ? manualRows : [mockDraftItem('No starred players yet', 'Use the star next to a player name to keep them here.')])
      );
      byId('model-shortlist').replaceChildren(...modelRows);
      byId('shortlist').replaceChildren(...modelRows.map(row => row.cloneNode(true)));
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

    const mockAuctionFeedLines = mockDraft =>
      mockDraft && mockDraft.auction && Array.isArray(mockDraft.auction.feed)
        ? mockDraft.auction.feed
        : [];

    const mockDraftNominationText = mockDraft => {
      if (!mockDraft || !mockDraft.auction) return '';
      const auction = mockDraft.auction;
      return (auction.nominator || mockDraft.nominator || 'AI') + ' nominated ' + (auction.player || '-');
    };

    const mockDraftPhaseLabel = mockDraft => {
      if (!mockDraft || !mockDraft.auction) return '';
      const auction = mockDraft.auction;
      if (auction.status === 'sold' && auction.resolution) {
        return 'Sold to ' + auction.resolution.owner + ' for ' + money(auction.resolution.price);
      }
      if (mockDraft.phase === 'human-decision' && auction.nextCamBid != null) {
        return 'Current ' + money(auction.currentBid) + ' - Cam can bid ' + money(auction.nextCamBid);
      }
      if (mockDraft.phase === 'ai-sale') {
        return 'AI sale ready at ' + money(auction.currentBid);
      }
      return cleanText(mockDraft.phase || 'Mock auction');
    };

    const renderMockAuctionFeed = mockDraft => {
      const root = byId('mock-auction-feed');
      const active = byId('mock-active-nomination');
      const lines = byId('mock-auction-feed-lines');
      const shouldShow = currentDraftMode === 'interactive-mock' && mockDraft && mockDraft.auction;
      root.hidden = !shouldShow;
      if (!shouldShow) {
        active.replaceChildren();
        lines.replaceChildren();
        return;
      }

      active.replaceChildren(
        textElement('strong', mockDraftNominationText(mockDraft)),
        textElement('span', mockDraftPhaseLabel(mockDraft), 'mock-auction-phase')
      );
      lines.replaceChildren(...mockAuctionFeedLines(mockDraft).map(event => {
        const item = document.createElement('span');
        item.className = 'mock-feed-line ' + event.type;
        item.textContent = cleanText(event.text);
        return item;
      }));
    };

    const syncMockNominationSelection = mockDraft => {
      if (!currentState || !mockDraft || !mockDraft.nomination || !mockDraft.nomination.player) return;

      const target = currentState.availableTargets.find(candidate => candidate.name === mockDraft.nomination.player);
      if (!target || selectedTargetName === target.name) return;

      selectedTargetName = target.name;
      const nominationPrice = mockDraft.camDecision ? mockDraft.camDecision.recommendedBid : target.recommendedMaxBid;
      byId('add-price').value = String(nominationPrice);
      renderSelected(currentState);
      renderBoard(currentState);
    };

    const renderMockDraft = mockDraft => {
      currentMockDraft = mockDraft;
      renderMockAuctionFeed(mockDraft);
      const details = byId('mock-draft-details');
      byId('mock-draft-panel').dataset.phase = mockDraft && mockDraft.phase ? mockDraft.phase : '';
      const isMockMode = currentDraftMode === 'interactive-mock';
      const phase = mockDraft ? mockDraft.phase : '';
      const camBidButton = byId('mock-cam-win-button');
      const nominateButton = byId('mock-nominate-button');
      const nextDecisionButton = byId('mock-next-decision-button');
      const nextRoundButton = byId('mock-next-round-button');
      const completeButton = byId('mock-complete-button');
      const target = selectedTarget();
      const terminal = phase === 'complete' || phase === 'blocked';
      const humanStop = phase === 'human-decision' || phase === 'human-nomination';
      byId('mock-advance-button').disabled = !isMockMode || phase !== 'ai-sale';
      nominateButton.disabled = !isMockMode || phase !== 'human-nomination' || !target;
      nominateButton.textContent = target ? 'Nominate ' + shortPlayerName(target.name) : 'Nominate';
      camBidButton.disabled = !isMockMode || phase !== 'human-decision' || !mockDraft.camDecision;
      camBidButton.textContent = mockDraft && mockDraft.auction && mockDraft.auction.nextCamBid != null ? 'Bid ' + money(mockDraft.auction.nextCamBid) : 'Bid';
      byId('mock-pass-button').disabled = !isMockMode || phase !== 'human-decision';
      nextDecisionButton.disabled = !isMockMode || terminal || humanStop;
      nextRoundButton.disabled = !isMockMode || terminal || humanStop;
      completeButton.disabled = !isMockMode || terminal;

      if (!isMockMode) {
        details.replaceChildren(mockDraftItem('Mock draft', 'Start mock draft to enter the practice room.'));
        return;
      }

      if (!mockDraft) {
        details.replaceChildren(mockDraftItem('Mock draft', 'Loading interactive state.'));
        return;
      }

      if (phase === 'human-nomination') {
        const ideas = (mockDraft.topTargets || []).slice(0, 5);
        details.replaceChildren(
          mockDraftItem('Cam nomination', target ? 'Nominate ' + target.name + ' from the board.' : 'Select a player from the board.'),
          mockDraftItem('Nomination ideas', ideas.length ? ideas.map(candidate => candidate.name + ' ' + money(candidate.liveExpectedPrice)).join(' / ') : '-')
        );
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
        items.push(mockDraftItem('Cam bid', recommended + ' now / ' + topAiOwner + ' can chase to ' + topAiBid + ' / Cam max ' + maxBid));
      } else if (aiBids.length) {
        items.push(mockDraftItem('Cam bid', aiBids[0].owner + ' can go to ' + money(aiBids[0].amount) + '. Use AI sale unless you want to manually override.'));
      }

      details.replaceChildren(...items);
      syncMockNominationSelection(mockDraft);
      renderSaleControls(currentState);
      if (currentState) renderBoard(currentState);
    };

    const renderBoard = state => {
      syncBoardControls();
      const owner = currentOwner();
      const query = boardSearchQuery();
      const tierDrops = tierDropsFor(state.availableTargets);
      const allTargets = visibleBoardTargets(state);
      const filtered = allTargets.filter(target => targetMatchesFilters(target, query, owner));
      const matches = sortedTargets(filtered, tierDrops).slice(0, 120);
      const keeperCount = allTargets.length - state.availableTargets.length;
      byId('board-count').textContent = String(matches.length) + ' shown / ' + String(filtered.length) + ' matched / ' + String(state.availableTargets.length) + ' available' + (keeperCount ? ' / ' + keeperCount + ' kept' : '');

      const rows = matches.map(target => {
        const tierDrop = tierDrops.get(target.name) || 0;
        const row = document.createElement('tr');
        if (target.name === selectedTargetName) row.classList.add('is-selected');
        if (currentMockDraft && currentMockDraft.auction && target.name === currentMockDraft.auction.player) row.classList.add('is-nominated');
        if (target.draftable === false) row.classList.add('keeper-row');
        const addCell = tableCell(row, '', 'center');
        addCell.appendChild(addTargetButton(target, 'icon'));

        const playerCell = tableCell(row, '', '');
        const title = document.createElement('div');
        title.className = 'player-title';
        title.append(textElement('div', target.name, 'player-name'), starTargetButton(target));
        playerCell.appendChild(title);
        if (target.draftable === false) {
          playerCell.appendChild(textElement('div', target.keeperOwner + ' keeper' + ' at ' + money(target.keeperCost), 'subtle'));
        }
        const strategyValues = renderStrategyValues(target);
        if (strategyValues) playerCell.appendChild(strategyValues);
        const tags = targetTags(target, tierDrop);
        if (tags) playerCell.appendChild(tags);

        tableCell(row, target.position);
        tableCell(row, target.teamAbbreviation || '-');
        tableCell(row, target.byeWeek || '-', 'center');
        tableCell(row, scoreText(target.week1Projection), 'money');
        tableCell(row, scoreText(target.seasonProjection), 'money');
        tableCell(row, money(target.expectedPrice), 'money');
        tableCell(row, money(target.liveExpectedPrice), 'money');
        tableCell(row, money(target.personalValue), 'money');
        tableCell(row, deltaMoney(valueGapFor(target)), 'money ' + gapClassFor(valueGapFor(target)));
        tableCell(row, money(target.recommendedMaxBid), 'money');
        return row;
      });

      byId('board').replaceChildren(...rows);
      byId('board-cards').replaceChildren(...matches.map(target => {
        const tierDrop = tierDrops.get(target.name) || 0;
        const card = document.createElement('div');
        card.className = 'target-card';
        if (currentMockDraft && currentMockDraft.auction && target.name === currentMockDraft.auction.player) card.classList.add('is-nominated');
        const add = document.createElement('div');
        add.appendChild(addTargetButton(target, 'icon'));
        const body = document.createElement('div');
        body.className = 'target-card-body';
        const top = document.createElement('div');
        top.className = 'target-card-top';
        const title = document.createElement('div');
        title.className = 'player-title';
        title.append(textElement('div', target.name, 'player-name'), starTargetButton(target));
        top.append(
          title,
          textElement('div', target.position + ' ' + (target.teamAbbreviation || '-') + ' - bye ' + (target.byeWeek || '-'), 'target-card-meta')
        );

        const values = document.createElement('div');
        values.className = 'target-card-values';
        for (const [label, value, className] of [
          ['Exp', money(target.expectedPrice), ''],
          ['Live', money(target.liveExpectedPrice), ''],
          ['Our', money(target.personalValue), ''],
          ['Gap', deltaMoney(valueGapFor(target)), gapClassFor(valueGapFor(target))],
          ['W1', scoreText(target.week1Projection), ''],
          ['Season', scoreText(target.seasonProjection), '']
        ]) {
          const cell = document.createElement('div');
          cell.className = 'target-card-value ' + className;
          cell.append(textElement('span', label), textElement('strong', value));
          values.appendChild(cell);
        }

        const tags = targetTags(target, tierDrop);
        body.append(top);
        if (target.draftable === false) {
          body.appendChild(textElement('div', target.keeperOwner + ' keeper' + ' at ' + money(target.keeperCost), 'subtle'));
        }
        const strategyValues = renderStrategyValues(target);
        if (strategyValues) body.appendChild(strategyValues);
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
      const priceInput = byId('add-price');
      const ownerInput = byId('add-owner');
      const warning = byId('sale-warning');
      const isMockMode = currentDraftMode === 'interactive-mock';
      ownerInput.disabled = isMockMode;
      priceInput.disabled = isMockMode;
      warning.classList.toggle('info', isMockMode);

      if (isMockMode) {
        const auction = currentMockDraft && currentMockDraft.auction;
        const isAuctionTarget = Boolean(target && auction && auction.player === target.name);
        submit.disabled = true;
        submit.textContent = target ? 'Mock mode - use auction controls' : 'Mock mode';
        if (isAuctionTarget && auction.status === 'sold' && auction.resolution) {
          warning.textContent =
            'Mock auction sold ' + target.name + ' to ' + auction.resolution.owner + ' for ' + money(auction.resolution.price) + '. Advance to the next nomination.';
        } else if (isAuctionTarget && auction.nextCamBid != null) {
          warning.textContent = 'Use the Bid ' + money(auction.nextCamBid) + ' button in the mock auction controls.';
        } else if (currentMockDraft && currentMockDraft.phase === 'human-nomination') {
          warning.textContent = target ? 'Use Nominate ' + shortPlayerName(target.name) + ' in the mock auction controls.' : 'Select a player to nominate.';
        } else {
          warning.textContent = 'Mock mode uses the auction controls below. Manual sale logging is disabled here.';
        }
        return;
      }

      ownerInput.disabled = false;
      priceInput.disabled = false;
      submit.disabled = warnings.length > 0;
      submit.textContent = target ? 'Add ' + shortPlayerName(target.name) + ' to ' + owner.owner + ' for ' + money(price || target.recommendedMaxBid) : 'Add';
      warning.textContent = warnings.join(' ');
    };

    const renderSelected = state => {
      const target = selectedTarget();
      const root = byId('selected-player');
      if (!target) {
        const first = state.availableTargets[0];
        selectedTargetName = first ? first.name : null;
        if (first) byId('add-price').value = String(first.recommendedMaxBid);
        if (first) renderSelected(state);
        return;
      }

      const meta = textElement(
        'span',
        target.position + ' ' + (target.teamAbbreviation || '-') + ' - bye ' + (target.byeWeek || '-'),
        'subtle'
      );
      const bidPrice = activeBidPriceFor(target);
      const values = document.createElement('div');
      values.className = 'selected-values';
      for (const [label, value, className] of [
        ['Exp', money(target.expectedPrice), ''],
        ['Live', money(target.liveExpectedPrice), ''],
        ['Bid', money(bidPrice), ''],
        ['Our', money(target.personalValue), ''],
        ['Bid gap', deltaMoney(valueGapAtPriceFor(target, bidPrice)), gapClassFor(valueGapAtPriceFor(target, bidPrice))],
        ['Season', scoreText(target.seasonProjection), '']
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
      syncDraftSession(state);
      loadManualShortlist();
      renderDraftMode(state);
      if (!state.owners.some(owner => owner.owner === selectedRosterOwner)) selectedRosterOwner = 'Cam';
      syncOwnerSelects(state);
      syncBoardFilterOptions(state);
      renderMetrics(state);
      renderPositionMarket(state);
      renderBoard(state);
      renderSelected(state);
      renderReadiness(state);
      renderPostDraftAudit(state);
      renderDraftPath(state);
      renderShortlist(state);
      renderRoster(state);
      renderOwners(state);
      renderPositionContext(state);
      renderEvents(state);
      renderErrors(state);
      renderImportConflictReview(state);
      renderSidePanel(state);
      if (state.mockDraft) renderMockDraft(state.mockDraft);
      else renderMockDraft(null);
      renderMockBatchResults(latestMockBatchReport);
    };

    const refreshMockDraft = async () => {
      if (!isActiveDraft() || currentDraftMode !== 'interactive-mock' || draftNightLockFor(currentState)) {
        renderMockDraft(null);
        return null;
      }
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
        byId('mock-nominate-button').disabled = true;
        byId('mock-cam-win-button').disabled = true;
        byId('mock-pass-button').disabled = true;
        byId('mock-next-decision-button').disabled = true;
        byId('mock-next-round-button').disabled = true;
        byId('mock-complete-button').disabled = true;
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

    const clearDraftCountdownTimer = () => {
      if (!draftCountdownTimer) return;
      window.clearTimeout(draftCountdownTimer);
      draftCountdownTimer = null;
    };

    const activateDraft = async () => {
      clearDraftCountdownTimer();
      draftLifecycle = 'active';
      draftCountdownValue = 0;
      pendingCamNominationName = null;
      persistDraftLifecycle();

      if (currentDraftMode === 'interactive-mock') {
        const data = await postJson('/api/reset', {});
        alertCommandErrors(data);
      }

      await refreshDraftRoom();
      focusCommandInput();
    };

    const beginDraftCountdown = () => {
      if (isActiveDraft()) return;
      clearDraftCountdownTimer();
      draftLifecycle = 'countdown';
      draftCountdownValue = draftCountdownSeconds;
      persistDraftLifecycle();
      renderDraftMode(currentState);

      const tick = () => {
        draftCountdownValue -= 1;
        if (draftCountdownValue <= 0) {
          void activateDraft();
          return;
        }
        renderDraftLifecycle(currentState);
        draftCountdownTimer = window.setTimeout(tick, 1000);
      };

      draftCountdownTimer = window.setTimeout(tick, 1000);
    };

    const endActiveDraft = async () => {
      if (!isActiveDraft() && !isStartingDraft()) return;
      const isMock = currentDraftMode === 'interactive-mock';
      const message = isMock
        ? 'End this mock draft and return to setup? This keeps the practice log until you reset it.'
        : 'End the active real draft view? This will not change logged sales.';
      if (!window.confirm(message)) {
        focusCommandInput();
        return;
      }

      clearDraftCountdownTimer();
      draftLifecycle = 'setup';
      draftCountdownValue = 0;
      pendingCamNominationName = null;
      persistDraftLifecycle();
      await refreshDraftRoom();
      focusCommandInput();
    };

    const setDraftMode = async (mode, options = {}) => {
      if (mode === 'real') currentDraftSession = 'live';
      if (mode === 'interactive-mock' && draftNightLockFor(currentState)) {
        currentDraftSession = practiceSessionForStrategy(currentStrategyKey);
      }
      currentDraftMode = draftModes.includes(mode) ? mode : 'real';
      if (options.prepareStart) draftLifecycle = 'ready';
      else if (!isActiveDraft()) draftLifecycle = 'setup';
      selectedTargetName = null;
      pendingCamNominationName = null;
      persistDraftLifecycle();
      await refreshDraftRoom();
      focusCommandInput();
    };

    const setDraftSession = async draftSession => {
      currentDraftSession = draftSession || 'live';
      if (!isActiveDraft()) draftLifecycle = 'setup';
      selectedTargetName = null;
      pendingCamNominationName = null;
      persistDraftLifecycle();
      await refreshDraftRoom();
      focusCommandInput();
    };

    const openScratchSession = async () => {
      const scratchName = byId('scratch-session-name').value.trim();
      if (!scratchName) {
        byId('active-session-label').textContent = 'Enter a scratch room name.';
        byId('scratch-session-name').focus();
        return;
      }
      await setDraftSession('scratch:' + scratchName);
    };

    const renderMockBatchButtonState = job => {
      const button = byId('run-mock-batch-button');
      const seeResultsButton = byId('see-mock-results-button');
      const resultsRunNewButton = byId('mock-results-run-new-button');
      const input = byId('mock-batch-runs');
      const scriptInput = byId('mock-batch-script');
      const status = job ? job.status : '';
      const percent = Math.max(0, Math.min(100, Number(job && job.percent ? job.percent : 0)));
      const isRunning = status === 'queued' || status === 'running';
      const isReady = status === 'complete' && job && job.result;

      button.style.setProperty('--mock-progress', isRunning ? percent + '%' : '0%');
      button.classList.toggle('mock-batch-running', isRunning);
      button.classList.toggle('mock-batch-ready', false);
      button.disabled = isRunning;
      input.disabled = isRunning;
      scriptInput.disabled = isRunning;
      seeResultsButton.hidden = !isReady;
      seeResultsButton.disabled = !isReady || isRunning;
      resultsRunNewButton.disabled = isRunning;

      if (isRunning) {
        button.textContent = percent > 0 ? percent + '% complete' : 'Starting mocks';
        resultsRunNewButton.textContent = percent > 0 ? percent + '% complete' : 'Starting mocks';
        return;
      }

      resultsRunNewButton.textContent = 'Run new mocks';
      button.textContent = 'Run mocks';
    };

    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    const fetchMockBatchJob = async jobId => {
      const response = await fetch('/api/mock-batch/' + encodeURIComponent(jobId));
      const job = await response.json();
      if (!response.ok) throw new Error(job.error || 'Could not load mock batch job.');
      return job;
    };

    const pollMockBatchJob = async jobId => {
      const job = await fetchMockBatchJob(jobId);
      latestMockBatchJob = job;
      if (job.result) {
        latestMockBatchReport = job.result;
        renderMockBatchResults(job.result);
      }
      renderMockBatchButtonState(job);

      if (window.location.pathname === '/mock-results') {
        if (job.status === 'complete' && job.result) renderMockResultsRoute(job.result);
        else renderMockResultsLoading(job);
      }

      if (job.status === 'complete') return job;
      if (job.status === 'failed') throw new Error(job.error || 'Mock batch failed.');

      await wait(250);
      return pollMockBatchJob(jobId);
    };

    const loadLatestMockBatchJob = async () => {
      const response = await fetch('/api/mock-batch/latest');
      const job = await response.json();
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(job.error || 'Could not load mock batch results.');
      return job;
    };

    const mockBatchSeedPrefix = () =>
      'live-ui-' + currentStrategyKey + '-' + Date.now().toString(36);

    const mockBatchScript = () =>
      byId('mock-batch-script').value.trim();

    const runMockBatch = async () => {
      const runs = Number(byId('mock-batch-runs').value || 25);
      selectedMockResultsRunIndex = 0;
      try {
        const response = await fetch('/api/mock-batch', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            strategyKey: currentStrategyKey,
            draftSession: currentDraftSession,
            runs,
            seedPrefix: mockBatchSeedPrefix(),
            script: mockBatchScript()
          })
        });
        const job = await response.json();
        if (!response.ok) throw new Error(job.error || 'Could not run mock batch.');
        latestMockBatchJob = job;
        renderMockBatchButtonState(job);
        await pollMockBatchJob(job.jobId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not run mock batch.';
        byId('mock-batch-results').replaceChildren(mockDraftItem('Mock batch failed', message));
        latestMockBatchJob = { status: 'failed', percent: 0, error: message };
        renderMockBatchButtonState(latestMockBatchJob);
      }

      if (window.location.pathname !== '/mock-results') {
        focusCommandInput();
      }
    };

    const renderDraftRoomRoute = async () => {
      byId('draft-room-view').hidden = false;
      byId('mock-results-view').hidden = true;
      await refreshDraftRoom();
      renderMockBatchButtonState(latestMockBatchJob);
      focusCommandInput();
    };

    const renderMockResultsPage = async () => {
      byId('draft-room-view').hidden = true;
      byId('mock-results-view').hidden = false;

      try {
        const job = await loadLatestMockBatchJob();
        latestMockBatchJob = job;
        if (!job) {
          renderMockResultsRoute(null);
          return;
        }

        if (job.result) latestMockBatchReport = job.result;
        if (job.status === 'complete' && job.result) {
          renderMockResultsRoute(job.result);
          return;
        }

        renderMockResultsLoading(job);
        await pollMockBatchJob(job.jobId);
      } catch (error) {
        renderMockResultsError(error instanceof Error ? error.message : 'Could not load mock results.');
      }
    };

    const renderCurrentRoute = async () => {
      if (window.location.pathname === '/mock-results') {
        await renderMockResultsPage();
        return;
      }

      await renderDraftRoomRoute();
    };

    const postJsonAndRefresh = async (url, body) => {
      const data = await postJson(url, body);
      await refreshMockDraft();
      focusCommandInput();
      return data;
    };

    const submitCommand = async command => {
      const data = await postJson('/api/events', { command });
      alertCommandErrors(data);
      if (!data.errors.length) {
        pendingCamNominationName = null;
        selectedTargetName = data.availableTargets[0] ? data.availableTargets[0].name : null;
        render(data);
      }
      await refreshMockDraft();
      focusCommandInput();
      return data;
    };

    const confirmLiveDraftMutation = action => {
      if (!isLiveRealDraftRoom()) return true;
      return window.confirm('This will ' + action + ' the real live draft room. Export a bundle first if you are not sure.');
    };

    const advanceMockDraft = async action => {
      if (draftNightLockFor(currentState)) {
        window.alert(draftNightLockReasonFor(currentState));
        currentDraftMode = 'real';
        if (currentState) renderDraftMode(currentState);
        focusCommandInput();
        return null;
      }
      if (currentDraftMode !== 'interactive-mock') {
        await setDraftMode('interactive-mock');
      }
      if (action === 'cam-nominate') {
        pendingCamNominationName = selectedTargetName;
      }
      const data = await postJson('/api/mock/advance', {
        strategyKey: currentStrategyKey,
        mode: 'interactive-mock',
        draftSession: currentDraftSession,
        seed: 'live-ui',
        action,
        nominatedPlayer: pendingCamNominationName,
        mockAuction: currentMockDraft && currentMockDraft.auction
      });
      if (action !== 'cam-nominate' && !data.errors.length) pendingCamNominationName = null;
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
      const response = await fetch('/api/export?mode=' + currentDraftMode + '&format=' + format + sessionQuery());
      const content = await response.text();
      if (!response.ok) {
        if (currentState) render({ ...currentState, errors: [{ input: '', message: content || 'Could not export draft log.' }] });
        await refreshMockDraft();
        focusCommandInput();
        return;
      }

      downloadText(
        'mockd-' + currentDraftMode + '-draft-log.' + format,
        content,
        format === 'csv' ? 'text/csv' : 'application/json'
      );
      await refreshMockDraft();
      focusCommandInput();
    };

    const exportSessionBundle = async () => {
      const response = await fetch('/api/export-bundle?mode=' + currentDraftMode + '&strategy=' + currentStrategyKey + sessionQuery());
      const content = await response.text();
      if (!response.ok) {
        if (currentState) render({ ...currentState, errors: [{ input: '', message: content || 'Could not export draft bundle.' }] });
        await refreshMockDraft();
        focusCommandInput();
        return;
      }

      downloadText('mockd-' + safeFilePart(currentDraftSession) + '-' + currentDraftMode + '-bundle.json', content, 'application/json');
      await refreshMockDraft();
      focusCommandInput();
    };

    const importDraftLogFile = async file => {
      if (!file) return;
      const format = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
      const content = await file.text();
      if (!confirmLiveDraftMutation('import over')) {
        byId('import-log-file').value = '';
        focusCommandInput();
        return;
      }
      const importGuard = isLiveRealDraftRoom()
        ? { confirmImport: true, expectedCommandCount: currentCommandCount() }
        : {};
      const data = await postJson('/api/import', { format, content, ...importGuard });
      alertCommandErrors(data);
      await refreshMockDraft();
      byId('import-log-file').value = '';
      focusCommandInput();
    };

    const resetDraftRoom = async () => {
      if (!confirmLiveDraftMutation('reset')) {
        focusCommandInput();
        return;
      }
      const resetGuard = isLiveRealDraftRoom()
        ? { confirmReset: true, expectedCommandCount: currentCommandCount() }
        : {};
      const data = await postJsonAndRefresh('/api/reset', resetGuard);
      alertCommandErrors(data);
    };

    const syncBoardSearchInput = source => {
      const other = source.id === 'board-search' ? byId('header-board-search') : byId('board-search');
      other.value = source.value;
      if (currentState) renderBoard(currentState);
    };

    const submitQuickSaleCommand = async input => {
      const command = input.value.trim();
      if (!command) return;
      const data = await submitCommand(command);
      if (!data.errors.length) input.value = '';
    };

    byId('board-search').addEventListener('input', event => {
      syncBoardSearchInput(event.target);
    });

    byId('header-board-search').addEventListener('input', event => {
      syncBoardSearchInput(event.target);
    });

    byId('quick-sale-form').addEventListener('submit', async event => {
      event.preventDefault();
      await submitQuickSaleCommand(byId('quick-sale-command'));
    });

    byId('header-quick-sale-form').addEventListener('submit', async event => {
      event.preventDefault();
      await submitQuickSaleCommand(byId('header-quick-sale-command'));
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

    for (const button of document.querySelectorAll('[data-side-panel]')) {
      button.addEventListener('click', event => setSidePanel(event.currentTarget.dataset.sidePanel));
    }

    byId('sort-select').addEventListener('change', event => {
      const [key, direction] = event.target.value.split(':');
      boardSortKey = key;
      boardSortDirection = direction;
      if (currentState) renderBoard(currentState);
    });

    byId('strategy-select').addEventListener('change', async event => {
      currentStrategyKey = strategyKeys.includes(event.target.value) ? event.target.value : 'three-rb';
      pendingCamNominationName = null;
      persistDraftLifecycle();
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
      if (currentState) renderSelected(currentState);
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
      if (currentDraftMode === 'interactive-mock') {
        renderSaleControls(currentState);
        focusCommandInput();
        return;
      }
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
    byId('export-bundle-button').addEventListener('click', () => exportSessionBundle());
    byId('import-log-button').addEventListener('click', () => byId('import-log-file').click());
    byId('import-log-file').addEventListener('change', event => importDraftLogFile(event.target.files[0]));
    byId('draft-session-select').addEventListener('change', event => setDraftSession(event.target.value));
    byId('open-scratch-session-button').addEventListener('click', () => openScratchSession());
    byId('scratch-session-name').addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        openScratchSession();
      }
    });
    byId('start-real-draft-button').addEventListener('click', () => setDraftMode('real', { prepareStart: true }));
    byId('start-mock-draft-button').addEventListener('click', () => setDraftMode('interactive-mock', { prepareStart: true }));
    byId('confirm-start-draft-button').addEventListener('click', () => beginDraftCountdown());
    byId('end-draft-button').addEventListener('click', () => endActiveDraft());
    byId('run-mock-batch-button').addEventListener('click', () => runMockBatch());
    byId('see-mock-results-button').addEventListener('click', () => window.location.assign('/mock-results'));
    byId('undo-button').addEventListener('click', () => postJsonAndRefresh('/api/undo'));
    byId('reset-button').addEventListener('click', () => resetDraftRoom());
    byId('mock-advance-button').addEventListener('click', () => advanceMockDraft('advance'));
    byId('mock-nominate-button').addEventListener('click', () => advanceMockDraft('cam-nominate', selectedTargetName));
    byId('mock-cam-win-button').addEventListener('click', () => advanceMockDraft('cam-bid'));
    byId('mock-pass-button').addEventListener('click', () => advanceMockDraft('pass'));
    byId('mock-next-decision-button').addEventListener('click', () => advanceMockDraft('next-cam-decision'));
    byId('mock-next-round-button').addEventListener('click', () => advanceMockDraft('next-round'));
    byId('mock-complete-button').addEventListener('click', () => advanceMockDraft('complete-mock'));
    byId('back-to-draft-room-button').addEventListener('click', () => window.location.assign('/'));
    byId('mock-results-run-button').addEventListener('click', () => {
      const list = byId('mock-results-run-list');
      list.hidden = !list.hidden;
    });
    byId('mock-results-run-new-button').addEventListener('click', () => runMockBatch());
    document.addEventListener('click', event => {
      if (!event.target.closest || !event.target.closest('.run-selector')) byId('mock-results-run-list').hidden = true;
    });

    loadDraftLifecycle();
    renderCurrentRoute();
  </script>
</body>
</html>`;
