// Simmer Station: every tuning number, colour, ingredient and recipe in one place.
// The kitchen is a fixed 1280x720 logical area; the renderer scales it to the window,
// so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** One full shift, in seconds. */
export const SHIFT_SECONDS = 150;

/** Rush hour starts this far into the shift: orders arrive faster and timers run shorter. */
export const RUSH_AT_SECONDS = 75;

/** The chef's walk speed, in pixels per second, and how many items the hands hold. */
export const CHEF = { speed: 340, radius: 26, hands: 3 };

/** How long chopping one vegetable takes while the player holds the action key. */
export const CHOP_SECONDS = 1.6;

/** A patty on the grill: done after this many seconds, burnt this long after that. */
export const GRILL_SECONDS = 5;
export const GRILL_BURN_SECONDS = 7;

/** Orders: a new ticket every spawn interval, at most this many on the board at once. */
export const ORDERS = { maxTickets: 4, spawnFirst: 4, spawnSeconds: 13, spawnRushSeconds: 8 };

/** Points for serving a dish on time, plus a bonus for time left on its ticket. */
export const SCORE = { timeBonus: 60, comboBonus: 15 };

export const PALETTE = {
  wall: '#f7e8c9',
  wallTrim: '#e8c98f',
  floor: '#c98d4b',
  floorDark: '#b57a3e',
  counter: '#8a5a2b',
  counterTop: '#a9743f',
  board: '#3d2b1f',
  ticket: '#fff8e7',
  ticketEdge: '#d9b36c',
  text: '#2e2118',
  muted: '#7a5c3e',
  cream: '#fff3d6',
  red: '#d94f30',
  green: '#4e9a51',
  gold: '#f2b234',
  blue: '#3f7fbf',
  chefHat: '#ffffff',
  chefCoat: '#fdfdfd',
  chefSkin: '#f2c094',
  chefApron: '#2f6db3',
};

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'simmer-station.best';

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/**
 * Every ingredient the kitchen stocks. `chop` names the item chopping makes,
 * `grill` names the item grilling makes; a plain ingredient is used as it is.
 */
export const INGREDIENTS = {
  bun: { name: 'Bun', colour: '#e8a94e', key: '1', bin: 'Buns' },
  patty: { name: 'Patty', colour: '#a85b3a', key: '2', bin: 'Patties', grill: 'patty_grilled' },
  tomato: { name: 'Tomato', colour: '#e0483e', key: '3', bin: 'Tomatoes', chop: 'tomato_chopped' },
  lettuce: { name: 'Lettuce', colour: '#69b455', key: '4', bin: 'Lettuce', chop: 'lettuce_chopped' },
  cheese: { name: 'Cheese', colour: '#f2c230', key: '5', bin: 'Cheese' },
  onion: { name: 'Onion', colour: '#e8d9f2', key: '6', bin: 'Onions', chop: 'onion_chopped' },
  tomato_chopped: { name: 'Chopped Tomato', colour: '#e0483e', processed: true },
  lettuce_chopped: { name: 'Chopped Lettuce', colour: '#69b455', processed: true },
  onion_chopped: { name: 'Chopped Onion', colour: '#e8d9f2', processed: true },
  patty_grilled: { name: 'Grilled Patty', colour: '#7a3f26', processed: true },
};

/** The order in which the bins stand along the bottom counter. */
export const BIN_ORDER = ['bun', 'patty', 'tomato', 'lettuce', 'cheese', 'onion'];

/**
 * The menu: six dishes, each a different combination of the same pantry, so the
 * player plans a route through the kitchen instead of repeating one motion.
 * `items` is the exact multiset the plate must hold; `seconds` is the ticket time.
 */
export const RECIPES = [
  { id: 'salad', name: 'Garden Salad', items: ['tomato_chopped', 'lettuce_chopped'], seconds: 42, points: 100 },
  { id: 'melt', name: 'Cheese Melt', items: ['bun', 'patty_grilled', 'cheese'], seconds: 48, points: 140 },
  { id: 'soup', name: 'Golden Onion Soup', items: ['onion_chopped', 'tomato_chopped', 'cheese'], seconds: 52, points: 160 },
  { id: 'burger', name: 'Simmer Burger', items: ['bun', 'patty_grilled', 'tomato_chopped', 'lettuce_chopped'], seconds: 58, points: 200 },
  { id: 'veggie', name: 'Veggie Stack', items: ['bun', 'lettuce_chopped', 'tomato_chopped', 'cheese', 'onion_chopped'], seconds: 64, points: 220 },
  { id: 'double', name: 'Double Stack', items: ['bun', 'patty_grilled', 'patty_grilled', 'cheese', 'onion_chopped'], seconds: 68, points: 260 },
];

/**
 * Where every station sits. `anchor` is where the chef stands to use it;
 * `rect` is what the renderer draws. Bins are computed from BIN_ORDER.
 */
export const STATIONS = {
  chop: { label: 'CHOP', rect: { x: 40, y: 150, w: 260, h: 140 }, anchor: { x: 170, y: 330 } },
  grill: { label: 'GRILL', rect: { x: 340, y: 150, w: 260, h: 140 }, anchor: { x: 470, y: 330 } },
  plate: { label: 'PLATE UP', rect: { x: 640, y: 150, w: 260, h: 140 }, anchor: { x: 770, y: 330 } },
  serve: { label: 'SERVE', rect: { x: 940, y: 150, w: 300, h: 140 }, anchor: { x: 1090, y: 330 } },
  bins: { label: 'PANTRY', rect: { x: 40, y: 420, w: 1200, h: 130 }, anchor: { x: 640, y: 590 } },
};

/** The pixel distance inside which the chef can use a station. */
export const REACH = 110;
