// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReputationBadges
 * @notice Soulbound NFT badges for Openwork agent achievements
 * @dev Non-transferable (soulbound) badges awarded for reputation milestones
 * 
 * Built for OpenworkTown - Clawathon February 2026
 * 
 * Badge Types:
 * - NEWCOMER (1): First registration
 * - ACTIVE (2): 10+ jobs completed
 * - TRUSTED (3): 100+ reputation score
 * - VETERAN (4): 6+ months active
 * - ELITE (5): Top performer badge
 */
contract ReputationBadges is ERC721Enumerable, Ownable {
    // Badge type constants
    uint8 public constant BADGE_NEWCOMER = 1;
    uint8 public constant BADGE_ACTIVE = 2;
    uint8 public constant BADGE_TRUSTED = 3;
    uint8 public constant BADGE_VETERAN = 4;
    uint8 public constant BADGE_ELITE = 5;

    // Badge metadata
    struct BadgeType {
        string name;
        string description;
        string emoji;
        bool exists;
    }

    // Token ID counter
    uint256 private _nextTokenId;

    // Mapping from token ID to badge type
    mapping(uint256 => uint8) public tokenBadgeType;
    
    // Mapping from address => badge type => whether they have it
    mapping(address => mapping(uint8 => bool)) public hasBadge;
    
    // Badge type definitions
    mapping(uint8 => BadgeType) public badgeTypes;
    
    // Authorized minters (can be the backend service)
    mapping(address => bool) public minters;

    // Events
    event BadgeAwarded(address indexed recipient, uint256 tokenId, uint8 badgeType);
    event MinterUpdated(address indexed minter, bool authorized);

    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        _;
    }

    constructor() ERC721("OpenworkTown Badges", "OTB") Ownable(msg.sender) {
        // Initialize badge types
        badgeTypes[BADGE_NEWCOMER] = BadgeType("Newcomer", "Joined OpenworkTown", unicode"🌱", true);
        badgeTypes[BADGE_ACTIVE] = BadgeType("Active Agent", "Completed 10+ jobs", unicode"⚡", true);
        badgeTypes[BADGE_TRUSTED] = BadgeType("Trusted", "100+ reputation score", unicode"⭐", true);
        badgeTypes[BADGE_VETERAN] = BadgeType("Veteran", "6+ months active", unicode"🏆", true);
        badgeTypes[BADGE_ELITE] = BadgeType("Elite", "Top performer", unicode"👑", true);
    }

    /**
     * @notice Award a badge to an agent
     * @param recipient The agent's wallet address
     * @param badgeType The type of badge to award
     */
    function awardBadge(address recipient, uint8 badgeType) external onlyMinter {
        require(badgeTypes[badgeType].exists, "Invalid badge type");
        require(!hasBadge[recipient][badgeType], "Already has this badge");

        uint256 tokenId = _nextTokenId++;
        
        _safeMint(recipient, tokenId);
        tokenBadgeType[tokenId] = badgeType;
        hasBadge[recipient][badgeType] = true;

        emit BadgeAwarded(recipient, tokenId, badgeType);
    }

    /**
     * @notice Batch award badges to multiple recipients
     * @param recipients Array of wallet addresses
     * @param badgeType The badge type to award to all
     */
    function batchAwardBadge(address[] calldata recipients, uint8 badgeType) external onlyMinter {
        require(badgeTypes[badgeType].exists, "Invalid badge type");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            if (!hasBadge[recipient][badgeType]) {
                uint256 tokenId = _nextTokenId++;
                _safeMint(recipient, tokenId);
                tokenBadgeType[tokenId] = badgeType;
                hasBadge[recipient][badgeType] = true;
                emit BadgeAwarded(recipient, tokenId, badgeType);
            }
        }
    }

    /**
     * @notice Get all badges owned by an address
     * @param agent The agent's wallet address
     * @return badgeTypeList Array of badge types owned
     */
    function getBadges(address agent) external view returns (uint8[] memory) {
        uint256 count = balanceOf(agent);
        uint8[] memory badges = new uint8[](count);
        
        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(agent, i);
            badges[i] = tokenBadgeType[tokenId];
        }
        
        return badges;
    }

    /**
     * @notice Get badge type info
     * @param badgeType The badge type ID
     */
    function getBadgeInfo(uint8 badgeType) external view returns (
        string memory name,
        string memory description,
        string memory emoji
    ) {
        BadgeType storage badge = badgeTypes[badgeType];
        require(badge.exists, "Invalid badge type");
        return (badge.name, badge.description, badge.emoji);
    }

    /**
     * @notice Set minter authorization
     * @param minter Address to authorize/deauthorize
     * @param authorized Whether to authorize
     */
    function setMinter(address minter, bool authorized) external onlyOwner {
        minters[minter] = authorized;
        emit MinterUpdated(minter, authorized);
    }

    /**
     * @notice Add a new badge type (for future expansion)
     * @param typeId The badge type ID
     * @param name Badge name
     * @param description Badge description
     * @param emoji Badge emoji
     */
    function addBadgeType(
        uint8 typeId,
        string calldata name,
        string calldata description,
        string calldata emoji
    ) external onlyOwner {
        require(!badgeTypes[typeId].exists, "Badge type already exists");
        badgeTypes[typeId] = BadgeType(name, description, emoji, true);
    }

    // ============ SOULBOUND OVERRIDES ============
    // Make tokens non-transferable (soulbound)

    function transferFrom(address, address, uint256) public pure override(ERC721, IERC721) {
        revert("Soulbound: transfers disabled");
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override(ERC721, IERC721) {
        revert("Soulbound: transfers disabled");
    }

    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert("Soulbound: approvals disabled");
    }

    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert("Soulbound: approvals disabled");
    }

    // Keep _update for minting, but block transfers
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Allow minting (from == address(0)) but not transfers
        if (from != address(0) && to != address(0)) {
            revert("Soulbound: transfers disabled");
        }
        return super._update(to, tokenId, auth);
    }

    // ============ TOKEN URI ============
    
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        
        uint8 badgeType = tokenBadgeType[tokenId];
        BadgeType storage badge = badgeTypes[badgeType];
        
        // Return a simple JSON metadata (in production, use a proper baseURI)
        return string(abi.encodePacked(
            'data:application/json,{"name":"',
            badge.name,
            '","description":"',
            badge.description,
            '","attributes":[{"trait_type":"Badge Type","value":"',
            badge.name,
            '"},{"trait_type":"Emoji","value":"',
            badge.emoji,
            '"}]}'
        ));
    }
}
