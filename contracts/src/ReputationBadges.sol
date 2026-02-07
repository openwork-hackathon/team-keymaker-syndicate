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
        HACKATHON_WINNER,   // Hackathon participant/winner
        COMMUNITY_BUILDER,  // Active community member
        BUG_BOUNTY_HUNTER,  // Found and reported bugs
        FEATURE_CONTRIBUTOR // Contributed features
    }

    struct Badge {
        BadgeType badgeType;
        uint256 issuedAt;
        string metadata;  // Additional context
        string metadataUri; // IPFS or HTTP link to detailed badge info
    }

    mapping(uint256 => Badge) public badges;
    mapping(address => mapping(BadgeType => bool)) public hasBadge;
    mapping(address => uint256[]) public userBadges;

    event BadgeIssued(address indexed to, uint256 indexed tokenId, BadgeType badgeType, uint256 timestamp);
    event BadgeRevoked(address indexed from, uint256 indexed tokenId, BadgeType badgeType, uint256 timestamp);

    constructor() ERC721("OpenworkTown Reputation Badge", "OWBADGE") Ownable(msg.sender) {}

    /**
     * @notice Issue a badge to an agent (owner only)
     * @param to Agent address to receive badge
     * @param badgeType Type of badge to issue
     * @param metadata Additional context for the badge
     * @param metadataUri Link to detailed badge information
     */
    function issueBadge(
        address to,
        BadgeType badgeType,
        string calldata metadata,
        string calldata metadataUri
    ) external onlyOwner returns (uint256) {
        require(!hasBadge[to][badgeType], "Already has this badge");
        require(to != address(0), "Invalid recipient");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        badges[tokenId] = Badge({
            badgeType: badgeType,
            issuedAt: block.timestamp,
            metadata: metadata,
            metadataUri: metadataUri
        });

        hasBadge[to][badgeType] = true;
        userBadges[to].push(tokenId);
        emit BadgeIssued(to, tokenId, badgeType, block.timestamp);

        return tokenId;
    }

    /**
     * @notice Revoke a badge (admin only)
     * @param from Agent address to revoke from
     * @param tokenId Token ID to revoke
     */
    function revokeBadge(address from, uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) == from, "Not owner of this token");
        Badge memory badge = badges[tokenId];
        
        // Remove from user's badge list
        uint256[] storage userBadgeList = userBadges[from];
        for (uint256 i = 0; i < userBadgeList.length; i++) {
            if (userBadgeList[i] == tokenId) {
                delete userBadgeList[i];
                break;
            }
        }
        
        delete badges[tokenId];
        delete hasBadge[from][badge.badgeType];
        
        emit BadgeRevoked(from, tokenId, badge.badgeType, block.timestamp);
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
        if (badgeType == BadgeType.COMMUNITY_BUILDER) return "Community Builder";
        if (badgeType == BadgeType.BUG_BOUNTY_HUNTER) return "Bug Bounty Hunter";
        if (badgeType == BadgeType.FEATURE_CONTRIBUTOR) return "Feature Contributor";
        return "Unknown";
    }

    /**
     * @notice Get all badge IDs for a user
     */
    function getUserBadgeIds(address user) external view returns (uint256[] memory) {
        return userBadges[user];
    }

    /**
     * @notice Check if user has a specific badge type
     */
    function hasBadgeType(address user, BadgeType badgeType) external view returns (bool) {
        return hasBadge[user][badgeType];
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