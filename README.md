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
- deterministic owner-local auction simulation with scarcity pressure
- repeatable smoke checks for roster validity, batch validity, and the first two nomination rounds
- calibration gates that mark mock batches as pass, warn, or fail against explicit economic thresholds
- replacement-depth pricing and budget pacing so owners do not strand themselves into unrealistic $1-only endgames
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
npm run mock
npm run mocks
npm run smoke
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

The profile output includes each owner's weighted open-auction spend by QB/RB/WR/TE, normal K/DST spending, top-two concentration, $1 player tendency, average keeper cost, and derived profile label. Known execution-error bids, such as Tye's 2025 $29 kicker budget dump, are excluded from normal K/DST calibration while remaining part of the raw historical board.

The same profile data now derives auction behavior knobs used by mocks: position demand multipliers, price aggression, scarcity chasing, and replacement-level patience. High top-two concentration nudges an owner toward aggressive contested buys; high $1-player tendency nudges that owner toward more back-end patience.

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

## Auction Simulation

Run:

```bash
npm run mock
npm run mock -- --scenario=expected --seed=economic-regression
npm run mocks -- --scenarios=expected --runs=50 --seed-prefix=prep
npm run smoke -- --scenario=expected --runs=2 --seed=smoke
npm run calibration -- --scenarios=expected --runs=50 --seed-prefix=prep
npm run outputs -- --scenarios=expected --runs=50 --seed-prefix=prep --out=data/processed/mock-prep
```

`mock` runs a deterministic auction from the selected keeper scenario. Declared keepers are locked into their owners' rosters at keeper cost, the auction pool uses scenario-adjusted market prices, and additional $1 replacement players are added from the projection file when the known priced pool is smaller than the remaining roster slots.

Nominations are synthetic and deterministic because the historical boards do not include reliable nomination order. Owners rotate through nominations, the first phase strongly prefers elite market players, and later nominations adapt to the current nominator's roster needs, max bid, positional scarcity, and chance to make other owners spend. Each pick records both the nominator and the winning owner.

The auction engine does not globally discount the pool after a few expensive buys. Each owner carries their own remaining budget, remaining roster slots, and max bid, with $1 reserved for every unfilled slot. Budget pacing discounts bids that would strand too little money for future roster slots, while cash-heavy endgame pressure pushes owners to spend leftover money late. If two owners spend $80 early, those owners are capped; other owners with full budgets can still bid good players above anchor when comparable talent is scarce.

Replacement players are no longer a flat $1 shelf. The engine applies a descending replacement-price ladder to QB/RB/WR/TE depth names from the projection file and keeps K/DST replacements at the fallback price, which reduces unrealistic $1-only endgames without making special teams too expensive.

`mocks` runs many deterministic seeds and summarizes the draft-prep signal: player sale ranges, player draft rates, owner spend ranges, owner score ranges, invalid-roster counts, and owner-player exposure. Use comma-separated scenarios, such as `--scenarios=confirmedOnly,expected,highRetention`, when comparing keeper assumptions.

`smoke` runs a small deterministic mock batch and prints the fastest audit surface for engine changes: invalid-roster counts, first-two-round nominations and prices, average early-round sale-versus-anchor, and warnings such as owners leaving too much budget unused.

`calibration` runs the same batch and compares it against the 2023-2025 historical auction boards by price tier, position spend, owner spend, top-two auction spend, and $1 player volume. The audit includes pass/warn/fail gates for roster validity, auction spend, tier counts, position spend, owner spend, and leftover budget so tuning work has an explicit credibility signal.

`outputs` writes the usable prep files:

```text
mock-batch-summary.json
historical-calibration-audit.json
calibration-summary.csv
calibration-gates.csv
player-sale-ranges.csv
owner-summaries.csv
owner-player-exposure.csv
mock-draft-board.csv
price-tier-calibration.csv
position-spend-calibration.csv
```

`mock-draft-board.csv` is the full pick-by-pick board across every run, including seed, scenario, nominator, winning owner, player, position, anchor price, sale price, post-pick budget, and the top three bids.

When redirecting command output into JSON artifacts, use npm's silent mode:

```bash
npm run --silent prices > data/processed/player-prices.json
npm run --silent prices:custom > data/processed/player-prices-custom.json
npm run --silent scenarios > data/processed/keeper-scenarios.json
npm run --silent mock > data/processed/mock-auction.json
npm run --silent mocks -- --scenarios=expected --runs=50 > data/processed/mock-batch-summary.json
npm run --silent smoke -- --scenario=expected --runs=2 > data/processed/mock-smoke.json
npm run --silent calibration -- --scenarios=expected --runs=50 > data/processed/historical-calibration-audit.json
npm run --silent outputs -- --scenarios=expected --runs=50 --out=data/processed/mock-prep
```

The context layer is intentionally manual for now. Add only player facts you want the model to believe; unsupported contract, coaching, schedule, or bye assumptions should stay empty until you enter or import them from a trusted source.

## Next implementation work

1. Add import paths for richer player-context data sources.
2. Add a web-app upload flow once the league-specific engine is trusted.

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
