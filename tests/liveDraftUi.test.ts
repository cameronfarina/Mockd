import { describe, expect, it } from "vitest";
import { liveDraftHtml } from "../src/liveDraftUi.js";

describe("live draft UI shell", () => {
  it("renders the draft-room controls needed for search, add, and roster review", () => {
    expect(liveDraftHtml).toContain("id=\"board-search\"");
    expect(liveDraftHtml).toContain("id=\"quick-sale-command\"");
    expect(liveDraftHtml).toContain("id=\"board\"");
    expect(liveDraftHtml).toContain("id=\"board-cards\"");
    expect(liveDraftHtml).toContain("id=\"position-filters\"");
    expect(liveDraftHtml).toContain("data-position-filter=\"RB\"");
    expect(liveDraftHtml).toContain("id=\"my-needs-filter\"");
    expect(liveDraftHtml).toContain("id=\"team-filter\"");
    expect(liveDraftHtml).toContain("id=\"bye-filter\"");
    expect(liveDraftHtml).toContain("id=\"sort-select\"");
    expect(liveDraftHtml).toContain("id=\"strategy-select\"");
    expect(liveDraftHtml).toContain("id=\"export-json-button\"");
    expect(liveDraftHtml).toContain("id=\"export-csv-button\"");
    expect(liveDraftHtml).toContain("id=\"import-log-button\"");
    expect(liveDraftHtml).toContain("id=\"import-log-file\"");
    expect(liveDraftHtml).toContain("id=\"start-real-draft-button\"");
    expect(liveDraftHtml).toContain("id=\"start-mock-draft-button\"");
    expect(liveDraftHtml).toContain("id=\"mock-batch-runs\"");
    expect(liveDraftHtml).toContain("id=\"run-mock-batch-button\"");
    expect(liveDraftHtml).toContain("id=\"draft-mode-status\"");
    expect(liveDraftHtml).toContain("id=\"mock-batch-results\"");
    expect(liveDraftHtml).toContain("id=\"add-owner\"");
    expect(liveDraftHtml).toContain("id=\"add-price\"");
    expect(liveDraftHtml).toContain("id=\"add-submit\"");
    expect(liveDraftHtml).toContain("id=\"sale-warning\"");
    expect(liveDraftHtml).toContain("id=\"roster-owner\"");
    expect(liveDraftHtml).toContain("id=\"roster-slots\"");
    expect(liveDraftHtml).toContain("id=\"owner-needs\"");
    expect(liveDraftHtml).toContain("id=\"position-market\"");
    expect(liveDraftHtml).toContain("id=\"readiness-checks\"");
    expect(liveDraftHtml).toContain("id=\"shortlist\"");
    expect(liveDraftHtml).toContain("id=\"position-context\"");
    expect(liveDraftHtml).toContain("id=\"mock-draft-panel\"");
    expect(liveDraftHtml).toContain("id=\"mock-advance-button\"");
    expect(liveDraftHtml).toContain("id=\"mock-cam-win-button\"");
    expect(liveDraftHtml).toContain("id=\"mock-pass-button\"");
    expect(liveDraftHtml).toContain("class=\"sidebar\"");
    expect(liveDraftHtml).toContain("class=\"workspace\"");
    expect(liveDraftHtml).toContain("class=\"sidebar-section\"");
    expect(liveDraftHtml).toContain("data-sort-key=\"personalValue\">Our");
    expect(liveDraftHtml).toContain("data-sort-key=\"valueGap\">Gap");
    expect(liveDraftHtml).toContain("data-sort-key=\"byeWeek\">Bye");
    expect(liveDraftHtml).toContain("<th class=\"money\" style=\"width:70px\">Score</th>");
    expect(liveDraftHtml).not.toContain("id=\"hide-deep-filter\"");
    expect(liveDraftHtml).not.toContain("Hide $1/fallback");
    expect(liveDraftHtml).not.toContain("data-sort-key=\"valueScore\">Score");
  });

  it("includes board behavior for position filters, sortable values, and draft-day guardrails", () => {
    expect(liveDraftHtml).toContain("const boardPositions = ['ALL', 'RB', 'WR', 'TE', 'QB', 'FLEX', 'K', 'DST']");
    expect(liveDraftHtml).toContain("const valueGapFor = target => target.personalValue - target.liveExpectedPrice");
    expect(liveDraftHtml).toContain("const tierDropsFor = targets =>");
    expect(liveDraftHtml).toContain("'next ' + target.position + ' -' + money(tierDrop)");
    expect(liveDraftHtml).toContain("const saleWarningsFor = (target, owner, price) =>");
    expect(liveDraftHtml).toContain("const renderMockDraft = mockDraft =>");
    expect(liveDraftHtml).toContain("const renderDraftMode = state =>");
    expect(liveDraftHtml).toContain("const setDraftMode = async mode =>");
    expect(liveDraftHtml).toContain("const runMockBatch = async () =>");
    expect(liveDraftHtml).toContain("const syncMockNominationSelection = mockDraft =>");
    expect(liveDraftHtml).toContain("const nominationPrice = mockDraft.camDecision ? mockDraft.camDecision.recommendedBid : target.personalValue");
    expect(liveDraftHtml).toContain("byId('add-price').value = String(nominationPrice)");
    expect(liveDraftHtml).toContain("const advanceMockDraft = async action =>");
    expect(liveDraftHtml).toContain("advanceMockDraft('cam-bid')");
    expect(liveDraftHtml).toContain("'Bid ' + money(mockDraft.camDecision.recommendedBid)");
    expect(liveDraftHtml).toContain("mockDraftItem('Current nomination'");
    expect(liveDraftHtml).toContain("mockDraftItem('Top AI bids'");
    expect(liveDraftHtml).toContain("recommended + ' beats ' + topAiOwner + ' bid ' + topAiBid + ' / Cam max ' + maxBid");
    expect(liveDraftHtml).toContain("currentDraftMode === 'interactive-mock'");
    expect(liveDraftHtml).toContain("mode: currentDraftMode");
    expect(liveDraftHtml).toContain("mode=' + currentDraftMode");
    expect(liveDraftHtml).toContain("Start real draft");
    expect(liveDraftHtml).toContain("Start mock draft");
    expect(liveDraftHtml).toContain("Run mocks");
    expect(liveDraftHtml).not.toContain("mockDraftItem('AI max bids'");
    expect(liveDraftHtml).toContain("strategyKey: currentStrategyKey");
    expect(liveDraftHtml).toContain("const renderPositionMarket = state =>");
    expect(liveDraftHtml).toContain("const renderOwnerNeeds = state =>");
    expect(liveDraftHtml).toContain("const renderShortlist = state =>");
    expect(liveDraftHtml).toContain("const renderPositionContext = state =>");
    expect(liveDraftHtml).toContain("const renderReadiness = state =>");
    expect(liveDraftHtml).toContain("data-sort-key=\"valueGap\"");
  });

  it("uses a dark dashboard shell with command rail and panel grouping", () => {
    expect(liveDraftHtml).toContain("color-scheme: dark;");
    expect(liveDraftHtml).toContain("--bg: #050b12;");
    expect(liveDraftHtml).toContain("grid-template-columns: 300px minmax(0, 1fr);");
    expect(liveDraftHtml).toContain(".sidebar {");
    expect(liveDraftHtml).toContain(".workspace {");
    expect(liveDraftHtml).toContain(".sidebar-section {");
    expect(liveDraftHtml).toContain(".window-controls {");
    expect(liveDraftHtml).toContain(".board-panel {");
    expect(liveDraftHtml).toContain(".decision-panel {");
    expect(liveDraftHtml).toContain(".board-table {");
    expect(liveDraftHtml).toContain("min-width: 920px;");
    expect(liveDraftHtml).toContain("overflow-wrap: normal;");
  });

  it("renders raw sale history and import/export draft-log actions", () => {
    expect(liveDraftHtml).toContain("className = 'raw-command'");
    expect(liveDraftHtml).toContain("event.input");
    expect(liveDraftHtml).toContain("exportLog('json')");
    expect(liveDraftHtml).toContain("exportLog('csv')");
    expect(liveDraftHtml).toContain("importDraftLogFile");
    expect(liveDraftHtml).toContain("postJson('/api/import'");
  });

  it("returns keyboard focus to the quick-sale command entry after sales", () => {
    expect(liveDraftHtml).toContain("const focusCommandInput = () =>");
    expect(liveDraftHtml).toContain("byId('quick-sale-command').focus()");
    expect(liveDraftHtml).toContain("focusCommandInput();");
  });

  it("uses a custom select arrow with enough right-side spacing", () => {
    expect(liveDraftHtml).toContain("select {");
    expect(liveDraftHtml).toContain("appearance: none;");
    expect(liveDraftHtml).toContain("padding-right: 34px;");
    expect(liveDraftHtml).toContain("background-position: right 12px center;");
  });

  it("keeps room-wide budget totals out of the visible header metrics", () => {
    expect(liveDraftHtml).toContain("['Inflation', state.room.liveInflationFactor.toFixed(2) + 'x']");
    expect(liveDraftHtml).toContain("['Open Slots', String(state.room.remainingRosterSlots)]");
    expect(liveDraftHtml).toContain("['Paid vs Exp', deltaMoney(state.room.saleVsExpected)]");
    expect(liveDraftHtml).toContain("['Cam Left', money(state.watchOwner.budgetRemaining)]");
    expect(liveDraftHtml).toContain("['Cam Max', money(state.watchOwner.maxBid)]");
    expect(liveDraftHtml).toContain("grid-template-columns: repeat(5, minmax(120px, 1fr));");
    expect(liveDraftHtml).not.toContain("Room Left");
  });

  it("switches the board from the dense table to player cards on compact screens", () => {
    expect(liveDraftHtml).toContain("@media (max-width: 760px)");
    expect(liveDraftHtml).toContain(".scroll {\n        display: none;\n      }");
    expect(liveDraftHtml).toContain(".board-cards {\n        display: block;\n      }");
    expect(liveDraftHtml).toContain("className = 'target-card'");
    expect(liveDraftHtml).toContain("className = 'target-card-values'");
  });
});
