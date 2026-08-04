import { describe, expect, it } from "vitest";
import {
  canonicalizeMockDraftScript,
  parseMockDraftScript,
} from "../src/modeling/mockScript.js";

describe("mock draft scripts", () => {
  it("parses a natural target-cap script with an embedded run count", () => {
    expect(parseMockDraftScript(
      "run 10 mocks where i target Jadarian Price, where im not willing to pay over $20",
    )).toMatchObject({
      raw: "run 10 mocks where i target Jadarian Price, where im not willing to pay over $20",
      runsPerScenario: 10,
      label: "Target Jadarian Price up to $20",
      targetMaxBids: [
        { owner: "Cam", player: "Jadarian Price", maxBid: 20 },
      ],
    });
  });

  it("parses compact player cap syntax", () => {
    expect(parseMockDraftScript("target Puka Nacua:75")).toMatchObject({
      label: "Target Puka Nacua up to $75",
      targetMaxBids: [
        { owner: "Cam", player: "Puka Nacua", maxBid: 75 },
      ],
    });
  });

  it("parses build-around price sweeps", () => {
    expect(parseMockDraftScript(
      "run 10 mocks where i build around Omarion Hampton at $46-$50 by $2; target Zay Flowers max $31",
    )).toMatchObject({
      raw: "run 10 mocks where i build around Omarion Hampton at $46-$50 by $2; target Zay Flowers max $31",
      runsPerScenario: 10,
      label: "Build around Omarion Hampton at $46/$48/$50 / Target Zay Flowers up to $31",
      buildAround: {
        owner: "Cam",
        player: "Omarion Hampton",
        prices: [46, 48, 50],
      },
      targetMaxBids: [
        { owner: "Cam", player: "Zay Flowers", maxBid: 31 },
      ],
    });
  });

  it("canonicalizes lower-case player targets against available player names", () => {
    const script = parseMockDraftScript("target jadarian price max 20");
    if (!script) throw new Error("Expected mock draft script.");

    expect(canonicalizeMockDraftScript(script, ["Jadarian Price"]).targetMaxBids).toEqual([
      { owner: "Cam", player: "Jadarian Price", maxBid: 20 },
    ]);
  });

  it("does not include the connective word before up-to caps in player names", () => {
    const script = parseMockDraftScript("target jadarian price for up to $20");
    if (!script) throw new Error("Expected mock draft script.");

    expect(canonicalizeMockDraftScript(script, ["Jadarian Price"])).toMatchObject({
      label: "Target Jadarian Price up to $20",
      targetMaxBids: [
        { owner: "Cam", player: "Jadarian Price", maxBid: 20 },
      ],
    });
  });

  it("rejects non-experiment scripts before a mock job starts", () => {
    expect(() => parseMockDraftScript("draft good players cheaply"))
      .toThrow("Mock script must include a target or build-around");
  });
});
