// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
/**
 * @title AIAgentNFT
 * @dev NFT contract for AI Agents with ownership transfer and rental functionality
 */
contract AIAgentNFT is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    uint256 private _tokenIdCounter;
    
    // Basic agent metadata structure
    struct AgentMetadata {
        string name;
        string description;
        string model;
        uint256 usageCost; // Cost per use in wei
        uint256 maxUsagesPerDay;
        bool isForRent;
        uint256 rentPricePerUse; // Rent price per use in wei
        string ipfsHash; // IPFS hash for agent configuration
        address creator;
        uint256 createdAt;
    }
    
    // Tool configuration structure
    struct ToolConfig {
        bool enableWebSearch;
        bool enableCodeExecution;
        bool enableBrowserAutomation;
        bool enableWolframAlpha;
        bool enableStreaming;
        string responseFormat; // "text" or "json_object"
        uint256 temperature; // Scaled by 1000 (e.g., 700 = 0.7)
        uint256 maxTokens;
        uint256 topP; // Scaled by 1000 (e.g., 1000 = 1.0)
        uint256 frequencyPenalty; // Scaled by 1000
        uint256 presencePenalty; // Scaled by 1000
    }
    
    // Mapping from token ID to agent metadata
    mapping(uint256 => AgentMetadata) public agentMetadata;
    
    // Mapping from token ID to tool configuration
    mapping(uint256 => ToolConfig) public toolConfig;
    
    // Mapping from token ID to current owner
    mapping(uint256 => address) public tokenOwners;
    
    // Mapping from token ID to rental information
    mapping(uint256 => mapping(address => uint256)) public rentalBalances; // user => remaining uses
    mapping(uint256 => mapping(address => uint256)) public lastRentalUse; // user => timestamp
    mapping(uint256 => mapping(address => uint256)) public prepaidInferenceBalances; // user => prepaid inference uses
    
    // Mapping from token ID to sale information
    mapping(uint256 => bool) public isForSale; // tokenId => is for sale
    mapping(uint256 => uint256) public salePrice; // tokenId => sale price in wei
    
    // Array to store all token IDs for enumeration
    uint256[] private _allTokenIds;
    
    // Events
    event AgentMinted(uint256 indexed tokenId, address indexed creator, string name);
    event AgentTransferred(uint256 indexed tokenId, address indexed from, address indexed to);
    event AgentRented(uint256 indexed tokenId, address indexed renter, uint256 uses, uint256 totalCost);
    event AgentUsed(uint256 indexed tokenId, address indexed user, bool isOwner);
    event AgentListedForSale(uint256 indexed tokenId, address indexed seller, uint256 price);
    event AgentDelistedFromSale(uint256 indexed tokenId, address indexed seller);
    event AgentSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    
    constructor() ERC721("AIAgentNFT", "AIAGENT") Ownable(msg.sender) {}
    
    /**
     * @dev Mint a new AI Agent NFT
     * @param to Address to mint the NFT to
     * @param metadata Agent metadata
     * @param config Tool configuration
     * @param _tokenURI URI for the token metadata
     */
    function mintAgent(
        address to,
        AgentMetadata memory metadata,
        ToolConfig memory config,
        string memory _tokenURI
    ) public returns (uint256) {
        uint256 tokenId = ++_tokenIdCounter;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        
        agentMetadata[tokenId] = metadata;
        toolConfig[tokenId] = config;
        tokenOwners[tokenId] = to;
        
        // Add to enumeration array
        _allTokenIds.push(tokenId);
        
        emit AgentMinted(tokenId, metadata.creator, metadata.name);
        return tokenId;
    }
    
    /**
     * @dev Transfer agent ownership (overrides _update to update tokenOwners)
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = super._update(to, tokenId, auth);
        tokenOwners[tokenId] = to;
        emit AgentTransferred(tokenId, from, to);
        return from;
    }

    
    /**
     * @dev Rent an agent for a specific number of uses
     * @param tokenId Token ID of the agent
     * @param uses Number of uses to rent
     */
    function rentAgent(uint256 tokenId, uint256 uses) public payable nonReentrant {
        require(ownerOf(tokenId) != address(0), "Agent does not exist");
        require(agentMetadata[tokenId].isForRent, "Agent is not available for rent");
        require(uses > 0, "Must rent at least 1 use");
        
        uint256 totalCost = agentMetadata[tokenId].rentPricePerUse * uses;
        require(msg.value >= totalCost, "Insufficient payment for rental");
        
        // Add uses to renter's balance
        rentalBalances[tokenId][msg.sender] += uses;
        
        // Refund excess payment
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }
        
        emit AgentRented(tokenId, msg.sender, uses, totalCost);
    }
    
    /**
     * @dev Rent an agent with prepaid inference costs
     * @param tokenId Token ID of the agent
     * @param uses Number of uses to rent
     */
    function rentAgentWithInference(uint256 tokenId, uint256 uses) public payable nonReentrant {
        require(ownerOf(tokenId) != address(0), "Agent does not exist");
        require(agentMetadata[tokenId].isForRent, "Agent is not available for rent");
        require(uses > 0, "Must rent at least 1 use");
        
        uint256 rentalCost = agentMetadata[tokenId].rentPricePerUse * uses;
        uint256 inferenceCost = agentMetadata[tokenId].usageCost * uses;
        uint256 totalCost = rentalCost + inferenceCost;
        
        require(msg.value >= totalCost, "Insufficient payment for rental and inference");
        
        // Add uses to renter's balance
        rentalBalances[tokenId][msg.sender] += uses;
        
        // Add prepaid inference uses
        prepaidInferenceBalances[tokenId][msg.sender] += uses;
        
        // Refund excess payment
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }
        
        emit AgentRented(tokenId, msg.sender, uses, totalCost);
    }
    
    /**
     * @dev Use an agent (either as owner or renter) - requires payment
     * @param tokenId Token ID of the agent
     * @return success Whether the use was successful
     */
    function useAgent(uint256 tokenId) public payable nonReentrant returns (bool) {
        require(ownerOf(tokenId) != address(0), "Agent does not exist");
        
        address user = msg.sender;
        bool isOwner = (ownerOf(tokenId) == user);
        
        if (isOwner) {
            // Owner can use for free (no payment required)
            emit AgentUsed(tokenId, user, true);
            return true;
        } else {
            // Renter needs to have rental balance
            require(rentalBalances[tokenId][user] > 0, "No rental balance");
            
            // Check daily usage limit
            uint256 today = block.timestamp / 1 days;
            uint256 lastUse = lastRentalUse[tokenId][user] / 1 days;
            
            if (today > lastUse) {
                // Reset daily usage for new day
                lastRentalUse[tokenId][user] = block.timestamp;
            }
            
            // Consume one rental use
            rentalBalances[tokenId][user]--;
            lastRentalUse[tokenId][user] = block.timestamp;
            
            // Pay inference cost per use
            require(msg.value >= agentMetadata[tokenId].usageCost, "Insufficient payment for inference");
            
            emit AgentUsed(tokenId, user, false);
            return true;
        }
    }
    
    /**
     * @dev Consume one rental use without payment (for prepaid rentals)
     * @param tokenId Token ID of the agent
     * @return success Whether the use was consumed successfully
     */
    function consumeRentalUse(uint256 tokenId) public nonReentrant returns (bool) {
        require(ownerOf(tokenId) != address(0), "Agent does not exist");
        
        address user = msg.sender;
        bool isOwner = (ownerOf(tokenId) == user);
        
        if (isOwner) {
            // Owner can use for free
            emit AgentUsed(tokenId, user, true);
            return true;
        } else {
            // Renter needs to have rental balance
            require(rentalBalances[tokenId][user] > 0, "No rental balance");
            
            // Check daily usage limit
            uint256 today = block.timestamp / 1 days;
            uint256 lastUse = lastRentalUse[tokenId][user] / 1 days;
            
            if (today > lastUse) {
                // Reset daily usage for new day
                lastRentalUse[tokenId][user] = block.timestamp;
            }
            
            // Consume one rental use
            rentalBalances[tokenId][user]--;
            lastRentalUse[tokenId][user] = block.timestamp;
            
            emit AgentUsed(tokenId, user, false);
            return true;
        }
    }
    
    /**
     * @dev Use an agent with prepaid inference (no payment required)
     * @param tokenId Token ID of the agent
     * @return success Whether the use was successful
     */
    function useAgentPrepaid(uint256 tokenId) public nonReentrant returns (bool) {
        require(ownerOf(tokenId) != address(0), "Agent does not exist");
        
        address user = msg.sender;
        bool isOwner = (ownerOf(tokenId) == user);
        
        if (isOwner) {
            // Owner can use for free (no payment or balance checks needed)
            emit AgentUsed(tokenId, user, true);
            return true;
        } else {
            // Renter needs to have rental balance
            require(rentalBalances[tokenId][user] > 0, "No rental balance");
            
            // Check daily usage limit
            uint256 today = block.timestamp / 1 days;
            uint256 lastUse = lastRentalUse[tokenId][user] / 1 days;
            
            if (today > lastUse) {
                // Reset daily usage for new day
                lastRentalUse[tokenId][user] = block.timestamp;
            }
            
            // Consume one rental use
            rentalBalances[tokenId][user]--;
            lastRentalUse[tokenId][user] = block.timestamp;
            
            // Must have prepaid inference costs
            require(prepaidInferenceBalances[tokenId][user] > 0, "No prepaid inference balance");
            
            // Use prepaid inference
            prepaidInferenceBalances[tokenId][user]--;
            
            emit AgentUsed(tokenId, user, false);
            return true;
        }
    }
    
    /**
     * @dev Get agent metadata
     * @param tokenId Token ID of the agent
     * @return metadata Agent metadata
     */
    function getAgentMetadata(uint256 tokenId) public view returns (AgentMetadata memory) {
        require(ownerOf(tokenId) != address(0), "Agent does not exist");
        return agentMetadata[tokenId];
    }
    
    /**
     * @dev Get tool configuration
     * @param tokenId Token ID of the agent
     * @return config Tool configuration
     */
    function getToolConfig(uint256 tokenId) public view returns (ToolConfig memory) {
        require(ownerOf(tokenId) != address(0), "Agent does not exist");
        return toolConfig[tokenId];
    }
    
    /**
     * @dev Get rental balance for a user
     * @param tokenId Token ID of the agent
     * @param user User address
     * @return balance Remaining rental uses
     */
    function getRentalBalance(uint256 tokenId, address user) public view returns (uint256) {
        return rentalBalances[tokenId][user];
    }
    
    /**
     * @dev Get prepaid inference balance for a user
     * @param tokenId Token ID of the agent
     * @param user User address
     * @return balance Remaining prepaid inference uses
     */
    function getPrepaidInferenceBalance(uint256 tokenId, address user) public view returns (uint256) {
        return prepaidInferenceBalances[tokenId][user];
    }
    
    /**
     * @dev Check if user can use agent
     * @param tokenId Token ID of the agent
     * @param user User address
     * @return canUse Whether user can use the agent
     */
    function canUseAgent(uint256 tokenId, address user) public view returns (bool) {
        if (ownerOf(tokenId) == address(0)) return false;
        
        // Owner can always use
        if (ownerOf(tokenId) == user) return true;
        
        // Renter can use if they have balance
        return rentalBalances[tokenId][user] > 0;
    }
    
    /**
     * @dev Update agent metadata (only by owner)
     * @param tokenId Token ID of the agent
     * @param newMetadata New metadata
     */
    function updateAgentMetadata(uint256 tokenId, AgentMetadata memory newMetadata) public {
        require(ownerOf(tokenId) == msg.sender, "Only agent owner can update metadata");
        agentMetadata[tokenId] = newMetadata;
    }
    
    /**
     * @dev Update tool configuration (only by owner)
     * @param tokenId Token ID of the agent
     * @param newConfig New tool configuration
     */
    function updateToolConfig(uint256 tokenId, ToolConfig memory newConfig) public {
        require(ownerOf(tokenId) == msg.sender, "Only agent owner can update tool config");
        toolConfig[tokenId] = newConfig;
    }
    
    /**
     * @dev Get total number of agents
     * @return count Total number of minted agents
     */
    function getTotalAgents() public view returns (uint256) {
        return _allTokenIds.length;
    }
    
    /**
     * @dev Get all agent token IDs
     * @return tokenIds Array of all token IDs
     */
    function getAllTokenIds() public view returns (uint256[] memory) {
        return _allTokenIds;
    }
    
    /**
     * @dev Get agents with pagination
     * @param offset Starting index
     * @param limit Maximum number of agents to return
     * @return tokenIds Array of token IDs
     */
    function getAgentsPaginated(uint256 offset, uint256 limit) public view returns (uint256[] memory) {
        uint256 total = _allTokenIds.length;
        if (offset >= total) {
            return new uint256[](0);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = _allTokenIds[i];
        }
        
        return result;
    }
    
    /**
     * @dev Get agents owned by a specific address
     * @param owner Address to check
     * @return tokenIds Array of token IDs owned by the address
     */
    function getAgentsByOwner(address owner) public view returns (uint256[] memory) {
        uint256[] memory ownedTokens = new uint256[](_allTokenIds.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < _allTokenIds.length; i++) {
            if (ownerOf(_allTokenIds[i]) == owner) {
                ownedTokens[count] = _allTokenIds[i];
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = ownedTokens[i];
        }
        
        return result;
    }
    
    /**
     * @dev Get agents available for rent
     * @return tokenIds Array of token IDs available for rent
     */
    function getAgentsForRent() public view returns (uint256[] memory) {
        uint256[] memory rentableTokens = new uint256[](_allTokenIds.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < _allTokenIds.length; i++) {
            if (agentMetadata[_allTokenIds[i]].isForRent) {
                rentableTokens[count] = _allTokenIds[i];
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = rentableTokens[i];
        }
        
        return result;
    }
    
    /**
     * @dev List agent for sale
     * @param tokenId The token ID to list for sale
     * @param price The sale price in wei
     */
    function listAgentForSale(uint256 tokenId, uint256 price) public {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(price > 0, "Price must be greater than 0");
        
        isForSale[tokenId] = true;
        salePrice[tokenId] = price;
        
        emit AgentListedForSale(tokenId, msg.sender, price);
    }
    
    /**
     * @dev Delist agent from sale
     * @param tokenId The token ID to delist
     */
    function delistAgentFromSale(uint256 tokenId) public {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        
        isForSale[tokenId] = false;
        salePrice[tokenId] = 0;
        
        emit AgentDelistedFromSale(tokenId, msg.sender);
    }
    
    /**
     * @dev Buy agent NFT
     * @param tokenId The token ID to buy
     */
    function buyAgent(uint256 tokenId) public payable nonReentrant {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(isForSale[tokenId], "Agent not for sale");
        require(msg.value >= salePrice[tokenId], "Insufficient payment");
        require(ownerOf(tokenId) != msg.sender, "Cannot buy your own agent");
        
        address seller = ownerOf(tokenId);
        uint256 price = salePrice[tokenId];
        
        // Transfer ownership using the standard ERC721 transfer
        _update(msg.sender, tokenId, address(0));
        
        // Delist from sale
        isForSale[tokenId] = false;
        salePrice[tokenId] = 0;
        
        // Transfer payment to seller
        payable(seller).transfer(price);
        
        // Refund excess payment
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        emit AgentSold(tokenId, seller, msg.sender, price);
    }
    
    /**
     * @dev Get agents for sale
     * @return tokenIds Array of token IDs for sale
     */
    function getAgentsForSale() public view returns (uint256[] memory) {
        uint256[] memory saleTokens = new uint256[](_allTokenIds.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < _allTokenIds.length; i++) {
            if (isForSale[_allTokenIds[i]]) {
                saleTokens[count] = _allTokenIds[i];
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = saleTokens[i];
        }
        
        return result;
    }
    
    /**
     * @dev Withdraw contract balance (only by contract owner)
     */
    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner()).transfer(balance);
    }
    
    // Required overrides
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
