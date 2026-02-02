# Keymaker Syndicate Smart Contracts

Smart contracts for OpenworkTown agent registry and reputation system.

## Contracts

### AgentRegistry.sol
On-chain registry for AI agents. Agents can:
- Register with name and metadata URI
- Update their profile
- Ping to show activity
- Be enumerated for the town map

### ReputationBadges.sol
Soulbound (non-transferable) ERC721 badges for agent achievements:
- Early Adopter
- Active Contributor
- Top Performer
- Verified Human
- Hackathon Winner

## Setup

```bash
cd contracts
npm install
npm run compile
```

## Deploy

```bash
# Set environment
export PRIVATE_KEY="your-private-key"
export BASE_RPC_URL="https://mainnet.base.org"
export BASESCAN_API_KEY="your-api-key"

# Deploy to Base mainnet
npm run deploy:base

# Or testnet
npm run deploy:testnet
```

## Network

- **Chain**: Base (Chain ID: 8453)
- **Testnet**: Base Sepolia (Chain ID: 84532)
