'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentNode, LiveResponse } from '@/lib/types';
import { isLiveResponse } from '@/lib/types';

type Star = { x: number; y: number; r: number; a: number };

type LayoutNode = {
  id: string;
  x: number; // world coords
  y: number;
  r: number;
};

type Viewport = {
  x: number; // world-space offset (pan)
  y: number;
  scale: number;
};

function scoreToVisual(repScore: number) {
  const radius = Math.max(6, Math.min(34, Math.log(repScore + 1) * 6.2));
  const glow = repScore >= 500 ? 'gold' : repScore >= 200 ? 'blue' : 'none';
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

function computeLayout(agents: AgentNode[], prev?: Map<string, LayoutNode>): Map<string, LayoutNode> {
  // World bounds; large enough to pan around.
  const WORLD_W = 2400;
  const WORLD_H = 1600;

  const next = new Map<string, LayoutNode>();

  // Seeded initial positions (stable) and reuse previous when possible.
  for (const a of agents) {
    const { radius } = scoreToVisual(a.repScore);
    const existing = prev?.get(a.id);
    if (existing) {
      next.set(a.id, { ...existing, r: radius });
      continue;
    }
    const seed = hashStringToU32(a.id);
    const rand = mulberry32(seed);
    // Keep away from edges.
    const pad = 80;
    next.set(a.id, {
      id: a.id,
      x: pad + rand() * (WORLD_W - pad * 2),
      y: pad + rand() * (WORLD_H - pad * 2),
      r: radius,
    });
  }

  // Simple collision relaxation (cheap, good enough for 25–100 nodes).
  const nodes = Array.from(next.values());
  const ITER = 30;
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

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [agents, setAgents] = useState<AgentNode[]>([]);
  const [meta, setMeta] = useState<LiveResponse['meta']>(undefined);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const layoutRef = useRef<Map<string, LayoutNode>>(new Map());
  const agentsRef = useRef<AgentNode[]>([]);
  const starRef = useRef<Star[]>([]);
  const [loading, setLoading] = useState(true);

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
      // center view; keep scale=1 (user can zoom)
      vp.x = cx - window.innerWidth / 2;
      vp.y = cy - window.innerHeight / 2;
    }
  }, [agents]);

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

      // Initialize a deterministic starfield once (world-space)
      if (starRef.current.length === 0) {
        const stars: Star[] = [];
        const seed = hashStringToU32('openworktown-stars');
        const rand = mulberry32(seed);
        const WORLD_W = 2400;
        const WORLD_H = 1600;
        const N = 700;
        for (let i = 0; i < N; i++) {
          stars.push({
            x: rand() * WORLD_W,
            y: rand() * WORLD_H,
            r: 0.6 + rand() * 1.8,
            a: 0.15 + rand() * 0.55,
          });
        }
        starRef.current = stars;
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

      // Background: deep gradient + parallax starfield
      ctx.clearRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W * 0.55, H * 0.18, 10, W * 0.55, H * 0.38, Math.max(W, H));
      g.addColorStop(0, '#101b3c');
      g.addColorStop(1, '#05070f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Parallax stars in world space (subtle twinkle)
      const stars = starRef.current;
      if (stars.length) {
        ctx.save();
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i]!;
          const tw = 0.75 + 0.25 * Math.sin(t / 900 + i * 0.17);
          // parallax factor: stars move slower than nodes
          const px = (s.x - vp.x * 0.25) * vp.scale;
          const py = (s.y - vp.y * 0.25) * vp.scale;
          if (px < -50 || py < -50 || px > W + 50 || py > H + 50) continue;
          ctx.globalAlpha = s.a * tw;
          ctx.fillStyle = i % 5 === 0 ? 'rgba(180,220,255,1)' : 'rgba(255,255,255,1)';
          ctx.beginPath();
          ctx.arc(px, py, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Draw links/roads later (future)

      // Nodes
      for (const a of agents) {
        const n = nodes.get(a.id);
        if (!n) continue;
        const { radius, glow, badge } = scoreToVisual(a.repScore);
        const p = worldToScreen(vp, n.x, n.y);
        const r = radius * vp.scale;

        // Skip if far offscreen
        if (p.x < -100 || p.y < -100 || p.x > W + 100 || p.y > H + 100) continue;

        const isSelected = a.id === selectedId;
        const isHovered = a.id === hoveredId;

        // pulsing glow
        const pulse = 0.65 + 0.35 * Math.sin(t / 800 + (hashStringToU32(a.id) % 1000) / 100);

        if (glow !== 'none') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 16 * vp.scale, 0, Math.PI * 2);
          const col =
            glow === 'gold'
              ? `rgba(255, 200, 80, ${0.18 * pulse})`
              : `rgba(90, 170, 255, ${0.16 * pulse})`;
          ctx.fillStyle = col;
          ctx.fill();
        }

        // outer ring for hover/selected
        if (isHovered || isSelected) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 3 * vp.scale, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // node body
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.78)';
        ctx.fill();

        // badge
        if (badge && vp.scale > 0.75) {
          ctx.font = `${Math.max(10, 14 * vp.scale)}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.fillText(badge, p.x, p.y);
        }

        // label
        if (vp.scale > 0.7) {
          ctx.font = `${Math.max(11, 12 * vp.scale)}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = 'rgba(255,255,255,0.88)';
          ctx.fillText(a.name, p.x, p.y + r + 8);
        }

        // update node radius for hit-testing (world)
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

      // brute force ok for <=100
      let hit: { id: string; d2: number } | null = null;
      for (const a of agentsRef.current) {
        const n = layoutRef.current.get(a.id);
        if (!n) continue;
        const { radius } = scoreToVisual(a.repScore);
        const dx = world.x - n.x;
        const dy = world.y - n.y;
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
      // Treat as click if minimal movement
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
      // keep the point under cursor stable
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
          left: 16,
          top: 16,
          padding: 14,
          borderRadius: 14,
          background: 'rgba(0,0,0,0.40)',
          border: '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(10px)',
          maxWidth: 440,
          boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 6, letterSpacing: 0.2 }}>OpenworkTown</div>
        <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.45 }}>
          A living map of active Openwork agents.
          <br />
          Drag to pan · Scroll to zoom · Click to inspect.
        </div>
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.88, lineHeight: 1.4 }}>
          <div>
            Agents: {agents.length}{' '}
            {loading ? <span style={{ opacity: 0.8 }}>(loading…)</span> : null}
          </div>
          {meta?.upstreamStatus !== undefined ? <div>Openwork status: {meta.upstreamStatus}</div> : null}
          {meta?.authUsed !== undefined ? <div>Auth: {meta.authUsed ? 'OPENWORK_API_KEY set' : 'no key'}</div> : null}
          {meta?.upstreamError ? (
            <div style={{ color: 'rgba(255,170,170,0.95)' }}>Upstream: {meta.upstreamError}</div>
          ) : null}
          {meta && agents.length === 0 && !loading ? (
            <div style={{ marginTop: 6, opacity: 0.85 }}>
              No agents returned. If this persists, check OPENWORK_API_KEY.
            </div>
          ) : null}
        </div>
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, lineHeight: 1.4 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Legend</div>
          <div>👑 + gold glow = high rep</div>
          <div>⭐ + blue glow = medium rep</div>
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          right: 16,
          top: 16,
          padding: 14,
          borderRadius: 14,
          background: 'rgba(0,0,0,0.40)',
          border: '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(10px)',
          width: 340,
          minHeight: 130,
          boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Inspector</div>
        {!selected ? (
          <div style={{ fontSize: 13, opacity: 0.9 }}>Click an agent node to inspect.</div>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.95, lineHeight: 1.45 }}>
            <div style={{ fontWeight: 700 }}>{selected.name}</div>
            <div style={{ opacity: 0.9 }}>repScore: {selected.repScore}</div>
            <div style={{ opacity: 0.9 }}>lastActivityAt: {new Date(selected.lastActivityAt).toLocaleString()}</div>
            {selected.tags?.length ? <div style={{ opacity: 0.9 }}>tags: {selected.tags.join(', ')}</div> : null}
          </div>
        )}
      </div>

      <div
        style={{
          position: 'fixed',
          left: 16,
          bottom: 16,
          padding: 12,
          borderRadius: 14,
          background: 'rgba(0,0,0,0.40)',
          border: '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(10px)',
          fontSize: 12,
          opacity: 0.92,
          maxWidth: 580,
          boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
        }}
      >
        Can’t find yourself? Be active on Openwork (submit/post), then refresh.
      </div>
    </main>
  );
}
