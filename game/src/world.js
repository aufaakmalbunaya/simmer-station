// Simmer Station's rules: the shift, the orders, the stations and the chef.
// One fixed step moves the chef, cooks the grill, chops the board and ticks the
// order timers; the renderer only paints what this file holds, so the same
// simulation drives both live play and the deterministic screenshot scenes.

import {
  BIN_ORDER, CHEF, CHOP_SECONDS, FIELD, GRILL_BURN_SECONDS, GRILL_SECONDS,
  INGREDIENTS, ORDERS, REACH, RECIPES, RUSH_AT_SECONDS, SCORE, SHIFT_SECONDS, STATIONS,
} from './config.js';
import { pickIndex } from './random.js';
import {
  soundChop, soundError, soundExpire, soundGrab, soundPlace, soundReady,
  soundServe, soundSizzle, soundTick,
} from './audio.js';

export const EVENT_SERVED = 1;
export const EVENT_EXPIRED = 2;
export const EVENT_OVER = 4;
export const EVENT_CHOP_DONE = 8;
export const EVENT_GRILL_READY = 16;

/** The centre of one pantry bin, by ingredient. */
export function binCentre(kind) {
  const index = BIN_ORDER.indexOf(kind);
  const rect = STATIONS.bins.rect;
  const width = rect.w / BIN_ORDER.length;
  return { x: rect.x + width * (index + 0.5), y: rect.y + rect.h / 2 };
}

/** The pantry bin nearest the chef's x position. */
export function nearestBinKind(x) {
  const rect = STATIONS.bins.rect;
  const width = rect.w / BIN_ORDER.length;
  const index = Math.max(0, Math.min(BIN_ORDER.length - 1, Math.floor((x - rect.x) / width)));
  return BIN_ORDER[index];
}

/** The station whose anchor the chef stands near, or null. */
export function nearestStation(state) {
  const { x, y } = state.chef;
  let best = null;
  let bestDistance = REACH;
  for (const [name, station] of Object.entries(STATIONS)) {
    if (name === 'bins') continue;
    const dx = station.anchor.x - x;
    const dy = station.anchor.y - y;
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = name;
    }
  }
  if (best) return best;
  const bins = STATIONS.bins.rect;
  if (y > bins.y - 40 && y < bins.y + bins.h + 90 && x > bins.x - 20 && x < bins.x + bins.w + 20) return 'bins';
  return null;
}

/** The station (or pantry bin) at a clicked point, for mouse play. */
export function stationAtPoint(x, y) {
  for (const [name, station] of Object.entries(STATIONS)) {
    const r = station.rect;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      if (name === 'bins') return { station: 'bins', bin: nearestBinKind(x) };
      return { station: name };
    }
  }
  return null;
}

export function recipeById(id) {
  return RECIPES.find((recipe) => recipe.id === id);
}

/** True when the plate's items are exactly a recipe's items, in any order. */
export function plateMatchesRecipe(items, recipe) {
  if (items.length !== recipe.items.length) return false;
  const remaining = [...recipe.items];
  for (const item of items) {
    const index = remaining.indexOf(item);
    if (index === -1) return false;
    remaining.splice(index, 1);
  }
  return true;
}

/** The recipe a plate completes, or null when it matches none yet. */
export function completedRecipe(items) {
  return RECIPES.find((recipe) => plateMatchesRecipe(items, recipe)) ?? null;
}

/** The earliest open order waiting for this recipe, or null. */
export function matchingOrder(state, recipe) {
  if (!recipe) return null;
  return state.orders.find((order) => order.recipeId === recipe.id) ?? null;
}

/** A fresh world: empty kitchen, first ticket a few seconds in. */
export function createWorld(random) {
  const state = {
    random,
    time: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    served: 0,
    failed: 0,
    orders: [],
    spawnTimer: ORDERS.spawnFirst,
    nextOrderId: 1,
    rush: false,
    over: false,
    flash: 0,
    banner: null,
    chef: { x: FIELD.width / 2, y: 480, hands: [], plate: null },
    board: { item: null, progress: 0, done: false, chopTick: 0 },
    grill: [
      { item: null, progress: 0, state: 'empty' },
      { item: null, progress: 0, state: 'empty' },
    ],
    plate: { items: [] },
    particles: [],
    popups: [],
    lastTickSecond: -1,
  };
  return {
    state,
    reset() {
      const fresh = createWorld(random).state;
      for (const key of Object.keys(state)) delete state[key];
      Object.assign(state, fresh);
    },
    step,
  };
}

/** A puff of steam or a star, for feedback that reads without words. */
function spawnParticles(state, x, y, colour, count) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x: x + (state.random() - 0.5) * 30,
      y: y + (state.random() - 0.5) * 10,
      vx: (state.random() - 0.5) * 30,
      vy: -30 - state.random() * 40,
      t: 0,
      life: 0.7 + state.random() * 0.4,
      colour,
      size: 3 + state.random() * 4,
    });
  }
}

/** Floating score text that rises and fades. */
function spawnPopup(state, x, y, text, colour) {
  state.popups.push({ x, y, text, colour, t: 0 });
}

/** Deal one new ticket, from a recipe the board does not already carry twice. */
function spawnOrder(state) {
  const counts = {};
  for (const order of state.orders) counts[order.recipeId] = (counts[order.recipeId] ?? 0) + 1;
  const available = RECIPES.filter((recipe) => (counts[recipe.id] ?? 0) < 2);
  const recipe = available[pickIndex(state.random, available.length)];
  const rushScale = state.rush ? 0.8 : 1;
  const seconds = Math.round(recipe.seconds * rushScale);
  state.orders.push({ id: state.nextOrderId, recipeId: recipe.id, timeLeft: seconds, totalTime: seconds });
  state.nextOrderId += 1;
}

/** Move the chef, clamped to the kitchen floor. */
function moveChef(state, mx, my, dt) {
  const length = Math.hypot(mx, my);
  if (length === 0) return;
  const chef = state.chef;
  chef.x = Math.max(30, Math.min(FIELD.width - 30, chef.x + (mx / length) * CHEF.speed * dt));
  chef.y = Math.max(320, Math.min(FIELD.height - 30, chef.y + (my / length) * CHEF.speed * dt));
}

/** The action key at the chopping board: place, chop, take. */
function useChopBoard(state) {
  const board = state.board;
  const hands = state.chef.hands;
  if (board.item === null) {
    const index = hands.findIndex((item) => INGREDIENTS[item]?.chop);
    if (index === -1) return;
    board.item = hands.splice(index, 1)[0];
    board.progress = 0;
    board.done = false;
    soundPlace();
    return;
  }
  if (board.done) {
    if (hands.length >= CHEF.hands) return;
    hands.push(INGREDIENTS[board.item].chop);
    board.item = null;
    board.progress = 0;
    board.done = false;
    soundGrab();
  }
}

/** Hold the action key to chop: progress while held, done at CHOP_SECONDS. */
function chopHeld(state, dt) {
  const board = state.board;
  if (board.item === null || board.done) return 0;
  board.progress += dt;
  board.chopTick += dt;
  if (board.chopTick >= 0.45) {
    board.chopTick = 0;
    soundChop();
    spawnParticles(state, STATIONS.chop.rect.x + 130, STATIONS.chop.rect.y + 60, '#ffffff', 3);
  }
  if (board.progress >= CHOP_SECONDS) {
    board.done = true;
    board.progress = CHOP_SECONDS;
    return EVENT_CHOP_DONE;
  }
  return 0;
}

/** The action key at the grill: place a patty, or take a ready one. */
function useGrill(state) {
  const hands = state.chef.hands;
  const free = state.grill.find((slot) => slot.state === 'empty');
  const ready = state.grill.find((slot) => slot.state === 'ready');
  const burnt = state.grill.find((slot) => slot.state === 'burnt');
  if (ready && hands.length < CHEF.hands) {
    hands.push('patty_grilled');
    ready.item = null;
    ready.progress = 0;
    ready.state = 'empty';
    soundGrab();
    return;
  }
  if (burnt) {
    burnt.item = null;
    burnt.progress = 0;
    burnt.state = 'empty';
    soundError();
    spawnPopup(state, STATIONS.grill.anchor.x, STATIONS.grill.rect.y - 10, 'Burnt! Tossed.', '#d94f30');
    return;
  }
  if (free) {
    const index = hands.indexOf('patty');
    if (index === -1) return;
    hands.splice(index, 1);
    free.item = 'patty';
    free.progress = 0;
    free.state = 'cooking';
    soundSizzle();
    spawnParticles(state, STATIONS.grill.rect.x + 130, STATIONS.grill.rect.y + 60, '#bbbbbb', 4);
  }
}

/** The action key at the plating counter: add, pick up, or put down the plate. */
function usePlateCounter(state) {
  const chef = state.chef;
  const plate = state.plate;
  if (chef.plate) {
    if (plate.items.length === 0) {
      plate.items = chef.plate.items;
      chef.plate = null;
      soundPlace();
    }
    return;
  }
  if (plate.items.length > 0 && completedRecipe(plate.items)) {
    chef.plate = { items: [...plate.items] };
    plate.items = [];
    soundGrab();
    return;
  }
  if (chef.hands.length === 0) return;
  const item = chef.hands[chef.hands.length - 1];
  plate.items.push(item);
  chef.hands.pop();
  soundPlace();
}

/** The action key at the serving window: hand over a finished dish. */
function useServeWindow(state) {
  const chef = state.chef;
  if (!chef.plate) {
    soundError();
    return 0;
  }
  const recipe = completedRecipe(chef.plate.items);
  const order = matchingOrder(state, recipe);
  if (!order) {
    soundError();
    spawnPopup(state, STATIONS.serve.anchor.x, STATIONS.serve.rect.y - 10, 'No order for this dish!', '#d94f30');
    return 0;
  }
  const timeBonus = Math.round((order.timeLeft / order.totalTime) * SCORE.timeBonus);
  const comboBonus = state.combo * SCORE.comboBonus;
  const gained = recipe.points + timeBonus + comboBonus;
  state.score += gained;
  state.combo += 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  state.served += 1;
  state.orders = state.orders.filter((open) => open !== order);
  chef.plate = null;
  soundServe();
  spawnParticles(state, STATIONS.serve.anchor.x, STATIONS.serve.rect.y + 40, '#f2b234', 10);
  spawnPopup(state, STATIONS.serve.anchor.x, STATIONS.serve.rect.y - 10, `+${gained}`, '#4e9a51');
  return EVENT_SERVED;
}

/** The action key at the pantry: take the nearest bin's ingredient. */
function usePantry(state, bin) {
  const hands = state.chef.hands;
  if (hands.length >= CHEF.hands) {
    soundError();
    return;
  }
  hands.push(bin ?? nearestBinKind(state.chef.x));
  soundGrab();
}

/** Q: dump what the chef is carrying, what sits on the board, or the plate on the counter. */
function dumpCarried(state) {
  const chef = state.chef;
  if (chef.plate) {
    chef.plate = null;
    soundError();
    return;
  }
  if (nearestStation(state) === 'plate' && state.plate.items.length > 0) {
    state.plate.items = [];
    soundError();
    return;
  }
  if (state.board.item !== null) {
    state.board.item = null;
    state.board.progress = 0;
    state.board.done = false;
    soundError();
    return;
  }
  if (chef.hands.length > 0) {
    chef.hands.pop();
    soundError();
  }
}

/**
 * Advance the world one fixed step. `input` carries the move vector, whether
 * the action key is pressed this step and held, which pantry bin a click named,
 * and whether the dump key was pressed. `attract` runs the title-screen demo:
 * orders arrive and leave, but nothing is scored or lost.
 */
function step(state, input, dt, attract = false) {
  let events = 0;
  if (state.over) return events;
  state.time += dt;
  state.flash = Math.max(0, state.flash - dt * 2);
  if (state.banner) {
    state.banner.t -= dt;
    if (state.banner.t <= 0) state.banner = null;
  }
  if (!state.rush && state.time >= RUSH_AT_SECONDS) {
    state.rush = true;
    state.banner = { text: 'RUSH HOUR! Orders are coming faster!', t: 3 };
    soundReady();
  }

  moveChef(state, input.mx, input.my, dt);

  const station = nearestStation(state);
  if (input.interact) {
    if (station === 'chop') useChopBoard(state);
    else if (station === 'grill') useGrill(state);
    else if (station === 'plate') usePlateCounter(state);
    else if (station === 'serve') events |= useServeWindow(state);
    else if (station === 'bins') usePantry(state, input.bin);
  }
  if (input.interactHeld && station === 'chop') events |= chopHeld(state, dt);
  if (input.dump) dumpCarried(state);

  // The grill cooks on its own: ready, then burnt if forgotten.
  for (const slot of state.grill) {
    if (slot.state !== 'cooking' && slot.state !== 'ready') continue;
    slot.progress += dt;
    if (slot.state === 'cooking' && slot.progress >= GRILL_SECONDS) {
      slot.state = 'ready';
      soundReady();
      events |= EVENT_GRILL_READY;
    } else if (slot.state === 'ready' && slot.progress >= GRILL_SECONDS + GRILL_BURN_SECONDS) {
      slot.state = 'burnt';
      spawnPopup(state, STATIONS.grill.anchor.x, STATIONS.grill.rect.y - 10, 'Burnt!', '#d94f30');
    }
  }

  // New tickets arrive on a timer that quickens in rush hour.
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0 && state.orders.length < ORDERS.maxTickets) {
    spawnOrder(state);
    state.spawnTimer = state.rush ? ORDERS.spawnRushSeconds : ORDERS.spawnSeconds;
  } else if (state.spawnTimer <= 0) {
    state.spawnTimer = 2;
  }

  // Order timers run down; a missed ticket breaks the streak.
  for (const order of [...state.orders]) {
    order.timeLeft -= dt;
    const whole = Math.ceil(order.timeLeft);
    if (order.timeLeft <= 10 && whole !== state.lastTickSecond && !attract) {
      state.lastTickSecond = whole;
      soundTick();
    }
    if (order.timeLeft <= 0) {
      state.orders = state.orders.filter((open) => open !== order);
      if (!attract) {
        state.combo = 0;
        state.failed += 1;
        state.flash = 1;
        soundExpire();
        events |= EVENT_EXPIRED;
      }
    }
  }

  // Particles and popups drift up and fade.
  for (const particle of state.particles) {
    particle.t += dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  }
  state.particles = state.particles.filter((particle) => particle.t < particle.life);
  for (const popup of state.popups) popup.t += dt;
  state.popups = state.popups.filter((popup) => popup.t < 1.4);

  if (!attract && state.time >= SHIFT_SECONDS) {
    state.over = true;
    events |= EVENT_OVER;
  }
  return events;
}
