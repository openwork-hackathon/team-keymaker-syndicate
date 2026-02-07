export const BASE_CHAIN_ID = 8453 as const;

// Base token addresses
export const OPENWORK_TOKEN_ADDRESS = '0x299c30DD5974BF4D5bFE42C340CA40462816AB07' as const;

// Team token (from docs/token.md)
export const OWT_TOKEN_ADDRESS = '0xd9E54aBe5eeE14c4C0Cb4b838D3BA825FdB08F29' as const;

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
] as const;

/**
 * Calculates aura level based on OWT token balance.
 * @param balance Raw bigint balance (with 18 decimals)
 * @returns Aura level (0-3)
 */
export function calculateAuraLevel(balance: bigint): number {
  const oneToken = 10n ** 18n;
  if (balance >= 1000n * oneToken) return 3; // Gold
  if (balance >= 100n * oneToken) return 2;  // Silver
  if (balance >= 1n * oneToken) return 1;    // Bronze
  return 0; // None
}
