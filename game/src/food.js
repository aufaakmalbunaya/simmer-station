// Every morsel in Simmer Station is drawn in code, chunky and warm: no image
// files, just canvas shapes. drawIngredient paints one item; drawDish paints a
// whole plate, stacking the items so a finished dish reads at a glance.

import { INGREDIENTS } from './config.js';

/** Draw a filled circle. */
function circle(ctx, x, y, radius, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw a filled rounded rectangle. */
function roundRect(ctx, x, y, w, h, r, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** A bun: a golden dome with sesame seeds. */
function drawBun(ctx, x, y, s) {
  roundRect(ctx, x - s * 0.52, y - s * 0.1, s * 1.04, s * 0.42, s * 0.2, '#d98f35');
  ctx.fillStyle = '#f0b45c';
  ctx.beginPath();
  ctx.arc(x, y - s * 0.08, s * 0.5, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#fff3d6';
  for (const [dx, dy] of [[-0.24, -0.3], [0, -0.42], [0.24, -0.3], [-0.1, -0.2], [0.14, -0.18]]) {
    circle(ctx, x + dx * s, y + dy * s, s * 0.045, '#fff3d6');
  }
}

/** A patty: a brown slab with grill stripes; grilled is darker, with char lines. */
function drawPatty(ctx, x, y, s, grilled) {
  roundRect(ctx, x - s * 0.5, y - s * 0.22, s, s * 0.44, s * 0.16, grilled ? '#7a3f26' : '#a85b3a');
  ctx.strokeStyle = grilled ? '#4a2413' : '#7a3f26';
  ctx.lineWidth = Math.max(2, s * 0.05);
  ctx.beginPath();
  for (const dx of [-0.28, 0, 0.28]) {
    ctx.moveTo(x + dx * s, y - s * 0.16);
    ctx.lineTo(x + dx * s, y + s * 0.16);
  }
  ctx.stroke();
}

/** A tomato: a red round with a green star; chopped is three wedges. */
function drawTomato(ctx, x, y, s, chopped) {
  if (chopped) {
    for (let i = 0; i < 3; i += 1) {
      const angle = -Math.PI / 2 + (i - 1) * 0.7;
      ctx.fillStyle = i === 1 ? '#e0483e' : '#c93a32';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, s * 0.48, angle - 0.32, angle + 0.32);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#f2b234';
    circle(ctx, x, y, s * 0.1, '#f2b234');
    return;
  }
  circle(ctx, x, y, s * 0.48, '#e0483e');
  ctx.fillStyle = '#69b455';
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.42);
  ctx.lineTo(x - s * 0.2, y - s * 0.62);
  ctx.lineTo(x, y - s * 0.5);
  ctx.lineTo(x + s * 0.2, y - s * 0.62);
  ctx.closePath();
  ctx.fill();
  circle(ctx, x - s * 0.16, y - s * 0.14, s * 0.09, '#f07a6a');
}

/** Lettuce: a ruffled green leaf; chopped is a pile of shreds. */
function drawLettuce(ctx, x, y, s, chopped) {
  if (chopped) {
    ctx.strokeStyle = '#69b455';
    ctx.lineWidth = Math.max(2, s * 0.09);
    ctx.lineCap = 'round';
    for (const [dx, dy, len] of [[-0.2, -0.1, 0.3], [0.05, -0.22, 0.34], [0.26, 0.02, 0.3], [-0.05, 0.2, 0.32], [0.22, 0.24, 0.26]]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * s - len * s * 0.5, y + dy * s);
      ctx.lineTo(x + dx * s + len * s * 0.5, y + dy * s);
      ctx.stroke();
    }
    return;
  }
  ctx.fillStyle = '#69b455';
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.5, s * 0.38, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8ed07a';
  ctx.beginPath();
  ctx.ellipse(x - s * 0.06, y - s * 0.06, s * 0.34, s * 0.24, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4e9a51';
  ctx.lineWidth = Math.max(2, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.34, y + s * 0.26);
  ctx.quadraticCurveTo(x, y - s * 0.1, x + s * 0.34, y - s * 0.3);
  ctx.stroke();
}

/** Cheese: a yellow wedge with holes. */
function drawCheese(ctx, x, y, s) {
  ctx.fillStyle = '#f2c230';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y + s * 0.28);
  ctx.lineTo(x + s * 0.5, y + s * 0.28);
  ctx.lineTo(x + s * 0.5, y - s * 0.05);
  ctx.lineTo(x - s * 0.5, y - s * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d9a41f';
  circle(ctx, x - s * 0.2, y + s * 0.08, s * 0.08, '#d9a41f');
  circle(ctx, x + s * 0.18, y + s * 0.12, s * 0.06, '#d9a41f');
  circle(ctx, x + s * 0.05, y - s * 0.08, s * 0.05, '#d9a41f');
}

/** An onion: pale rings with a purple skin; chopped is small rings. */
function drawOnion(ctx, x, y, s, chopped) {
  if (chopped) {
    ctx.strokeStyle = '#c9a8e0';
    ctx.lineWidth = Math.max(2, s * 0.07);
    for (const [dx, dy, r] of [[-0.2, -0.08, 0.2], [0.14, -0.16, 0.16], [0.05, 0.16, 0.18], [0.28, 0.12, 0.12]]) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  circle(ctx, x, y, s * 0.46, '#e8d9f2');
  ctx.strokeStyle = '#c9a8e0';
  ctx.lineWidth = Math.max(2, s * 0.05);
  for (const r of [0.34, 0.22]) {
    ctx.beginPath();
    ctx.arc(x, y, r * s, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#69b455';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.12, y - s * 0.44);
  ctx.lineTo(x, y - s * 0.66);
  ctx.lineTo(x + s * 0.12, y - s * 0.44);
  ctx.closePath();
  ctx.fill();
}

/** Paint one ingredient, centred at (x, y), about `size` pixels across. */
export function drawIngredient(ctx, kind, x, y, size) {
  const s = size;
  switch (kind) {
    case 'bun': drawBun(ctx, x, y, s); break;
    case 'patty': drawPatty(ctx, x, y, s, false); break;
    case 'patty_grilled': drawPatty(ctx, x, y, s, true); break;
    case 'tomato': drawTomato(ctx, x, y, s, false); break;
    case 'tomato_chopped': drawTomato(ctx, x, y, s, true); break;
    case 'lettuce': drawLettuce(ctx, x, y, s, false); break;
    case 'lettuce_chopped': drawLettuce(ctx, x, y, s, true); break;
    case 'cheese': drawCheese(ctx, x, y, s); break;
    case 'onion': drawOnion(ctx, x, y, s, false); break;
    case 'onion_chopped': drawOnion(ctx, x, y, s, true); break;
    default: circle(ctx, x, y, s * 0.4, '#888888');
  }
}

/** The name shown under an item, for tooltips and the hands tray. */
export function ingredientName(kind) {
  return INGREDIENTS[kind]?.name ?? kind;
}

/**
 * Paint a plate of food: a white plate with the dish's items stacked on it, so a
 * half-built dish and a finished one look different at a glance.
 */
export function drawDish(ctx, items, x, y, size) {
  const plateRadius = size * 0.5;
  ctx.fillStyle = '#fdfdf8';
  ctx.beginPath();
  ctx.ellipse(x, y, plateRadius, plateRadius * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d9c9a8';
  ctx.lineWidth = Math.max(2, size * 0.02);
  ctx.beginPath();
  ctx.ellipse(x, y, plateRadius * 0.82, plateRadius * 0.26, 0, 0, Math.PI * 2);
  ctx.stroke();
  const itemSize = size * 0.42;
  const step = items.length > 1 ? size * 0.16 : 0;
  items.forEach((kind, index) => {
    const offset = (index - (items.length - 1) / 2) * step;
    drawIngredient(ctx, kind, x + offset, y - size * 0.08 - index * size * 0.03, itemSize);
  });
}
