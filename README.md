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
- optional custom player-context weights for role, injury, contract, coaching, schedule, and bye-week adjustments
- confirmed-only, expected, and high-retention keeper inflation scenarios
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
npm run scenarios
npm run scenarios:custom
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

The profile output includes each owner's weighted open-auction spend by QB/RB/WR/TE, normal K/DST spending, top-two concentration, $1 player tendency, average keeper cost, and derived profile label. Known execution-error bids, such as Tye's 2025 $29 kicker budget dump, are excluded from normal K/DST calibration while remaining part of the raw historical board.

## Projection, Pricing, And Inflation

Run:

```bash
npm run rankings
npm run prices
npm run scenarios
```

`rankings` labels the model rank as the positional order by ESPN Weeks 1-4 `appliedTotal`. Rank gap is `projectionRank - espnRank`, so negative gaps mean the Weeks 1-4 projection order is higher than ESPN's visible PPR draft rank.

`prices` builds pre-keeper prices from uploaded/imported inputs: public auction value anchors, league-calibrated position multipliers, capped rank-gap adjustments, role-sustainability overrides, historical spend reconciliation, and hard position ceilings. The current defaults reproduce this league's audited drafted-pool counts and spend targets, but the engine accepts new historical records and config for future leagues.

`prices:custom` turns on editable player-context weights from `config/playerContext.ts`. Those weights can move prices for manually configured role, injury, contract, coaching, schedule, and bye-week signals while still reconciling the final pool back to historical positional spend. The default `prices` command leaves that layer off, preserving the audited baseline.

`scenarios` removes known keepers from the priced auction pool and applies confirmed-only, expected, and high-retention inflation factors. Scenario counts and average keeper costs are config-driven so unannounced keepers are not assigned to owners.

`scenarios:custom` applies the same keeper scenario logic after custom player-context weights are turned on.

When redirecting command output into JSON artifacts, use npm's silent mode:

```bash
npm run --silent prices > data/processed/player-prices.json
npm run --silent prices:custom > data/processed/player-prices-custom.json
npm run --silent scenarios > data/processed/keeper-scenarios.json
```

The context layer is intentionally manual for now. Add only player facts you want the model to believe; unsupported contract, coaching, schedule, or bye assumptions should stay empty until you enter or import them from a trusted source.

## Next implementation work

1. Port the 50-mock generator from the current workbook process.
2. Add deterministic random seeds and snapshot tests.
3. Add import paths for richer player-context data sources.
4. Generate Excel/CSV outputs directly from the codebase.

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
