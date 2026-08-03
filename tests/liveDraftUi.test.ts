import { describe, expect, it } from "vitest";
import { liveDraftHtml } from "../src/liveDraftUi.js";

describe("live draft UI shell", () => {
  it("renders the draft-room controls needed for search, add, and roster review", () => {
    expect(liveDraftHtml).toContain("id=\"board-search\"");
    expect(liveDraftHtml).toContain("id=\"board\"");
    expect(liveDraftHtml).toContain("id=\"board-cards\"");
    expect(liveDraftHtml).toContain("id=\"add-owner\"");
    expect(liveDraftHtml).toContain("id=\"add-price\"");
    expect(liveDraftHtml).toContain("id=\"roster-owner\"");
    expect(liveDraftHtml).toContain("id=\"roster-slots\"");
    expect(liveDraftHtml).toContain("Our</th>");
    expect(liveDraftHtml).toContain("Bye</th>");
  });

  it("switches the board from the dense table to player cards on compact screens", () => {
    expect(liveDraftHtml).toContain("@media (max-width: 760px)");
    expect(liveDraftHtml).toContain(".scroll {\n        display: none;\n      }");
    expect(liveDraftHtml).toContain(".board-cards {\n        display: block;\n      }");
    expect(liveDraftHtml).toContain("className = 'target-card'");
    expect(liveDraftHtml).toContain("className = 'target-card-values'");
  });
});
