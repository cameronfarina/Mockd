import { describe, expect, it } from "vitest";
import { leagueSyncProviderStatuses, leagueSyncReadOnlyPolicy } from "../src/modeling/leagueSync.js";

describe("league sync provider contract", () => {
  it("reports provider auth requirements while preserving read-only advice boundaries", () => {
    const providers = leagueSyncProviderStatuses({
      MOCKD_YAHOO_CLIENT_ID: "",
      MOCKD_YAHOO_CLIENT_SECRET: "",
      MOCKD_ESPN_LEAGUE_ID: "",
      MOCKD_ESPN_SWID: "",
      MOCKD_ESPN_S2: "",
    });

    expect(leagueSyncReadOnlyPolicy).toEqual({
      mode: "read-only",
      allowedActions: ["recommend", "sync"],
      blockedActions: ["add", "drop", "trade", "set-lineup", "submit-waiver-claim"],
    });
    expect(providers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "sleeper",
        status: "available",
        auth: expect.objectContaining({ type: "none", configured: true }),
        readOnly: true,
      }),
      expect.objectContaining({
        key: "yahoo",
        status: "setup-required",
        auth: expect.objectContaining({ type: "oauth2", configured: false }),
        setupSteps: expect.arrayContaining([expect.stringMatching(/Yahoo Developer/i)]),
        readOnly: true,
      }),
      expect.objectContaining({
        key: "espn",
        status: "setup-required",
        auth: expect.objectContaining({ type: "manual-cookie", configured: false }),
        setupSteps: expect.arrayContaining([expect.stringMatching(/local/i)]),
        readOnly: true,
      }),
    ]));
  });
});
