// Everything the player sees: the warm kitchen, the order board, the stations,
// the chef, and the title, pause and game-over screens. All food and faces are
// drawn in code; nothing here loads a file. The renderer only paints the state
// the world holds, so a screenshot is a true frame of the game.

import {
  BIN_ORDER, CHEF, CHOP_SECONDS, FIELD, FONT, GRILL_SECONDS, INGREDIENTS,
  PALETTE, RECIPES, SHIFT_SECONDS, STATIONS,
} from './config.js';
import { completedRecipe, matchingOrder, nearestBinKind, recipeById } from './world.js';
import { drawDish, drawIngredient, ingredientName } from './food.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** Round a rectangle path (ctx.roundRect exists in modern browsers; this is the fallback). */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** A filled rounded rectangle. */
function panel(ctx, x, y, w, h, r, colour) {
  ctx.fillStyle = colour;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

/** A filled circle. */
function circle(ctx, x, y, radius, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** Text with a font size, weight, colour and alignment. */
function text(ctx, value, x, y, size, colour, align = 'center', weight = '700') {
  ctx.fillStyle = colour;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

/** A clock reading like 2:05 from seconds. */
function clock(seconds) {
  const left = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

/** The rank a shift's score earns. */
export function rankForScore(score) {
  if (score >= 1400) return 'Head Chef';
  if (score >= 1000) return 'Sous Chef';
  if (score >= 600) return 'Line Cook';
  return 'Kitchen Hand';
}

/** Make a renderer for the canvas; it scales the 1280x720 kitchen to the window. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  /** Size the canvas backing store to its displayed size, so the game draws sharp. */
  function resizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  /** Fit the logical kitchen into the canvas, letterboxed. */
  function fit() {
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    const offsetX = (canvas.width - FIELD.width * scale) / 2;
    const offsetY = (canvas.height - FIELD.height * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    return { scale, offsetX, offsetY };
  }

  /** Convert a canvas pixel point back to logical kitchen coordinates. */
  function toLogical(px, py) {
    const { scale, offsetX, offsetY } = fit();
    return { x: (px - offsetX) / scale, y: (py - offsetY) / scale };
  }

  function drawBackground() {
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Tile wainscot along the top of the wall.
    ctx.fillStyle = PALETTE.wallTrim;
    ctx.fillRect(0, 96, FIELD.width, 10);
    ctx.fillStyle = '#f2d9a8';
    for (let x = 0; x < FIELD.width; x += 64) ctx.fillRect(x, 100, 60, 6);
    // Wooden floor with planks.
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(0, 320, FIELD.width, FIELD.height - 320);
    ctx.fillStyle = PALETTE.floorDark;
    for (let y = 340; y < FIELD.height; y += 46) ctx.fillRect(0, y, FIELD.width, 3);
    for (let x = 0; x < FIELD.width; x += 180) {
      ctx.fillRect(x, 320, 3, FIELD.height - 320);
    }
  }

  function drawOrderBoard(state) {
    // The ticket rail: a dark board strip across the top.
    panel(ctx, 280, 4, 640, 94, 12, PALETTE.board);
    ctx.fillStyle = '#5a4028';
    for (let x = 300; x < 900; x += 40) {
      ctx.beginPath();
      ctx.arc(x, 12, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.orders.length === 0) {
      text(ctx, 'No orders yet — the lunch crowd is coming…', 600, 52, 17, '#d9c9a8', 'center', '600');
      return;
    }
    const cardWidth = 148;
    const gap = 8;
    const total = state.orders.length * cardWidth + (state.orders.length - 1) * gap;
    let x = 600 - total / 2;
    for (const order of state.orders) {
      const recipe = recipeById(order.recipeId);
      const urgent = order.timeLeft <= 10;
      panel(ctx, x, 12, cardWidth, 78, 8, PALETTE.ticket);
      ctx.strokeStyle = urgent ? PALETTE.red : PALETTE.ticketEdge;
      ctx.lineWidth = urgent ? 3 : 2;
      roundRectPath(ctx, x, 12, cardWidth, 78, 8);
      ctx.stroke();
      text(ctx, recipe.name, x + cardWidth / 2, 28, 14, PALETTE.text);
      const iconSize = 22;
      const icons = recipe.items.length;
      const iconStart = x + (cardWidth - icons * (iconSize + 4)) / 2 + iconSize / 2;
      recipe.items.forEach((item, index) => {
        drawIngredient(ctx, item, iconStart + index * (iconSize + 4), 50, iconSize);
      });
      const fraction = Math.max(0, order.timeLeft / order.totalTime);
      ctx.fillStyle = '#e5d5b3';
      roundRectPath(ctx, x + 10, 68, cardWidth - 20, 10, 5);
      ctx.fill();
      ctx.fillStyle = urgent ? PALETTE.red : fraction > 0.5 ? PALETTE.green : PALETTE.gold;
      roundRectPath(ctx, x + 10, 68, (cardWidth - 20) * fraction, 10, 5);
      ctx.fill();
      text(ctx, `${Math.ceil(order.timeLeft)}s`, x + cardWidth / 2, 84, 11, urgent ? PALETTE.red : PALETTE.muted, 'center', '700');
      x += cardWidth + gap;
    }
  }

  function drawTopBar(state, best) {
    text(ctx, 'SIMMER STATION', 20, 34, 24, PALETTE.red, 'left', '800');
    text(ctx, 'a timed cooking game', 22, 62, 14, PALETTE.muted, 'left', '600');
    const left = SHIFT_SECONDS - state.time;
    const urgent = left <= 30;
    text(ctx, 'SHIFT', 990, 24, 13, PALETTE.muted, 'left', '700');
    text(ctx, clock(left), 990, 50, 30, urgent ? PALETTE.red : PALETTE.text, 'left', '800');
    const shiftFraction = Math.max(0, left / SHIFT_SECONDS);
    ctx.fillStyle = '#e5d5b3';
    roundRectPath(ctx, 990, 70, 130, 10, 5);
    ctx.fill();
    ctx.fillStyle = urgent ? PALETTE.red : PALETTE.blue;
    roundRectPath(ctx, 990, 70, 130 * shiftFraction, 10, 5);
    ctx.fill();
    text(ctx, 'SCORE', 1150, 24, 13, PALETTE.muted, 'left', '700');
    text(ctx, String(state.score), 1150, 50, 30, PALETTE.text, 'left', '800');
    text(ctx, `Best ${best}`, 1150, 76, 12, PALETTE.muted, 'left', '600');
    if (state.rush) {
      text(ctx, 'RUSH HOUR', 600, 118, 18, PALETTE.red, 'center', '800');
    }
  }

  function drawStationLabel(rect, label, highlight) {
    text(ctx, label, rect.x + rect.w / 2, rect.y - 14, 16, highlight ? PALETTE.red : PALETTE.text, 'center', '800');
  }

  function drawChopBoard(state, highlight) {
    const rect = STATIONS.chop.rect;
    drawStationLabel(rect, 'CHOP  ·  hold E', highlight);
    panel(ctx, rect.x, rect.y, rect.w, rect.h, 12, PALETTE.counter);
    panel(ctx, rect.x + 8, rect.y + 8, rect.w - 16, rect.h - 16, 8, '#e8c98f');
    // The knife, resting on the board.
    ctx.strokeStyle = '#8b93a3';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(rect.x + 200, rect.y + 34);
    ctx.lineTo(rect.x + 244, rect.y + 34);
    ctx.stroke();
    ctx.strokeStyle = '#3d2b1f';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(rect.x + 200, rect.y + 34);
    ctx.lineTo(rect.x + 176, rect.y + 34);
    ctx.stroke();
    const board = state.board;
    if (board.item) {
      drawIngredient(ctx, board.item, rect.x + 110, rect.y + 66, 64);
      if (!board.done) {
        const fraction = board.progress / CHOP_SECONDS;
        ctx.fillStyle = '#d9c9a8';
        roundRectPath(ctx, rect.x + 40, rect.y + 108, 180, 12, 6);
        ctx.fill();
        ctx.fillStyle = PALETTE.green;
        roundRectPath(ctx, rect.x + 40, rect.y + 108, 180 * fraction, 12, 6);
        ctx.fill();
        text(ctx, 'CHOPPING…', rect.x + 130, rect.y + 92, 13, PALETTE.muted, 'center', '700');
      } else {
        text(ctx, 'Ready — press E to take it', rect.x + 130, rect.y + 112, 13, PALETTE.green, 'center', '700');
      }
    } else {
      text(ctx, 'Bring a tomato, lettuce', rect.x + 130, rect.y + 62, 14, PALETTE.muted, 'center', '600');
      text(ctx, 'or onion — press E to chop', rect.x + 130, rect.y + 84, 14, PALETTE.muted, 'center', '600');
    }
  }

  function drawGrill(state, highlight) {
    const rect = STATIONS.grill.rect;
    drawStationLabel(rect, 'GRILL  ·  patties cook here', highlight);
    panel(ctx, rect.x, rect.y, rect.w, rect.h, 12, '#3a3a3a');
    panel(ctx, rect.x + 8, rect.y + 8, rect.w - 16, rect.h - 16, 8, '#555555');
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 3;
    for (let i = 1; i < 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(rect.x + 14, rect.y + 14 + i * 20);
      ctx.lineTo(rect.x + rect.w - 14, rect.y + 14 + i * 20);
      ctx.stroke();
    }
    state.grill.forEach((slot, index) => {
      const cx = rect.x + 70 + index * 120;
      const cy = rect.y + 66;
      if (slot.state === 'empty') {
        ctx.fillStyle = '#777777';
        ctx.beginPath();
        ctx.arc(cx, cy, 34, 0, Math.PI * 2);
        ctx.fill();
        text(ctx, 'empty', cx, cy, 12, '#dddddd', 'center', '600');
        return;
      }
      const wobble = slot.state === 'cooking' ? Math.sin(state.time * 6 + index) * 1.5 : 0;
      drawIngredient(ctx, slot.state === 'burnt' ? 'patty' : 'patty_grilled', cx + wobble, cy, 64);
      if (slot.state === 'burnt') {
        text(ctx, 'BURNT — E to toss', cx, cy + 48, 12, '#ffb0a0', 'center', '700');
        return;
      }
      const fraction = Math.min(1, slot.progress / GRILL_SECONDS);
      ctx.fillStyle = '#222222';
      roundRectPath(ctx, cx - 34, cy + 40, 68, 10, 5);
      ctx.fill();
      ctx.fillStyle = slot.state === 'ready' ? PALETTE.green : '#ff8c42';
      roundRectPath(ctx, cx - 34, cy + 40, 68 * fraction, 10, 5);
      ctx.fill();
      if (slot.state === 'ready') text(ctx, 'READY — E to take', cx, cy + 62, 12, '#b8e6b0', 'center', '700');
    });
  }

  function drawPlateCounter(state, highlight) {
    const rect = STATIONS.plate.rect;
    drawStationLabel(rect, 'PLATE UP  ·  build the dish', highlight);
    panel(ctx, rect.x, rect.y, rect.w, rect.h, 12, PALETTE.counter);
    panel(ctx, rect.x + 8, rect.y + 8, rect.w - 16, rect.h - 16, 8, '#f2e3c2');
    const plate = state.plate;
    const recipe = completedRecipe(plate.items);
    if (plate.items.length === 0) {
      drawDish(ctx, [], rect.x + 130, rect.y + 76, 110);
      text(ctx, 'Add ingredients with E', rect.x + 130, rect.y + 118, 13, PALETTE.muted, 'center', '600');
    } else {
      if (recipe) {
        const pulse = 1 + Math.sin(state.time * 5) * 0.06;
        ctx.save();
        ctx.translate(rect.x + 130, rect.y + 76);
        ctx.scale(pulse, pulse);
        ctx.translate(-(rect.x + 130), -(rect.y + 76));
        drawDish(ctx, plate.items, rect.x + 130, rect.y + 76, 110);
        ctx.restore();
        text(ctx, `${recipe.name} — ready! E to pick up`, rect.x + 130, rect.y + 118, 13, PALETTE.green, 'center', '800');
      } else {
        drawDish(ctx, plate.items, rect.x + 130, rect.y + 76, 110);
        text(ctx, 'Keep building… (Q dumps the plate)', rect.x + 130, rect.y + 118, 12, PALETTE.muted, 'center', '600');
      }
    }
  }

  function drawServeWindow(state, highlight) {
    const rect = STATIONS.serve.rect;
    drawStationLabel(rect, 'SERVE  ·  hand it over', highlight);
    panel(ctx, rect.x, rect.y, rect.w, rect.h, 12, '#7a3f26');
    // The red awning.
    ctx.fillStyle = PALETTE.red;
    roundRectPath(ctx, rect.x, rect.y, rect.w, 34, 12);
    ctx.fill();
    ctx.fillStyle = '#fff3d6';
    for (let i = 0; i < 6; i += 1) {
      ctx.fillRect(rect.x + 12 + i * 48, rect.y + 26, 22, 8);
    }
    // The window and the bell.
    panel(ctx, rect.x + 20, rect.y + 46, rect.w - 40, rect.h - 58, 8, '#2e2118');
    ctx.fillStyle = '#f2b234';
    ctx.beginPath();
    ctx.arc(rect.x + rect.w - 44, rect.y + 62, 12, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(rect.x + rect.w - 48, rect.y + 62, 8, 6);
    const carrying = state.chef.plate;
    const recipe = carrying ? completedRecipe(carrying.items) : null;
    const order = matchingOrder(state, recipe);
    if (carrying && order) {
      text(ctx, `${recipe.name} — serve it!`, rect.x + rect.w / 2, rect.y + 92, 16, '#ffe9a8', 'center', '800');
      text(ctx, `E to serve · +${recipe.points} pts`, rect.x + rect.w / 2, rect.y + 116, 13, '#ffe9a8', 'center', '600');
    } else if (carrying) {
      text(ctx, 'No order for this dish', rect.x + rect.w / 2, rect.y + 92, 15, '#ffb0a0', 'center', '700');
      text(ctx, 'Check the board — or Q to dump', rect.x + rect.w / 2, rect.y + 116, 12, '#e8c9a8', 'center', '600');
    } else {
      text(ctx, 'Bring a finished plate', rect.x + rect.w / 2, rect.y + 92, 15, '#e8c9a8', 'center', '600');
      text(ctx, 'and press E to serve', rect.x + rect.w / 2, rect.y + 116, 13, '#e8c9a8', 'center', '600');
    }
  }

  function drawPantry(state, highlight) {
    const rect = STATIONS.bins.rect;
    drawStationLabel({ x: rect.x, y: rect.y, w: rect.w, h: rect.h }, 'PANTRY  ·  press E (or keys 1–6) to grab', highlight);
    const width = rect.w / BIN_ORDER.length;
    BIN_ORDER.forEach((kind, index) => {
      const bx = rect.x + index * width;
      const def = INGREDIENTS[kind];
      const near = nearestBinKind(state.chef.x) === kind && state.chef.y > rect.y - 40;
      panel(ctx, bx + 4, rect.y, width - 8, rect.h, 10, near ? '#b57a3e' : PALETTE.counter);
      panel(ctx, bx + 10, rect.y + 6, width - 20, rect.h - 12, 8, '#f7e8c9');
      drawIngredient(ctx, kind, bx + width / 2, rect.y + 52, 56);
      text(ctx, def.bin, bx + width / 2, rect.y + 96, 15, PALETTE.text, 'center', '800');
      text(ctx, `key ${def.key}`, bx + width / 2, rect.y + 116, 12, PALETTE.muted, 'center', '600');
    });
  }

  function drawChef(state) {
    const chef = state.chef;
    const bob = Math.sin(state.time * 4) * 1.5;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(chef.x, chef.y + 30, 30, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body: white coat, blue apron.
    ctx.fillStyle = PALETTE.chefCoat;
    roundRectPath(ctx, chef.x - 22, chef.y - 6 + bob, 44, 34, 12);
    ctx.fill();
    ctx.fillStyle = PALETTE.chefApron;
    roundRectPath(ctx, chef.x - 15, chef.y + 6 + bob, 30, 22, 8);
    ctx.fill();
    // Head and hat.
    ctx.fillStyle = PALETTE.chefSkin;
    ctx.beginPath();
    ctx.arc(chef.x, chef.y - 20 + bob, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e2118';
    circle(ctx, chef.x - 5, chef.y - 22 + bob, 1.8, '#2e2118');
    circle(ctx, chef.x + 5, chef.y - 22 + bob, 1.8, '#2e2118');
    ctx.strokeStyle = '#2e2118';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(chef.x, chef.y - 16 + bob, 5, 0.3, Math.PI - 0.3);
    ctx.stroke();
    // The tall chef's hat.
    ctx.fillStyle = PALETTE.chefHat;
    roundRectPath(ctx, chef.x - 14, chef.y - 46 + bob, 28, 14, 6);
    ctx.fill();
    circle(ctx, chef.x - 9, chef.y - 46 + bob, 7, PALETTE.chefHat);
    circle(ctx, chef.x, chef.y - 50 + bob, 8, PALETTE.chefHat);
    circle(ctx, chef.x + 9, chef.y - 46 + bob, 7, PALETTE.chefHat);
    // What the chef carries: a finished plate rides overhead.
    if (chef.plate) {
      drawDish(ctx, chef.plate.items, chef.x, chef.y - 62 + bob, 64);
    }
  }

  function drawParticles(state) {
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(0, 1 - particle.t / particle.life);
      ctx.fillStyle = particle.colour;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const popup of state.popups) {
      ctx.globalAlpha = Math.max(0, 1 - popup.t / 1.4);
      text(ctx, popup.text, popup.x, popup.y - popup.t * 40, 20, popup.colour, 'center', '800');
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, nearest) {
    // Hands tray, bottom left.
    panel(ctx, 20, 606, 300, 96, 12, 'rgba(46,33,24,0.85)');
    text(ctx, 'HANDS', 36, 626, 13, '#f2b234', 'left', '800');
    for (let i = 0; i < CHEF.hands; i += 1) {
      const slotX = 60 + i * 74;
      ctx.fillStyle = '#5a4028';
      roundRectPath(ctx, slotX - 28, 634, 56, 56, 10);
      ctx.fill();
      const item = state.chef.hands[i];
      if (item) {
        drawIngredient(ctx, item, slotX, 662, 44);
        text(ctx, ingredientName(item), slotX, 700, 10, '#fff3d6', 'center', '600');
      }
    }
    // Combo badge.
    if (state.combo >= 2) {
      panel(ctx, 340, 606, 190, 96, 12, 'rgba(217,79,48,0.9)');
      text(ctx, `COMBO x${state.combo}`, 435, 640, 26, '#ffffff', 'center', '800');
      text(ctx, 'serve on time to grow it', 435, 672, 13, '#ffe9d6', 'center', '600');
    } else {
      panel(ctx, 340, 606, 190, 96, 12, 'rgba(46,33,24,0.85)');
      text(ctx, 'COMBO', 435, 640, 20, '#f2b234', 'center', '800');
      text(ctx, 'serve dishes on time', 435, 672, 13, '#d9c9a8', 'center', '600');
    }
    // Served / missed counts.
    panel(ctx, 550, 606, 190, 96, 12, 'rgba(46,33,24,0.85)');
    text(ctx, `SERVED ${state.served}`, 645, 640, 20, '#b8e6b0', 'center', '800');
    text(ctx, `Missed ${state.failed}`, 645, 672, 13, '#e8c9a8', 'center', '600');
    // Controls, bottom right.
    text(ctx, 'WASD / arrows — walk', 1260, 626, 14, '#fff3d6', 'right', '600');
    text(ctx, 'E — use station (hold to chop)', 1260, 648, 14, '#fff3d6', 'right', '600');
    text(ctx, 'Click a station — walk there · Q dump · P pause · M mute', 1260, 670, 14, '#fff3d6', 'right', '600');
    text(ctx, nearest ? `Near: ${nearest.toUpperCase()} — press E` : 'Walk up to a station to use it', 1260, 694, 13, '#f2b234', 'right', '700');
    // The menu, for planning at a glance.
    text(ctx, 'MENU: Salad · Melt · Soup · Burger · Veggie Stack · Double Stack', 640, 712, 12, '#fff3d6', 'center', '600');
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(46,33,24,0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(ctx, 290, 130, 700, 440, 20, 'rgba(255,248,231,0.97)');
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 4;
    roundRectPath(ctx, 290, 130, 700, 440, 20);
    ctx.stroke();
    text(ctx, 'SIMMER STATION', 640, 190, 58, PALETTE.red, 'center', '800');
    text(ctx, 'A timed cooking game', 640, 232, 22, PALETTE.muted, 'center', '600');
    drawDish(ctx, ['bun', 'patty_grilled', 'tomato_chopped', 'lettuce_chopped'], 640, 300, 130);
    text(ctx, 'Orders arrive on the board. Chop, grill, plate, serve —', 640, 372, 18, PALETTE.text, 'center', '600');
    text(ctx, 'before the ticket timer runs out. Rush hour is coming.', 640, 398, 18, PALETTE.text, 'center', '600');
    text(ctx, 'WASD or arrows to walk · E to use a station · Q to dump · P to pause', 640, 436, 16, PALETTE.muted, 'center', '600');
    const blink = Math.sin(state.time * 4) > -0.2;
    if (blink) text(ctx, 'Press SPACE or click to start cooking', 640, 486, 22, PALETTE.red, 'center', '800');
    text(ctx, `Best shift: ${best} pts`, 640, 528, 15, PALETTE.muted, 'center', '600');
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(46,33,24,0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(ctx, 440, 280, 400, 160, 16, PALETTE.ticket);
    text(ctx, 'PAUSED', 640, 330, 40, PALETTE.text, 'center', '800');
    text(ctx, 'Press P to keep cooking', 640, 378, 18, PALETTE.muted, 'center', '600');
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(46,33,24,0.5)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(ctx, 340, 120, 600, 470, 20, 'rgba(255,248,231,0.98)');
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 4;
    roundRectPath(ctx, 340, 120, 600, 470, 20);
    ctx.stroke();
    text(ctx, 'SHIFT OVER!', 640, 172, 48, PALETTE.red, 'center', '800');
    text(ctx, `You are a ${rankForScore(state.score)}`, 640, 216, 22, PALETTE.text, 'center', '700');
    text(ctx, `Score  ${state.score}`, 640, 272, 34, PALETTE.text, 'center', '800');
    text(ctx, `Dishes served  ${state.served}      Missed  ${state.failed}`, 640, 322, 19, PALETTE.muted, 'center', '600');
    text(ctx, `Best combo  x${state.bestCombo}`, 640, 356, 19, PALETTE.muted, 'center', '600');
    text(ctx, `Best shift  ${best} pts`, 640, 390, 19, PALETTE.muted, 'center', '600');
    const blink = Math.sin(state.time * 4) > -0.2;
    if (blink) text(ctx, 'Press R to cook another shift', 640, 448, 22, PALETTE.red, 'center', '800');
    text(ctx, 'Tip: serve fast, keep the combo alive, mind the grill.', 640, 500, 15, PALETTE.muted, 'center', '600');
  }

  /** Paint one frame: the kitchen, then the screen on top of it. */
  function draw(state, screen, best, nearest) {
    fit();
    drawBackground();
    drawOrderBoard(state);
    drawTopBar(state, best);
    drawChopBoard(state, nearest === 'chop');
    drawGrill(state, nearest === 'grill');
    drawPlateCounter(state, nearest === 'plate');
    drawServeWindow(state, nearest === 'serve');
    drawPantry(state, nearest === 'bins');
    drawChef(state);
    drawParticles(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, nearest);
    if (state.banner) {
      panel(ctx, 380, 300, 520, 54, 12, 'rgba(217,79,48,0.92)');
      text(ctx, state.banner.text, 640, 328, 22, '#ffffff', 'center', '800');
    }
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(217,79,48,${state.flash * 0.22})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
  }

  return { draw, toLogical };
}
