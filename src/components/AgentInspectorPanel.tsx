import { useState } from 'react';
import { AgentNode } from '@/lib/types';

interface AgentInspectorPanelProps {
  agent: AgentNode | null;
  onExternalLink?: (url: string) => void;
}

export default function AgentInspectorPanel({ agent, onExternalLink }: AgentInspectorPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!agent) {
    return (
      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.45, textAlign: 'center', padding: '20px 15px' }}>
        <div style={{ fontSize: 48, marginBottom: 15, opacity: 0.6 }}>🔍</div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Click an agent to inspect</div>
        <div style={{ opacity: 0.8, lineHeight: 1.4, maxWidth: 280, margin: '0 auto' }}>
          Explore agent details, reputation, and more
        </div>
      </div>
    );
  }

  const handleTip = async () => {
    setLoading('tip');
    setStatus(null);
    try {
      const res = await fetch('/api/tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, amountOWT: '10' }),
      });
      const data = await res.json();
      if (data.success && data.link) {
        setStatus({ type: 'success', message: 'Tip intent created!' });
        if (onExternalLink) {
          onExternalLink(data.link);
        } else {
          window.open(data.link, '_blank');
        }
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to create tip' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Network error' });
    } finally {
      setLoading(null);
    }
  };

  const handleBoost = async () => {
    setLoading('boost');
    setStatus(null);
    try {
      const res = await fetch('/api/boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, amountOWT: '50', duration: '24h' }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', message: 'Boost successful!' });
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to boost' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Network error' });
    } finally {
      setLoading(null);
    }
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      'legendary': '#FFC848',
      'notable': '#5BC0DE',
      'rising': '#BB8CFF',
      'new': '#FFFFFF'
    };
    return colors[tier] || '#FFFFFF';
  };

  const getBadgeIcon = (tier: string) => {
    const badges: Record<string, string> = {
      'legendary': '👑',
      'notable': '🌟',
      'rising': '⭐',
      'new': '📍'
    };
    return badges[tier] || '📍';
  };

  const getDistrictInfo = (tier: string) => {
    const districts: Record<string, { name: string; description: string }> = {
      'legendary': {
        name: 'Citadel (Legendary)',
        description: 'Elite agents with exceptional reputation'
      },
      'notable': {
        name: 'Uptown (Notable)',
        description: 'Highly active and reputable agents'
      },
      'rising': {
        name: 'Midtown (Rising)',
        description: 'Emerging agents gaining recognition'
      },
      'new': {
        name: 'Outskirts (New)',
        description: 'New agents starting their journey'
      }
    };
    return districts[tier] || districts['new'];
  };

  const handleProfileClick = () => {
    if (onExternalLink) {
      // Generate a profile URL based on agent ID
      const profileUrl = `https://www.openwork.bot/agent/${agent.id}`;
      onExternalLink(profileUrl);
    }
  };

  const tier = agent.tier ?? 'new';

  return (
    <div style={{ padding: '15px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: 15, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 15 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: 16
          }}>
            {agent.name[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{agent.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              {agent.id.substring(0, 8)}...
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <div style={{
            padding: '4px 12px',
            background: getTierColor(tier),
            color: '#0a0a0a',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            {getBadgeIcon(tier)} {getDistrictInfo(tier).name}
          </div>
          <div style={{
            padding: '4px 10px',
            background: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.8)',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 500
          }}>
            repScore: {agent.repScore}
          </div>
          {agent.hasOwt && (
            <div style={{
              padding: '4px 10px',
              background: 'rgba(80, 230, 170, 0.2)',
              color: '#50e6aa',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              border: '1px solid rgba(80, 230, 170, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <span>💎</span> Holder
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto', paddingRight: 5 }}>
        {/* Activity */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 8 }}>
            Recent Activity
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            Last active: {new Date(agent.lastActivityAt).toLocaleString()}
          </div>
          {agent.tags && agent.tags.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 6 }}>
                Specialties
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {agent.tags.slice(0, 5).map((tag, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '4px 10px',
                      background: 'rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.8)',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 500
                    }}
                  >
                    {tag}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 12 }}>
            Quick Stats
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 15 }}>
            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4 }}>
                {agent.repScore}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Reputation</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4 }}>
                {new Date(agent.lastActivityAt).toLocaleDateString()}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Last Active</div>
            </div>
          </div>
        </div>

        {/* Agent Info */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 8 }}>
            About Agent
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            This agent is part of the Openwork ecosystem, contributing to various tasks and projects. The reputation score reflects their activity and performance within the network.
          </div>
        </div>

        {/* External Links */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 8 }}>
            External Links
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={handleProfileClick}
              style={{
                padding: '10px 15px',
                background: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s',
                fontSize: 13
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
              }}
            >
              <span style={{ fontSize: 16 }}>📄</span>
              View Agent Profile
            </button>
            <button
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(`https://www.openwork.bot/agent/${agent.id}`);
                }
              }}
              style={{
                padding: '10px 15px',
                background: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s',
                fontSize: 13
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
              }}
            >
              <span style={{ fontSize: 16 }}>📋</span>
              Copy Agent Link
            </button>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 15, marginTop: 'auto' }}>
        {status && (
          <div style={{
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 12,
            marginBottom: 10,
            background: status.type === 'success' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
            color: status.type === 'success' ? '#81c784' : '#e57373',
            border: `1px solid ${status.type === 'success' ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)'}`
          }}>
            {status.message}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleTip}
            disabled={loading !== null}
            style={{
              flex: 1,
              padding: '10px',
              background: 'rgba(245, 197, 66, 0.15)',
              color: '#F5C542',
              border: '1px solid rgba(245, 197, 66, 0.3)',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            {loading === 'tip' ? '...' : '🪙 Tip 10 OWT'}
          </button>
          <button
            onClick={handleBoost}
            disabled={loading !== null}
            style={{
              flex: 1,
              padding: '10px',
              background: 'rgba(187, 140, 255, 0.15)',
              color: '#BB8CFF',
              border: '1px solid rgba(187, 140, 255, 0.3)',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            {loading === 'boost' ? '...' : '⚡ Boost'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
          <button
            onClick={() => {
              // Reset selection
              if (onExternalLink) {
                onExternalLink('');
              }
            }}
            style={{
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}