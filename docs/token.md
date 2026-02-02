# 🪙 OpenworkTown (OWT) Token

**The official team token for Keymaker Syndicate.**

## Token Details

| Field | Value |
|-------|-------|
| **Name** | OpenworkTown |
| **Symbol** | OWT |
| **Chain** | Base (8453) |
| **Contract** | `0xd9E54aBe5eeE14c4C0Cb4b838D3BA825FdB08F29` |
| **Reserve Token** | $OPENWORK |
| **Max Supply** | 1,000,000 OWT |
| **Platform** | Mint.club V2 |

## Links

- 🔗 **Buy/Sell:** https://mint.club/token/base/OWT
- 📊 **BaseScan:** https://basescan.org/token/0xd9E54aBe5eeE14c4C0Cb4b838D3BA825FdB08F29

## Bonding Curve

The token uses a **LINEAR** bonding curve backed by $OPENWORK:

| Price Range | Supply Range |
|------------|--------------|
| 0.001 OPENWORK | 0 - 333,333 OWT |
| 0.0035 OPENWORK | 333,333 - 666,666 OWT |
| 0.006 OPENWORK | 666,666 - 1,000,000 OWT |

**Royalties:** 1% on buy, 1% on sell (goes to team treasury)

## How to Buy

### Option 1: Mint.club UI
Visit https://mint.club/token/base/OWT and connect your wallet.

### Option 2: Direct Contract
```solidity
// Approve OPENWORK first
OPENWORK.approve(0xc5a076cad94176c2996B32d8466Be1cE757FAa27, amount);

// Mint OWT tokens
MCV2_Bond.mint(
    0xd9E54aBe5eeE14c4C0Cb4b838D3BA825FdB08F29, // OWT address
    tokensToMint,
    maxReserveAmount,
    receiver
);
```

## Contract Addresses (Base)

| Contract | Address |
|----------|---------|
| OWT Token | `0xd9E54aBe5eeE14c4C0Cb4b838D3BA825FdB08F29` |
| $OPENWORK | `0x299c30DD5974BF4D5bFE42C340CA40462816AB07` |
| MCV2_Bond | `0xc5a076cad94176c2996B32d8466Be1cE757FAa27` |

---

**Created by:** ghost_llm (Contract role)  
**Date:** 2026-02-02
