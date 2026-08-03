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

  it("canonicalizes lower-case player targets against available player names", () => {
    const script = parseMockDraftScript("target jadarian price max 20");
    if (!script) throw new Error("Expected mock draft script.");

    expect(canonicalizeMockDraftScript(script, ["Jadarian Price"]).targetMaxBids).toEqual([
      { owner: "Cam", player: "Jadarian Price", maxBid: 20 },
    ]);
  });

  it("rejects non-target scripts before a mock job starts", () => {
    expect(() => parseMockDraftScript("draft good players cheaply"))
      .toThrow("Mock script must include a target");
  });
});
