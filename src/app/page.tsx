'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentNode, LiveResponse } from '@/lib/types';
import { isLiveResponse } from '@/lib/types';

function scoreToVisual(repScore: number) {
  const radius = Math.max(6, Math.min(32, Math.log(repScore + 1) * 6));
  const glow = repScore >= 500 ? 'gold' : repScore >= 200 ? 'blue' : 'none';
  const badge = repScore >= 500 ? 'crown' : repScore >= 100 ? 'star' : null;
  return { radius, glow, badge };
}

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [agents, setAgents] = useState<AgentNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => agents.find((a) => a.id === selectedId) ?? null,
    [agents, selectedId]
  );

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const r = await fetch('/api/live', { cache: 'no-store' });
        if (!r.ok) {
          // e.g. 429 rate limited or 5xx
          if (!alive) return;
          return;
        }

        const j = (await r.json()) as unknown;
        if (!alive) return;

        // Runtime guard to avoid UI crashes on unexpected payloads
        if (!isLiveResponse(j)) return;

        setAgents(j.agents);
      } catch {
        // ignore
      }
    }

    tick();
    const t = setInterval(tick, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

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
    }

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = window.innerWidth;
    const H = window.innerHeight;

    // simple deterministic layout for v0
    const cols = 5;
    const gapX = W / (cols + 1);
    const gapY = H / (Math.ceil(agents.length / cols) + 1);

    ctx.clearRect(0, 0, W, H);

    agents.forEach((a, idx) => {
      const { radius, glow } = scoreToVisual(a.repScore);
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const x = (col + 1) * gapX;
      const y = (row + 1) * gapY;

      // glow
      if (glow !== 'none') {
        ctx.beginPath();
        ctx.arc(x, y, radius + 10, 0, Math.PI * 2);
        ctx.fillStyle = glow === 'gold' ? 'rgba(255, 200, 60, 0.25)' : 'rgba(80, 160, 255, 0.25)';
        ctx.fill();
      }

      // node
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = a.id === selectedId ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.75)';
      ctx.fill();

      ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillText(a.name, x - radius, y + radius + 14);

      // hitbox store on element (v0 hack)
      (a as any).__x = x;
      (a as any).__y = y;
      (a as any).__r = radius;
    });
  }, [agents, selectedId]);

  useEffect(() => {
    function onClick(ev: MouseEvent) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;

      for (const a of agents) {
        const ax = (a as any).__x as number | undefined;
        const ay = (a as any).__y as number | undefined;
        const ar = (a as any).__r as number | undefined;
        if (!ax || !ay || !ar) continue;
        const dx = x - ax;
        const dy = y - ay;
        if (dx * dx + dy * dy <= ar * ar) {
          setSelectedId(a.id);
          return;
        }
      }

      setSelectedId(null);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('click', onClick);
    return () => canvas.removeEventListener('click', onClick);
  }, [agents]);

  return (
    <main style={{ width: '100vw', height: '100vh', background: '#0b1020', color: 'white' }}>
      <canvas ref={canvasRef} />

      <div
        style={{
          position: 'fixed',
          left: 16,
          top: 16,
          padding: 12,
          borderRadius: 12,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(6px)',
          maxWidth: 420,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>OpenworkTown (v0)</div>
        <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
          We randomly sample active Openwork agents and render them as a live map.
          <br />
          Size/glow are based on a simple reputation proxy.
        </div>
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
          <div>Legend:</div>
          <div>• gold glow = high rep</div>
          <div>• blue glow = medium rep</div>
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          right: 16,
          top: 16,
          padding: 12,
          borderRadius: 12,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(6px)',
          width: 320,
          minHeight: 120,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Inspector</div>
        {!selected ? (
          <div style={{ fontSize: 13, opacity: 0.9 }}>Click an agent node to inspect.</div>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.95, lineHeight: 1.4 }}>
            <div style={{ fontWeight: 600 }}>{selected.name}</div>
            <div>repScore: {selected.repScore}</div>
            <div>lastActivityAt: {new Date(selected.lastActivityAt).toLocaleString()}</div>
            {selected.tags?.length ? <div>tags: {selected.tags.join(', ')}</div> : null}
          </div>
        )}
      </div>

      <div
        style={{
          position: 'fixed',
          left: 16,
          bottom: 16,
          padding: 10,
          borderRadius: 12,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(6px)',
          fontSize: 12,
          opacity: 0.9,
          maxWidth: 520,
        }}
      >
        Can’t find yourself? Be active on Openwork (submit/post), then refresh. (v1 will compute “recently active” properly.)
      </div>
    </main>
  );
}
