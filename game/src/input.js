// Keyboard and mouse for Simmer Station. Arrows or WASD walk the chef, E (or
// Space) uses the nearest station and is held to chop, Q dumps what is carried,
// P pauses, M mutes. A mouse click sets a walk target: click a station and the
// chef walks there and uses it on arrival; click the floor and the chef walks.

import { STATIONS } from './config.js';
import { stationAtPoint } from './world.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DUMP = 4;
export const ACTION_RESTART = 8;
export const ACTION_MUTE = 16;

/** Keys that move the chef, as [key, dx, dy]. */
const MOVE_KEYS = [
  ['ArrowLeft', -1, 0],
  ['ArrowRight', 1, 0],
  ['ArrowUp', 0, -1],
  ['ArrowDown', 0, 1],
  ['a', -1, 0],
  ['d', 1, 0],
  ['w', 0, -1],
  ['s', 0, 1],
];

/** Make an input reader for the canvas. Returns the live input state. */
export function createInput(canvas, toLogical) {
  const keys = new Set();
  const actions = { bits: 0 };
  const mouse = { x: 0, y: 0, down: false, clicked: false, clickStation: null };
  let target = null;

  /** Convert a client point to logical kitchen coordinates. */
  function logicalPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return toLogical(event.clientX - rect.left, event.clientY - rect.top);
  }

  function onKeyDown(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === 'e' || key === ' ') actions.bits |= ACTION_CONFIRM;
    if (key === 'p' || key === 'Escape') actions.bits |= ACTION_PAUSE;
    if (key === 'q') actions.bits |= ACTION_DUMP;
    if (key === 'r') actions.bits |= ACTION_RESTART;
    if (key === 'm') actions.bits |= ACTION_MUTE;
  }

  function onKeyUp(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    keys.delete(key);
  }

  function onPointerDown(event) {
    const point = logicalPoint(event);
    mouse.x = point.x;
    mouse.y = point.y;
    mouse.down = true;
    mouse.clicked = true;
    const hit = stationAtPoint(point.x, point.y);
    mouse.clickStation = hit;
    target = hit ? { x: hit.station === 'bins' ? point.x : stationAnchor(hit).x, y: hit.station === 'bins' ? 590 : stationAnchor(hit).y, station: hit.station, bin: hit.bin } : { x: point.x, y: Math.max(330, point.y) };
  }

  function onPointerUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);

  /** The anchor a clicked station's chef stands at. */
  function stationAnchor(hit) {
    return STATIONS[hit.station].anchor;
  }

  return {
    /** The move vector from the keys, or toward the click target when set. */
    direction(chef) {
      let mx = 0;
      let my = 0;
      for (const [key, dx, dy] of MOVE_KEYS) {
        if (keys.has(key)) {
          mx += dx;
          my += dy;
        }
      }
      if (mx !== 0 || my !== 0) {
        target = null;
        return { mx, my };
      }
      if (target) {
        const dx = target.x - chef.x;
        const dy = target.y - chef.y;
        if (Math.hypot(dx, dy) < 12) {
          const arrived = target;
          target = null;
          return { mx: 0, my: 0, arrived };
        }
        return { mx: dx, my: dy };
      }
      return { mx: 0, my: 0 };
    },
    /** True while the action key is held down (for chopping). */
    interactHeld() {
      return keys.has('e') || keys.has(' ');
    },
    /** One-shot action bits pressed since the last read; reading clears them. */
    takeActions() {
      const bits = actions.bits;
      actions.bits = 0;
      return bits;
    },
    /** The station a click named, if the chef just arrived at one. */
    takeClick(arrived) {
      if (!arrived || !arrived.station) return null;
      const hit = { station: arrived.station, bin: arrived.bin };
      return hit;
    },
    /** The last click point, for hover hints. */
    mouse() {
      return mouse;
    },
    /** Forget any walk target (a key press already does this). */
    clearTarget() {
      target = null;
    },
  };
}
