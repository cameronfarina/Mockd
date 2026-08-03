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
    expect(liveDraftHtml).toContain("id=\"hide-deep-filter\"");
    expect(liveDraftHtml).toContain("id=\"team-filter\"");
    expect(liveDraftHtml).toContain("id=\"bye-filter\"");
    expect(liveDraftHtml).toContain("id=\"sort-select\"");
    expect(liveDraftHtml).toContain("id=\"add-owner\"");
    expect(liveDraftHtml).toContain("id=\"add-price\"");
    expect(liveDraftHtml).toContain("id=\"add-submit\"");
    expect(liveDraftHtml).toContain("id=\"sale-warning\"");
    expect(liveDraftHtml).toContain("id=\"roster-owner\"");
    expect(liveDraftHtml).toContain("id=\"roster-slots\"");
    expect(liveDraftHtml).toContain("id=\"owner-needs\"");
    expect(liveDraftHtml).toContain("id=\"position-market\"");
    expect(liveDraftHtml).toContain("data-sort-key=\"personalValue\">Our");
    expect(liveDraftHtml).toContain("data-sort-key=\"valueGap\">Gap");
    expect(liveDraftHtml).toContain("data-sort-key=\"byeWeek\">Bye");
  });

  it("includes board behavior for position filters, sortable values, and draft-day guardrails", () => {
    expect(liveDraftHtml).toContain("const boardPositions = ['ALL', 'RB', 'WR', 'TE', 'QB', 'FLEX', 'K', 'DST']");
    expect(liveDraftHtml).toContain("const valueGapFor = target => target.personalValue - target.liveExpectedPrice");
    expect(liveDraftHtml).toContain("const tierDropsFor = targets =>");
    expect(liveDraftHtml).toContain("const saleWarningsFor = (target, owner, price) =>");
    expect(liveDraftHtml).toContain("const renderPositionMarket = state =>");
    expect(liveDraftHtml).toContain("const renderOwnerNeeds = state =>");
    expect(liveDraftHtml).toContain("data-sort-key=\"valueGap\"");
  });

  it("uses a custom select arrow with enough right-side spacing", () => {
    expect(liveDraftHtml).toContain("select {");
    expect(liveDraftHtml).toContain("appearance: none;");
    expect(liveDraftHtml).toContain("padding-right: 34px;");
    expect(liveDraftHtml).toContain("background-position: right 12px center;");
  });

  it("switches the board from the dense table to player cards on compact screens", () => {
    expect(liveDraftHtml).toContain("@media (max-width: 760px)");
    expect(liveDraftHtml).toContain(".scroll {\n        display: none;\n      }");
    expect(liveDraftHtml).toContain(".board-cards {\n        display: block;\n      }");
    expect(liveDraftHtml).toContain("className = 'target-card'");
    expect(liveDraftHtml).toContain("className = 'target-card-values'");
  });
});
