"use client";
import { ethers } from "ethers";
import { AgentConfig } from './groqService';

// Contract ABI (simplified for the interface)
const AI_AGENT_NFT_ABI = [
  // ERC721 functions
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  
  // Custom functions
  "function mintAgent(address to, tuple(string name, string description, string model, uint256 usageCost, uint256 maxUsagesPerDay, bool isForRent, uint256 rentPricePerUse, string ipfsHash, address creator, uint256 createdAt) metadata, tuple(bool enableWebSearch, bool enableCodeExecution, bool enableBrowserAutomation, bool enableWolframAlpha, bool enableStreaming, string responseFormat, uint256 temperature, uint256 maxTokens, uint256 topP, uint256 frequencyPenalty, uint256 presencePenalty) config, string tokenURI) returns (uint256)",
  "function getAgentMetadata(uint256 tokenId) view returns (tuple(string name, string description, string model, uint256 usageCost, uint256 maxUsagesPerDay, bool isForRent, uint256 rentPricePerUse, string ipfsHash, address creator, uint256 createdAt))",
  "function getToolConfig(uint256 tokenId) view returns (tuple(bool enableWebSearch, bool enableCodeExecution, bool enableBrowserAutomation, bool enableWolframAlpha, bool enableStreaming, string responseFormat, uint256 temperature, uint256 maxTokens, uint256 topP, uint256 frequencyPenalty, uint256 presencePenalty))",
  "function rentAgent(uint256 tokenId, uint256 uses) payable",
  "function rentAgentWithInference(uint256 tokenId, uint256 uses) payable",
  "function useAgent(uint256 tokenId) payable returns (bool)",
  "function useAgentPrepaid(uint256 tokenId) returns (bool)",
  "function consumeRentalUse(uint256 tokenId) returns (bool)",
  "function canUseAgent(uint256 tokenId, address user) view returns (bool)",
  "function getRentalBalance(uint256 tokenId, address user) view returns (uint256)",
  "function getPrepaidInferenceBalance(uint256 tokenId, address user) view returns (uint256)",
  "function updateAgentMetadata(uint256 tokenId, tuple(string name, string description, string model, uint256 usageCost, uint256 maxUsagesPerDay, bool isForRent, uint256 rentPricePerUse, string ipfsHash, address creator, uint256 createdAt) newMetadata)",
  
  // Enumeration functions
  "function getTotalAgents() view returns (uint256)",
  "function getAllTokenIds() view returns (uint256[])",
  "function getAgentsPaginated(uint256 offset, uint256 limit) view returns (uint256[])",
  "function getAgentsByOwner(address owner) view returns (uint256[])",
  "function getAgentsForRent() view returns (uint256[])",
  "function getAgentsForSale() view returns (uint256[])",
  
  // Sale functions
  "function listAgentForSale(uint256 tokenId, uint256 price)",
  "function delistAgentFromSale(uint256 tokenId)",
  "function buyAgent(uint256 tokenId) payable",
  "function isForSale(uint256 tokenId) view returns (bool)",
  "function salePrice(uint256 tokenId) view returns (uint256)",
  
  // Events
  "event AgentMinted(uint256 indexed tokenId, address indexed creator, string name)",
  "event AgentTransferred(uint256 indexed tokenId, address indexed from, address indexed to)",
  "event AgentRented(uint256 indexed tokenId, address indexed renter, uint256 uses, uint256 totalCost)",
  "event AgentUsed(uint256 indexed tokenId, address indexed user, bool isOwner)",
  "event AgentListedForSale(uint256 indexed tokenId, address indexed seller, uint256 price)",
  "event AgentDelistedFromSale(uint256 indexed tokenId, address indexed seller)",
  "event AgentSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price)",
];

export interface AgentMetadata {
  name: string;
  description: string;
  model: string;
  usageCost: string; // In wei
  maxUsagesPerDay: number;
  isForRent: boolean;
  rentPricePerUse: string; // In wei
  ipfsHash: string;
  creator: string;
  createdAt: number;
}

export interface ToolConfig {
  enableWebSearch: boolean;
  enableCodeExecution: boolean;
  enableBrowserAutomation: boolean;
  enableWolframAlpha: boolean;
  enableStreaming: boolean;
  responseFormat: string; // "text" or "json_object"
  temperature: number; // Scaled by 1000 (e.g., 700 = 0.7)
  maxTokens: number;
  topP: number; // Scaled by 1000 (e.g., 1000 = 1.0)
  frequencyPenalty: number; // Scaled by 1000
  presencePenalty: number; // Scaled by 1000
}

export interface NFTAgent extends AgentConfig {
  tokenId: number;
  nftContract: string;
  metadata: AgentMetadata;
  toolConfig: ToolConfig;
  isOwner: boolean;
  rentalBalance?: number;
  creator: string;
}

export class NFTService {
  private contract: ethers.Contract | null = null;
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;

  constructor() {
    this.initializeProvider().catch(console.error);
  }

  private async initializeProvider() {
    if (typeof window !== 'undefined' && window.ethereum) {
      console.log('🔄 Initializing provider...');
      this.provider = new ethers.BrowserProvider(window.ethereum);
      
      // Request account access if not already connected
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      } catch (error) {
        console.warn('⚠️ User rejected account access:', error);
      }
      
      this.signer = await this.provider.getSigner();
      
      // Debug network info
      try {
        const network = await this.provider.getNetwork();
        console.log('🌐 Connected to network:', {
          name: network.name,
          chainId: network.chainId.toString(),
          expectedChainId: '80002'
        });
        
        // Check if we're on the wrong network
        if (network.chainId !== BigInt(80002)) {
          console.warn('⚠️ Wrong network detected! Please switch to Polygon Amoy testnet');
          console.log('💡 To add Polygon Amoy testnet to MetaMask:');
          console.log('   1. Open MetaMask');
          console.log('   2. Click on network dropdown');
          console.log('   3. Click "Add network" or "Custom RPC"');
          console.log('   4. Enter:');
          console.log('      - Network Name: Polygon Amoy Testnet');
          console.log('      - RPC URL: https://rpc-amoy.polygon.technology');
          console.log('      - Chain ID: 80002');
          console.log('      - Currency Symbol: MATIC');
          console.log('      - Block Explorer: https://amoy.polygonscan.com');
        }
      } catch (error) {
        console.error('❌ Failed to get network info:', error);
      }
    } else {
      console.error('❌ No window.ethereum found - make sure you have a wallet installed');
    }
  }

  /**
   * Initialize the contract with the deployed address
   */
  async initializeContract(contractAddress: string) {
    console.log('🔄 Initializing contract with address:', contractAddress);
    
    if (!this.provider) {
      console.error('❌ Web3 provider not available');
      throw new Error('Web3 provider not available');
    }

    // Ensure signer is available
    if (!this.signer) {
      console.log('🔄 Getting signer...');
      this.signer = await this.provider.getSigner();
    }

    // Check network first
    try {
      const network = await this.provider.getNetwork();
      console.log('🌐 Connected to network:', {
        name: network.name,
        chainId: network.chainId.toString(),
        expectedChainId: '80002' // Polygon Amoy testnet
      });
      
      if (network.chainId !== BigInt(80002)) {
        throw new Error(`Wrong network! Please switch to Polygon Amoy testnet (Chain ID: 80002). Current network: ${network.name} (${network.chainId})`);
      }
    } catch (error) {
      console.error('❌ Network check failed:', error);
      throw error;
    }

    console.log('📝 Creating contract instance...');
    this.contract = new ethers.Contract(
      contractAddress,
      AI_AGENT_NFT_ABI,
      this.signer
    );
    
    // Test the contract connection
    try {
      console.log('🧪 Testing contract connection...');
      const totalAgents = await this.contract.getTotalAgents();
      console.log('✅ Contract connection successful, total agents:', totalAgents.toString());
    } catch (error) {
      console.error('❌ Contract connection failed:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('could not decode result data')) {
          throw new Error('Contract method call failed. Please ensure you are connected to the correct network (localhost:31337) and the contract is deployed.');
        } else if (error.message.includes('No contract found')) {
          throw new Error(`No contract found at address ${contractAddress}. Please deploy the contract first.`);
        } else if (error.message.includes('Wrong network')) {
          throw error; // Re-throw network errors as-is
        }
      }
      
      throw error;
    }
    
    console.log('✅ Contract initialized successfully');
  }

  /**
   * Check if user account is connected and authorized
   */
  async checkAccountAccess(): Promise<boolean> {
    if (!this.provider) {
      return false;
    }

    try {
      // Check if we can get accounts
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      return accounts.length > 0;
    } catch (error) {
      console.error('❌ Failed to check account access:', error);
      return false;
    }
  }

  /**
   * Request account access from MetaMask
   */
  async requestAccountAccess(): Promise<boolean> {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      return true;
    } catch (error) {
      console.error('❌ User rejected account access:', error);
      return false;
    }
  }

  /**
   * Check if the service is ready for use
   */
  async isReady(): Promise<boolean> {
    try {
      console.log('🔍 Checking NFT service readiness...');
      
      if (!this.provider) {
        console.log('❌ Provider not available');
        return false;
      }
      
      if (!this.signer) {
        console.log('🔄 Getting signer...');
        this.signer = await this.provider.getSigner();
      }

      // Check if account is connected
      const hasAccountAccess = await this.checkAccountAccess();
      if (!hasAccountAccess) {
        console.log('❌ No account access. User needs to connect wallet.');
        return false;
      }
      
      // Check network and try to switch if needed
      const network = await this.provider.getNetwork();
      console.log('🌐 Connected to network:', {
        name: network.name,
        chainId: network.chainId.toString(),
        expectedChainId: '80002' // Polygon Amoy testnet
      });
      
      if (network.chainId !== BigInt(80002)) {
        console.warn('⚠️ Wrong network detected! Attempting to switch to Polygon Amoy testnet...');
        try {
          await this.switchToPolygonAmoyNetwork();
          // Re-check network after switching
          const newNetwork = await this.provider.getNetwork();
          if (newNetwork.chainId !== BigInt(80002)) {
            throw new Error(`Failed to switch to Polygon Amoy testnet. Please switch manually to Polygon Amoy. Current network: ${newNetwork.name} (${newNetwork.chainId})`);
          }
        } catch (switchError) {
          console.error('❌ Failed to switch network:', switchError);
          throw new Error(`Wrong network! Please switch to Polygon Amoy testnet (Chain ID: 80002). Current network: ${network.name} (${network.chainId}). Error: ${switchError instanceof Error ? switchError.message : 'Unknown error'}`);
        }
      }
      
      // Initialize contract if not already done
      const contractAddress = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
      console.log('📋 Contract address:', contractAddress);
      if (contractAddress && !this.contract) {
        console.log('🔄 Initializing contract...');
        await this.initializeContract(contractAddress);
      } else if (!contractAddress) {
        console.log('❌ No contract address configured');
        return false;
      }
      
      const isReady = !!(this.contract && this.signer);
      console.log('✅ NFT service ready:', isReady);
      return isReady;
    } catch (error) {
      console.error('❌ Error checking NFT service readiness:', error);
      return false;
    }
  }

  /**
   * Mint a new AI Agent NFT
   */
  async mintAgent(
    agent: AgentConfig,
    ipfsHash: string,
    isForRent: boolean = false,
    rentPricePerUse: number = 0
  ): Promise<number> {
    // Ensure contract is initialized
    if (!this.contract) {
      const contractAddress = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
      if (!contractAddress) {
        throw new Error('NFT contract address not configured');
      }
      await this.initializeContract(contractAddress);
    }

    if (!this.signer) {
      throw new Error('Signer not available');
    }

    // Check if account is connected and authorized
    const hasAccountAccess = await this.checkAccountAccess();
    if (!hasAccountAccess) {
      const granted = await this.requestAccountAccess();
      if (!granted) {
        throw new Error('Account access required. Please connect your wallet and approve the connection.');
      }
    }

    const signerAddress = await this.signer.getAddress();
    const metadata: AgentMetadata = {
      name: agent.name,
      description: agent.description,
      model: agent.model,
      usageCost: ethers.parseEther(agent.usageCost.toString()).toString(),
      maxUsagesPerDay: agent.maxUsagesPerDay,
      isForRent,
      rentPricePerUse: ethers.parseEther(rentPricePerUse.toString()).toString(),
      ipfsHash,
      creator: signerAddress,
      createdAt: Math.floor(Date.now() / 1000),
    };

    const toolConfig: ToolConfig = {
      enableWebSearch: agent.enableWebSearch || false,
      enableCodeExecution: agent.enableCodeExecution || false,
      enableBrowserAutomation: agent.enableBrowserAutomation || false,
      enableWolframAlpha: agent.enableWolframAlpha || false,
      enableStreaming: agent.enableStreaming || false,
      responseFormat: agent.responseFormat || 'text',
      temperature: Math.round((agent.temperature || 0.7) * 1000), // Scale by 1000
      maxTokens: agent.maxTokens || 4096,
      topP: Math.round((agent.topP || 1.0) * 1000), // Scale by 1000
      frequencyPenalty: Math.round((agent.frequencyPenalty || 0) * 1000), // Scale by 1000
      presencePenalty: Math.round((agent.presencePenalty || 0) * 1000), // Scale by 1000
    };

    const tokenURI = `https://gateway.lighthouse.storage/ipfs/${ipfsHash}`;

    console.log('🚀 Calling mintAgent with params:', {
      to: await this.signer!.getAddress(),
      metadata,
      tokenURI
    });

    // Add detailed debugging for the transaction
    try {
      console.log('🔍 Contract address:', this.contract!.target);
      console.log('🔍 Signer address:', await this.signer!.getAddress());
      console.log('🔍 Network:', await this.provider!.getNetwork());
      
      // Validate contract first
      await this.validateContract();
      
      // Additional contract verification
      console.log('🔍 Verifying contract deployment...');
      const contractCode = await this.provider!.getCode(this.contract!.target);
      if (contractCode === '0x') {
        throw new Error(`No contract found at address ${this.contract!.target}. Please verify the contract address is correct.`);
      }
      console.log('✅ Contract code found, length:', contractCode.length);
      
      // Check if we have enough balance for gas
      const balance = await this.provider!.getBalance(await this.signer!.getAddress());
      console.log('💰 Wallet balance:', ethers.formatEther(balance), 'MATIC');
      
      // Check if balance is sufficient for gas
      const minBalance = ethers.parseEther('0.01'); // Minimum 0.01 MATIC
      if (balance < minBalance) {
        throw new Error(`Insufficient MATIC balance. You need at least 0.01 MATIC for gas fees. Current balance: ${ethers.formatEther(balance)} MATIC`);
      }
      
      // Get current gas price for Polygon Amoy
      try {
        const feeData = await this.provider!.getFeeData();
        console.log('⛽ Gas price info:', {
          gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') + ' gwei' : 'Not available',
          maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') + ' gwei' : 'Not available',
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') + ' gwei' : 'Not available'
        });
      } catch (gasPriceError) {
        console.warn('⚠️ Could not get gas price info:', gasPriceError);
      }
      
      // Estimate gas first with proper error handling for Polygon Amoy
      try {
        console.log('🔍 Estimating gas for mintAgent...');
        console.log('📋 Parameters:', {
          to: await this.signer!.getAddress(),
          metadata: {
            name: metadata.name,
            description: metadata.description,
            model: metadata.model,
            usageCost: metadata.usageCost,
            maxUsagesPerDay: metadata.maxUsagesPerDay,
            isForRent: metadata.isForRent,
            rentPricePerUse: metadata.rentPricePerUse,
            ipfsHash: metadata.ipfsHash,
            creator: metadata.creator,
            createdAt: metadata.createdAt
          },
          tokenURI
        });
        
        // Use a higher gas limit for Polygon Amoy
        const gasEstimate = await this.contract!.mintAgent.estimateGas(
          await this.signer!.getAddress(),
          metadata,
          toolConfig,
          tokenURI
        );
        console.log('⛽ Gas estimate:', gasEstimate.toString());
        
        // Add 20% buffer for Polygon Amoy
        const gasWithBuffer = (gasEstimate * BigInt(120)) / BigInt(100);
        console.log('⛽ Gas with buffer:', gasWithBuffer.toString());
        
      } catch (gasError) {
        console.error('❌ Gas estimation failed:', gasError);
        console.error('❌ Gas error details:', {
          message: gasError instanceof Error ? gasError.message : 'Unknown error',
          code: (gasError as any)?.code,
          data: (gasError as any)?.data
        });
        
        // For Polygon Amoy, we'll use a fixed gas limit if estimation fails
        console.log('🔄 Using fallback gas limit for Polygon Amoy...');
      }
      
    } catch (debugError) {
      console.error('❌ Debug check failed:', debugError);
      
      // For Polygon Amoy, provide more specific error messages
      if (debugError instanceof Error) {
        if (debugError.message.includes('Internal JSON-RPC error')) {
          throw new Error('Polygon Amoy RPC error. Please check your wallet connection and ensure you have enough MATIC for gas fees.');
        } else if (debugError.message.includes('execution reverted')) {
          throw new Error('Contract execution failed. Please verify the contract address and ensure you have sufficient MATIC balance.');
        } else if (debugError.message.includes('insufficient funds')) {
          throw new Error('Insufficient MATIC balance. Please add more MATIC to your wallet for gas fees.');
        }
      }
      
      throw debugError;
    }

    // Get current gas price for Polygon Amoy
    let gasPrice;
    try {
      const feeData = await this.provider!.getFeeData();
      gasPrice = feeData.gasPrice || ethers.parseUnits('30', 'gwei');
      console.log('⛽ Using gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
    } catch (error) {
      console.warn('⚠️ Could not get gas price, using fallback');
      gasPrice = ethers.parseUnits('30', 'gwei');
    }

    // Try different gas strategies for Polygon Amoy
    let tx;
    try {
      // First try with explicit gas settings
      tx = await this.contract!.mintAgent(
        await this.signer!.getAddress(),
        metadata,
        toolConfig,
        tokenURI,
        {
          gasLimit: 1000000, // High gas limit for Polygon Amoy
          gasPrice: gasPrice // Use current gas price
        }
      );
    } catch (gasError) {
      console.warn('⚠️ First attempt failed, trying with different gas settings...');
      console.error('❌ Gas error details:', {
        message: gasError instanceof Error ? gasError.message : 'Unknown error',
        code: (gasError as any)?.code,
        data: (gasError as any)?.data
      });
      
      try {
        // Try with EIP-1559 gas settings (Type 2 transaction)
        const feeData = await this.provider!.getFeeData();
        tx = await this.contract!.mintAgent(
          await this.signer!.getAddress(),
          metadata,
          toolConfig,
          tokenURI,
          {
            gasLimit: 1000000,
            maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('50', 'gwei'),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('30', 'gwei')
          }
        );
      } catch (eip1559Error) {
        console.warn('⚠️ EIP-1559 failed, trying with minimal gas settings...');
        console.error('❌ EIP-1559 error details:', {
          message: eip1559Error instanceof Error ? eip1559Error.message : 'Unknown error',
          code: (eip1559Error as any)?.code,
          data: (eip1559Error as any)?.data
        });
        
        // Last resort: try with minimal gas settings
        try {
          tx = await this.contract!.mintAgent(
            await this.signer!.getAddress(),
            metadata,
            toolConfig,
            tokenURI,
            {
              gasLimit: 500000, // Lower gas limit
              gasPrice: ethers.parseUnits('20', 'gwei') // Lower gas price
            }
          );
        } catch (finalError) {
          console.error('❌ All gas strategies failed:', finalError);
          throw new Error(`All transaction attempts failed. Last error: ${finalError instanceof Error ? finalError.message : 'Unknown error'}`);
        }
      }
    }

    console.log('📝 Transaction sent:', tx.hash);
    console.log('⏳ Waiting for confirmation...');

    const receipt = await tx.wait();
    
    console.log('✅ Transaction confirmed:', {
      hash: receipt.hash,
      status: receipt.status,
      gasUsed: receipt.gasUsed?.toString(),
      logs: receipt.logs.length
    });
    
    // Get the token ID from the transaction logs
    console.log('🔍 Looking for AgentMinted event in transaction logs...');
    console.log('📋 Total logs:', receipt.logs.length);
    
    const mintEvent = receipt.logs.find((log: any) => {
      const contractAddress = this.contract!.target.toString().toLowerCase();
      const logAddress = log.address.toString().toLowerCase();
      
      console.log('🔍 Checking log:', {
        logAddress,
        contractAddress,
        topics: log.topics,
        data: log.data
      });
      
      // Check if this log is from our contract
      if (logAddress !== contractAddress) {
        return false;
      }
      
      // Check if this is an AgentMinted event by looking for the event signature
      // AgentMinted(uint256 indexed tokenId, address indexed creator, string name)
      const expectedTopic = ethers.id('AgentMinted(uint256,address,string)');
      console.log('🔍 Expected topic:', expectedTopic);
      console.log('🔍 Actual topic:', log.topics[0]);
      return log.topics[0] === expectedTopic;
    });
    
    if (!mintEvent) {
      console.error('❌ AgentMinted event not found in transaction logs');
      console.error('📋 Available logs:', receipt.logs.map((log: any) => ({
        address: log.address,
        topics: log.topics,
        data: log.data
      })));
      
      // Fallback: Try to get the token ID by checking the total agents count
      console.log('🔄 Trying fallback method to get token ID...');
      try {
        const totalAgents = await this.contract!.getTotalAgents();
        console.log('📊 Total agents after mint:', totalAgents.toString());
        
        // The token ID should be the total agents count (since we just minted one)
        const tokenId = Number(totalAgents);
        console.log('🎯 Using fallback token ID:', tokenId);
        return tokenId;
      } catch (fallbackError) {
        console.error('❌ Fallback method also failed:', fallbackError);
        throw new Error('Failed to get token ID from mint transaction');
      }
    }

    console.log('✅ Found AgentMinted event:', mintEvent);
    
    // Decode the event data
    const decodedEvent = this.contract!.interface.decodeEventLog('AgentMinted', mintEvent.data, mintEvent.topics);
    console.log('🎯 Decoded event:', decodedEvent);
    
    return Number(decodedEvent.tokenId);
  }

  /**
   * Get agent metadata from NFT
   */
  async getAgentMetadata(tokenId: number): Promise<AgentMetadata> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const metadata = await this.contract.getAgentMetadata(tokenId);
    
    return {
      name: metadata.name,
      description: metadata.description,
      model: metadata.model,
      usageCost: metadata.usageCost.toString(),
      maxUsagesPerDay: Number(metadata.maxUsagesPerDay),
      isForRent: metadata.isForRent,
      rentPricePerUse: metadata.rentPricePerUse.toString(),
      ipfsHash: metadata.ipfsHash,
      creator: metadata.creator,
      createdAt: Number(metadata.createdAt),
    };
  }

  /**
   * Get tool configuration from NFT
   */
  async getToolConfig(tokenId: number): Promise<ToolConfig> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const config = await this.contract.getToolConfig(tokenId);
    
    return {
      enableWebSearch: config.enableWebSearch || false,
      enableCodeExecution: config.enableCodeExecution || false,
      enableBrowserAutomation: config.enableBrowserAutomation || false,
      enableWolframAlpha: config.enableWolframAlpha || false,
      enableStreaming: config.enableStreaming || false,
      responseFormat: config.responseFormat || 'text',
      temperature: Number(config.temperature) / 1000, // Unscale from 1000
      maxTokens: Number(config.maxTokens),
      topP: Number(config.topP) / 1000, // Unscale from 1000
      frequencyPenalty: Number(config.frequencyPenalty) / 1000, // Unscale from 1000
      presencePenalty: Number(config.presencePenalty) / 1000, // Unscale from 1000
    };
  }

  /**
   * Check if user can use an agent
   */
  async canUseAgent(tokenId: number, userAddress: string): Promise<boolean> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    return await this.contract.canUseAgent(tokenId, userAddress);
  }

  /**
   * Get rental balance for a user
   */
  async getRentalBalance(tokenId: number, userAddress: string): Promise<number> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const balance = await this.contract.getRentalBalance(tokenId, userAddress);
    return Number(balance);
  }

  /**
   * Get prepaid inference balance for a user
   */
  async getPrepaidInferenceBalance(tokenId: number, userAddress: string): Promise<number> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const balance = await this.contract.getPrepaidInferenceBalance(tokenId, userAddress);
    return Number(balance);
  }

  /**
   * Consume one rental use without payment (for prepaid rentals)
   */
  async consumeRentalUse(tokenId: number): Promise<boolean> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized or signer not available');
    }

    try {
      const tx = await (this.contract as any).consumeRentalUse(tokenId);
      console.log('📝 Consume rental use transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Consume rental use transaction confirmed:', {
        hash: receipt.hash,
        status: receipt.status
      });
      
      return true;
    } catch (error) {
      console.error('❌ Failed to consume rental use:', error);
      throw error;
    }
  }

  /**
   * Rent an agent
   */
  async rentAgent(tokenId: number, uses: number, rentPricePerUse: string): Promise<void> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized or signer not available');
    }

    const totalCost = BigInt(rentPricePerUse) * BigInt(uses);
    
    console.log('🔄 Calling rentAgent with params:', {
      tokenId,
      uses,
      rentPricePerUse,
      totalCost: totalCost.toString(),
      value: totalCost.toString()
    });
    
    try {
      // Get current gas price for Polygon Amoy
      let gasPrice;
      try {
        const feeData = await this.provider!.getFeeData();
        gasPrice = feeData.gasPrice || ethers.parseUnits('30', 'gwei');
        console.log('⛽ Using gas price for rental:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
      } catch (error) {
        console.warn('⚠️ Could not get gas price, using fallback');
        gasPrice = ethers.parseUnits('30', 'gwei');
      }

      // Try different gas strategies for Polygon Amoy
      let tx;
      
      // First, try to estimate gas to get a better gas limit
      let estimatedGas;
      try {
        console.log('🔍 Estimating gas for rentAgent...');
        estimatedGas = await this.contract.rentAgent.estimateGas(tokenId, uses, {
          value: totalCost
        });
        console.log('⛽ Estimated gas:', estimatedGas.toString());
        // Add 20% buffer
        estimatedGas = (estimatedGas * BigInt(120)) / BigInt(100);
        console.log('⛽ Gas with buffer:', estimatedGas.toString());
      } catch (gasEstimateError) {
        console.warn('⚠️ Gas estimation failed, using fallback:', gasEstimateError);
        estimatedGas = BigInt(500000); // Fallback gas limit
      }
      
      try {
        // First try with estimated gas and current gas price
        console.log('🚀 Attempt 1: Estimated gas with current price');
        tx = await this.contract.rentAgent(tokenId, uses, {
          value: totalCost,
          gasLimit: estimatedGas,
          gasPrice: gasPrice
        });
      } catch (gasError) {
        console.warn('⚠️ First rental attempt failed, trying with different gas settings...');
        
        try {
          // Try with EIP-1559 gas settings (Type 2 transaction)
          console.log('🚀 Attempt 2: EIP-1559 gas settings');
          const feeData = await this.provider!.getFeeData();
          tx = await this.contract.rentAgent(tokenId, uses, {
            value: totalCost,
            gasLimit: estimatedGas,
            maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('50', 'gwei'),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('30', 'gwei')
          });
        } catch (eip1559Error) {
          console.warn('⚠️ EIP-1559 rental failed, trying with minimal gas settings...');
          
          // Last resort: try with minimal gas settings
          try {
            console.log('🚀 Attempt 3: Minimal gas settings');
            tx = await this.contract.rentAgent(tokenId, uses, {
              value: totalCost,
              gasLimit: BigInt(300000), // Lower gas limit
              gasPrice: ethers.parseUnits('10', 'gwei') // Lower gas price
            });
          } catch (finalError) {
            console.error('❌ All rental gas strategies failed:', finalError);
            throw new Error(`All rental transaction attempts failed. Last error: ${finalError instanceof Error ? finalError.message : 'Unknown error'}`);
          }
        }
      }

      console.log('📝 Rental transaction sent:', tx.hash);
      console.log('⏳ Waiting for confirmation...');
      
      const receipt = await tx.wait();
      
      console.log('✅ Rental transaction confirmed:', {
        hash: receipt.hash,
        status: receipt.status,
        gasUsed: receipt.gasUsed?.toString()
      });
      
    } catch (error) {
      console.error('❌ Rental transaction failed:', error);
      
      // Re-throw with more context
      if (error instanceof Error) {
        if (error.message.includes('4100') || error.message.includes('not been authorized')) {
          throw new Error('Transaction rejected by MetaMask. Please check your wallet connection and approve the transaction.');
        } else if (error.message.includes('insufficient funds')) {
          throw new Error('Insufficient funds. Please add more ETH to your wallet.');
        } else if (error.message.includes('user rejected')) {
          throw new Error('Transaction was cancelled by user.');
        } else {
          throw new Error(`Rental failed: ${error.message}`);
        }
      } else {
        throw new Error('Rental failed: Unknown error occurred');
      }
    }
  }

  /**
   * Rent an agent with prepaid inference costs
   * This function pays both rental and inference costs upfront
   */
  async rentAgentWithInference(
    tokenId: number, 
    uses: number, 
    rentPricePerUse: string, 
    usageCost: string, 
    totalCost: bigint
  ): Promise<void> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized or wallet not connected');
    }

    // Check if account is connected and authorized
    const hasAccountAccess = await this.checkAccountAccess();
    if (!hasAccountAccess) {
      const granted = await this.requestAccountAccess();
      if (!granted) {
        throw new Error('Account access required. Please connect your wallet and approve the connection.');
      }
    }

    console.log('🔄 Calling rentAgentWithInference (rental + inference costs):', {
      tokenId,
      uses,
      rentPricePerUse,
      usageCost,
      totalCost: totalCost.toString()
    });
    
    try {
      // Validate that the agent exists and is for rent
      const agentMetadata = await this.getAgentMetadata(tokenId);
      if (!agentMetadata.isForRent) {
        throw new Error('Agent is not available for rent');
      }

      // Calculate costs
      const rentalCost = BigInt(rentPricePerUse) * BigInt(uses);
      const inferenceCost = BigInt(usageCost) * BigInt(uses);
      
      // Validate that total cost matches
      if (rentalCost + inferenceCost !== totalCost) {
        throw new Error('Cost calculation mismatch');
      }

      // Get current gas price for Polygon Amoy
      let gasPrice;
      try {
        const feeData = await this.provider!.getFeeData();
        gasPrice = feeData.gasPrice || ethers.parseUnits('30', 'gwei');
        console.log('⛽ Using gas price for rental:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
      } catch (error) {
        console.warn('⚠️ Could not get gas price, using fallback');
        gasPrice = ethers.parseUnits('30', 'gwei');
      }

      // Try different gas strategies for Polygon Amoy
      let tx;
      
      console.log('🔄 Starting rental transaction with gas strategies...');
      console.log('📊 Transaction details:', {
        tokenId,
        uses,
        totalCost: totalCost.toString(),
        gasPrice: gasPrice.toString(),
        gasPriceGwei: ethers.formatUnits(gasPrice, 'gwei')
      });
      
      // Check if the contract method exists
      if (!this.contract.rentAgentWithInference) {
        console.error('❌ Contract method not found. Available methods:', Object.getOwnPropertyNames(this.contract));
        throw new Error('rentAgentWithInference method not found on contract. Contract may not be properly deployed or ABI may be incorrect.');
      }
      
      // First, try to estimate gas to get a better gas limit
      let estimatedGas;
      try {
        console.log('🔍 Estimating gas for rentAgentWithInference...');
        estimatedGas = await this.contract.rentAgentWithInference.estimateGas(tokenId, uses, {
          value: totalCost
        });
        console.log('⛽ Estimated gas:', estimatedGas.toString());
        // Add 20% buffer
        estimatedGas = (estimatedGas * BigInt(120)) / BigInt(100);
        console.log('⛽ Gas with buffer:', estimatedGas.toString());
      } catch (gasEstimateError) {
        console.warn('⚠️ Gas estimation failed, using fallback:', gasEstimateError);
        estimatedGas = BigInt(500000); // Fallback gas limit
      }
      
      try {
        // First try with estimated gas and current gas price
        console.log('🚀 Attempt 1: Estimated gas with current price');
        tx = await this.contract.rentAgentWithInference(tokenId, uses, {
          value: totalCost,
          gasLimit: estimatedGas,
          gasPrice: gasPrice
        });
      } catch (gasError) {
        console.warn('⚠️ First rental attempt failed, trying with different gas settings...');
        
        try {
          // Try with EIP-1559 gas settings (Type 2 transaction)
          console.log('🚀 Attempt 2: EIP-1559 gas settings');
          const feeData = await this.provider!.getFeeData();
          tx = await this.contract.rentAgentWithInference(tokenId, uses, {
            value: totalCost,
            gasLimit: estimatedGas,
            maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('50', 'gwei'),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('30', 'gwei')
          });
        } catch (eip1559Error) {
          console.warn('⚠️ EIP-1559 rental failed, trying with minimal gas settings...');
          
          // Last resort: try with minimal gas settings
          try {
            console.log('🚀 Attempt 3: Minimal gas settings');
            tx = await this.contract.rentAgentWithInference(tokenId, uses, {
              value: totalCost,
              gasLimit: BigInt(300000), // Lower gas limit
              gasPrice: ethers.parseUnits('10', 'gwei') // Lower gas price
            });
          } catch (finalError) {
            console.error('❌ All rental gas strategies failed:', finalError);
            throw new Error(`All rental transaction attempts failed. Last error: ${finalError instanceof Error ? finalError.message : 'Unknown error'}`);
          }
        }
      }

      console.log('📝 Rental with inference transaction sent:', tx.hash);
      console.log('⏳ Waiting for confirmation...');
      
      const receipt = await tx.wait();
      
      console.log('✅ Rental with inference transaction confirmed:', {
        hash: receipt.hash,
        status: receipt.status,
        gasUsed: receipt.gasUsed?.toString()
      });

      // Verify the prepaid balance was actually added
      const userAddress = await this.signer.getAddress();
      const prepaidBalance = await this.getPrepaidInferenceBalance(tokenId, userAddress);
      const rentalBalance = await this.getRentalBalance(tokenId, userAddress);
      
      console.log('🔍 Post-rental verification:', {
        tokenId,
        userAddress,
        prepaidBalance,
        rentalBalance,
        expectedUses: uses
      });

      console.log('✅ Agent rented with prepaid inference costs. No additional payments needed per use!');
      
    } catch (error) {
      console.error('❌ Rental with inference failed:', error);
      
      // Re-throw with more context
      if (error instanceof Error) {
        if (error.message.includes('4100') || error.message.includes('not been authorized')) {
          throw new Error('Transaction rejected by MetaMask. Please:\n1. Make sure MetaMask is unlocked\n2. Approve the transaction when prompted\n3. Check that you\'re connected to Polygon Amoy testnet\n4. Ensure you have enough MATIC for gas fees');
        } else if (error.message.includes('insufficient funds')) {
          throw new Error('Insufficient funds. Please add more MATIC to your wallet for gas fees and transaction costs.');
        } else if (error.message.includes('user rejected')) {
          throw new Error('Transaction was cancelled by user. Please try again and approve the transaction in MetaMask.');
        } else if (error.message.includes('execution reverted')) {
          throw new Error('Transaction failed. The agent may not be available for rent or there may be insufficient funds.');
        } else if (error.message.includes('Internal JSON-RPC error')) {
          throw new Error('Polygon Amoy network error. Please try again in a few moments. If the problem persists, check your internet connection and ensure you have enough MATIC for gas fees.');
        } else if (error.message.includes('could not coalesce error')) {
          throw new Error('Transaction failed due to network issues. Please try again with a different gas price or wait for network congestion to clear.');
        } else {
          throw new Error(`Rental with inference failed: ${error.message}`);
        }
      } else {
        throw new Error('Rental with inference failed: Unknown error occurred');
      }
    }
  }

  /**
   * Use an agent (handles both prepaid and per-use inference costs)
   */
  async useAgent(tokenId: number, usageCost: string): Promise<boolean> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized or signer not available');
    }

    // Check if user is the owner
    const userAddress = await this.signer.getAddress();
    const owner = await this.contract.ownerOf(tokenId);
    const isOwner = owner.toLowerCase() === userAddress.toLowerCase();
    
    if (isOwner) {
      // Owner can use for free (no payment required)
      console.log('👑 Owner using agent for free (no MetaMask prompt)');
      const tx = await this.contract.useAgentPrepaid(tokenId);
      const receipt = await tx.wait();
      console.log('✅ Owner use successful:', receipt.status === 1);
      return receipt.status === 1;
    }

    // For renters, check if they have prepaid inference balance
    const prepaidBalance = await this.getPrepaidInferenceBalance(tokenId, userAddress);
    const rentalBalance = await this.getRentalBalance(tokenId, userAddress);
    
    console.log('🔍 Agent usage check:', {
      tokenId,
      userAddress,
      isOwner,
      prepaidBalance,
      rentalBalance,
      usageCost
    });
    
    if (prepaidBalance > 0) {
      // Use prepaid inference (no MetaMask prompt needed)
      console.log(`🎉 Using prepaid inference. Balance: ${prepaidBalance} uses remaining`);
      const tx = await this.contract.useAgentPrepaid(tokenId);
      const receipt = await tx.wait();
      console.log('✅ Prepaid use successful:', receipt.status === 1);
      return receipt.status === 1;
    } else {
      // Pay inference cost per use
      console.log('💳 Paying inference cost per use (no prepaid balance)');
      
      // Get current gas price for Polygon Amoy
      let gasPrice;
      try {
        const feeData = await this.provider!.getFeeData();
        gasPrice = feeData.gasPrice || ethers.parseUnits('30', 'gwei');
        console.log('⛽ Using gas price for usage:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
      } catch (error) {
        console.warn('⚠️ Could not get gas price, using fallback');
        gasPrice = ethers.parseUnits('30', 'gwei');
      }

      // Try different gas strategies for Polygon Amoy
      let tx;
      
      // First, try to estimate gas to get a better gas limit
      let estimatedGas;
      try {
        console.log('🔍 Estimating gas for useAgent...');
        estimatedGas = await this.contract.useAgent.estimateGas(tokenId, {
          value: usageCost
        });
        console.log('⛽ Estimated gas:', estimatedGas.toString());
        // Add 20% buffer
        estimatedGas = (estimatedGas * BigInt(120)) / BigInt(100);
        console.log('⛽ Gas with buffer:', estimatedGas.toString());
      } catch (gasEstimateError) {
        console.warn('⚠️ Gas estimation failed, using fallback:', gasEstimateError);
        estimatedGas = BigInt(300000); // Fallback gas limit
      }
      
      try {
        // First try with estimated gas and current gas price
        console.log('🚀 Attempt 1: Estimated gas with current price');
        tx = await this.contract.useAgent(tokenId, {
          value: usageCost,
          gasLimit: estimatedGas,
          gasPrice: gasPrice
        });
      } catch (gasError) {
        console.warn('⚠️ First usage attempt failed, trying with different gas settings...');
        
        try {
          // Try with EIP-1559 gas settings (Type 2 transaction)
          console.log('🚀 Attempt 2: EIP-1559 gas settings');
          const feeData = await this.provider!.getFeeData();
          tx = await this.contract.useAgent(tokenId, {
            value: usageCost,
            gasLimit: estimatedGas,
            maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('50', 'gwei'),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('30', 'gwei')
          });
        } catch (eip1559Error) {
          console.warn('⚠️ EIP-1559 usage failed, trying with minimal gas settings...');
          
          // Last resort: try with minimal gas settings
          try {
            console.log('🚀 Attempt 3: Minimal gas settings');
            tx = await this.contract.useAgent(tokenId, {
              value: usageCost,
              gasLimit: BigInt(200000), // Lower gas limit
              gasPrice: ethers.parseUnits('10', 'gwei') // Lower gas price
            });
          } catch (finalError) {
            console.error('❌ All usage gas strategies failed:', finalError);
            throw new Error(`All usage transaction attempts failed. Last error: ${finalError instanceof Error ? finalError.message : 'Unknown error'}`);
          }
        }
      }
      
      const receipt = await tx.wait();
      console.log('✅ Per-use payment successful:', receipt.status === 1);
      return receipt.status === 1;
    }
  }

  /**
   * Use an agent with prepaid inference (no payment required)
   */
  async useAgentPrepaid(tokenId: number): Promise<boolean> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized or signer not available');
    }

    // Check if user is the owner
    const userAddress = await this.signer.getAddress();
    const owner = await this.contract.ownerOf(tokenId);
    const isOwner = owner.toLowerCase() === userAddress.toLowerCase();
    
    if (isOwner) {
      console.log('👑 Owner using agent for free (no MetaMask prompt)');
    } else {
      console.log('🎉 Using prepaid agent (no MetaMask prompt needed)');
    }
    
    const tx = await this.contract.useAgentPrepaid(tokenId);
    const receipt = await tx.wait();
    console.log('✅ Prepaid use successful:', receipt.status === 1);
    return receipt.status === 1;
  }

  /**
   * Transfer agent ownership
   */
  async transferAgent(tokenId: number, to: string): Promise<void> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized or signer not available');
    }

    const tx = await this.contract.safeTransferFrom(
      await this.signer.getAddress(),
      to,
      tokenId
    );

    await tx.wait();
  }

  /**
   * Get all agents owned by a user
   */
  async getUserAgents(userAddress: string): Promise<number[]> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    // This would require implementing a function to get all tokens owned by a user
    // For now, we'll return an empty array and implement this in the contract
    return [];
  }





  /**
   * Update agent metadata
   */
  async updateAgentMetadata(tokenId: number, metadata: AgentMetadata): Promise<void> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized or wallet not connected');
    }

    const tx = await (this.contract as any).updateAgentMetadata(tokenId, metadata);
    await tx.wait();
  }

  /**
   * Convert wei to ETH
   */
  weiToEth(wei: string): string {
    return ethers.formatEther(wei);
  }

  /**
   * Convert ETH to wei
   */
  ethToWei(eth: string): string {
    return ethers.parseEther(eth).toString();
  }

  /**
   * Validate contract deployment and ABI compatibility
   */
  async validateContract(): Promise<boolean> {
    if (!this.contract || !this.provider) {
      throw new Error('Contract or provider not initialized');
    }

    try {
      console.log('🔍 Validating contract deployment...');
      
      // Check if contract exists at the address
      const code = await this.provider.getCode(this.contract.target);
      if (code === '0x') {
        throw new Error(`No contract found at address ${this.contract.target}`);
      }
      console.log('✅ Contract exists at address');
      
      // Try to call a simple view function to verify ABI compatibility
      try {
        const totalAgents = await this.contract.getTotalAgents();
        console.log('✅ Contract ABI is compatible, total agents:', totalAgents.toString());
        
        // Test a more complex function to ensure the contract is fully functional
        try {
          const allTokenIds = await this.contract.getAllTokenIds();
          console.log('✅ Contract is fully functional, token IDs:', allTokenIds.length);
        } catch (complexError) {
          console.warn('⚠️ Complex function test failed, but basic functions work:', complexError);
        }
        
        return true;
      } catch (abiError) {
        console.error('❌ Contract ABI mismatch:', abiError);
        throw new Error(`Contract ABI mismatch: ${abiError instanceof Error ? abiError.message : 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Contract validation failed:', error);
      throw error;
    }
  }


  /**
   * Switch to Polygon Amoy testnet if not already connected
   */
  async switchToPolygonAmoyNetwork(): Promise<boolean> {
    if (!this.provider) {
      throw new Error('Web3 provider not available');
    }

    try {
      const network = await this.provider.getNetwork();
      
      if (network.chainId === BigInt(80002)) {
        console.log('✅ Already connected to Polygon Amoy testnet');
        return true;
      }

      console.log('🔄 Switching to Polygon Amoy testnet...');
      
      // Request to switch network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x13882' }], // 80002 in hex
      });
      
      console.log('✅ Successfully switched to Polygon Amoy testnet');
      return true;
    } catch (error: any) {
      // If the network doesn't exist, add it
      if (error.code === 4902) {
        console.log('🔄 Adding Polygon Amoy testnet...');
        
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x13882', // 80002 in hex
              chainName: 'Polygon Amoy Testnet',
              rpcUrls: ['https://rpc-amoy.polygon.technology'],
              blockExplorerUrls: ['https://amoy.polygonscan.com'],
              nativeCurrency: {
                name: 'MATIC',
                symbol: 'MATIC',
                decimals: 18,
              },
            }],
          });
          
          console.log('✅ Successfully added and switched to Polygon Amoy testnet');
          return true;
        } catch (addError) {
          console.error('❌ Failed to add Polygon Amoy testnet:', addError);
          throw new Error('Failed to add Polygon Amoy testnet. Please add it manually in MetaMask.');
        }
      } else {
        console.error('❌ Failed to switch network:', error);
        throw new Error('Failed to switch to Polygon Amoy testnet. Please switch manually in MetaMask.');
      }
    }
  }

  /**
   * Get total number of agents
   */
  async getTotalAgents(): Promise<number> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const total = await this.contract.getTotalAgents();
    return Number(total);
  }

  /**
   * Get all agent token IDs
   */
  async getAllTokenIds(): Promise<number[]> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    console.log('🔍 Calling getAllTokenIds...');
    console.log('📋 Contract address:', this.contract.target);
    console.log('📋 Signer address:', await this.signer?.getAddress());
    
    try {
      const tokenIds = await this.contract.getAllTokenIds();
      console.log('✅ getAllTokenIds result:', tokenIds);
      return tokenIds.map((id: any) => Number(id));
    } catch (error) {
      console.error('❌ getAllTokenIds error:', error);
      throw error;
    }
  }

  /**
   * Get agents with pagination
   */
  async getAgentsPaginated(offset: number, limit: number): Promise<number[]> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const tokenIds = await this.contract.getAgentsPaginated(offset, limit);
    return tokenIds.map((id: any) => Number(id));
  }

  /**
   * Get agents owned by a specific address
   */
  async getAgentsByOwner(ownerAddress: string): Promise<number[]> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const tokenIds = await this.contract.getAgentsByOwner(ownerAddress);
    return tokenIds.map((id: any) => Number(id));
  }

  /**
   * Get agents available for rent
   */
  async getAgentsForRent(): Promise<number[]> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const tokenIds = await this.contract.getAgentsForRent();
    return tokenIds.map((id: any) => Number(id));
  }

  /**
   * Get all marketplace agents with full metadata
   */
  async getAllMarketplaceAgents(userAddress?: string): Promise<Array<{
    tokenId: number;
    metadata: AgentMetadata;
    toolConfig: ToolConfig;
    owner: string;
    isOwner: boolean;
    canUse: boolean;
    rentalBalance: number;
    prepaidInferenceBalance: number;
    isForSale: boolean;
    salePrice: number;
  }>> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    let tokenIds: number[] = [];
    
    try {
      tokenIds = await this.getAllTokenIds();
    } catch (error) {
      console.error('❌ Failed to get all token IDs, trying fallback method:', error);
      // Fallback: try to get total agents and iterate
      try {
        const totalAgents = await this.contract.getTotalAgents();
        console.log('🔄 Using fallback method, total agents:', totalAgents.toString());
        tokenIds = Array.from({ length: Number(totalAgents) }, (_, i) => i + 1);
      } catch (fallbackError) {
        console.error('❌ Fallback method also failed:', fallbackError);
        return []; // Return empty array if both methods fail
      }
    }
    
    const agents = [];

    for (const tokenId of tokenIds) {
      try {
        const metadata = await this.getAgentMetadata(tokenId);
        const toolConfig = await this.getToolConfig(tokenId);
        const owner = await this.contract.ownerOf(tokenId);
        const isOwner = userAddress ? owner.toLowerCase() === userAddress.toLowerCase() : false;
        const canUse = userAddress ? await this.canUseAgent(tokenId, userAddress) : false;
        const rentalBalance = userAddress ? await this.getRentalBalance(tokenId, userAddress) : 0;
        const prepaidInferenceBalance = userAddress ? await this.getPrepaidInferenceBalance(tokenId, userAddress) : 0;
        const isForSale = await this.contract.isForSale(tokenId);
        const salePrice = isForSale ? parseFloat(ethers.formatEther(await this.contract.salePrice(tokenId))) : 0;

        agents.push({
          tokenId,
          metadata,
          toolConfig,
          owner,
          isOwner,
          canUse,
          rentalBalance,
          prepaidInferenceBalance,
          isForSale,
          salePrice,
        });
      } catch (error) {
        console.warn(`Failed to load agent ${tokenId}:`, error);
        // Continue with other agents
      }
    }

    return agents;
  }

  /**
   * List agent for sale
   */
  async listAgentForSale(tokenId: number, priceInEth: number): Promise<void> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized or wallet not connected');
    }

    // Verify ownership before attempting to list
    const userAddress = await this.signer.getAddress();
    const owner = await this.contract.ownerOf(tokenId);
    const isOwner = owner.toLowerCase() === userAddress.toLowerCase();
    
    if (!isOwner) {
      throw new Error(`You are not the owner of this agent. Owner: ${owner}, Your address: ${userAddress}`);
    }

    const priceInWei = this.ethToWei(priceInEth.toString());
    
    console.log('🔄 Listing agent for sale:', {
      tokenId,
      priceInEth,
      priceInWei: priceInWei.toString(),
      userAddress,
      owner
    });

    // Get current gas price for Polygon Amoy
    let gasPrice;
    try {
      const feeData = await this.provider!.getFeeData();
      gasPrice = feeData.gasPrice || ethers.parseUnits('30', 'gwei');
      console.log('⛽ Using gas price for listing:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
    } catch (error) {
      console.warn('⚠️ Could not get gas price, using fallback');
      gasPrice = ethers.parseUnits('30', 'gwei');
    }

    // Try different gas strategies for Polygon Amoy
    let tx;
    
    // First, try to estimate gas to get a better gas limit
    let estimatedGas;
    try {
      console.log('🔍 Estimating gas for listAgentForSale...');
      estimatedGas = await (this.contract as any).listAgentForSale.estimateGas(tokenId, priceInWei);
      console.log('⛽ Estimated gas:', estimatedGas.toString());
      // Add 20% buffer
      estimatedGas = (estimatedGas * BigInt(120)) / BigInt(100);
      console.log('⛽ Gas with buffer:', estimatedGas.toString());
    } catch (gasEstimateError) {
      console.warn('⚠️ Gas estimation failed, using fallback:', gasEstimateError);
      estimatedGas = BigInt(200000); // Fallback gas limit
    }
    
    try {
      // First try with estimated gas and current gas price
      console.log('🚀 Attempt 1: Estimated gas with current price');
      tx = await (this.contract as any).listAgentForSale(tokenId, priceInWei, {
        gasLimit: estimatedGas,
        gasPrice: gasPrice
      });
    } catch (gasError) {
      console.warn('⚠️ First listing attempt failed, trying with different gas settings...');
      
      try {
        // Try with EIP-1559 gas settings (Type 2 transaction)
        console.log('🚀 Attempt 2: EIP-1559 gas settings');
        const feeData = await this.provider!.getFeeData();
        tx = await (this.contract as any).listAgentForSale(tokenId, priceInWei, {
          gasLimit: estimatedGas,
          maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('50', 'gwei'),
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('30', 'gwei')
        });
      } catch (eip1559Error) {
        console.warn('⚠️ EIP-1559 listing failed, trying with minimal gas settings...');
        
        // Last resort: try with minimal gas settings
        try {
          console.log('🚀 Attempt 3: Minimal gas settings');
          tx = await (this.contract as any).listAgentForSale(tokenId, priceInWei, {
            gasLimit: BigInt(150000), // Lower gas limit
            gasPrice: ethers.parseUnits('10', 'gwei') // Lower gas price
          });
        } catch (finalError) {
          console.error('❌ All listing gas strategies failed:', finalError);
          throw new Error(`All listing transaction attempts failed. Last error: ${finalError instanceof Error ? finalError.message : 'Unknown error'}`);
        }
      }
    }

    console.log('📝 Listing transaction sent:', tx.hash);
    console.log('⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait();
    
    console.log('✅ Listing transaction confirmed:', {
      hash: receipt.hash,
      status: receipt.status,
      gasUsed: receipt.gasUsed?.toString()
    });
  }

  /**
   * Delist agent from sale
   */
  async delistAgentFromSale(tokenId: number): Promise<void> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized or wallet not connected');
    }

    // Verify ownership before attempting to delist
    const userAddress = await this.signer.getAddress();
    const owner = await this.contract.ownerOf(tokenId);
    const isOwner = owner.toLowerCase() === userAddress.toLowerCase();
    
    if (!isOwner) {
      throw new Error(`You are not the owner of this agent. Owner: ${owner}, Your address: ${userAddress}`);
    }

    console.log('🔄 Delisting agent from sale:', {
      tokenId,
      userAddress,
      owner
    });

    // Get current gas price for Polygon Amoy
    let gasPrice;
    try {
      const feeData = await this.provider!.getFeeData();
      gasPrice = feeData.gasPrice || ethers.parseUnits('30', 'gwei');
      console.log('⛽ Using gas price for delisting:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
    } catch (error) {
      console.warn('⚠️ Could not get gas price, using fallback');
      gasPrice = ethers.parseUnits('30', 'gwei');
    }

    // Try different gas strategies for Polygon Amoy
    let tx;
    
    // First, try to estimate gas to get a better gas limit
    let estimatedGas;
    try {
      console.log('🔍 Estimating gas for delistAgentFromSale...');
      estimatedGas = await (this.contract as any).delistAgentFromSale.estimateGas(tokenId);
      console.log('⛽ Estimated gas:', estimatedGas.toString());
      // Add 20% buffer
      estimatedGas = (estimatedGas * BigInt(120)) / BigInt(100);
      console.log('⛽ Gas with buffer:', estimatedGas.toString());
    } catch (gasEstimateError) {
      console.warn('⚠️ Gas estimation failed, using fallback:', gasEstimateError);
      estimatedGas = BigInt(150000); // Fallback gas limit
    }
    
    try {
      // First try with estimated gas and current gas price
      console.log('🚀 Attempt 1: Estimated gas with current price');
      tx = await (this.contract as any).delistAgentFromSale(tokenId, {
        gasLimit: estimatedGas,
        gasPrice: gasPrice
      });
    } catch (gasError) {
      console.warn('⚠️ First delisting attempt failed, trying with different gas settings...');
      
      try {
        // Try with EIP-1559 gas settings (Type 2 transaction)
        console.log('🚀 Attempt 2: EIP-1559 gas settings');
        const feeData = await this.provider!.getFeeData();
        tx = await (this.contract as any).delistAgentFromSale(tokenId, {
          gasLimit: estimatedGas,
          maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('50', 'gwei'),
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('30', 'gwei')
        });
      } catch (eip1559Error) {
        console.warn('⚠️ EIP-1559 delisting failed, trying with minimal gas settings...');
        
        // Last resort: try with minimal gas settings
        try {
          console.log('🚀 Attempt 3: Minimal gas settings');
          tx = await (this.contract as any).delistAgentFromSale(tokenId, {
            gasLimit: BigInt(100000), // Lower gas limit
            gasPrice: ethers.parseUnits('10', 'gwei') // Lower gas price
          });
        } catch (finalError) {
          console.error('❌ All delisting gas strategies failed:', finalError);
          throw new Error(`All delisting transaction attempts failed. Last error: ${finalError instanceof Error ? finalError.message : 'Unknown error'}`);
        }
      }
    }

    console.log('📝 Delisting transaction sent:', tx.hash);
    console.log('⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait();
    
    console.log('✅ Delisting transaction confirmed:', {
      hash: receipt.hash,
      status: receipt.status,
      gasUsed: receipt.gasUsed?.toString()
    });
  }

  /**
   * Buy agent NFT
   */
  async buyAgent(tokenId: number, priceInEth: number): Promise<void> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized or wallet not connected');
    }

    // Get the current sale price from the contract
    const salePriceInWei = await this.contract.salePrice(tokenId);
    
    // Get current gas price for Polygon Amoy
    let gasPrice;
    try {
      const feeData = await this.provider!.getFeeData();
      gasPrice = feeData.gasPrice || ethers.parseUnits('30', 'gwei');
      console.log('⛽ Using gas price for purchase:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
    } catch (error) {
      console.warn('⚠️ Could not get gas price, using fallback');
      gasPrice = ethers.parseUnits('30', 'gwei');
    }

    // Try different gas strategies for Polygon Amoy
    let tx;
    
    // First, try to estimate gas to get a better gas limit
    let estimatedGas;
    try {
      console.log('🔍 Estimating gas for buyAgent...');
      estimatedGas = await (this.contract as any).buyAgent.estimateGas(tokenId, {
        value: salePriceInWei
      });
      console.log('⛽ Estimated gas:', estimatedGas.toString());
      // Add 20% buffer
      estimatedGas = (estimatedGas * BigInt(120)) / BigInt(100);
      console.log('⛽ Gas with buffer:', estimatedGas.toString());
    } catch (gasEstimateError) {
      console.warn('⚠️ Gas estimation failed, using fallback:', gasEstimateError);
      estimatedGas = BigInt(500000); // Fallback gas limit
    }
    
    try {
      // First try with estimated gas and current gas price
      console.log('🚀 Attempt 1: Estimated gas with current price');
      tx = await (this.contract as any).buyAgent(tokenId, { 
        value: salePriceInWei,
        gasLimit: estimatedGas,
        gasPrice: gasPrice
      });
    } catch (gasError) {
      console.warn('⚠️ First purchase attempt failed, trying with different gas settings...');
      
      try {
        // Try with EIP-1559 gas settings (Type 2 transaction)
        console.log('🚀 Attempt 2: EIP-1559 gas settings');
        const feeData = await this.provider!.getFeeData();
        tx = await (this.contract as any).buyAgent(tokenId, { 
          value: salePriceInWei,
          gasLimit: estimatedGas,
          maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('50', 'gwei'),
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('30', 'gwei')
        });
      } catch (eip1559Error) {
        console.warn('⚠️ EIP-1559 purchase failed, trying with minimal gas settings...');
        
        // Last resort: try with minimal gas settings
        try {
          console.log('🚀 Attempt 3: Minimal gas settings');
          tx = await (this.contract as any).buyAgent(tokenId, { 
            value: salePriceInWei,
            gasLimit: BigInt(300000), // Lower gas limit
            gasPrice: ethers.parseUnits('10', 'gwei') // Lower gas price
          });
        } catch (finalError) {
          console.error('❌ All purchase gas strategies failed:', finalError);
          throw new Error(`All purchase transaction attempts failed. Last error: ${finalError instanceof Error ? finalError.message : 'Unknown error'}`);
        }
      }
    }
    
    await tx.wait();
  }

  /**
   * Check if agent is for sale
   */
  async isAgentForSale(tokenId: number): Promise<boolean> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    return await this.contract.isForSale(tokenId);
  }

  /**
   * Get agent sale price
   */
  async getAgentSalePrice(tokenId: number): Promise<string> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const priceInWei = await this.contract.salePrice(tokenId);
    return priceInWei.toString();
  }

  /**
   * Get agents for sale
   */
  async getAgentsForSale(): Promise<number[]> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const tokenIds = await this.contract.getAgentsForSale();
    return tokenIds.map((id: any) => Number(id));
  }

  /**
   * Convert NFT metadata to full AgentConfig for execution
   */
  convertNFTMetadataToAgentConfig(nftAgent: NFTAgent): AgentConfig {
    // Provide default values if toolConfig is undefined
    const toolConfig = nftAgent.toolConfig || {
      enableWebSearch: false,
      enableCodeExecution: false,
      enableBrowserAutomation: false,
      enableWolframAlpha: false,
      enableStreaming: false,
      responseFormat: 'text',
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
      frequencyPenalty: 0,
      presencePenalty: 0
    };

    return {
      id: nftAgent.id,
      name: nftAgent.name,
      description: nftAgent.description,
      systemPrompt: nftAgent.systemPrompt || 'You are a helpful AI assistant.',
      model: nftAgent.model,
      temperature: toolConfig.temperature,
      maxTokens: toolConfig.maxTokens,
      topP: toolConfig.topP,
      frequencyPenalty: toolConfig.frequencyPenalty,
      presencePenalty: toolConfig.presencePenalty,
      
      // Tool configuration from toolConfig
      enabledTools: this.getEnabledToolsFromConfig(toolConfig),
      responseFormat: toolConfig.responseFormat as 'text' | 'json_object',
      enableStreaming: toolConfig.enableStreaming,
      enableWebSearch: toolConfig.enableWebSearch,
      enableCodeExecution: toolConfig.enableCodeExecution,
      enableBrowserAutomation: toolConfig.enableBrowserAutomation,
      enableWolframAlpha: toolConfig.enableWolframAlpha,
      
      // Custom settings (these would need to be stored separately or in IPFS)
      customInstructions: nftAgent.customInstructions || [],
      exampleConversations: nftAgent.exampleConversations || [],
      guardrails: nftAgent.guardrails || [],
      
      // NFT properties
      isNFT: true,
      ownerAddress: nftAgent.creator,
      usageCost: parseFloat(this.weiToEth(nftAgent.metadata.usageCost)),
      maxUsagesPerDay: nftAgent.metadata.maxUsagesPerDay,
      isForRent: nftAgent.metadata.isForRent,
      rentPricePerUse: parseFloat(this.weiToEth(nftAgent.metadata.rentPricePerUse)),
    };
  }

  /**
   * Get enabled tools array from tool config
   */
  private getEnabledToolsFromConfig(config: ToolConfig): string[] {
    const tools: string[] = [];
    
    if (config.enableWebSearch) {
      tools.push('web_search');
    }
    if (config.enableCodeExecution) {
      tools.push('code_interpreter');
    }
    if (config.enableBrowserAutomation) {
      tools.push('visit_website', 'browser_automation');
    }
    if (config.enableWolframAlpha) {
      tools.push('wolfram_alpha');
    }
    
    return tools;
  }

  /**
   * Debug function to check user balances
   */
  async debugUserBalances(tokenId: number, userAddress?: string): Promise<{
    rentalBalance: number;
    prepaidInferenceBalance: number;
    isOwner: boolean;
  }> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const address = userAddress || (this.signer ? await this.signer.getAddress() : '');
    if (!address) {
      throw new Error('No user address provided');
    }

    const rentalBalance = await this.getRentalBalance(tokenId, address);
    const prepaidInferenceBalance = await this.getPrepaidInferenceBalance(tokenId, address);
    const owner = await this.contract.ownerOf(tokenId);
    const isOwner = owner.toLowerCase() === address.toLowerCase();

    console.log('🔍 Debug balances:', {
      tokenId,
      userAddress: address,
      rentalBalance,
      prepaidInferenceBalance,
      isOwner,
      owner
    });

    return {
      rentalBalance,
      prepaidInferenceBalance,
      isOwner
    };
  }
}

// Export singleton instance
export const nftService = new NFTService();

// Expose debug functions globally for testing
if (typeof window !== 'undefined') {
  (window as any).debugNFTBalances = async (tokenId: number) => {
    try {
      const balances = await nftService.debugUserBalances(tokenId);
      console.log('🔍 NFT Balances:', balances);
      return balances;
    } catch (error) {
      console.error('❌ Debug failed:', error);
      return null;
    }
  };

  (window as any).checkContractAddress = () => {
    const address = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
    console.log('📋 Contract Address:', address);
    return address;
  };

  (window as any).testContractConnection = async () => {
    try {
      console.log('🧪 Testing contract connection...');
      const isReady = await nftService.isReady();
      console.log('✅ NFT Service Ready:', isReady);
      
      if (isReady) {
        await nftService.validateContract();
        console.log('✅ Contract validation passed');
        
        // Test a simple function call
        const totalAgents = await nftService.getTotalAgents();
        console.log('✅ Total agents:', totalAgents);
        
        return { success: true, totalAgents };
      } else {
        return { success: false, error: 'NFT Service not ready' };
      }
    } catch (error) {
      console.error('❌ Contract test failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };
}
