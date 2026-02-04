'use client';

import { useAccount, useConnect, useDisconnect, useReadContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { formatUnits } from 'viem';
import { ERC20_ABI, OPENWORK_TOKEN_ADDRESS, OWT_TOKEN_ADDRESS } from '@/lib/tokens';

function formatAmount(raw?: bigint, decimals = 18) {
  if (raw === undefined) return '—';
  try {
    const s = formatUnits(raw, decimals);
    // Keep it readable
    const [a, b] = s.split('.');
    if (!b) return a;
    return a + '.' + b.slice(0, 4);
  } catch {
    return String(raw);
  }
}

export default function WalletPanel() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  const openwork = useReadContract({
    abi: ERC20_ABI,
    address: OPENWORK_TOKEN_ADDRESS,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const owt = useReadContract({
    abi: ERC20_ABI,
    address: OWT_TOKEN_ADDRESS,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  // OPENWORK token is 18 decimals on Base.
  const openworkHuman = openwork.data ? Number(formatUnits(openwork.data, 18)) : null;
  const hasOpenwork = openworkHuman !== null && openworkHuman >= 100_000;

  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        bottom: 16,
        padding: 12,
        borderRadius: 14,
        background: 'rgba(0,0,0,0.42)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
        color: 'rgba(255,255,255,0.92)',
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
        fontSize: 12,
        lineHeight: 1.4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Wallet</div>
        {!isConnected ? (
          <button
            onClick={() => connect({ connector: connectors[0]! })}
            disabled={isPending || connectors.length === 0}
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
            {isPending ? 'Connecting…' : 'Connect'}
          </button>
        ) : (
          <button
            onClick={() => disconnect()}
            style={{
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: 'rgba(255,255,255,0.85)',
              cursor: 'pointer',
            }}
          >
            Disconnect
          </button>
        )}
      </div>

      <div style={{ marginTop: 8, opacity: 0.9 }}>
        <div>Network: {chainId === base.id ? 'Base' : chainId ? `Chain ${chainId}` : '—'}</div>
        <div style={{ wordBreak: 'break-all' }}>Address: {address ?? '—'}</div>
      </div>

      <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Token balances (Base)</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ opacity: 0.8 }}>OPENWORK</div>
            <div style={{ fontWeight: 700 }}>{formatAmount(openwork.data, 18)}</div>
          </div>
          <div>
            <div style={{ opacity: 0.8 }}>OWT</div>
            <div style={{ fontWeight: 700 }}>{formatAmount(owt.data, 18)}</div>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          {isConnected ? (
            hasOpenwork ? (
              <div style={{ color: 'rgba(170,255,170,0.95)' }}>✅ OPENWORK verified (≥ 100,000)</div>
            ) : (
              <div style={{ color: 'rgba(255,220,170,0.95)' }}>⚠️ Need ≥ 100,000 OPENWORK to be “verified”</div>
            )
          ) : (
            <div style={{ opacity: 0.8 }}>Connect a wallet to check balances.</div>
          )}
        </div>

        {error ? <div style={{ marginTop: 6, color: 'rgba(255,160,160,0.95)' }}>{error.message}</div> : null}

        <div style={{ marginTop: 8, opacity: 0.85 }}>
          Links: <a href="https://mint.club/token/base/OWT" target="_blank" rel="noreferrer" style={{ color: 'rgba(160,210,255,0.95)' }}>OWT</a>
          {' · '}
          <a href="https://dexscreener.com/base/0x2174bd22600ba56234e283c5bd0da2824cc84c15c437e5909c2c38c5701841ea" target="_blank" rel="noreferrer" style={{ color: 'rgba(160,210,255,0.95)' }}>OPENWORK</a>
        </div>
      </div>
    </div>
  );
}
