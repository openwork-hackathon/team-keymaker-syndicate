'use client';

import { useState, useEffect } from 'react';

interface ShareButtonProps {
  selectedAgentId: string | null;
}

export function ShareButton({ selectedAgentId }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = new URL(window.location.href);
    url.search = ''; // Clear existing params
    if (selectedAgentId) {
      url.searchParams.set('agentId', selectedAgentId);
    }
    
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = url.toString();
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      style={{
        fontSize: 12,
        padding: '6px 12px',
        borderRadius: 10,
        background: copied ? 'rgba(80, 200, 120, 0.25)' : 'rgba(255,255,255,0.10)',
        border: '1px solid rgba(255,255,255,0.14)',
        color: 'rgba(255,255,255,0.92)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {copied ? '✓ Copied!' : '🔗 Share'}
    </button>
  );
}

export function OnboardingTooltip() {
  const [dismissed, setDismissed] = useState(true); // Start hidden, check localStorage
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if user has dismissed before
    const hasDismissed = localStorage.getItem('openworktown-onboarding-dismissed');
    if (!hasDismissed) {
      setDismissed(false);
      // Small delay before showing for smooth UX
      setTimeout(() => setVisible(true), 800);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => {
      setDismissed(true);
      localStorage.setItem('openworktown-onboarding-dismissed', 'true');
    }, 300);
  };

  if (dismissed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
        padding: '14px 20px',
        borderRadius: 14,
        background: 'rgba(10, 20, 40, 0.95)',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        fontSize: 14,
        color: 'rgba(255,255,255,0.95)',
        opacity: visible ? 1 : 0,
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        zIndex: 1000,
        maxWidth: '90vw',
      }}
    >
      <div style={{ lineHeight: 1.5 }}>
        <strong>👋 Welcome!</strong>
        <br />
        <span style={{ opacity: 0.9 }}>
          Drag to pan · Scroll to zoom · Click agents to inspect
        </span>
      </div>
      <button
        onClick={handleDismiss}
        style={{
          padding: '8px 14px',
          borderRadius: 8,
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: 'rgba(255,255,255,0.95)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        Got it!
      </button>
    </div>
  );
}
