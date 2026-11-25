// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between four screens: title, play, paused
// and game over.
//
// ?seed=N fixes the order pattern. ?shot=start|play|rush|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, BIN_ORDER, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_OVER, nearestStation } from './world.js';
import {
  ACTION_CONFIRM, ACTION_DUMP, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { soundEnd, soundStart, toggleMute, unlockAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  // A read-only handle for the screenshot tooling, so a shot's state can be
  // checked without guessing from pixels.
  window.__simmerShot = {
    score: world.state.score,
    served: world.state.served,
    plate: [...world.state.plate.items],
    grill: world.state.grill.map((slot) => slot.state),
    board: world.state.board.item,
    hands: [...world.state.chef.hands],
    orders: world.state.orders.map((order) => order.recipeId),
  };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (px, py) => renderer.toLogical(px, py));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let lastDigit = null;
  let clickInteract = null;

  // The pantry's number keys: 1-6 grabs that bin's ingredient.
  window.addEventListener('keydown', (event) => {
    const digit = Number.parseInt(event.key, 10);
    if (digit >= 1 && digit <= BIN_ORDER.length) lastDigit = digit;
  });

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    unlockAudio();
    soundStart();
    announce('Playing. Serve dishes before their tickets run out.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    soundEnd();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Shift over. Score ${world.state.score}. Best ${best}. Press R to cook again.`);
  }

  function handleActions(actions) {
    const mouse = input.mouse();
    const clicked = mouse.clicked;
    mouse.clicked = false;
    if (actions & ACTION_MUTE) {
      const muted = toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART) || clicked) startGame();
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (screen === SCREEN_OVER && (actions & ACTION_RESTART)) startGame();
  }

  function step(actions) {
    const state = world.state;
    if (screen === SCREEN_TITLE) {
      world.step(state, { mx: 0, my: 0, interact: false, interactHeld: false, bin: null, dump: false }, STEP, true);
      return;
    }
    const move = input.direction(state.chef);
    if (move.arrived) {
      const hit = input.takeClick(move.arrived);
      if (hit) clickInteract = hit;
    }
    const nearest = nearestStation(state);
    let interact = (actions & ACTION_CONFIRM) !== 0;
    let bin = null;
    if (clickInteract) {
      interact = true;
      bin = clickInteract.bin ?? null;
      clickInteract = null;
    }
    if (lastDigit !== null && nearest === 'bins') {
      interact = true;
      bin = BIN_ORDER[lastDigit - 1];
    }
    lastDigit = null;
    const events = world.step(state, {
      mx: move.mx,
      my: move.my,
      interact,
      interactHeld: input.interactHeld(),
      bin,
      dump: (actions & ACTION_DUMP) !== 0,
    }, STEP, false);
    if (events & EVENT_OVER) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // A one-shot action (E, Q, a click) fires on the first step of the frame
      // only; later catch-up steps in the same frame get none, so one key press
      // can never grab three ingredients at once.
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, screen === SCREEN_PLAY ? nearestStation(world.state) : null);
    // A read-only live handle for play-testing (?debug=1): the state snapshot.
    if (params.get('debug') === '1') {
      const state = world.state;
      window.__simmerLive = {
        screen,
        score: state.score,
        served: state.served,
        hands: [...state.chef.hands],
        plate: [...state.plate.items],
        board: state.board.item,
        boardDone: state.board.done,
        grill: state.grill.map((slot) => slot.state),
        chef: { x: Math.round(state.chef.x), y: Math.round(state.chef.y) },
        orders: state.orders.map((order) => order.recipeId),
      };
    }
  }

  // Leaving the tab pauses a running game rather than letting tickets run out unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Simmer Station. Press Space or click to start cooking.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
