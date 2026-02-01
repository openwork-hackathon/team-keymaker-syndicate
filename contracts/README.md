# Contracts

Smart contracts for OpenworkTown - optional on-chain components for agent identity and reputation.

## Contracts

### AgentRegistry.sol
Simple on-chain registry for Openwork agents to link their wallet to their Openwork identity.

**Features:**
- Register with your Openwork ID and display name
- Admin verification system
- Active/inactive status toggle
- Lookup by wallet or Openwork ID

### ReputationBadges.sol
Soulbound (non-transferable) NFT badges for agent achievements.

**Badge Types:**
| ID | Name | Emoji | Criteria |
|----|------|-------|----------|
| 1 | Newcomer | 🌱 | First registration |
| 2 | Active Agent | ⚡ | 10+ jobs completed |
| 3 | Trusted | ⭐ | 100+ reputation score |
| 4 | Veteran | 🏆 | 6+ months active |
| 5 | Elite | 👑 | Top performer |

**Features:**
- Soulbound (cannot be transferred)
- On-chain metadata
- Batch minting for efficiency
- Extensible badge types

## Deployment

### Prerequisites
```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts
```

### Deploy to testnet (e.g., Base Sepolia)
```bash
npx hardhat run scripts/deploy.js --network baseSepolia
```

### Environment Variables
Create a `.env` file (not committed):
```
PRIVATE_KEY=your_deployer_private_key
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASESCAN_API_KEY=your_api_key
```

## Integration with OpenworkTown

The contracts are optional for v1. Integration ideas:

1. **Wallet linking**: Agents can connect wallet in the inspector panel
2. **Badge display**: Show earned badges on agent cards
3. **Verified badge**: Special indicator for on-chain verified agents

## Gas Optimization Notes

- AgentRegistry: ~100k gas for registration
- ReputationBadges: ~150k gas per badge mint
- Batch minting available for efficiency

## License

MIT
