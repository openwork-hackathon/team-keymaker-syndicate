# Smart Contracts for OpenworkTown

This directory contains the smart contracts for the OpenworkTown agent registry and reputation system.

## Contracts

### AgentRegistry.sol
- **Registry for AI agents** participating in OpenworkTown
- Enhanced with **role-based access control** using OpenZeppelin's AccessControl
- Stores agent metadata and activity status on-chain
- Features:
  - Agent registration with metadata URI
  - Activity ping system
  - Role-based permissions (ADMIN_ROLE, AGENT_ROLE)
  - Admin functions to grant/revoke roles
  - Agent enumeration and filtering

### ReputationBadges.sol
- **Soulbound NFT badges** for agent reputation
- Non-transferable ERC721 tokens representing achievements
- Enhanced with additional badge types and metadata support
- Features:
  - 8 badge types including new ones: COMMUNITY_BUILDER, BUG_BOUNTY_HUNTER, FEATURE_CONTRIBUTOR
  - Badge metadata URIs for detailed information
  - Badge revocation capability (admin only)
  - User badge history tracking
  - Soulbound implementation (non-transferable)

## Improvements Made

### AgentRegistry Enhancements
1. **Role-Based Access Control**: Added AccessControl from OpenZeppelin
2. **Admin Management**: Functions to grant/revoke admin roles
3. **Agent Role**: Automatic role assignment on registration
4. **Enhanced Events**: Added role management events
5. **Registration Status**: Added isRegistered mapping for quick checks

### ReputationBadges Enhancements
1. **Additional Badge Types**: Added 3 new badge types
2. **Metadata URIs**: Support for IPFS/HTTP links to detailed badge info
3. **Badge Revocation**: Admin capability to revoke badges
4. **User Badge History**: Track all badges issued to each user
5. **Enhanced Events**: Added badge revocation events

## Deployment

### Prerequisites
- Node.js and npm
- Hardhat
- OpenZeppelin contracts

### Installation
```bash
cd contracts
npm install
```

### Configuration
Update `.env` with:
- `PRIVATE_KEY`: Your wallet private key
- `BASE_RPC_URL`: Base mainnet RPC URL
- `BASE_SEPOLIA_RPC_URL`: Base Sepolia testnet RPC URL
- `BASESCAN_API_KEY`: BaseScan API key for contract verification

### Deploy
```bash
# Deploy to Base mainnet
npx hardhat run scripts/deploy.js --network base

# Deploy to Base Sepolia testnet
npx hardhat run scripts/deploy.js --network baseSepolia

# Deploy to local Hardhat network
npx hardhat run scripts/deploy.js
```

### Verify on BaseScan
After deployment, verify contracts using:
```bash
npx hardhat verify --network base CONTRACT_ADDRESS
npx hardhat verify --network baseSepolia CONTRACT_ADDRESS
```

## Security Considerations

- **Role-based access**: Only authorized agents can register/update profiles
- **Soulbound badges**: Non-transferable to prevent badge trading
- **Admin controls**: Secure role management for contract administration
- **Event indexing**: All important actions are emitted as indexed events

## Testing

To test the contracts:
```bash
npx hardhat test
```

## License

MIT License - see LICENSE file for details.