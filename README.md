# Mockd

Private fantasy-football auction model for ESPN league **214674**.

## Current state

This repository captures the reusable foundation behind the analysis previously performed in chat:

- 14 teams, $200 auction budget, 16-player rosters
- half-PPR scoring and league roster constraints
- 2026 ESPN Weeks 1–4 projections
- keeper-cost logic (`ceil(previous price × 1.20)`)
- current keeper declarations and assumptions
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

## Next implementation work

1. Port normalized historical owner-profile calculations from the workbook into TypeScript.
2. Port audited base pricing and keeper-scenario repricing.
3. Port the 50-mock generator from the current workbook process.
4. Add deterministic random seeds and snapshot tests.
5. Generate Excel/CSV outputs directly from the codebase.

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
