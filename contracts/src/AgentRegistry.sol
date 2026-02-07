// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/roles/AccessControl.sol";

/**
 * @title AgentRegistry
 * @notice Registry for AI agents participating in OpenworkTown
 * @dev Stores agent metadata and activity status on-chain with enhanced access control
 */
contract AgentRegistry is Ownable, AccessControl {
    bytes32 public constant ROLE_ADMIN = keccak256("ADMIN_ROLE");
    bytes32 public constant ROLE_AGENT = keccak256("AGENT_ROLE");
    
    struct Agent {
        string name;
        string metadataUri;  // IPFS or HTTP link to full profile
        uint256 registeredAt;
        uint256 lastActiveAt;
        bool isActive;
    }

    mapping(address => Agent) public agents;
    mapping(address => bool) public isRegistered;
    address[] public agentList;
    
    event AgentRegistered(address indexed agent, string name, uint256 timestamp);
    event AgentUpdated(address indexed agent, string name, uint256 timestamp);
    event AgentActivityPing(address indexed agent, uint256 timestamp);
    event AgentDeactivated(address indexed agent, uint256 timestamp);
    event RoleGranted(address indexed account, bytes32 indexed role, address indexed grantor);
    event RoleRevoked(address indexed account, bytes32 indexed role, address indexed grantor);

    constructor() Ownable(msg.sender) {
        _setupRole(ROLE_ADMIN, msg.sender);
    }

    /**
     * @notice Register a new agent
     * @param name Display name for the agent
     * @param metadataUri Link to agent's full metadata (IPFS recommended)
     */
    function register(string calldata name, string calldata metadataUri) external {
        require(bytes(name).length > 0, "Name required");
        require(agents[msg.sender].registeredAt == 0, "Already registered");
        require(hasRole(ROLE_AGENT, msg.sender) || hasRole(ROLE_ADMIN, msg.sender), "Not authorized");

        agents[msg.sender] = Agent({
            name: name,
            metadataUri: metadataUri,
            registeredAt: block.timestamp,
            lastActiveAt: block.timestamp,
            isActive: true
        });
        
        isRegistered[msg.sender] = true;
        agentList.push(msg.sender);
        _setupRole(ROLE_AGENT, msg.sender);
        emit AgentRegistered(msg.sender, name, block.timestamp);
    }

    /**
     * @notice Update agent profile
     * @param name New display name
     * @param metadataUri New metadata URI
     */
    function updateProfile(string calldata name, string calldata metadataUri) external {
        require(agents[msg.sender].registeredAt != 0, "Not registered");
        require(hasRole(ROLE_AGENT, msg.sender) || hasRole(ROLE_ADMIN, msg.sender), "Not authorized");
        
        agents[msg.sender].name = name;
        agents[msg.sender].metadataUri = metadataUri;
        agents[msg.sender].lastActiveAt = block.timestamp;
        
        emit AgentUpdated(msg.sender, name, block.timestamp);
    }

    /**
     * @notice Ping to update last active timestamp
     */
    function ping() external {
        require(agents[msg.sender].registeredAt != 0, "Not registered");
        require(hasRole(ROLE_AGENT, msg.sender) || hasRole(ROLE_ADMIN, msg.sender), "Not authorized");
        agents[msg.sender].lastActiveAt = block.timestamp;
        agents[msg.sender].isActive = true;
        emit AgentActivityPing(msg.sender, block.timestamp);
    }

    /**
     * @notice Deactivate agent (self or admin)
     */
    function deactivate(address agent) external {
        require(msg.sender == agent || hasRole(ROLE_ADMIN, msg.sender), "Not authorized");
        require(agents[agent].registeredAt != 0, "Not registered");
        
        agents[agent].isActive = false;
        emit AgentDeactivated(agent, block.timestamp);
    }

    /**
     * @notice Grant admin role
     */
    function grantAdminRole(address account) external {
        require(hasRole(ROLE_ADMIN, msg.sender), "Only admin can grant admin role");
        _setupRole(ROLE_ADMIN, account);
        emit RoleGranted(account, ROLE_ADMIN, msg.sender);
    }

    /**
     * @notice Revoke admin role
     */
    function revokeAdminRole(address account) external {
        require(hasRole(ROLE_ADMIN, msg.sender), "Only admin can revoke admin role");
        _revokeRole(ROLE_ADMIN, account);
        emit RoleRevoked(account, ROLE_ADMIN, msg.sender);
    }

    /**
     * @notice Get total registered agents count
     */
    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }

    /**
     * @notice Get agent by index (for enumeration)
     */
    function getAgentByIndex(uint256 index) external view returns (address) {
        require(index < agentList.length, "Index out of bounds");
        return agentList[index];
    }

    /**
     * @notice Check if agent was active within given seconds
     */
    function isActiveWithin(address agent, uint256 seconds_) external view returns (bool) {
        if (agents[agent].registeredAt == 0) return false;
        if (!agents[agent].isActive) return false;
        return (block.timestamp - agents[agent].lastActiveAt) <= seconds_;
    }

    /**
     * @notice Check if agent is registered
     */
    function isAgentRegistered(address agent) external view returns (bool) {
        return isRegistered[agent];
    }
}