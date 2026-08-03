# My Expert Issue Slices

Important: This plan is a reference, not a contract. The codebase is always the source of truth. If merged code contradicts this plan, follow the code.

## Source Snapshot

- Base worktree: `/Users/cameronfarina/personal-projects/Mockd-player-news-feed`
- Branch: `codex/player-news-feed`
- Starting context: Player News SPA branch with existing draft-room state, mock-results page shell, and file-backed draft sessions.
- Phase waiver: full tech spec deferred. The first implementation is a narrow execution slice for read-only advice from Mockd roster state.

## [1] My Expert from Mockd roster

- Type: Feature
- Slice category: User-facing behavior
- Owner/team: Mockd
- Affected teams: none
- Belongs to Epic: yes
- Depends on: existing draft-room state
- Suggested PR boundary: one vertical PR with model, `/api/my-expert`, `/my-expert`, menu entry, tests, and local verification.

### Scope

Add a read-only My Expert page that analyzes Cam's active Mockd roster and current available board targets.

### Behavior

The page shows advice cards for weekly lineup/flex decisions, add/drop, bye coverage, injury watch, and trade-target ideas. It never writes a draft command, never submits platform moves, and never sets a lineup for the user.

### Acceptance Criteria

- `/my-expert` loads from the global menu.
- `/api/my-expert` returns `mode: "advice-only"` and `readOnly: true`.
- Weekly lineup cards include legal starters, a FLEX choice, ranked FLEX alternatives, evidence, and risk.
- Advice cards include manual suggestions only.
- Mockd draft, ESPN, Sleeper, and Yahoo provider statuses are shown as read-only integrations.
- Focused model, server, UI tests and `npm run build` pass.

### Suggested Boundaries

Use `src/modeling/myExpert.ts`, `src/liveDraftServer.ts`, `src/liveDraftUi.ts`, `tests/myExpert.test.ts`, `tests/liveDraftServer.test.ts`, and `tests/liveDraftUi.test.ts`.

### Notes For Agents

If current code on main contradicts this slice, follow the code.

## [2] Normalized league sync contract

- Type: Task
- Slice category: Foundation
- Owner/team: Mockd
- Affected teams: none
- Belongs to Epic: yes
- Depends on: slice 1
- Suggested PR boundary: types/adapters/tests only, no provider credentials.

### Scope

Define provider-neutral league sync readiness and snapshots for ESPN, Sleeper, and Yahoo.

### Behavior

Normalize teams, rosters, settings, lineup slots, transactions, availability, matchups, and player identity into a shape that feeds `buildMyExpertAdvice`.

### Acceptance Criteria

- Contract includes an explicit `permissionMode: "read-only"`.
- No provider adapter exposes write methods such as add, drop, claim, trade, set lineup, or submit.
- Provider capability statuses can be rendered by the My Expert page.
- `/api/sync/providers` returns provider auth type, configured state, setup steps, and read-only blocked actions.
- Yahoo OAuth starts only when `MOCKD_YAHOO_CLIENT_ID` and `MOCKD_YAHOO_CLIENT_SECRET` are configured; the callback does not persist tokens until encrypted storage is added.

### Suggested Boundaries

Create a `src/modeling/leagueSync.ts` style module and corresponding tests. Keep actual provider calls out of this slice unless they are fixture-backed.

### Notes For Agents

Sleeper is the safest first live provider because its public API is read-only and tokenless. Yahoo requires OAuth2 and read-only fantasy scope. ESPN is mandatory for product value, but hosted sync needs a provider-approved path; local private-league experiments should stay behind environment-gated read-only credentials.

## [3] Sleeper read-only sync

- Type: Feature
- Slice category: Foundation
- Owner/team: Mockd
- Affected teams: none
- Belongs to Epic: yes
- Depends on: slice 2
- Suggested PR boundary: one provider adapter with fixture tests and an optional local sync endpoint.

### Scope

Implement Sleeper as the first live sync provider.

### Behavior

Given a Sleeper user/league/team selection, fetch league settings, rosters, matchups, transactions, player metadata, and trends using GET-only requests.

### Acceptance Criteria

- Adapter only calls documented read endpoints.
- Free agents are derived from player map minus rostered players.
- Synced snapshot feeds My Expert without changing advice model inputs.

### Suggested Boundaries

Provider adapter, fixtures, tests, and a read-only UI connection panel.

### Notes For Agents

Cache the Sleeper player map; do not poll the full player universe aggressively.

## [4] ESPN local-only private league spike

- Type: Task
- Slice category: Correctness/reliability
- Owner/team: Mockd
- Affected teams: none
- Belongs to Epic: yes
- Depends on: slice 2
- Suggested PR boundary: local-only adapter spike with no hosted credential storage.

### Scope

Explore ESPN v3 read endpoints for the user's league using `SWID` and `ESPN_S2` from environment variables.

### Behavior

Fetch settings, teams, rosters, matchups, and player pool with GET-only requests.

### Acceptance Criteria

- Adapter refuses non-GET requests.
- Credentials are never logged or committed.
- Failure messages explain missing cookies without exposing values.
- Spike output can be converted into the normalized league snapshot.

### Suggested Boundaries

Experimental adapter, fixtures captured from sanitized responses, and tests around request construction.

### Notes For Agents

Treat ESPN as required for product fit but unsafe for hosted credential storage until reviewed.
