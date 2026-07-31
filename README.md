# Mockd

Private fantasy-football auction model for ESPN league **214674**.

## Current state

This repository captures the reusable foundation behind the analysis previously performed in chat:

- 14 teams, $200 auction budget, 16-player rosters
- half-PPR scoring and league roster constraints
- 2026 ESPN Weeks 1–4 projections
- keeper-cost logic (`ceil(previous price × 1.20)`)
- current keeper declarations and assumptions
- projection rank anchors, ESPN ranks, auction values, and rank gaps
- audited pre-keeper prices reconciled to historical open-auction spend
- optional custom player-context weights for role, injury, contract, coaching, schedule, bye-week, opportunity, defensive-attention, skill-fit, environment, and risk adjustments
- confirmed-only, expected, and high-retention keeper inflation scenarios
- deterministic owner-local auction simulation with scarcity pressure
- repeatable smoke checks for roster validity, batch validity, and the first two nomination rounds
- structured player price waterfalls from effective public anchor through mock-sale outcome
- prioritized outlier review queues for top-player values that need human attention
- prioritized factual evidence queues for top-player pricing review
- evidence coverage gates that fail loudly when high-priority players have no supporting facts
- calibration gates that mark mock batches as pass, warn, or fail against explicit economic thresholds
- leave-one-season-out historical backtests that separate stable league economics from noisy historical swings
- replacement-depth pricing and budget pacing so owners do not strand themselves into unrealistic $1-only endgames
- high-price volume gates for `$70+`, `$75+`, and `$80+` player counts against historical single-draft ceilings
- roster-shape calibration for QB/RB/WR/TE/K/DST counts so mocks do not hoard backup QBs or special teams
- legal lineup optimization performed **after** the full roster is built
- validation guards for duplicate players, budget, roster size, and position limits
- the current validated Excel model as an output artifact

## Important source-of-truth rules

1. The manually pasted 2023–2025 boards from league 214674 are authoritative for historical bids, owners, and keeper designations.
2. The old JSON exports for league 278452 must not be used as historical draft data for this project.
3. Excel files in `output/` are generated artifacts, not the long-term source of truth.
4. Keeper declarations in `config/keepers.ts` should be updated as they arrive.

## Setup

```bash
npm install
npm test
npm run validate
npm run profiles
npm run rankings
npm run prices
npm run prices:custom
npm run prices -- --player-context=data/raw/player-context.example.csv
npm run prices -- --player-evidence=data/raw/player-evidence.example.csv
npm run audit -- --player="Drake London"
npm run sanity -- --scenario=expected --limit=40 --runs=10
npm run outliers:queue -- --scenario=expected --limit=40 --runs=10
npm run evidence:queue -- --scenario=expected --limit=40 --runs=10
npm run evidence:template -- --scenario=expected --limit=40 --runs=10
npm run evidence:adapt -- --input=data/raw/player-evidence-template.csv
npm run evidence:coverage -- --scenario=expected --limit=40 --runs=10
npm run scenarios
npm run scenarios:custom
npm run mock
npm run mocks
npm run smoke
npm run qa
npm run backtest
npm run calibration
npm run outputs
npm run keepers
```

## Historical Data

The manually exported draft boards are committed as source inputs:

```text
data/raw/2023-board.csv
data/raw/2024-board.csv
data/raw/2025-board.csv
```

The TypeScript parser converts each wide draft-board CSV into normalized records with this schema:

```text
season,owner,rosterRow,originalPlayerName,normalizedPlayerName,position,price,isKeeper,acquisitionType,source
```

Keeper rows come from roster row `1` for each owner. `DEF` is normalized to `DST`. Seth's missing 2023 sixteenth slot is represented as a $1 Seattle Seahawks post-draft waiver DST placeholder.

## Owner Profiles

Owner profiles are generated from the normalized historical boards with recency weights:

```text
2023 = 20%
2024 = 30%
2025 = 50%
```

Run:

```bash
npm run profiles
```

The profile output includes each owner's weighted open-auction spend by QB/RB/WR/TE, roster-count tendencies by position, normal K/DST spending, top-two concentration, $1 player tendency, average keeper cost, and derived profile label. Known execution-error bids, such as Tye's 2025 $29 kicker budget dump, are excluded from normal K/DST calibration while remaining part of the raw historical board.

The same profile data now derives auction behavior knobs used by mocks: position demand multipliers, price aggression, scarcity chasing, anchor-buy aggression, depth-buy discipline, and replacement-level patience. High top-two concentration nudges an owner toward stronger anchor bids without blindly inflating depth bids; high $1-player tendency still nudges that owner toward more back-end patience.

## Projection, Pricing, And Inflation

Run:

```bash
npm run rankings
npm run prices
npm run scenarios
```

`rankings` labels the model rank as the positional order by ESPN Weeks 1-4 `appliedTotal`. Rank gap is `projectionRank - espnRank`, so negative gaps mean the Weeks 1-4 projection order is higher than ESPN's visible PPR draft rank.

`prices` builds pre-keeper prices from uploaded/imported inputs: public auction value anchors, league-calibrated position multipliers, capped rank-gap adjustments, role-sustainability overrides, historical spend reconciliation, and hard position ceilings. The current defaults reproduce this league's audited drafted-pool counts and spend targets, but the engine accepts new historical records and config for future leagues.

`prices:custom` turns on editable player-context weights from `config/playerContext.ts`. Those weights can move prices for manually configured role, injury, contract, coaching, schedule, bye-week, opportunity, defensive-attention, skill-fit, environment, and risk signals while still reconciling the final pool back to historical positional spend. The default `prices` command leaves that layer off, preserving the audited baseline.

Player-context imports can be layered on with `--player-context=path/to/file.csv` or `--player-context=path/to/file.json`. Passing an import path turns the context layer on, merges the imported rows with the manual overrides, and lets imported category values win for matching normalized player names. CSV imports use this shape:

```text
player,role,injury,contract,coaching,schedule,bye,role_note,injury_note,contract_note,coaching_note,schedule_note,bye_note
```

Each category value is a signed signal multiplied by the configured category weight; notes are optional. JSON imports can be either an array of `{ player, signals, notes }` overrides or an object with an `overrides` array.

Factual player-context evidence can be layered on with `--player-evidence=path/to/file.csv`. Evidence imports are meant for sourced inputs such as target-share deltas, depth-chart changes, coverage difficulty, separation fit, team environment, injury risk, and contract risk. The CSV shape is:

```text
player,category,score,confidence,source,note
```

`category` must be one of `opportunity`, `defensiveAttention`, `skillFit`, `environment`, or `risk`. `score` is the signed evidence signal, `confidence` is optional from `0` to `1`, and the model applies `score * confidence` before category and total caps. `source` and `note` are preserved in each player's pricing audit so factual inputs can be inspected instead of hidden as assumptions.

Positive evidence is intentionally capped tighter than negative evidence by default: one good news stack should not create a whole extra tier of $75-plus players, but real role, health, environment, or defensive-attention problems can still pull a player down. The base pricing allocator also enforces historical top-price volume limits before keeper inflation so the model can redistribute dollars into the mid-tier without inventing too many elite-price buys.

The initial sourced 2026 evidence set lives at `data/raw/player-evidence-2026-initial.csv` and can be used directly with `--player-evidence=data/raw/player-evidence-2026-initial.csv`.

`scenarios` removes known keepers from the priced auction pool and applies confirmed-only, expected, and high-retention inflation factors. Scenario counts and average keeper costs are config-driven so unannounced keepers are not assigned to owners.

`scenarios:custom` applies the same keeper scenario logic after custom player-context weights are turned on.

Use `audit` when a player number looks weird and you want the bridge in one place:

```bash
npm run audit -- --player="Drake London" --scenario=expected --runs=10
npm run audit -- --player="Drake London" --scenario=expected --player-evidence=data/raw/player-evidence.example.csv
npm run sanity -- --scenario=expected --limit=40 --runs=10
npm run outliers:queue -- --scenario=expected --limit=40 --runs=10
npm run outliers:queue -- --scenario=expected --limit=40 --runs=10 --format=csv
npm run evidence:queue -- --scenario=expected --limit=40 --runs=10
npm run evidence:queue -- --scenario=expected --limit=40 --runs=10 --format=csv
npm run evidence:template -- --scenario=expected --limit=40 --runs=10
npm run evidence:adapt -- --input=data/raw/player-evidence-template.csv
npm run evidence:coverage -- --scenario=expected --limit=40 --runs=10
```

The audit report includes the effective ESPN anchor, projection rank, ESPN rank, rank gap, league multipliers, context signals and evidence, pre-keeper base price, keeper-inflated scenario price, and the player's observed mock-sale range across the requested runs. Raw ESPN auction values below `$1` are shown separately and floored to a `$1` effective model anchor. The report also includes a structured waterfall that walks from effective ESPN anchor through position multiplier, rank gap, market pressure, projection floor, sustainability, factual context, spend reconciliation, keeper inflation or keeper removal, and mock-sale average when the player is drafted. If the scenario removes the player as a keeper, the report explains why instead of pretending they are still in the auction pool.

The sanity report scans the top auction-available players for review prompts: high mock-sale premiums, large projection lifts versus ESPN rank, expensive players with no factual evidence rows, context penalties, hard-ceiling pressure, and high-price volume against the 2023-2025 historical max counts. Treat those flags as the next evidence queue, not automatic price changes.

`outliers:queue` converts top-player sanity signals into a prioritized review queue for pricing judgment. It flags high mock premiums, mock discounts, wide mock-sale ranges, thin mock demand, large projection rank lifts, public-anchor-to-scenario jumps, hard-ceiling pressure, context penalties, and players contributing to reviewed elite-price volume thresholds. Each row includes the relevant prices, mock range, drafted rate, primary reason, all outlier reasons, thresholds, and a ready-to-run `audit` command for that player.

`evidence:queue` converts those sanity flags into prioritized factual research rows. Each row lists the player, price context, existing evidence count, flags, evidence status, and the exact categories to research: opportunity, defensive attention, skill fit, environment, and risk. Use `--format=csv` when you want a fillable research queue.

`evidence:template` writes a fillable `player,category,score,confidence,source,note` evidence CSV with extra context columns from the queue. Leave rows blank until researched; once `score`, `source`, and `note` are filled, the same file can be passed back through `--player-evidence`.

`evidence:adapt` normalizes a completed local evidence CSV or JSON export back to canonical `player,category,score,confidence,source,note` rows. The first adapter, `scored-local`, is intentionally deterministic: it does not fetch or infer facts, it only validates and strips context columns from completed local research exports. Untouched template rows are skipped, while half-completed rows fail until `score`, `source`, and `note` are filled together.

`evidence:coverage` turns that queue into pass/warn/fail gates for high-priority missing evidence, overall evidence coverage, and complete evidence coverage. A failing coverage audit means the pricing model is still allowed to run, but the affected top-player values should be treated as unaudited until sourced evidence rows are added.

## Auction Simulation

Run:

```bash
npm run mock
npm run mock -- --scenario=expected --seed=economic-regression
npm run mock -- --scenario=expected --player-context=data/raw/player-context.example.csv
npm run mock -- --scenario=expected --player-evidence=data/raw/player-evidence.example.csv
npm run mocks -- --scenarios=expected --runs=50 --seed-prefix=prep
npm run smoke -- --scenario=expected --runs=2 --seed=smoke
npm run qa -- --scenarios=expected --runs=2 --seed-prefix=qa
npm run backtest
npm run calibration -- --scenarios=expected --runs=50 --seed-prefix=prep
npm run outputs -- --scenarios=expected --runs=50 --seed-prefix=prep --out=data/processed/mock-prep
```

`mock` runs a deterministic auction from the selected keeper scenario. Declared keepers are locked into their owners' rosters at keeper cost, the auction pool uses scenario-adjusted market prices, and additional $1 replacement players are added from the projection file when the known priced pool is smaller than the remaining roster slots.

Nominations are synthetic and deterministic because the historical boards do not include reliable nomination order. Owners rotate through nominations, the first phase strongly prefers elite market players, and later nominations adapt to the current nominator's roster needs, opponents' unfilled roster holes, max bid, positional scarcity, and chance to make other owners spend. Each pick records both the nominator and the winning owner.

The auction engine does not globally discount the pool after a few expensive buys. Each owner carries their own remaining budget, remaining roster slots, and max bid, with $1 reserved for every unfilled slot. Budget pacing discounts bids that would strand too little money for future roster slots, mid-auction room pressure lets cash-heavy owners chase good players before the endgame, and endgame pressure pushes owners to spend leftover money late. Late nominators with extra money can also open affordable depth players above anchor, which models real auction budget dumps without globally inflating the room. If two owners spend $80 early, those owners are capped; other owners with full budgets can still bid good players above anchor when comparable talent is scarce. Scarcity pressure now counts bidder depth by same-tier roster capacity and downweights legal backup bidders with low roster interest, so backup QB/TE bidders do not create full starter-tier pressure.

Roster maximums are tuned to this league's historical draft shape: mocks cap owners at two QBs, one kicker, and one defense so cheap late fillers do not crowd out RB/WR depth. Owner-specific history tightens that further for one-QB and one-TE owners, while owners who historically carried backups can still do it.

Replacement players are no longer a flat $1 shelf. The engine applies a descending replacement-price ladder to QB/RB/WR/TE depth names from the projection file and keeps K/DST replacements at the fallback price, which reduces unrealistic $1-only endgames without making special teams too expensive.

Historical live-auction ceilings from the 2023-2025 boards are now explicit calibration inputs: `$70+` players peaked at 5 in a draft, `$75+` players peaked at 3, and `$80+` players peaked at 1. The engine dampens only the over-anchor portion of elite bids, guards sub-$70 anchors from crossing the `$70` line, and keeps `$70-$71` anchors below `$75`, which keeps top prices from drifting into unrealistic four-or-five-player `$80+` rooms.

Starter-tier guards keep sub-$40 anchors from becoming extra `$40+` sales, which preserves the historical split between starter and strong tiers.

QB spend has its own controls because this league historically drafts only about 20-24 QBs and does not chase backup quarterbacks at starter prices. The engine dampens QB overbids and discounts backup-QB bids once an owner already has a starter.

TE spend uses the same shape with lighter defaults: elite TE overbids are dampened, and backup-TE bids are discounted once an owner already has a starter. This keeps the model from drafting too many second tight ends at meaningful prices.

WR spend uses a very light position overbid damper so owner preferences can still chase receivers, while the above-anchor portion of those bids stays closer to the historical league spend mix.

`mocks` runs many deterministic seeds and summarizes the draft-prep signal: player sale ranges, player draft rates, owner spend ranges, owner score ranges, invalid-roster counts, and owner-player exposure. Use comma-separated scenarios, such as `--scenarios=confirmedOnly,expected,highRetention`, when comparing keeper assumptions.

`smoke` runs a small deterministic mock batch and prints the fastest audit surface for engine changes: invalid-roster counts, first-two-round nominations and prices, average early-round sale-versus-anchor, compact winner/runner-up bid diagnostics, and warnings such as owners leaving too much budget unused.

`qa` is the blessed engine-quality command. It runs one mock batch, smoke report, calibration audit, historical backtest, and advisory evidence coverage pass, then prints a compact JSON report with hard and advisory checks. Hard smoke, calibration, and backtest failures set a nonzero exit code; evidence coverage remains advisory so incomplete research rows are visible without blocking engine verification. Pass `--out=data/processed/mock-prep` when you also want the prep artifacts written.

`backtest` performs a leave-one-season-out historical economics audit. For each 2023-2025 draft, it compares that season's actual open-auction spend, price tiers, high-price volume, roster shape, position spend, and owner spend against the average of the other historical seasons. This is intentionally a league-shape backtest, not a claim that the model can predict past players without historical projection files. Warnings mark naturally noisy areas to keep in mind while tuning; failures mean the historical signal should not be trusted as stable without more data.

`calibration` runs the same batch and compares it against the 2023-2025 historical auction boards by price tier, high-price volume, roster position counts, position spend, owner spend, top-two auction spend, and $1 player volume. The audit includes pass/warn/fail gates for roster validity, auction spend, tier counts, roster counts, position spend, owner spend, and leftover budget so tuning work has an explicit credibility signal. High-price volume gates now check both ceilings and floors, so mocks fail loudly when they create too many elite-price buys or get unrealistically timid at the top. Historical auction spend remains visible as context, but league, owner, and position spend gates target the selected keeper scenario's open auction dollars because keeper costs change the room's available spend year to year.

`outputs` writes the usable prep files:

```text
mock-batch-summary.json
historical-calibration-audit.json
mock-smoke.json
mock-smoke-first-two-rounds.csv
historical-backtest.json
historical-backtest-gates.csv
calibration-summary.csv
calibration-gates.csv
player-sale-ranges.csv
player-outlier-review-queue.csv
player-evidence-queue.csv
player-evidence-template.csv
player-evidence-coverage.json
player-evidence-coverage-gates.csv
owner-summaries.csv
owner-player-exposure.csv
mock-draft-board.csv
mock-bid-diagnostics.csv
price-tier-calibration.csv
high-price-volume-calibration.csv
position-count-calibration.csv
position-spend-calibration.csv
scenario-calibration.csv
```

`mock-draft-board.csv` is the full pick-by-pick board across every run, including seed, scenario, nominator, winning owner, player, position, anchor price, sale price, post-pick budget, and the top three bids.

`mock-bid-diagnostics.csv` is the explainability companion for the draft board. It writes one row per retained top bid with bid rank, owner, amount, max-bid cap status, reserve/second-bid/nominator-opening sale resolution, sale-price basis, and the top multiplier drivers such as roster need, scarcity, room pressure, budget pacing, or damping.

When redirecting command output into JSON artifacts, use npm's silent mode:

```bash
npm run --silent prices > data/processed/player-prices.json
npm run --silent prices:custom > data/processed/player-prices-custom.json
npm run --silent scenarios > data/processed/keeper-scenarios.json
npm run --silent mock > data/processed/mock-auction.json
npm run --silent mocks -- --scenarios=expected --runs=50 > data/processed/mock-batch-summary.json
npm run --silent smoke -- --scenario=expected --runs=2 > data/processed/mock-smoke.json
npm run --silent qa -- --scenarios=expected --runs=2 > data/processed/qa-report.json
npm run --silent backtest > data/processed/historical-backtest.json
npm run --silent calibration -- --scenarios=expected --runs=50 > data/processed/historical-calibration-audit.json
npm run --silent outputs -- --scenarios=expected --runs=50 --out=data/processed/mock-prep
npm run --silent evidence:queue -- --scenario=expected --limit=40 --format=csv > data/processed/player-evidence-queue.csv
npm run --silent evidence:template -- --scenario=expected --limit=40 > data/processed/player-evidence-template.csv
npm run --silent evidence:adapt -- --input=data/processed/player-evidence-template.csv > data/processed/player-evidence.adapted.csv
npm run --silent evidence:coverage -- --scenario=expected --limit=40 > data/processed/player-evidence-coverage.json
```

The context layer is deterministic and source-driven. Add only player facts you want the model to believe; unsupported contract, coaching, schedule, opportunity, defensive-attention, skill-fit, environment, or risk assumptions should stay empty until you enter or import them from a trusted source.

## Next implementation work

1. Fill and maintain sourced player evidence rows for the high-priority queue.
2. Add richer provider-specific evidence adapters once the local scored adapter is proven.
3. Add a web-app upload flow once the league-specific engine is trusted.

## Push to GitHub

From the directory containing this project:

```bash
git init
git remote add origin git@github.com:cameronfarina/Mockd.git
git add .
git commit -m "Initialize fantasy auction model"
git branch -M main
git push -u origin main
```
