// The screenshot scenes behind ?shot=start|play|rush|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot that walks the chef, grabs, chops, grills, plates and serves
// through the same step() live players use, so every frame is what a real game
// looks like and the same seed always gives the same frame.

import { BIN_ORDER, STEP, STATIONS } from './config.js';
import { EVENT_OVER, completedRecipe, matchingOrder, recipeById } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 45;
const RUSH_SECONDS = 88;
const END_LIMIT_SECONDS = 400;

/** Move toward (x, y); returns true once the chef is close enough to act. */
function moveToward(state, input, x, y) {
  const chef = state.chef;
  const dx = x - chef.x;
  const dy = y - chef.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 18) {
    input.mx = 0;
    input.my = 0;
    return true;
  }
  input.mx = dx / distance;
  input.my = dy / distance;
  return false;
}

/** Count how many of `kind` sit on the plate. */
function plateCount(state, kind) {
  return state.plate.items.filter((item) => item === kind).length;
}

/**
 * One step of the autopilot's plan: a small object with an update that returns
 * true when the step is finished. Steps are built from a recipe, so the pilot
 * fetches, prepares and plates each ingredient in turn, then serves.
 */
function grabStep(kind) {
  const bin = BIN_ORDER.indexOf(kind);
  const rect = STATIONS.bins.rect;
  const width = rect.w / BIN_ORDER.length;
  const x = rect.x + width * (bin + 0.5);
  return {
    name: `grab ${kind}`,
    update(state, input) {
      if (state.chef.hands.includes(kind)) return true;
      if (moveToward(state, input, x, 590)) {
        input.interact = true;
        input.bin = kind;
      }
      return false;
    },
  };
}

function chopStep(raw, chopped) {
  return {
    name: `chop ${raw}`,
    update(state, input) {
      if (state.board.done) return true;
      if (state.board.item === null) {
        if (moveToward(state, input, STATIONS.chop.anchor.x, STATIONS.chop.anchor.y)) input.interact = true;
        return false;
      }
      if (moveToward(state, input, STATIONS.chop.anchor.x, STATIONS.chop.anchor.y)) input.interactHeld = true;
      return false;
    },
  };
}

function takeBoardStep(chopped) {
  return {
    name: `take ${chopped}`,
    update(state, input) {
      if (state.board.item === null && state.chef.hands.includes(chopped)) return true;
      if (moveToward(state, input, STATIONS.chop.anchor.x, STATIONS.chop.anchor.y)) input.interact = true;
      return false;
    },
  };
}

function grillStep() {
  return {
    name: 'grill patty',
    update(state, input) {
      const cooking = state.grill.some((slot) => slot.state === 'cooking' || slot.state === 'ready');
      if (cooking) return true;
      if (moveToward(state, input, STATIONS.grill.anchor.x, STATIONS.grill.anchor.y)) input.interact = true;
      return false;
    },
  };
}

function waitGrillStep() {
  return {
    name: 'wait for grill',
    update(state, input) {
      if (state.grill.some((slot) => slot.state === 'ready')) return true;
      moveToward(state, input, STATIONS.grill.anchor.x, STATIONS.grill.anchor.y + 40);
      return false;
    },
  };
}

function takeGrillStep() {
  return {
    name: 'take grilled patty',
    update(state, input) {
      if (state.chef.hands.includes('patty_grilled')) return true;
      if (moveToward(state, input, STATIONS.grill.anchor.x, STATIONS.grill.anchor.y)) input.interact = true;
      return false;
    },
  };
}

function addToPlateStep(kind) {
  let startCount = null;
  return {
    name: `plate ${kind}`,
    update(state, input) {
      if (startCount === null) startCount = plateCount(state, kind);
      if (plateCount(state, kind) > startCount) return true;
      if (moveToward(state, input, STATIONS.plate.anchor.x, STATIONS.plate.anchor.y)) input.interact = true;
      return false;
    },
  };
}

function pickUpPlateStep() {
  return {
    name: 'pick up plate',
    update(state, input) {
      if (state.chef.plate) return true;
      if (moveToward(state, input, STATIONS.plate.anchor.x, STATIONS.plate.anchor.y)) input.interact = true;
      return false;
    },
  };
}

function serveStep() {
  let servedAtStart = null;
  return {
    name: 'serve',
    update(state, input) {
      if (servedAtStart === null) servedAtStart = state.served;
      if (state.served > servedAtStart) return true;
      if (moveToward(state, input, STATIONS.serve.anchor.x, STATIONS.serve.anchor.y)) input.interact = true;
      return false;
    },
  };
}

/** Dump a stale half-built plate before starting a different dish. */
function clearPlateStep() {
  return {
    name: 'clear plate',
    update(state, input) {
      if (state.plate.items.length === 0) return true;
      if (moveToward(state, input, STATIONS.plate.anchor.x, STATIONS.plate.anchor.y)) input.dump = true;
      return false;
    },
  };
}

/** Dump what the chef carries, one item per step, until the hands are empty. */
function clearHandsStep() {
  return {
    name: 'clear hands',
    update(state, input) {
      if (state.chef.hands.length === 0 && !state.chef.plate) return true;
      input.dump = true;
      return false;
    },
  };
}

/** True when the chef holds an item the new recipe no longer needs. */
function handsHoldStaleItems(state, recipe) {
  const needed = [...recipe.items];
  for (const item of state.plate.items) {
    const index = needed.indexOf(item);
    if (index !== -1) needed.splice(index, 1);
  }
  for (const item of state.chef.hands) {
    const index = needed.indexOf(item);
    if (index === -1) return true;
    needed.splice(index, 1);
  }
  return false;
}

/** Build the plan for one recipe: fetch and prepare each item, plate, serve. */
function planForRecipe(recipe) {
  const steps = [];
  for (const item of recipe.items) {
    if (item === 'patty_grilled') {
      steps.push(grabStep('patty'));
      steps.push(grillStep());
      steps.push(waitGrillStep());
      steps.push(takeGrillStep());
      steps.push(addToPlateStep('patty_grilled'));
    } else if (item.endsWith('_chopped')) {
      const raw = item.slice(0, -'_chopped'.length);
      steps.push(grabStep(raw));
      steps.push(chopStep(raw, item));
      steps.push(takeBoardStep(item));
      steps.push(addToPlateStep(item));
    } else {
      steps.push(grabStep(item));
      steps.push(addToPlateStep(item));
    }
  }
  steps.push(pickUpPlateStep());
  steps.push(serveStep());
  return steps;
}

/**
 * The autopilot: keeps a plan for the earliest open order, runs its steps in
 * order, and rebuilds the plan when the order is served or expires. A step
 * that takes too long is abandoned so the pilot never stalls on one spot.
 */
export function createAutopilot() {
  let plan = null;
  let orderId = null;
  let stepIndex = 0;
  let stepTime = 0;

  /** The order to cook next: one the plate already completes, else the most urgent. */
  function pickOrder(state) {
    if (state.orders.length === 0) return null;
    const complete = completedRecipe(state.plate.items);
    if (complete) {
      const match = state.orders.find((order) => order.recipeId === complete.id);
      if (match) return match;
    }
    return [...state.orders].sort((a, b) => a.timeLeft - b.timeLeft)[0];
  }

  return {
    /** Decide this step's input for the world. */
    decide(state) {
      const input = { mx: 0, my: 0, interact: false, interactHeld: false, bin: null, dump: false };
      const order = pickOrder(state);
      if (!order) {
        plan = null;
        orderId = null;
        return input;
      }
      if (!plan || order.id !== orderId) {
        const recipe = recipeById(order.recipeId);
        plan = planForRecipe(recipe);
        // A half-built plate for another dish is cleared before starting over.
        const complete = completedRecipe(state.plate.items);
        if (state.plate.items.length > 0 && !matchingOrder(state, complete)) {
          plan.unshift(clearPlateStep());
        }
        if ((state.chef.hands.length > 0 || state.chef.plate) && handsHoldStaleItems(state, recipe)) {
          plan.unshift(clearHandsStep());
        }
        orderId = order.id;
        stepIndex = 0;
        stepTime = 0;
      }
      const step = plan[stepIndex];
      if (!step) {
        plan = null;
        return input;
      }
      stepTime += STEP;
      if (step.update(state, input)) {
        stepIndex += 1;
        stepTime = 0;
      } else if (stepTime > 25) {
        // Stuck on one step: dump what is carried and start the plan over.
        input.dump = true;
        plan = null;
        orderId = null;
      }
      return input;
    },
  };
}

/** A pilot that wanders the kitchen and never serves: the game-over scene. */
function wanderPilot(state) {
  const angle = state.time * 0.7;
  return {
    mx: Math.cos(angle),
    my: Math.sin(angle * 0.8),
    interact: false,
    interactHeld: false,
    bin: null,
    dump: false,
  };
}

/**
 * Set `world` to the named scene (start, play, rush or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name !== 'play' && name !== 'rush' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(state, { mx: 0, my: 0, interact: false, interactHeld: false, bin: null, dump: false }, STEP, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'end') {
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      if (world.step(state, wanderPilot(state), STEP, false) & EVENT_OVER) break;
    }
    return { screen: SCREEN_OVER, best: state.score };
  }
  const pilot = createAutopilot();
  const limit = name === 'rush' ? RUSH_SECONDS : PLAY_SECONDS;
  const totalSteps = Math.floor(limit / STEP);
  for (let index = 0; index < totalSteps; index += 1) {
    const input = pilot.decide(state);
    if (world.step(state, input, STEP, false) & EVENT_OVER) break;
    // The cover frame: a dish mid-assembly, a patty on the grill, tickets up.
    if (name === 'play' && state.plate.items.length >= 2 && state.grill.some((slot) => slot.state === 'cooking')) {
      break;
    }
  }
  return { screen: SCREEN_PLAY, best: state.score };
}
