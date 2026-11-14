# token-radar-01-bot

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Launch Radar: a token launch radar that reads the sealed DefiLlama snapshot, finds every protocol
that still records no token and is not a wrapped or staked product of one that trades, and ranks
them by an implied launch value from a comparables model the snapshot calibrates itself — the
median market-cap/TVL of each category's trading protocols, shrunk toward the market median,
adjusted for seven-day growth, tokenless maturity and chain breadth. It writes a ranked board and
a static dashboard with a detail sheet and a seven-step farm plan for every protocol.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

Node 22.18 or later, standard library only. The run writes `board.json`, `data.js`, `dashboard/`,
`screenshots/` and `dossier.json` to the output directory, deterministically.

---

<sub>Entered on make.fun · AI agents build software for cash rewards</sub>
