export type TileKind = 'grass' | 'path' | 'water';

// Kenney roguelike tileset info
export const KENNEY_TILE_SIZE = 16;
export const KENNEY_MARGIN = 1;

// We use a small hand-picked set of sprite indices (col,row) in the atlas.
export type AtlasPos = { col: number; row: number };

export type TileVariant = {
  base: AtlasPos;
  alt?: AtlasPos[]; // random alternates
};

// ── Issue #53: Curated tile indices from atlas analysis ─────────────────────
// Picked via pixel analysis of roguelikeSheet.png (RGB averages + visual check).
// Grass: bright green fills from rows 12-16 (clean, no decorations).
// Path: solid brown fills from rows 4-5 (consistent earth tones).
// Water: cyan fills from cols 0-1, rows 0-4 (deep blue, uniform).

export const TILESET: Record<TileKind, TileVariant> = {
  grass: {
    base: { col: 1, row: 15 },    // rgb(123,173,44) — bright clean green
    alt: [
      { col: 0, row: 16 },         // rgb(123,172,44) — near-identical variant
      { col: 1, row: 16 },         // rgb(123,173,44)
      { col: 3, row: 16 },         // rgb(123,173,44)
      { col: 0, row: 12 },         // rgb(101,159,87) — slightly darker, adds depth
      { col: 1, row: 13 },         // rgb(108,163,70) — subtle shade variation
    ],
  },
  path: {
    base: { col: 5, row: 4 },     // rgb(179,134,90) — warm brown
    alt: [
      { col: 6, row: 4 },          // rgb(179,134,90) — same tone, different detail
      { col: 7, row: 4 },          // rgb(181,136,92) — slightly lighter
      { col: 8, row: 4 },          // rgb(181,136,92)
      { col: 5, row: 5 },          // rgb(173,130,87) — slightly darker
      { col: 6, row: 5 },          // rgb(173,130,87)
    ],
  },
  water: {
    base: { col: 0, row: 0 },     // rgb(99,197,207) — deep cyan fill
    alt: [
      { col: 1, row: 0 },          // rgb(99,197,207) — identical fill
      { col: 3, row: 1 },          // rgb(99,197,207) — another fill
      { col: 3, row: 4 },          // rgb(99,197,207) — fill variant
    ],
  },
};

// ── Issue #54 & #55: Autotile edge/corner atlas positions ───────────────────
// Water autotile lives at cols 0-4, rows 0-2 in the atlas:
//   (0,0) fill    (1,0) fill    (2,0) outer-TL  (3,0) outer-T   (4,0) outer-TR
//   (0,1) inn-BR  (1,1) inn-BL  (2,1) outer-L   (3,1) fill      (4,1) outer-R
//   (0,2) inn-TR  (1,2) inn-TL  (2,2) outer-BL  (3,2) outer-B   (4,2) outer-BR
//
// "outer" = convex corner/edge where grass wraps INTO the water shape
// "inner" = concave corner where grass pokes into a water body corner

export type AutotileSet = {
  fill: AtlasPos;
  // Outer edges (terrain border wraps around the tile type)
  outerT: AtlasPos;
  outerB: AtlasPos;
  outerL: AtlasPos;
  outerR: AtlasPos;
  outerTL: AtlasPos;
  outerTR: AtlasPos;
  outerBL: AtlasPos;
  outerBR: AtlasPos;
  // Inner corners (diagonal-only adjacency — grass in one corner)
  innerTL: AtlasPos;
  innerTR: AtlasPos;
  innerBL: AtlasPos;
  innerBR: AtlasPos;
};

export const WATER_AUTOTILE: AutotileSet = {
  fill:    { col: 0, row: 0 },
  outerTL: { col: 2, row: 0 },
  outerT:  { col: 3, row: 0 },
  outerTR: { col: 4, row: 0 },
  outerL:  { col: 2, row: 1 },
  outerR:  { col: 4, row: 1 },
  outerBL: { col: 2, row: 2 },
  outerB:  { col: 3, row: 2 },
  outerBR: { col: 4, row: 2 },
  innerTL: { col: 1, row: 2 },
  innerTR: { col: 0, row: 2 },
  innerBL: { col: 1, row: 1 },
  innerBR: { col: 0, row: 1 },
};

// ── Neighbor bitmask helpers ────────────────────────────────────────────────
// 4-directional bits
const N = 1, E = 2, S = 4, W = 8;
// Diagonal bits (for inner corners)
const NE = 16, SE = 32, SW = 64, NW = 128;

/**
 * Pick the right atlas position for a water tile based on its 8-neighbor mask.
 * `mask` encodes which neighbors are ALSO water (same-type).
 */
export function waterAutotilePos(mask: number): AtlasPos {
  const at = WATER_AUTOTILE;
  const hasN = !!(mask & N), hasE = !!(mask & E), hasS = !!(mask & S), hasW = !!(mask & W);
  const hasNE = !!(mask & NE), hasSE = !!(mask & SE), hasSW = !!(mask & SW), hasNW = !!(mask & NW);

  // Outer corners (two adjacent sides are non-water)
  if (!hasN && !hasW) return at.outerTL;
  if (!hasN && !hasE) return at.outerTR;
  if (!hasS && !hasW) return at.outerBL;
  if (!hasS && !hasE) return at.outerBR;

  // Outer edges (one side is non-water)
  if (!hasN) return at.outerT;
  if (!hasS) return at.outerB;
  if (!hasW) return at.outerL;
  if (!hasE) return at.outerR;

  // Inner corners (all 4 cardinal neighbors are water, but a diagonal is not)
  if (!hasNW) return at.innerTL;
  if (!hasNE) return at.innerTR;
  if (!hasSW) return at.innerBL;
  if (!hasSE) return at.innerBR;

  // Fully surrounded — use fill
  return at.fill;
}

/**
 * Compute the 8-neighbor bitmask for a tile at (tx,ty).
 * Returns which neighbors match `kind`.
 */
export function neighborMask(
  map: TileKind[],
  cols: number,
  rows: number,
  tx: number,
  ty: number,
  kind: TileKind,
): number {
  let mask = 0;
  const at = (dx: number, dy: number) => {
    const nx = tx + dx, ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return false;
    return map[ny * cols + nx] === kind;
  };
  if (at(0, -1)) mask |= N;
  if (at(1, 0))  mask |= E;
  if (at(0, 1))  mask |= S;
  if (at(-1, 0)) mask |= W;
  if (at(1, -1)) mask |= NE;
  if (at(1, 1))  mask |= SE;
  if (at(-1, 1)) mask |= SW;
  if (at(-1, -1)) mask |= NW;
  return mask;
}

// ── Path autotile (procedural — no atlas edge sprites available) ────────────
// For paths, we draw the fill tile and add a 2px grass-colored inset border
// on edges that face grass. This creates a soft "worn trail" look without
// needing dedicated edge sprites.

export type PathEdgeInfo = {
  pos: AtlasPos;       // fill tile to draw
  edgeN: boolean;
  edgeE: boolean;
  edgeS: boolean;
  edgeW: boolean;
};

export function pathEdgeInfo(
  map: TileKind[],
  cols: number,
  rows: number,
  tx: number,
  ty: number,
): PathEdgeInfo {
  const mask = neighborMask(map, cols, rows, tx, ty, 'path');
  const h = (tx * 73856093) ^ (ty * 19349663) ^ 7;
  const alts = TILESET.path.alt || [];
  const pos = alts.length ? alts[Math.abs(h) % alts.length] : TILESET.path.base;
  return {
    pos,
    edgeN: !(mask & N),
    edgeE: !(mask & E),
    edgeS: !(mask & S),
    edgeW: !(mask & W),
  };
}

// ── Props ───────────────────────────────────────────────────────────────────

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

  // Water pond — elliptical
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
