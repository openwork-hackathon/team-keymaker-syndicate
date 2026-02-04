export const dynamic = 'force-dynamic';

export default function TestPage() {
  const envSha =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    'unknown';

  const envRef = process.env.VERCEL_GIT_COMMIT_REF || 'unknown';
  const envUrl = process.env.VERCEL_URL || 'unknown';

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 20,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        background: '#070a14',
        color: 'rgba(255,255,255,0.92)',
      }}
    >
      <h1 style={{ margin: '0 0 12px 0' }}>OpenworkTown — Deploy Test</h1>
      <p style={{ marginTop: 0, opacity: 0.85 }}>
        If you can load this page, the current deployment is serving fresh app-router routes.
      </p>

      <div
        style={{
          padding: 14,
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(0,0,0,0.35)',
          maxWidth: 680,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10 }}>
          <div style={{ opacity: 0.75 }}>Commit SHA</div>
          <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{envSha}</div>

          <div style={{ opacity: 0.75 }}>Branch</div>
          <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{envRef}</div>

          <div style={{ opacity: 0.75 }}>Vercel URL</div>
          <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{envUrl}</div>

          <div style={{ opacity: 0.75 }}>Server time</div>
          <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{new Date().toISOString()}</div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            href="/"
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.14)',
              color: 'rgba(255,255,255,0.92)',
              textDecoration: 'none',
              background: 'rgba(255,255,255,0.06)',
            }}
          >
            Open map
          </a>
          <a
            href="/api/live"
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.14)',
              color: 'rgba(255,255,255,0.92)',
              textDecoration: 'none',
              background: 'rgba(255,255,255,0.06)',
            }}
          >
            /api/live
          </a>
        </div>
      </div>

      <p style={{ marginTop: 18, opacity: 0.75 }}>
        Tip: on iPhone Safari, try opening <code>/test</code> in a Private tab to bypass cache.
      </p>
    </main>
  );
}
