# Production Readiness Roadmap

Mockd is currently optimized for Cam's draft-night workflow: one local league, one local machine, deterministic files, and fast iteration. That is the right shape until the model is trusted in a real room. A hosted multi-league product should add infrastructure only when the league-specific engine has proven useful.

## Current Local Architecture

- Deterministic engine inputs: projections, keepers, historical boards, player context evidence, and raw sale commands.
- File-backed live sessions: `live-draft-log.jsonl`, `live-draft-current.json`, and `live-draft-backup.json`.
- Every live mutation writes through the session store before the server accepts it.
- Strategy selection changes Cam's personal value layer, not the underlying league market price.
- Interactive mock actions use the same command log path as real live sales, so practice should run in a separate `--session-dir`.

This does not need a database for the first real draft night. A database becomes useful when multiple users, multiple leagues, auth, hosted persistence, uploads, collaboration, and historical calibration jobs need to exist at the same time.

## Before A Real Draft

1. Keep one real session directory for draft night and one or more separate practice directories.
2. Export the command log before the draft starts and after any long break.
3. Run `npm run draft:ready -- --owner=Cam --strategy=three-rb --scenario=expected --runs=50 --qa-runs=2 --strategy-mode=force`.
4. Run `npm run smoke -- --scenario=expected --runs=2 --seed=smoke` and inspect the first two rounds for obviously unrealistic prices.
5. Keep the ESPN projection input and checked-in player evidence unchanged during the draft unless a correction is intentional.

## Completed Local Slices

1. Named session controls in the UI for `live`, `practice-3rb`, `practice-wr-heavy`, and custom scratch rooms.
2. Draft-night lock mode that blocks mock advance actions in the real live session.
3. One-click session export bundle containing current snapshot, backup, JSON commands, CSV commands, and readiness status.
4. Compact command conflict review for invalid imports and ambiguous player names.
5. Direct "nominate for Cam" support in the interactive mock when the snake turn reaches Cam.
6. Mock speed controls: next AI sale, next Cam decision, next round, and complete mock.
7. Strategy comparison rows so one player can show Balanced / 3RB / Hero RB / WR Heavy personal values side by side.
8. Post-draft audit that compares actual sale prices to expected, live, personal, and mock ranges.

## Hosted Product Slices

1. Accounts and auth.
2. League setup: teams, budgets, roster rules, scoring, keepers, nomination style, and source provider.
3. Upload pipeline for historical draft boards with mapping, validation, and owner/player normalization review.
4. Provider adapters for projections, auction values, bye weeks, injuries, depth charts, schedules, and factual context.
5. Durable database tables for leagues, seasons, owners, players, projections, keepers, commands, sessions, evidence, and model runs.
6. Background calibration jobs that rebuild league economics after uploads or projection updates.
7. Versioned model outputs so draft-room state can always explain which inputs produced each number.
8. Collaborative live rooms with optimistic updates, undo permissions, and audit history.
9. Practice mock sessions that are isolated from live draft sessions by default.
10. Export/import APIs for backup, support, and user trust.

The key architectural rule stays the same in both local and hosted modes: the engine should rebuild from explicit inputs and command history. Hidden mutable model state is how a draft tool becomes impossible to trust.
