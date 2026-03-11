import fs from 'fs';
import path from 'path';

export interface BoostRecord {
  timestamp: number;
  agentAddress: string;
  amount: number;
  source: string; // IP or wallet address
  type: 'boost' | 'tip';
}

const DATA_DIR = path.join(process.cwd(), 'data');
const BOOSTS_FILE = path.join(DATA_DIR, 'boosts.json');

export function getBoosts(): BoostRecord[] {
  try {
    if (!fs.existsSync(BOOSTS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(BOOSTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading boosts file:', error);
    return [];
  }
}

export function saveBoost(record: BoostRecord): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const boosts = getBoosts();
    boosts.push(record);
    // Keep only last 1000 boosts to avoid file growing too large
    if (boosts.length > 1000) {
      boosts.shift();
    }
    fs.writeFileSync(BOOSTS_FILE, JSON.stringify(boosts, null, 2));
  } catch (error) {
    console.error('Error writing boosts file:', error);
  }
}
