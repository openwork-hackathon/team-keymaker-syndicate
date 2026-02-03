export type TileKind = 'grass' | 'path' | 'water';

// Kenney roguelike tileset info
export const KENNEY_TILE_SIZE = 16;
export const KENNEY_MARGIN = 1;

// We use a small hand-picked set of sprite indices (col,row) in the atlas.
// NOTE: This is intentionally minimal; adjust indices after visual check.
export type AtlasPos = { col: number; row: number };

export type TileVariant = {
  base: AtlasPos;
  alt?: AtlasPos[]; // random alternates
};

// Guessable, but we'll keep simple and fix visually.
// Tile indices chosen by sampling average RGB values from the atlas (to avoid accidentally
// using decorative/edge tiles like the previous "water border" look). These can be tweaked
// visually via /atlas.html.
export const TILESET: Record<TileKind, TileVariant> = {
  grass: {
    // vivid green ground (candidates: (0..3,15..16))
    base: { col: 0, row: 15 },
    alt: [
      { col: 1, row: 15 },
      { col: 0, row: 16 },
      { col: 1, row: 16 },
      { col: 3, row: 16 },
    ],
  },
  path: {
    // earthy brown ground (candidates: (17,9..10), (14,10), (20,9))
    base: { col: 17, row: 9 },
    alt: [
      { col: 17, row: 10 },
      { col: 14, row: 10 },
      { col: 20, row: 9 },
      { col: 11, row: 14 },
    ],
  },
  water: {
    // blue water fill (candidate: (2,3) is strongly blue; keep a couple nearby alternates)
    base: { col: 2, row: 3 },
    alt: [
      { col: 1, row: 3 },
      { col: 3, row: 3 },
      { col: 2, row: 4 },
    ],
  },
};

export type PropKind = 'tree' | 'rock' | 'flower' | 'sign' | 'barrel';

export type Prop = {
  kind: PropKind;
  x: number; // world coords
  y: number;
};

export type WorldTilemap = {
  worldW: number;
  worldH: number;
  tilePx: number;
  cols: number;
  rows: number;
  map: TileKind[];
  props: Prop[];
};

export function makeWorldTilemap(worldW: number, worldH: number, tilePx: number): WorldTilemap {
  const cols = Math.floor(worldW / tilePx);
  const rows = Math.floor(worldH / tilePx);
  const map: TileKind[] = Array(cols * rows).fill('grass');

  const set = (x: number, y: number, k: TileKind) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    map[y * cols + x] = k;
  };

  const line = (x0: number, y0: number, x1: number, y1: number, k: TileKind) => {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0, y = y0;
    for (;;) {
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) set(x + ox, y + oy, k);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  };

  // Water pond
  const cx = Math.floor(cols * 0.25);
  const cy = Math.floor(rows * 0.80);
  for (let y = cy - 5; y <= cy + 5; y++) {
    for (let x = cx - 7; x <= cx + 7; x++) {
      const d = ((x - cx) * (x - cx)) / 49 + ((y - cy) * (y - cy)) / 25;
      if (d <= 1) set(x, y, 'water');
    }
  }

  // Paths connecting landmarks
  const toCell = (wx: number, wy: number) => ({ x: Math.floor(wx / tilePx), y: Math.floor(wy / tilePx) });
  const docks = toCell(460, 1360);
  const hall = toCell(1080, 760);
  const market = toCell(860, 980);
  const mint = toCell(1520, 1020);
  line(docks.x, docks.y, hall.x, hall.y, 'path');
  line(market.x, market.y, hall.x, hall.y, 'path');
  line(mint.x, mint.y, hall.x, hall.y, 'path');
  line(market.x, market.y, docks.x, docks.y, 'path');

  // Generate scattered props
  const props: Prop[] = [];
  const seededRand = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  };
  const rand = seededRand(42);

  // Scatter trees in outskirts (left/bottom area)
  for (let i = 0; i < 45; i++) {
    const x = 100 + rand() * 700;
    const y = 900 + rand() * 600;
    // Don't place on water or paths
    const tx = Math.floor(x / tilePx);
    const ty = Math.floor(y / tilePx);
    if (tx >= 0 && ty >= 0 && tx < cols && ty < rows) {
      const tile = map[ty * cols + tx];
      if (tile === 'grass') {
        props.push({ kind: 'tree', x, y });
      }
    }
  }

  // Scatter rocks near paths and outskirts
  for (let i = 0; i < 25; i++) {
    const x = 200 + rand() * 1800;
    const y = 400 + rand() * 1100;
    const tx = Math.floor(x / tilePx);
    const ty = Math.floor(y / tilePx);
    if (tx >= 0 && ty >= 0 && tx < cols && ty < rows) {
      const tile = map[ty * cols + tx];
      if (tile === 'grass') {
        props.push({ kind: 'rock', x, y });
      }
    }
  }

  // Flowers scattered lightly
  for (let i = 0; i < 20; i++) {
    const x = 300 + rand() * 1400;
    const y = 500 + rand() * 900;
    const tx = Math.floor(x / tilePx);
    const ty = Math.floor(y / tilePx);
    if (tx >= 0 && ty >= 0 && tx < cols && ty < rows) {
      const tile = map[ty * cols + tx];
      if (tile === 'grass') {
        props.push({ kind: 'flower', x, y });
      }
    }
  }

  // Signs near landmarks
  props.push({ kind: 'sign', x: 500, y: 1320 }); // near docks
  props.push({ kind: 'sign', x: 1040, y: 800 }); // near town hall
  props.push({ kind: 'barrel', x: 820, y: 950 }); // near market
  props.push({ kind: 'barrel', x: 880, y: 1010 }); // near market

  return { worldW, worldH, tilePx, cols, rows, map, props };
}

export function atlasSrcRect(pos: AtlasPos) {
  const tile = KENNEY_TILE_SIZE;
  const m = KENNEY_MARGIN;
  return {
    sx: m + pos.col * (tile + m),
    sy: m + pos.row * (tile + m),
    sw: tile,
    sh: tile,
  };
}
