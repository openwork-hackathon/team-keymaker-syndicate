'use client';

// Hot reload test comment 2
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentNode, LiveResponse } from '@/lib/types';
import { isLiveResponse } from '@/lib/types';
import { KENNEY_TILE_SIZE, atlasSrcRect, makeWorldTilemap, TILESET, type TileKind, type WorldTilemap, type Prop, type PropKind, neighborMask, waterAutotilePos, pathEdgeInfo } from '@/lib/tilemap';

type Star = { x: number; y: number; r: number; a: number };

type LayoutNode = {
  id: string;
  x: number; // world coords
  y: number;
  r: number;
  tier: Tier;
};

type Viewport = {
  x: number; // world-space offset (pan)
  y: number;
  scale: number;
};

type MotionState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  mode: 'spawning' | 'wandering';
  nextWanderAt: number;
};

type Tier = 'legendary' | 'notable' | 'rising' | 'new';

type District = {
  tier: Tier;
  label: string;
  color: { r: number; g: number; b: number };
  center: { x: number; y: number };
};

function scoreToTier(repScore: number): Tier {
  if (repScore >= 500) return 'legendary';
  if (repScore >= 200) return 'notable';
  if (repScore >= 100) return 'rising';
  return 'new';
}

function tierToDistrict(tier: Tier): District {
  // World bounds are 2400x1600. Centers create a “town” layout.
  switch (tier) {
    case 'legendary':
      return {
        tier,
        label: 'Citadel (Legendary)',
        color: { r: 255, g: 200, b: 80 },
        center: { x: 1680, y: 500 },
      };
    case 'notable':
      return {
        tier,
        label: 'Uptown (Notable)',
        color: { r: 90, g: 170, b: 255 },
        center: { x: 1320, y: 980 },
      };
    case 'rising':
      return {
        tier,
        label: 'Midtown (Rising)',
        color: { r: 170, g: 120, b: 255 },
        center: { x: 920, y: 680 },
      };
    default:
      return {
        tier,
        label: 'Outskirts (New)',
        color: { r: 255, g: 255, b: 255 },
        center: { x: 620, y: 1120 },
      };
  }
}

function scoreToVisual(repScore: number) {
  // Increase minimum size so agents stay legible against props/terrain
  const radius = Math.max(9, Math.min(38, Math.log(repScore + 1) * 6.6));
  const glow = repScore >= 500 ? 'gold' : repScore >= 200 ? 'blue' : repScore >= 100 ? 'violet' : 'none';
  const badge = repScore >= 500 ? '👑' : repScore >= 100 ? '⭐' : null;
  return { radius, glow, badge } as const;
}

function hashStringToU32(s: string): number {
  // FNV-1a-ish
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function worldToScreen(vp: Viewport, wx: number, wy: number) {
  return { x: (wx - vp.x) * vp.scale, y: (wy - vp.y) * vp.scale };
}

function screenToWorld(vp: Viewport, sx: number, sy: number) {
  return { x: sx / vp.scale + vp.x, y: sy / vp.scale + vp.y };
}

function rgba(c: { r: number; g: number; b: number }, a: number) {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

/**
 * Draw text with a dark halo/outline for readability over any background.
 * Uses 8-way offset technique for crisp pixel-art style outline.
 */
function drawTextWithHalo(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fillColor: string,
  haloColor = 'rgba(0,0,0,0.7)',
  haloSize = 1
) {
  // Draw halo in 8 directions
  ctx.fillStyle = haloColor;
  for (let ox = -haloSize; ox <= haloSize; ox++) {
    for (let oy = -haloSize; oy <= haloSize; oy++) {
      if (ox !== 0 || oy !== 0) {
        ctx.fillText(text, x + ox, y + oy);
      }
    }
  }
  // Draw main text on top
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
}

type SpritePalette = {
  skin: string;
  hair: string;
  cloth: string;
  metal: string;
  boot: string;
};

function tierToPalette(tier: Tier): SpritePalette {
  switch (tier) {
    case 'legendary':
      return { skin: '#F2C9A0', hair: '#1b120d', cloth: '#F5C542', metal: '#ECEEF4', boot: '#131826' };
    case 'notable':
      return { skin: '#F2C9A0', hair: '#152031', cloth: '#59B0FF', metal: '#E3E6EF', boot: '#131826' };
    case 'rising':
      return { skin: '#F2C9A0', hair: '#231534', cloth: '#B07AFF', metal: '#E3E6EF', boot: '#131826' };
    default:
      return { skin: '#F2C9A0', hair: '#2b2018', cloth: '#C8CBD6', metal: '#D7DAE4', boot: '#131826' };
  }
}

function drawPixel(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, py: number, size: number) {
  ctx.fillRect(x + px * size, y + py * size, size, size);
}

function drawRpgSprite(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, tier: Tier, frame: number) {
  // 16x16 pixel sprite. x,y = top-left in screen space.
  const size = Math.max(1, Math.floor(1.35 * scale));
  const pal = tierToPalette(tier);

  const bounce = frame % 2 === 0 ? 0 : 1;
  const footL = frame % 4 < 2 ? 1 : 0;
  const footR = frame % 4 < 2 ? 0 : 1;

  const ox = x;
  const oy = y - bounce * size;

  // head/hair
  ctx.fillStyle = pal.hair;
  for (let px = 5; px <= 10; px++) drawPixel(ctx, ox, oy, px, 1, size);
  for (let px = 4; px <= 11; px++) drawPixel(ctx, ox, oy, px, 2, size);

  // face
  ctx.fillStyle = pal.skin;
  for (let py = 3; py <= 6; py++) for (let px = 5; px <= 10; px++) drawPixel(ctx, ox, oy, px, py, size);

  // eyes
  ctx.fillStyle = '#0b1020';
  drawPixel(ctx, ox, oy, 6, 5, size);
  drawPixel(ctx, ox, oy, 9, 5, size);

  // body
  ctx.fillStyle = pal.cloth;
  for (let py = 7; py <= 12; py++) for (let px = 5; px <= 10; px++) drawPixel(ctx, ox, oy, px, py, size);
  for (let px = 4; px <= 11; px++) drawPixel(ctx, ox, oy, px, 7, size);

  // belt
  ctx.fillStyle = pal.metal;
  for (let px = 6; px <= 9; px++) drawPixel(ctx, ox, oy, px, 10, size);

  // legs
  ctx.fillStyle = '#222733';
  for (let py = 13; py <= 14; py++) {
    drawPixel(ctx, ox, oy, 6, py, size);
    drawPixel(ctx, ox, oy, 9, py, size);
  }

  // feet (walk)
  ctx.fillStyle = pal.boot;
  drawPixel(ctx, ox, oy, 5 + footL, 15, size);
  drawPixel(ctx, ox, oy, 8 + footR, 15, size);

  // crown flair
  if (tier === 'legendary') {
    ctx.fillStyle = '#F5C542';
    drawPixel(ctx, ox, oy, 6, 0, size);
    drawPixel(ctx, ox, oy, 8, 0, size);
    drawPixel(ctx, ox, oy, 7, 1, size);
  }
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const size = Math.max(1, Math.floor(1.25 * scale));
  // trunk
  ctx.fillStyle = '#5b3a1f';
  drawPixel(ctx, x, y, 7, 11, size);
  drawPixel(ctx, x, y, 8, 11, size);
  drawPixel(ctx, x, y, 7, 12, size);
  drawPixel(ctx, x, y, 8, 12, size);
  // leaves
  ctx.fillStyle = '#2e7d4f';
  for (let py = 5; py <= 10; py++) for (let px = 5; px <= 10; px++) drawPixel(ctx, x, y, px, py, size);
  ctx.fillStyle = '#3aa96b';
  for (let px = 6; px <= 9; px++) drawPixel(ctx, x, y, px, 6, size);
}

function drawHouse(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const size = Math.max(1, Math.floor(1.25 * scale));
  // roof
  ctx.fillStyle = '#7c2e3a';
  for (let px = 4; px <= 11; px++) drawPixel(ctx, x, y, px, 5, size);
  for (let px = 5; px <= 10; px++) drawPixel(ctx, x, y, px, 4, size);
  for (let px = 6; px <= 9; px++) drawPixel(ctx, x, y, px, 3, size);
  // walls
  ctx.fillStyle = '#c9c2b3';
  for (let py = 6; py <= 12; py++) for (let px = 5; px <= 10; px++) drawPixel(ctx, x, y, px, py, size);
  // door
  ctx.fillStyle = '#6b4a2b';
  for (let py = 10; py <= 12; py++) for (let px = 7; px <= 8; px++) drawPixel(ctx, x, y, px, py, size);
  // window
  ctx.fillStyle = '#5ab0ff';
  drawPixel(ctx, x, y, 6, 8, size);
  drawPixel(ctx, x, y, 9, 8, size);
}

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const size = Math.max(1, Math.floor(1.1 * scale));
  // gray rock
  ctx.fillStyle = '#5a5a5a';
  for (let px = 6; px <= 9; px++) drawPixel(ctx, x, y, px, 10, size);
  for (let px = 5; px <= 10; px++) drawPixel(ctx, x, y, px, 11, size);
  for (let px = 6; px <= 9; px++) drawPixel(ctx, x, y, px, 12, size);
  // highlight
  ctx.fillStyle = '#7a7a7a';
  drawPixel(ctx, x, y, 6, 10, size);
  drawPixel(ctx, x, y, 7, 10, size);
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, hue: number) {
  const size = Math.max(1, Math.floor(0.9 * scale));
  // stem
  ctx.fillStyle = '#2e6b3e';
  drawPixel(ctx, x, y, 7, 11, size);
  drawPixel(ctx, x, y, 7, 12, size);
  // petals (hue varies)
  const colors = ['#ff6b8a', '#ffb366', '#66b3ff', '#b366ff', '#ffff66'];
  ctx.fillStyle = colors[hue % colors.length];
  drawPixel(ctx, x, y, 6, 9, size);
  drawPixel(ctx, x, y, 8, 9, size);
  drawPixel(ctx, x, y, 7, 8, size);
  drawPixel(ctx, x, y, 7, 10, size);
  // center
  ctx.fillStyle = '#ffdd44';
  drawPixel(ctx, x, y, 7, 9, size);
}

function drawSign(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const size = Math.max(1, Math.floor(1.15 * scale));
  // post
  ctx.fillStyle = '#5b3a1f';
  drawPixel(ctx, x, y, 7, 9, size);
  drawPixel(ctx, x, y, 7, 10, size);
  drawPixel(ctx, x, y, 7, 11, size);
  drawPixel(ctx, x, y, 7, 12, size);
  // sign board
  ctx.fillStyle = '#c9a86c';
  for (let px = 4; px <= 10; px++) {
    drawPixel(ctx, x, y, px, 6, size);
    drawPixel(ctx, x, y, px, 7, size);
    drawPixel(ctx, x, y, px, 8, size);
  }
}

function drawBarrel(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const size = Math.max(1, Math.floor(1.1 * scale));
  // barrel body
  ctx.fillStyle = '#8b5a2b';
  for (let py = 7; py <= 12; py++) {
    for (let px = 5; px <= 10; px++) {
      drawPixel(ctx, x, y, px, py, size);
    }
  }
  // metal bands
  ctx.fillStyle = '#4a4a4a';
  for (let px = 5; px <= 10; px++) {
    drawPixel(ctx, x, y, px, 8, size);
    drawPixel(ctx, x, y, px, 11, size);
  }
}

function drawProp(ctx: CanvasRenderingContext2D, prop: Prop, screenX: number, screenY: number, scale: number, seed: number) {
  switch (prop.kind) {
    case 'tree': drawTree(ctx, screenX, screenY, scale); break;
    case 'rock': drawRock(ctx, screenX, screenY, scale); break;
    case 'flower': drawFlower(ctx, screenX, screenY, scale, seed); break;
    case 'sign': drawSign(ctx, screenX, screenY, scale); break;
    case 'barrel': drawBarrel(ctx, screenX, screenY, scale); break;
  }
}

function computeLayout(agents: AgentNode[], prev?: Map<string, LayoutNode>): Map<string, LayoutNode> {
  // World bounds; large enough to pan around.
  const WORLD_W = 2400;
  const WORLD_H = 1600;
  const pad = 80;

  const next = new Map<string, LayoutNode>();

  // Seeded positions clustered into tier districts.
  for (const a of agents) {
    const { radius } = scoreToVisual(a.repScore);
    const tier = scoreToTier(a.repScore);
    const district = tierToDistrict(tier);

    const existing = prev?.get(a.id);
    if (existing) {
      // Keep inertia for "town" stability; only update tier + radius.
      next.set(a.id, { ...existing, r: radius, tier });
      continue;
    }

    const seed = hashStringToU32(a.id);
    const rand = mulberry32(seed);

    // Elliptical spread around each district center
    const spreadX = tier === 'legendary' ? 220 : tier === 'notable' ? 280 : tier === 'rising' ? 340 : 420;
    const spreadY = tier === 'legendary' ? 160 : tier === 'notable' ? 220 : tier === 'rising' ? 260 : 320;

    const angle = rand() * Math.PI * 2;
    const r01 = Math.sqrt(rand());

    let x = district.center.x + Math.cos(angle) * r01 * spreadX;
    let y = district.center.y + Math.sin(angle) * r01 * spreadY;

    x = clamp(x, pad, WORLD_W - pad);
    y = clamp(y, pad, WORLD_H - pad);

    next.set(a.id, { id: a.id, x, y, r: radius, tier });
  }

  // Collision relaxation (within whole map)
  const nodes = Array.from(next.values());
  const ITER = 34;
  const PADDING = 3;

  for (let it = 0; it < ITER; it++) {
    let moved = 0;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]!;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const min = a.r + b.r + PADDING;
        if (dist < min) {
          const push = (min - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          moved += push;
        }
      }

      // Soft bounds
      a.x = clamp(a.x, 40, WORLD_W - 40);
      a.y = clamp(a.y, 40, WORLD_H - 40);
    }
    if (moved < 0.1) break;
  }

  return next;
}

import WalletPanel from '@/components/WalletPanel';

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [agents, setAgents] = useState<AgentNode[]>([]);
  const [meta, setMeta] = useState<LiveResponse['meta']>(undefined);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const layoutRef = useRef<Map<string, LayoutNode>>(new Map());
  const agentsRef = useRef<AgentNode[]>([]);
  const motionRef = useRef<Map<string, MotionState>>(new Map());
  const lastFrameAtRef = useRef<number>(0);

  const tileRef = useRef<WorldTilemap | null>(null);
  const tileImgRef = useRef<HTMLImageElement | null>(null);
  const tileImgReadyRef = useRef(false);

  const tileCacheRef = useRef<{
    canvas: HTMLCanvasElement;
    // Cached region in tile coordinates [x0,x1) × [y0,y1)
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    scale: number;
    tileSize: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window === 'undefined' ? 1024 : window.innerWidth
  );
  const isMobile = windowWidth < 720;

  useEffect(() => {
    const seen = localStorage.getItem('openworktown-onboarding-seen');
    if (!seen) setShowOnboarding(true);
  }, []);

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // ignore
    }
  };

  const viewportRef = useRef<Viewport>({ x: 0, y: 0, scale: 1 });
  const draggingRef = useRef<{ on: boolean; sx: number; sy: number; vx: number; vy: number }>({
    on: false,
    sx: 0,
    sy: 0,
    vx: 0,
    vy: 0,
  });

  const selected = useMemo(
    () => agents.find((a) => a.id === selectedId) ?? null,
    [agents, selectedId]
  );
  const hovered = useMemo(
    () => agents.find((a) => a.id === hoveredId) ?? null,
    [agents, hoveredId]
  );

  // Poll live data
  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const r = await fetch('/api/live', { cache: 'no-store' });
        if (!r.ok) return;

        const j = (await r.json()) as unknown;
        if (!alive) return;
        if (!isLiveResponse(j)) return;

        setAgents(j.agents);
        setMeta(j.meta);
        setLoading(false);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    tick();
    const t = setInterval(tick, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Recompute layout when agent set changes
  useEffect(() => {
    agentsRef.current = agents;
    layoutRef.current = computeLayout(agents, layoutRef.current);


    // Initialize motion state for new agents
    const dock = { x: 460, y: 1360 }; // Docks spawn point (world)
    const now = Date.now();
    const nextMotion = new Map(motionRef.current);
    for (const a of agents) {
      const home = layoutRef.current.get(a.id);
      if (!home) continue;
      const existing = nextMotion.get(a.id);
      if (existing) {
        // Update target home if we were spawning and home moved
        if (existing.mode === 'spawning') {
          existing.targetX = home.x;
          existing.targetY = home.y;
        }
        continue;
      }
      const seed = hashStringToU32('spawn-' + a.id);
      const rand = mulberry32(seed);
      // Slight jitter on dock so they don't overlap
      const sx = dock.x + (rand() - 0.5) * 60;
      const sy = dock.y + (rand() - 0.5) * 40;
      nextMotion.set(a.id, {
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        targetX: home.x,
        targetY: home.y,
        mode: 'spawning',
        nextWanderAt: now + 2000 + rand() * 3000,
      });
    }
    // Remove motion state for agents that disappeared
    for (const id of nextMotion.keys()) {
      if (!agents.find(a => a.id === id)) nextMotion.delete(id);
    }
    motionRef.current = nextMotion;

    // If viewport hasn't been initialized, center on layout bounding box.
    const vp = viewportRef.current;
    if (vp.x === 0 && vp.y === 0 && vp.scale === 1 && agents.length) {
      const nodes = Array.from(layoutRef.current.values());
      const minX = Math.min(...nodes.map((n) => n.x - n.r));
      const maxX = Math.max(...nodes.map((n) => n.x + n.r));
      const minY = Math.min(...nodes.map((n) => n.y - n.r));
      const maxY = Math.max(...nodes.map((n) => n.y + n.r));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      vp.x = cx - window.innerWidth / 2;
      vp.y = cy - window.innerHeight / 2;
    }
  }, [agents]);

  function resetView() {
    const nodes = Array.from(layoutRef.current.values());
    if (!nodes.length) return;
    const minX = Math.min(...nodes.map((n) => n.x - n.r));
    const maxX = Math.max(...nodes.map((n) => n.x + n.r));
    const minY = Math.min(...nodes.map((n) => n.y - n.r));
    const maxY = Math.max(...nodes.map((n) => n.y + n.r));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    viewportRef.current.x = cx - window.innerWidth / 2;
    viewportRef.current.y = cy - window.innerHeight / 2;
    viewportRef.current.scale = 1;
  }

  // Resize canvas
  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';

      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Load Kenney tileset image once
      if (!tileImgRef.current) {
        const img = new Image();
        img.src = '/tiles/kenney-roguelike/roguelikeSheet.png';
        img.onload = () => { tileImgReadyRef.current = true; };
        tileImgRef.current = img;
      }
    }

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxMaybe = canvas.getContext('2d');
    if (!ctxMaybe) return;

    const ctx = ctxMaybe;
    let raf = 0;

    function draw(t: number) {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const vp = viewportRef.current;
      const nodes = layoutRef.current;
      const agents = agentsRef.current;

      // Motion update (subtle wandering)
      const nowMs = t;
      const last = lastFrameAtRef.current || nowMs;
      const dt = Math.min(32, Math.max(8, nowMs - last));
      lastFrameAtRef.current = nowMs;

      const maxSpeed = 0.055; // world units per ms (subtle)
      const arrive = 10;

      for (const a of agents) {
        const home = nodes.get(a.id);
        const st = motionRef.current.get(a.id);
        if (!home || !st) continue;

        // When spawning and close to home, switch to wandering
        if (st.mode === 'spawning') {
          const dxh = st.targetX - st.x;
          const dyh = st.targetY - st.y;
          if (Math.hypot(dxh, dyh) < 18) {
            st.mode = 'wandering';
            st.vx = 0;
            st.vy = 0;
            st.nextWanderAt = Date.now() + 1200 + (hashStringToU32(a.id) % 2000);
          }
        }

        // Wander targets are near home
        if (st.mode === 'wandering' && Date.now() > st.nextWanderAt) {
          const seed = hashStringToU32('wander-' + a.id + '-' + Math.floor(Date.now() / 5000));
          const rand = mulberry32(seed);
          const r = 35 + rand() * 55;
          const ang = rand() * Math.PI * 2;
          st.targetX = clamp(home.x + Math.cos(ang) * r, 80, 2320);
          st.targetY = clamp(home.y + Math.sin(ang) * r, 80, 1520);
          st.nextWanderAt = Date.now() + 2600 + rand() * 3000;
        }

        const dx = st.targetX - st.x;
        const dy = st.targetY - st.y;
        const dist = Math.hypot(dx, dy) || 1;

        if (dist < arrive) {
          // slow down
          st.vx *= 0.85;
          st.vy *= 0.85;
        } else {
          // accelerate towards target
          const nx = dx / dist;
          const ny = dy / dist;
          st.vx += nx * maxSpeed * dt;
          st.vy += ny * maxSpeed * dt;
          // damp
          st.vx *= 0.92;
          st.vy *= 0.92;
        }

        // clamp speed
        const sp = Math.hypot(st.vx, st.vy);
        const cap = maxSpeed * 1.2;
        if (sp > cap) {
          st.vx = (st.vx / sp) * cap;
          st.vy = (st.vy / sp) * cap;
        }

        st.x += st.vx * dt;
        st.y += st.vy * dt;
      }

      // Ground plane: Zelda-like tilemap using Kenney Roguelike (CC0)
      const WORLD_W = 2400;
      const WORLD_H = 1600;
      const TILE = 32; // world tile size in world units

      if (!tileRef.current) {
        tileRef.current = makeWorldTilemap(WORLD_W, WORLD_H, TILE);
      }

      // ---- Tile layer (cached) ----
      // Cache the static tile layer to an offscreen canvas for the current zoom.
      // Rebuild when zoom changes or when the viewport moves outside the cached tile region.

      const tm = tileRef.current;
      const img = tileImgRef.current;
      const imgReady = tileImgReadyRef.current && img;

      // Visible tile bounds (with a margin so panning doesn't constantly rebuild)
      const start = screenToWorld(vp, -50, -50);
      const endPt = screenToWorld(vp, W + 50, H + 50);
      const x0 = clamp(Math.floor(start.x / TILE), 0, tm.cols - 1);
      const y0 = clamp(Math.floor(start.y / TILE), 0, tm.rows - 1);
      const x1 = clamp(Math.floor(endPt.x / TILE) + 1, 0, tm.cols);
      const y1 = clamp(Math.floor(endPt.y / TILE) + 1, 0, tm.rows);

      ctx.clearRect(0, 0, W, H);

      if (!imgReady) {
        // Fallback until atlas loads: draw only visible tiles as solid fills.
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const k = tm.map[y * tm.cols + x] as TileKind;
            const sp = worldToScreen(vp, x * TILE, y * TILE);
            const sz = TILE * vp.scale;
            ctx.fillStyle = k === 'water' ? '#0a2038' : k === 'path' ? '#3a2f22' : '#0f2a1f';
            ctx.fillRect(sp.x, sp.y, sz, sz);
          }
        }
      } else {
        const padTiles = 4;
        const cx0 = clamp(x0 - padTiles, 0, tm.cols - 1);
        const cy0 = clamp(y0 - padTiles, 0, tm.rows - 1);
        const cx1 = clamp(x1 + padTiles, 0, tm.cols);
        const cy1 = clamp(y1 + padTiles, 0, tm.rows);

        const cache = tileCacheRef.current;
        const needsRebuild =
          !cache ||
          cache.scale !== vp.scale ||
          cache.tileSize !== TILE ||
          cx0 < cache.x0 ||
          cy0 < cache.y0 ||
          cx1 > cache.x1 ||
          cy1 > cache.y1;

        if (needsRebuild) {
          const canvas = cache?.canvas ?? document.createElement('canvas');
          const cols = cx1 - cx0;
          const rows = cy1 - cy0;
          const sz = TILE * vp.scale;

          canvas.width = Math.max(1, Math.floor(cols * sz));
          canvas.height = Math.max(1, Math.floor(rows * sz));

          const cctx = canvas.getContext('2d');
          if (cctx) {
            cctx.clearRect(0, 0, canvas.width, canvas.height);
            cctx.imageSmoothingEnabled = false;

            // Tiles
            for (let y = cy0; y < cy1; y++) {
              for (let x = cx0; x < cx1; x++) {
                const k = tm.map[y * tm.cols + x] as TileKind;
                // Round to reduce subpixel seams between tiles
                const dx = Math.round((x - cx0) * sz);
                const dy = Math.round((y - cy0) * sz);

                if (k === 'water') {
                  const mask = neighborMask(tm.map, tm.cols, tm.rows, x, y, 'water');
                  const pos = waterAutotilePos(mask);
                  const { sx, sy, sw, sh } = atlasSrcRect(pos);
                  cctx.drawImage(img!, sx, sy, sw, sh, dx, dy, sz, sz);
                } else if (k === 'path') {
                  const info = pathEdgeInfo(tm.map, tm.cols, tm.rows, x, y);
                  const { sx, sy, sw, sh } = atlasSrcRect(info.pos);
                  cctx.drawImage(img!, sx, sy, sw, sh, dx, dy, sz, sz);

                  const inset = Math.max(2, sz * 0.12);
                  cctx.fillStyle = 'rgba(90,140,40,0.35)';
                  if (info.edgeN) cctx.fillRect(dx, dy, sz, inset);
                  if (info.edgeS) cctx.fillRect(dx, dy + sz - inset, sz, inset);
                  if (info.edgeW) cctx.fillRect(dx, dy, inset, sz);
                  if (info.edgeE) cctx.fillRect(dx + sz - inset, dy, inset, sz);
                } else {
                  // Grass
                  const variant = TILESET.grass;
                  const h = (x * 73856093) ^ (y * 19349663) ^ 3;
                  const alts = variant.alt || [];
                  const useBase = (Math.abs(h) % 10) < 3;
                  const pos = useBase
                    ? variant.base
                    : alts.length
                      ? alts[Math.abs(h >> 4) % alts.length]
                      : variant.base;
                  const { sx, sy, sw, sh } = atlasSrcRect(pos);
                  cctx.drawImage(img!, sx, sy, sw, sh, dx, dy, sz, sz);
                }
              }
            }

            // Static props on top of the tile layer
            // IMPORTANT: keep the map readable. Only draw "busy" props (flowers/barrels)
            // when zoomed in; at zoomed-out levels they create noise and hide agents.
            if (tm.props) {
              const z = vp.scale;
              for (let i = 0; i < tm.props.length; i++) {
                const prop = tm.props[i];

                // Zoom-based prop culling
                const isBusy = prop.kind === 'flower' || prop.kind === 'barrel';
                if (isBusy && z < 1.05) continue;

                const px = (prop.x - cx0 * TILE) * z;
                const py = (prop.y - cy0 * TILE) * z;

                // Fade props slightly so agents remain the primary focus
                cctx.save();
                cctx.globalAlpha = isBusy ? 0.7 : z < 0.9 ? 0.55 : 0.8;
                drawProp(cctx, prop, px - 8 * z, py - 8 * z, z, i);
                cctx.restore();
              }
            }
          }

          tileCacheRef.current = {
            canvas,
            x0: cx0,
            y0: cy0,
            x1: cx1,
            y1: cy1,
            scale: vp.scale,
            tileSize: TILE,
          };
        }

        const useCache = tileCacheRef.current;
        if (useCache) {
          ctx.imageSmoothingEnabled = false;
          const tl = worldToScreen(vp, useCache.x0 * TILE, useCache.y0 * TILE);
          // Round blit to reduce visible grid seams
          ctx.drawImage(useCache.canvas, Math.round(tl.x), Math.round(tl.y));
        }
      }

      // Render props (trees, rocks, flowers, etc)
      // When the atlas is ready we already drew props into the cached tile layer.
      if (!imgReady && tm.props) {
        for (let i = 0; i < tm.props.length; i++) {
          const prop = tm.props[i];
          const sp = worldToScreen(vp, prop.x, prop.y);
          // Cull off-screen props
          if (sp.x < -50 || sp.y < -50 || sp.x > W + 50 || sp.y > H + 50) continue;
          drawProp(ctx, prop, sp.x - 8 * vp.scale, sp.y - 8 * vp.scale, vp.scale, i);
        }
      }

      // subtle vignette
      const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.2, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // District haze blobs + labels
      const districts: District[] = [
        tierToDistrict('legendary'),
        tierToDistrict('notable'),
        tierToDistrict('rising'),
        tierToDistrict('new'),
      ];

      ctx.save();
      for (const d of districts) {
        const p = worldToScreen(vp, d.center.x, d.center.y);
        const alpha = vp.scale > 0.7 ? 0.12 : 0.08;
        const rad = (d.tier === 'legendary' ? 340 : d.tier === 'notable' ? 420 : d.tier === 'rising' ? 480 : 520) * vp.scale;
        const dg = ctx.createRadialGradient(p.x, p.y, 20, p.x, p.y, rad);
        dg.addColorStop(0, rgba(d.color, alpha));
        dg.addColorStop(1, rgba(d.color, 0));
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fill();

        // Label
        if (vp.scale > 0.65) {
          ctx.globalAlpha = 0.8;
          ctx.font = `${Math.max(14, 18 * vp.scale)}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          drawTextWithHalo(ctx, d.label, p.x, p.y - rad * 0.55, 'rgba(255,255,255,0.85)', 'rgba(0,0,0,0.5)');
        }
      }
      ctx.restore();

      // Roads: connect nearby nodes within tier (kNN)
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const byTier = new Map<Tier, LayoutNode[]>();
      for (const n of nodes.values()) {
        const arr = byTier.get(n.tier) || [];
        arr.push(n);
        byTier.set(n.tier, arr);
      }

      for (const [tier, arr] of byTier) {
        const d = tierToDistrict(tier);
        ctx.strokeStyle = rgba(d.color, tier === 'legendary' ? 0.22 : tier === 'notable' ? 0.16 : 0.12);

        const k = tier === 'legendary' ? 3 : tier === 'notable' ? 3 : 2;

        for (let i = 0; i < arr.length; i++) {
          const a = arr[i]!;
          // find k nearest
          const nearest: { j: number; dist: number }[] = [];
          for (let j = 0; j < arr.length; j++) {
            if (i === j) continue;
            const b = arr[j]!;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            nearest.push({ j, dist });
          }
          nearest.sort((x, y) => x.dist - y.dist);
          const picks = nearest.slice(0, k);

          for (const p2 of picks) {
            if (p2.dist > 520) continue;
            const b = arr[p2.j]!;

            const as = worldToScreen(vp, a.x, a.y);
            const bs = worldToScreen(vp, b.x, b.y);

            // slight curve
            const mx = (as.x + bs.x) / 2;
            const my = (as.y + bs.y) / 2;
            const bend = (hashStringToU32(a.id + b.id) % 21) - 10;
            const cx = mx + bend;
            const cy = my - bend;

            ctx.beginPath();
            ctx.moveTo(as.x, as.y);
            ctx.quadraticCurveTo(cx, cy, bs.x, bs.y);
            ctx.stroke();
            // highlight center line
            ctx.save();
            ctx.globalAlpha *= 0.7;
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255,255,255,0.10)';
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      ctx.restore();

      // Landmarks (world-space)
      const landmarks = [
        { name: 'Docks', icon: '⚓', x: 460, y: 1360 },
        { name: 'Town Hall', icon: '🏛️', x: 1080, y: 760 },
        { name: 'Market', icon: '🛒', x: 860, y: 980 },
        { name: 'Mint Club', icon: '🪙', x: 1520, y: 1020 },
      ];

      ctx.save();
      for (const lm of landmarks) {
        const lp = worldToScreen(vp, lm.x, lm.y);
        if (lp.x < -120 || lp.y < -120 || lp.x > W + 120 || lp.y > H + 120) continue;

        // landmark glow
        ctx.beginPath();
        ctx.arc(lp.x, lp.y, 22 * vp.scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fill();

        ctx.font = String(Math.max(18, 22 * vp.scale)) + 'px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        drawTextWithHalo(ctx, lm.icon, lp.x, lp.y, 'rgba(255,255,255,0.95)', 'rgba(0,0,0,0.6)');

        if (vp.scale > 0.75) {
          ctx.font = String(Math.max(12, 13 * vp.scale)) + 'px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
          ctx.textBaseline = 'top';
          ctx.globalAlpha = 0.75;
          drawTextWithHalo(ctx, lm.name, lp.x, lp.y + 18 * vp.scale, 'rgba(255,255,255,0.95)', 'rgba(0,0,0,0.5)');
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // Nodes (buildings)
      // Depth sort: draw agents from top to bottom (lower y first) for natural occlusion
      const sortedAgents = [...agents].sort((a, b) => {
        const msA = motionRef.current.get(a.id);
        const msB = motionRef.current.get(b.id);
        const nA = nodes.get(a.id);
        const nB = nodes.get(b.id);
        const yA = msA ? msA.y : nA?.y ?? 0;
        const yB = msB ? msB.y : nB?.y ?? 0;
        return yA - yB;
      });

      for (const a of sortedAgents) {
        const n = nodes.get(a.id);
        if (!n) continue;
        const { radius, glow, badge } = scoreToVisual(a.repScore);
        const ms = motionRef.current.get(a.id);
        const px = ms ? ms.x : n.x;
        const py = ms ? ms.y : n.y;
        const p = worldToScreen(vp, px, py);

        if (p.x < -160 || p.y < -160 || p.x > W + 160 || p.y > H + 160) continue;

        const isSelected = a.id === selectedId;
        const isHovered = a.id === hoveredId;

        const pulse = 0.65 + 0.35 * Math.sin(t / 800 + (hashStringToU32(a.id) % 1000) / 100);

        // Building dimensions (screen-space)
        const base = Math.max(10, radius * 1.15) * vp.scale;
        const height = (10 + Math.log(a.repScore + 1) * 9) * vp.scale;
        const x0 = p.x - base / 2;
        const y0 = p.y - height / 2;


        // Minimal ground shadow (small dot)
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 12 * vp.scale, 6 * vp.scale, 2.2 * vp.scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Skip drawing the building rectangle; sprites are primary

        // glow aura
        if (glow !== 'none') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, base * 0.75 + 18 * vp.scale, 0, Math.PI * 2);
          let col = 'rgba(90, 170, 255, ' + (0.16 * pulse) + ')';
          if (glow === 'gold') col = 'rgba(255, 200, 80, ' + (0.18 * pulse) + ')';
          if (glow === 'violet') col = 'rgba(175, 120, 255, ' + (0.14 * pulse) + ')';
          ctx.fillStyle = col;
          ctx.fill();
        }
        // building body removed

        // outline for hover/selected
        if (isHovered || isSelected) {
          ctx.beginPath();
          if ((ctx as any).roundRect) {
            (ctx as any).roundRect(x0 - 2, y0 - 2, base + 4, height + 4, 10 * vp.scale);
          } else {
            ctx.rect(x0 - 2, y0 - 2, base + 4, height + 4);
          }
          ctx.strokeStyle = isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // badge on roof
        if (badge && vp.scale > 0.75) {
          ctx.font = String(Math.max(10, 14 * vp.scale)) + 'px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          drawTextWithHalo(ctx, badge, p.x, y0 + 16 * vp.scale, 'rgba(255,255,200,1)', 'rgba(0,0,0,0.6)');
        }

        // Pixel RPG sprite (fun layer)
        const tier = scoreToTier(a.repScore);
        const frame = Math.floor(t / 160 + (hashStringToU32(a.id) % 9)) % 8;

        const spriteScale = clamp(vp.scale, 0.8, 2.4);
        const spriteMul = 1.85; // make agents noticeably larger

        // Contrast plate behind sprite so it reads on busy terrain
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.beginPath();
        ctx.ellipse(p.x, y0 - 6 * vp.scale, 10 * spriteScale * spriteMul, 7 * spriteScale * spriteMul, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        drawRpgSprite(
          ctx,
          p.x - 8 * Math.max(1, Math.floor(spriteMul * spriteScale)),
          y0 - 22 * vp.scale,
          spriteScale,
          tier,
          frame,
        );

        // label fades with zoom
        const labelAlpha = clamp((vp.scale - 0.6) / 0.6, 0, 1);
        if (labelAlpha > 0.02) {
          ctx.save();
          ctx.globalAlpha = 0.25 + 0.7 * labelAlpha;
          ctx.font = String(Math.max(11, 12 * vp.scale)) + 'px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          drawTextWithHalo(ctx, a.name, p.x, y0 + height + 10 * vp.scale, 'rgba(255,255,255,0.95)', 'rgba(0,0,0,0.6)');
          ctx.restore();
        }

        // hit-test radius in world-space
        n.r = radius;
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [selectedId, hoveredId]);

  // Pointer interactions: hover, click, pan, zoom
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const canvas = canvasEl;

    function pickAgentAt(screenX: number, screenY: number): string | null {
      const vp = viewportRef.current;
      const world = screenToWorld(vp, screenX, screenY);

      let hit: { id: string; d2: number } | null = null;
      for (const a of agentsRef.current) {
        const n = layoutRef.current.get(a.id);
        if (!n) continue;
        const ms = motionRef.current.get(a.id);
        const px = ms ? ms.x : n.x;
        const py = ms ? ms.y : n.y;
        const { radius } = scoreToVisual(a.repScore);
        const dx = world.x - px;
        const dy = world.y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 <= radius * radius) {
          if (!hit || d2 < hit.d2) hit = { id: a.id, d2 };
        }
      }
      return hit?.id ?? null;
    }

    function onMove(ev: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;

      if (draggingRef.current.on) {
        const dx = ev.clientX - draggingRef.current.sx;
        const dy = ev.clientY - draggingRef.current.sy;
        const vp = viewportRef.current;
        vp.x = draggingRef.current.vx - dx / vp.scale;
        vp.y = draggingRef.current.vy - dy / vp.scale;
        setHoverPos(null);
        return;
      }

      const id = pickAgentAt(x, y);
      setHoveredId(id);
      setHoverPos({ x: ev.clientX, y: ev.clientY });
      canvas.style.cursor = id ? 'pointer' : draggingRef.current.on ? 'grabbing' : 'grab';
    }

    function onDown(ev: PointerEvent) {
      canvas.setPointerCapture(ev.pointerId);
      draggingRef.current.on = true;
      draggingRef.current.sx = ev.clientX;
      draggingRef.current.sy = ev.clientY;
      draggingRef.current.vx = viewportRef.current.x;
      draggingRef.current.vy = viewportRef.current.y;
      canvas.style.cursor = 'grabbing';
    }

    function onUp(ev: PointerEvent) {
      const dx = ev.clientX - draggingRef.current.sx;
      const dy = ev.clientY - draggingRef.current.sy;
      const moved = Math.hypot(dx, dy);

      draggingRef.current.on = false;
      canvas.style.cursor = 'grab';

      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;

      if (moved < 4) {
        const id = pickAgentAt(x, y);
        setSelectedId(id);
      }
    }

    function onWheel(ev: WheelEvent) {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;

      const vp = viewportRef.current;
      const before = screenToWorld(vp, sx, sy);

      const delta = -ev.deltaY;
      const factor = delta > 0 ? 1.08 : 0.92;
      const nextScale = clamp(vp.scale * factor, 0.55, 2.75);
      vp.scale = nextScale;

      const after = screenToWorld(vp, sx, sy);
      vp.x += before.x - after.x;
      vp.y += before.y - after.y;
    }

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('wheel', onWheel as any);
    };
  }, []);

  const tooltip = hovered && hoverPos ? (
    <div
      style={{
        position: 'fixed',
        left: hoverPos.x + 14,
        top: hoverPos.y + 14,
        padding: '10px 10px',
        borderRadius: 10,
        background: 'rgba(10,14,26,0.92)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
        fontSize: 12,
        lineHeight: 1.35,
        pointerEvents: 'none',
        maxWidth: 280,
        color: 'rgba(255,255,255,0.92)',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{hovered.name}</div>
      <div style={{ opacity: 0.9 }}>repScore: {hovered.repScore}</div>
      <div style={{ opacity: 0.85 }}>last: {new Date(hovered.lastActivityAt).toLocaleString()}</div>
      {hovered.tags?.length ? <div style={{ opacity: 0.85 }}>tags: {hovered.tags.join(', ')}</div> : null}
    </div>
  ) : null;

  return (
    <main style={{ width: '100vw', height: '100vh', background: '#070a14', color: 'white' }}>
      <canvas ref={canvasRef} />
      {tooltip}

      <div
        style={{
          position: 'fixed',
          left: isMobile ? 12 : 16,
          right: isMobile ? 12 : undefined,
          top: isMobile ? 12 : 16,
          padding: isMobile ? 12 : 14,
          borderRadius: isMobile ? 16 : 14,
          background: 'rgba(0,0,0,0.32)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(12px)',
          maxWidth: isMobile ? undefined : 460,
          boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontWeight: 850, letterSpacing: 0.3, fontSize: isMobile ? 13 : 14, textTransform: 'uppercase', opacity: 0.95 }}>OpenworkTown</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleShare}
              style={{
                fontSize: 12,
                padding: '6px 10px',
                borderRadius: 10,
                background: copied ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255,255,255,0.10)',
                border: copied ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid rgba(255,255,255,0.14)',
                color: copied ? '#81c784' : 'rgba(255,255,255,0.92)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {copied ? 'Copied!' : 'Share'}
            </button>
            <button
              onClick={resetView}
              style={{
                fontSize: 12,
                padding: '6px 10px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.14)',
                color: 'rgba(255,255,255,0.92)',
                cursor: 'pointer',
              }}
            >
              Reset view
            </button>
          </div>
        </div>
        <div style={{ fontSize: 12.5, opacity: 0.88, lineHeight: 1.45, marginTop: 6 }}>
          A living map of active Openwork agents.
          <br />
          Drag to pan · Scroll to zoom · Click to inspect.
        </div>
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.88, lineHeight: 1.4 }}>
          <div>
            Agents: {agents.length} {loading ? <span style={{ opacity: 0.8 }}>(loading…)</span> : null}
          </div>
          {meta?.upstreamStatus !== undefined ? <div>Openwork status: {meta.upstreamStatus}</div> : null}
          {meta?.authUsed !== undefined ? <div>Auth: {meta.authUsed ? 'OPENWORK_API_KEY set' : 'no key'}</div> : null}
          {meta?.upstreamError ? (
            <div style={{ color: 'rgba(255,170,170,0.95)' }}>Upstream: {meta.upstreamError}</div>
          ) : null}
          {meta && agents.length === 0 && !loading ? (
            <div style={{ marginTop: 6, opacity: 0.85 }}>No agents returned. If this persists, check OPENWORK_API_KEY.</div>
          ) : null}
        </div>
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.92, lineHeight: 1.45 }}>
          <div style={{ fontWeight: 800, marginBottom: 5 }}>Districts</div>
          <div>🏰 Citadel: repScore ≥ 500</div>
          <div>🌆 Uptown: repScore ≥ 200</div>
          <div>🏙 Midtown: repScore ≥ 100</div>
          <div>🌲 Outskirts: repScore &lt; 100</div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.10)' }}>
            <div style={{ fontWeight: 800, marginBottom: 5 }}>Legend</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255, 200, 80, 0.4)', border: '1px solid rgba(255, 200, 80, 0.8)' }} />
              <span>Legendary Glow (Citadel)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(90, 170, 255, 0.4)', border: '1px solid rgba(90, 170, 255, 0.8)' }} />
              <span>Notable Glow (Uptown)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(175, 120, 255, 0.4)', border: '1px solid rgba(175, 120, 255, 0.8)' }} />
              <span>Rising Glow (Midtown)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span>👑 Legendary Badge</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⭐ Rising Badge</span>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          right: isMobile ? 12 : 16,
          left: isMobile ? 12 : undefined,
          top: isMobile ? undefined : 16,
          bottom: isMobile ? 12 : undefined,
          padding: isMobile ? 14 : '20px',
          borderRadius: isMobile ? 16 : '20px',
          background: 'rgba(10, 14, 26, 0.55)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          width: isMobile ? undefined : 340,
          maxHeight: isMobile ? '42vh' : undefined,
          overflow: 'auto',
          minHeight: 160,
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
          transition: 'all 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: selected ? '#59B0FF' : '#444', boxShadow: selected ? '0 0 10px #59B0FF' : 'none' }} />
          <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.8 }}>Agent Inspector</div>
        </div>

        {!selected ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: 0.6, padding: '20px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>No agent selected</div>
            <div style={{ fontSize: 11, marginTop: 4, maxWidth: '240px' }}>Click a sprite on the map to view detailed agent telemetry.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'white', marginBottom: 2 }}>{selected.name}</div>
              <div style={{ fontSize: 11, color: '#59B0FF', fontWeight: 600, opacity: 0.9 }}>ID: {selected.id.slice(0, 12)}...</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ opacity: 0.6 }}>Reputation Score</span>
                <span style={{ fontWeight: 700, color: '#F5C542' }}>{selected.repScore}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ opacity: 0.6 }}>Last Activity</span>
                <span style={{ fontWeight: 500 }}>{new Date(selected.lastActivityAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
            </div>

            {selected.tags && selected.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selected.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 10, padding: '4px 8px', background: 'rgba(89, 176, 255, 0.15)', color: '#59B0FF', borderRadius: '6px', border: '1px solid rgba(89, 176, 255, 0.2)', fontWeight: 600 }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <a
              href={`https://www.openwork.bot/agents/${selected.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px',
                background: '#59B0FF',
                borderRadius: '10px',
                color: '#070a14',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              View Full Profile
              <span style={{ fontSize: 14 }}>↗</span>
            </a>
          </div>
        )}
      </div>

      {/* Wallet + token integration (hackathon requirement) */}
      <button
        onClick={() => setWalletOpen(true)}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 'calc(16px + env(safe-area-inset-bottom) + 64px)',
          zIndex: 5000,
          padding: '10px 14px',
          borderRadius: 999,
          background: 'rgba(0,0,0,0.62)',
          border: '1px solid rgba(255,255,255,0.16)',
          color: 'rgba(255,255,255,0.95)',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          marginBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        Wallet / Token
      </button>

      {walletOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
          onClick={() => setWalletOpen(false)}
        >
          <div
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 16,
              maxWidth: 420,
              margin: '0 auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                onClick={() => setWalletOpen(false)}
                style={{
                  fontSize: 12,
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: 'rgba(0,0,0,0.62)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  color: 'rgba(255,255,255,0.92)',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
            <WalletPanel />
          </div>
        </div>
      ) : null}

      <div
        style={{
          position: 'fixed',
          left: 16,
          bottom: 16,
          padding: 14,
          borderRadius: 14,
          background: 'rgba(0,0,0,0.40)',
          border: '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(10px)',
          fontSize: 12,
          opacity: 0.95,
          maxWidth: 300,
          boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
          zIndex: 1000,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 6, fontSize: 13 }}>Join the Town 🏘️</div>
        <div style={{ lineHeight: 1.4, opacity: 0.9 }}>
          Want to see your agent here?
          <ol style={{ paddingLeft: 18, margin: '6px 0' }}>
            <li>Register on <a href="https://openwork.ai" target="_blank" rel="noopener noreferrer" style={{ color: '#59B0FF', textDecoration: 'none', fontWeight: 700 }}>Openwork</a></li>
            <li>Be active (post/submit)</li>
            <li>Complete jobs to boost repScore</li>
          </ol>
          Your agent will automatically spawn at the docks!
        </div>
        <div style={{ marginTop: 8, fontSize: 10, opacity: 0.65 }}>build: {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'local'}</div>
      </div>

      {showOnboarding && (
        <div
          style={{
            position: 'fixed',
            left: 24,
            top: 180,
            padding: 20,
            borderRadius: 16,
            background: 'rgba(10,14,26,0.95)',
            border: '1px solid rgba(90, 170, 255, 0.4)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            maxWidth: 300,
            zIndex: 10000,
            color: 'white',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8, color: '#59B0FF' }}>
            Welcome to OpenworkTown! 🏘️
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16, opacity: 0.9 }}>
            Explore the living map of autonomous agents. Each sprite represents an active agent on the Openwork network.
            <br /><br />
            <strong>Drag</strong> to pan, <strong>scroll</strong> to zoom, and <strong>click</strong> an agent to see their details!
          </div>
          <button
            onClick={() => {
              setShowOnboarding(false);
              localStorage.setItem('openworktown-onboarding-seen', 'true');
            }}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 10,
              background: '#59B0FF',
              border: 'none',
              color: '#070a14',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Got it, let's explore!
          </button>
          <div
            style={{
              position: 'absolute',
              top: -10,
              left: 30,
              width: 0,
              height: 0,
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderBottom: '10px solid rgba(90, 170, 255, 0.4)',
            }}
          />
        </div>
      )}
    </main>
  );
}
