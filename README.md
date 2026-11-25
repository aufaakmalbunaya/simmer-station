# Simmer Station

[![make.fun](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/c/best-cooking-game-20261125-0137/)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/aufaakmalbunaya/simmer-station/rank.svg)](https://make.fun/c/best-cooking-game-20261125-0137/)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/aufaakmalbunaya/simmer-station/reward.svg)](https://make.fun/c/best-cooking-game-20261125-0137/)

A timed cooking game for the browser. You are the only chef on a busy lunch
shift: orders arrive on the board, and you chop, grill, plate and serve each
dish before its ticket timer runs out. Serve fast to build a combo, mind the
grill so nothing burns, and hold the line when rush hour hits.

## How to play

- **Walk** with WASD or the arrow keys, or click a station (or the floor) and
  the chef walks there.
- **Use a station** with E or Space. Hold E at the chopping board to chop.
  Keys 1–6 grab directly from the pantry bins.
- **Q** dumps what you are carrying, what sits on the board, or the plate on
  the counter. **P** pauses. **M** mutes the sounds.

The kitchen, top to bottom:

- **Order board** — tickets with the dish, its ingredients and a timer bar.
  A red border means ten seconds or less: serve it or lose the streak.
- **Chop** — bring a tomato, lettuce or onion and hold E to chop it.
- **Grill** — a patty cooks in about five seconds. Take it when it is ready;
  leave it and it burns.
- **Plate up** — add ingredients with E. When the plate matches a ticket it
  glows: press E to pick it up.
- **Serve** — carry a finished plate to the window and press E.
- **Pantry** — buns, patties, tomatoes, lettuce, cheese and onions.

## The menu

Six dishes from one pantry, each a different combination, so every order asks
for a different route through the kitchen:

| Dish | Ingredients | Points |
| --- | --- | --- |
| Garden Salad | chopped tomato, chopped lettuce | 100 |
| Cheese Melt | bun, grilled patty, cheese | 140 |
| Golden Onion Soup | chopped onion, chopped tomato, cheese | 160 |
| Simmer Burger | bun, grilled patty, chopped tomato, chopped lettuce | 200 |
| Veggie Stack | bun, chopped lettuce, chopped tomato, cheese, chopped onion | 220 |
| Double Stack | bun, grilled patty x2, cheese, chopped onion | 260 |

Serving earns the dish points, a bonus for time left on the ticket, and a
combo bonus that grows with every on-time serve in a row. A missed ticket
breaks the combo. After 75 seconds rush hour starts: tickets arrive faster
and run shorter. The shift lasts 150 seconds; the best shift is saved in your
browser.

## How to run it

No build step and no network request: every file the game loads lives under
`game/`, and all art and sound are drawn and synthesised in code.

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser and press Space to start
cooking. `?seed=N` fixes the order pattern; `?shot=start|play|rush|end`
with `&seed=N` stages one deterministic scene for a screenshot (the shots in
`screenshots/` use `shots.json`: play at seed 6, the rest at seed 1, so two
runs produce byte-identical images). `?debug=1` exposes a read-only live
state snapshot at `window.__simmerLive` for play-testing.

## How it is built

- `game/index.html` — the page and its canvas.
- `game/src/main.js` — boot, the fixed-step loop, screens and shot mode.
- `game/src/world.js` — the rules: orders, stations, the chef, scoring.
- `game/src/render.js` — everything the player sees, drawn on canvas.
- `game/src/food.js` — the chunky food art, drawn in code.
- `game/src/input.js` — keyboard and mouse, including click-to-walk.
- `game/src/audio.js` — the sounds, synthesised with Web Audio.
- `game/src/shots.js` — the screenshot scenes and their autopilot, which plays
  the real game through the same step the player uses.
- `game/src/config.js` — tuning, palette, recipes and station layout.
- `game/src/random.js` — the seeded random source.
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## License

MIT — see `LICENSE`.
