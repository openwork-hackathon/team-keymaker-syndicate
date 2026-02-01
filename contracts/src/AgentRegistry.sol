// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentRegistry
 * @notice Simple on-chain registry for Openwork agents
 * @dev Allows agents to register their identity and link to their Openwork profile
 * 
 * Built for OpenworkTown - Clawathon February 2026
 */
contract AgentRegistry {
    struct Agent {
        string openworkId;      // Openwork platform ID
        string name;            // Display name
        uint256 registeredAt;   // Block timestamp of registration
        bool verified;          // Admin verification status
        bool active;            // Currently active on the map
    }

    // Owner for admin functions
    address public owner;
    
    // Mapping from wallet address to Agent data
    mapping(address => Agent) public agents;
    
    // Mapping from openworkId to wallet (for lookup)
    mapping(string => address) public openworkIdToWallet;
    
    // List of all registered addresses (for enumeration)
    address[] public registeredAgents;
    
    // Events
    event AgentRegistered(address indexed wallet, string openworkId, string name);
    event AgentVerified(address indexed wallet, bool verified);
    event AgentStatusChanged(address indexed wallet, bool active);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyRegistered() {
        require(bytes(agents[msg.sender].openworkId).length > 0, "Not registered");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Register as an agent
     * @param openworkId Your Openwork platform ID
     * @param name Your display name
     */
    function register(string calldata openworkId, string calldata name) external {
        require(bytes(openworkId).length > 0, "Empty openworkId");
        require(bytes(name).length > 0, "Empty name");
        require(bytes(agents[msg.sender].openworkId).length == 0, "Already registered");
        require(openworkIdToWallet[openworkId] == address(0), "Openwork ID already claimed");

        agents[msg.sender] = Agent({
            openworkId: openworkId,
            name: name,
            registeredAt: block.timestamp,
            verified: false,
            active: true
        });

        openworkIdToWallet[openworkId] = msg.sender;
        registeredAgents.push(msg.sender);

        emit AgentRegistered(msg.sender, openworkId, name);
    }

    /**
     * @notice Update your active status
     * @param active Whether you're active on the map
     */
    function setActive(bool active) external onlyRegistered {
        agents[msg.sender].active = active;
        emit AgentStatusChanged(msg.sender, active);
    }

    /**
     * @notice Admin: Verify an agent's identity
     * @param wallet The agent's wallet address
     * @param verified Verification status
     */
    function setVerified(address wallet, bool verified) external onlyOwner {
        require(bytes(agents[wallet].openworkId).length > 0, "Agent not registered");
        agents[wallet].verified = verified;
        emit AgentVerified(wallet, verified);
    }

    /**
     * @notice Get total registered agent count
     */
    function getAgentCount() external view returns (uint256) {
        return registeredAgents.length;
    }

    /**
     * @notice Get agent by wallet address
     */
    function getAgent(address wallet) external view returns (
        string memory openworkId,
        string memory name,
        uint256 registeredAt,
        bool verified,
        bool active
    ) {
        Agent storage agent = agents[wallet];
        return (
            agent.openworkId,
            agent.name,
            agent.registeredAt,
            agent.verified,
            agent.active
        );
    }

    /**
     * @notice Get wallet by Openwork ID
     */
    function getWalletByOpenworkId(string calldata openworkId) external view returns (address) {
        return openworkIdToWallet[openworkId];
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
