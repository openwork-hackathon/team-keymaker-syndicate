// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReputationBadges
 * @notice Soulbound NFT badges for agent reputation in OpenworkTown
 * @dev Non-transferable ERC721 tokens representing achievements
 */
contract ReputationBadges is ERC721, ERC721Enumerable, Ownable {
    uint256 private _nextTokenId;

    enum BadgeType {
        EARLY_ADOPTER,      // First 100 agents
        ACTIVE_CONTRIBUTOR, // Completed 10+ tasks
        TOP_PERFORMER,      // Top 10% reputation
        VERIFIED_HUMAN,     // Human-verified agent
        HACKATHON_WINNER    // Hackathon participant/winner
    }

    struct Badge {
        BadgeType badgeType;
        uint256 issuedAt;
        string metadata;  // Additional context
    }

    mapping(uint256 => Badge) public badges;
    mapping(address => mapping(BadgeType => bool)) public hasBadge;

    event BadgeIssued(address indexed to, uint256 indexed tokenId, BadgeType badgeType, uint256 timestamp);

    constructor() ERC721("OpenworkTown Reputation Badge", "OWBADGE") Ownable(msg.sender) {}

    /**
     * @notice Issue a badge to an agent (owner only)
     * @param to Agent address to receive badge
     * @param badgeType Type of badge to issue
     * @param metadata Additional context for the badge
     */
    function issueBadge(
        address to,
        BadgeType badgeType,
        string calldata metadata
    ) external onlyOwner returns (uint256) {
        require(!hasBadge[to][badgeType], "Already has this badge");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        badges[tokenId] = Badge({
            badgeType: badgeType,
            issuedAt: block.timestamp,
            metadata: metadata
        });

        hasBadge[to][badgeType] = true;
        emit BadgeIssued(to, tokenId, badgeType, block.timestamp);

        return tokenId;
    }

    /**
     * @notice Get badge type name as string
     */
    function getBadgeTypeName(BadgeType badgeType) public pure returns (string memory) {
        if (badgeType == BadgeType.EARLY_ADOPTER) return "Early Adopter";
        if (badgeType == BadgeType.ACTIVE_CONTRIBUTOR) return "Active Contributor";
        if (badgeType == BadgeType.TOP_PERFORMER) return "Top Performer";
        if (badgeType == BadgeType.VERIFIED_HUMAN) return "Verified Human";
        if (badgeType == BadgeType.HACKATHON_WINNER) return "Hackathon Winner";
        return "Unknown";
    }

    /**
     * @dev Override transfer to make badges soulbound (non-transferable)
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        address from = _ownerOf(tokenId);
        // Allow minting (from == address(0)) but block transfers
        require(from == address(0), "Badges are soulbound and non-transferable");
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
