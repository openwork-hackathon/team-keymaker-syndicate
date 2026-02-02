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
export const TILESET: Record<TileKind, TileVariant> = {
  grass: {
    base: { col: 0, row: 0 },
    alt: [
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 3, row: 0 },
    ],
  },
  path: {
    base: { col: 0, row: 1 },
    alt: [
      { col: 1, row: 1 },
      { col: 2, row: 1 },
    ],
  },
  water: {
    base: { col: 0, row: 2 },
    alt: [
      { col: 1, row: 2 },
      { col: 2, row: 2 },
    ],
  },
};

export type WorldTilemap = {
  worldW: number;
  worldH: number;
  tilePx: number;
  cols: number;
  rows: number;
  map: TileKind[];
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

  return { worldW, worldH, tilePx, cols, rows, map };
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
