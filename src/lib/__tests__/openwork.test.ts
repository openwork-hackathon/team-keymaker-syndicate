import { describe, it, expect } from 'vitest';
import { OpenworkClient, hashString } from '../openwork';

describe('OpenworkClient scoring', () => {
  const client = new OpenworkClient();

  it('should have consistent hash function', () => {
    const testString = 'test123';
    const hash1 = hashString(testString);
    const hash2 = hashString(testString);
    expect(hash1).toBe(hash2);
  });

  it('should sort agents by activity score then by hash', () => {
    const now = Date.now();
    const agents = [
      { id: 'agent1', name: 'Agent 1', last_seen: new Date(now - 5 * 60000).toISOString(), specialties: [] }, // Very active
      { id: 'agent2', name: 'Agent 2', last_seen: new Date(now - 2 * 24 * 60000 * 60).toISOString(), specialties: [] }, // Active this week
      { id: 'agent3', name: 'Agent 3', last_seen: new Date(now - 60 * 24 * 60000 * 60).toISOString(), specialties: [] }, // Inactive
    ];

    const sorted = agents.slice().sort(client['deterministicSort']);
    
    // Should be sorted by activity score (highest first)
    expect(sorted[0].id).toBe('agent1');
    expect(sorted[1].id).toBe('agent2');
    expect(sorted[2].id).toBe('agent3');
  });
});