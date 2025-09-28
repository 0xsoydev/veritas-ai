"use client";
import { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@/lib/wallet-context';
import { nftService, NFTAgent, AgentMetadata } from '@/lib/nftService';
import { StoredAgent } from '@/lib/agentStorageService';
import { ethers } from 'ethers';

interface AgentMarketplaceProps {
  agents?: StoredAgent[];
  nftAgents?: NFTAgent[];
}

interface MarketplaceAgent extends AgentMetadata {
  tokenId: number;
  owner: string;
  isOwner: boolean;
  canUse: boolean;
  rentalBalance: number;
  prepaidInferenceBalance: number;
  isForSale: boolean;
  salePrice: number;
  
  // Tool configuration properties
  enableWebSearch: boolean;
  enableCodeExecution: boolean;
  enableBrowserAutomation: boolean;
  enableWolframAlpha: boolean;
  enableStreaming: boolean;
  responseFormat: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export function AgentMarketplace({ }: AgentMarketplaceProps) {
  const { address, isConnected } = useWallet();
  const [marketplaceAgents, setMarketplaceAgents] = useState<MarketplaceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'for-rent' | 'for-sale' | 'owned' | 'my-listings'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'created' | 'usage'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Rental state
  const [rentalModal, setRentalModal] = useState<{ isOpen: boolean; agent: MarketplaceAgent | null }>({
    isOpen: false,
    agent: null
  });
  const [rentalUses, setRentalUses] = useState<number>(1);
  const [rentalLoading, setRentalLoading] = useState(false);
  
  // Usage state
  const [usageModal, setUsageModal] = useState<{ isOpen: boolean; agent: MarketplaceAgent | null }>({
    isOpen: false,
    agent: null
  });
  const [usageLoading, setUsageLoading] = useState(false);
  
  // Buy state
  const [buyModal, setBuyModal] = useState<{ isOpen: boolean; agent: MarketplaceAgent | null }>({
    isOpen: false,
    agent: null
  });
  const [buyLoading, setBuyLoading] = useState(false);

  // Load all marketplace agents from the smart contract
  useEffect(() => {
    const loadMarketplaceAgents = async () => {
      if (!isConnected || !address) {
        setMarketplaceAgents([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Check if NFT service is ready
        const isReady = await nftService.isReady();
        if (!isReady) {
          throw new Error('NFT service not ready. Please check your wallet connection.');
        }

        // Load all agents from the smart contract
        const allAgents = await nftService.getAllMarketplaceAgents(address);
        
        // Transform to MarketplaceAgent format
        const marketplaceAgents: MarketplaceAgent[] = allAgents.map(agent => ({
          tokenId: agent.tokenId,
          name: agent.metadata.name,
          description: agent.metadata.description,
          model: agent.metadata.model,
          usageCost: agent.metadata.usageCost,
          maxUsagesPerDay: agent.metadata.maxUsagesPerDay,
          isForRent: agent.metadata.isForRent,
          rentPricePerUse: agent.metadata.rentPricePerUse,
          ipfsHash: agent.metadata.ipfsHash,
          creator: agent.metadata.creator,
          createdAt: agent.metadata.createdAt,
          
          // Tool configuration properties from toolConfig
          enableWebSearch: agent.toolConfig.enableWebSearch,
          enableCodeExecution: agent.toolConfig.enableCodeExecution,
          enableBrowserAutomation: agent.toolConfig.enableBrowserAutomation,
          enableWolframAlpha: agent.toolConfig.enableWolframAlpha,
          enableStreaming: agent.toolConfig.enableStreaming,
          responseFormat: agent.toolConfig.responseFormat,
          temperature: agent.toolConfig.temperature,
          maxTokens: agent.toolConfig.maxTokens,
          topP: agent.toolConfig.topP,
          frequencyPenalty: agent.toolConfig.frequencyPenalty,
          presencePenalty: agent.toolConfig.presencePenalty,
          
          owner: agent.owner,
          isOwner: agent.isOwner,
          canUse: agent.canUse,
          rentalBalance: agent.rentalBalance,
          prepaidInferenceBalance: agent.prepaidInferenceBalance,
          isForSale: agent.isForSale,
          salePrice: agent.salePrice,
        }));
        
        setMarketplaceAgents(marketplaceAgents);
        
      } catch (err) {
        console.error('Failed to load marketplace agents:', err);
        setError(err instanceof Error ? err.message : 'Failed to load marketplace agents');
      } finally {
        setLoading(false);
      }
    };

    loadMarketplaceAgents();
  }, [isConnected, address]);

  // Filter and sort agents
  const filteredAndSortedAgents = useMemo(() => {
    const filtered = marketplaceAgents.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           agent.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           agent.model.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      switch (filterType) {
        case 'for-rent':
          return agent.isForRent;
        case 'for-sale':
          return agent.isForSale;
        case 'owned':
          return agent.isOwner;
        case 'my-listings':
          return agent.isOwner && (agent.isForSale || agent.isForRent);
        default:
          return true;
      }
    });

    // Sort agents
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'price':
          const aPrice = a.isForRent ? parseFloat(ethers.formatEther(a.rentPricePerUse)) : 
                        a.isForSale ? a.salePrice : 0;
          const bPrice = b.isForRent ? parseFloat(ethers.formatEther(b.rentPricePerUse)) : 
                        b.isForSale ? b.salePrice : 0;
          comparison = aPrice - bPrice;
          break;
        case 'created':
          comparison = a.createdAt - b.createdAt;
          break;
        case 'usage':
          comparison = parseFloat(ethers.formatEther(a.usageCost)) - parseFloat(ethers.formatEther(b.usageCost));
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [marketplaceAgents, searchTerm, filterType, sortBy, sortOrder]);

  // Handle agent rental
  const handleRentAgent = async (agent: MarketplaceAgent) => {
    if (!address) {
      setError('Please connect your wallet to rent agents');
      return;
    }

    try {
      setRentalLoading(true);
      setError(null);

      const rentalCost = BigInt(agent.rentPricePerUse) * BigInt(rentalUses);
      
      console.log('🔄 Attempting to rent agent:', {
        tokenId: agent.tokenId,
        uses: rentalUses,
        rentalCost: rentalCost.toString(),
        rentPricePerUse: agent.rentPricePerUse.toString()
      });
      
      // Check if nftService is ready
      const isReady = await nftService.isReady();
      if (!isReady) {
        throw new Error('NFT service not ready. Please check your wallet connection.');
      }
      
      console.log('✅ NFT service is ready, proceeding with rental...');
      
      // Pay only rental costs
      await nftService.rentAgent(agent.tokenId, rentalUses, agent.rentPricePerUse);
      
      // Refresh agent data
      await refreshMarketplaceAgents();
      
      // Sync rental uses in the executor
      if ((window as any).syncRentalUsesFromContract) {
        await (window as any).syncRentalUsesFromContract();
      }
      
      setRentalModal({ isOpen: false, agent: null });
      setRentalUses(1);
      
      // Show success message
      const rentalCostEth = parseFloat(ethers.formatEther(rentalCost));
      alert(`🎉 Successfully rented ${agent.name} for ${rentalUses} uses!\n\n✅ Rental cost: ${rentalCostEth.toFixed(4)} MATIC\n\n🚀 You can now use it!`);
      
    } catch (err) {
      console.error('Failed to rent agent:', err);
      
      let errorMessage = 'Failed to rent agent';
      
      if (err instanceof Error) {
        if (err.message.includes('4100') || err.message.includes('not been authorized')) {
          errorMessage = 'Transaction rejected by MetaMask. Please:\n1. Check that MetaMask is unlocked\n2. Ensure you\'re on the correct network (Polygon Amoy testnet)\n3. Approve the transaction when prompted';
        } else if (err.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds. Please add more MATIC to your wallet.';
        } else if (err.message.includes('user rejected')) {
          errorMessage = 'Transaction was cancelled by user.';
        } else if (err.message.includes('Internal JSON-RPC error')) {
          errorMessage = 'Polygon Amoy network error. Please try again in a few moments. If the problem persists, check your internet connection and ensure you have enough MATIC for gas fees.';
        } else if (err.message.includes('could not coalesce error')) {
          errorMessage = 'Transaction failed due to network issues. Please try again with a different gas price or wait for network congestion to clear.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setRentalLoading(false);
    }
  };

  // Handle agent usage
  const handleUseAgent = async (agent: MarketplaceAgent) => {
    if (!address) {
      setError('Please connect your wallet to use agents');
      return;
    }

    try {
      setUsageLoading(true);
      setError(null);

      const success = await nftService.useAgent(agent.tokenId, agent.usageCost);
      
      if (success) {
        // Refresh agent data
        await refreshMarketplaceAgents();
        setUsageModal({ isOpen: false, agent: null });
      } else {
        setError('Failed to use agent');
      }
      
    } catch (err) {
      console.error('Failed to use agent:', err);
      setError(err instanceof Error ? err.message : 'Failed to use agent');
    } finally {
      setUsageLoading(false);
    }
  };

  // Handle agent purchase
  const handleBuyAgent = async (agent: MarketplaceAgent) => {
    if (!address) {
      setError('Please connect your wallet to buy agents');
      return;
    }

    try {
      setBuyLoading(true);
      setError(null);

      await nftService.buyAgent(agent.tokenId, agent.salePrice);
      
      // Refresh agent data
      await refreshMarketplaceAgents();
      setBuyModal({ isOpen: false, agent: null });
      
      // Show success message
      alert(`🎉 Successfully bought ${agent.name} for ${agent.salePrice} MATIC!`);
      
    } catch (err) {
      console.error('Failed to buy agent:', err);
      
      let errorMessage = 'Failed to buy agent';
      
      if (err instanceof Error) {
        if (err.message.includes('4100') || err.message.includes('not been authorized')) {
          errorMessage = 'Transaction rejected by MetaMask. Please:\n1. Check that MetaMask is unlocked\n2. Ensure you\'re on the correct network (Polygon Amoy testnet)\n3. Approve the transaction when prompted';
        } else if (err.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds. Please add more MATIC to your wallet.';
        } else if (err.message.includes('user rejected')) {
          errorMessage = 'Transaction was cancelled by user.';
        } else if (err.message.includes('Internal JSON-RPC error')) {
          errorMessage = 'Polygon Amoy network error. Please try again in a few moments. If the problem persists, check your internet connection and ensure you have enough MATIC for gas fees.';
        } else if (err.message.includes('could not coalesce error')) {
          errorMessage = 'Transaction failed due to network issues. Please try again with a different gas price or wait for network congestion to clear.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setBuyLoading(false);
    }
  };

  // Refresh marketplace agents
  const refreshMarketplaceAgents = async () => {
    if (!isConnected || !address) return;

    try {
      setError(null);
      const allAgents = await nftService.getAllMarketplaceAgents(address);
      
      const marketplaceAgents: MarketplaceAgent[] = allAgents.map(agent => ({
        tokenId: agent.tokenId,
        name: agent.metadata.name,
        description: agent.metadata.description,
        model: agent.metadata.model,
        usageCost: agent.metadata.usageCost,
        maxUsagesPerDay: agent.metadata.maxUsagesPerDay,
        isForRent: agent.metadata.isForRent,
        rentPricePerUse: agent.metadata.rentPricePerUse,
        ipfsHash: agent.metadata.ipfsHash,
        creator: agent.metadata.creator,
        createdAt: agent.metadata.createdAt,
        
        // Tool configuration properties from toolConfig
        enableWebSearch: agent.toolConfig.enableWebSearch,
        enableCodeExecution: agent.toolConfig.enableCodeExecution,
        enableBrowserAutomation: agent.toolConfig.enableBrowserAutomation,
        enableWolframAlpha: agent.toolConfig.enableWolframAlpha,
        enableStreaming: agent.toolConfig.enableStreaming,
        responseFormat: agent.toolConfig.responseFormat,
        temperature: agent.toolConfig.temperature,
        maxTokens: agent.toolConfig.maxTokens,
        topP: agent.toolConfig.topP,
        frequencyPenalty: agent.toolConfig.frequencyPenalty,
        presencePenalty: agent.toolConfig.presencePenalty,
        
        owner: agent.owner,
        isOwner: agent.isOwner,
        canUse: agent.canUse,
        rentalBalance: agent.rentalBalance,
        prepaidInferenceBalance: agent.prepaidInferenceBalance,
        isForSale: agent.isForSale,
        salePrice: agent.salePrice,
      }));
      
      setMarketplaceAgents(marketplaceAgents);
    } catch (err) {
      console.error('Failed to refresh marketplace agents:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh marketplace agents');
    }
  };

  if (!isConnected) {
    return (
      <div className="w-[80vw] mx-auto py-8">
        <div className="text-center py-12">
          <div className="text-6xl mb-6">🔐</div>
          <h2 className="text-3xl font-bricolage-bold text-black mb-4">Wallet Required</h2>
          <p className="text-black font-dmsans-medium mb-6">
            Please connect your wallet to access the AI Agent Marketplace.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-[80vw] h-[70svh] mx-auto py-8">
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-black font-bricolage-bold">Loading marketplace agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[80vw] mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bricolage-bold text-black mb-2">🤖 AI Agent Marketplace</h1>
        <p className="text-black font-dmsans-medium">
          Discover, rent, and use AI agents created by the community
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-100 border-4 border-black rounded-[10px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-600 text-xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-bricolage-bold text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700 font-dmsans-medium">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="mb-8 bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label htmlFor="search" className="block text-sm font-bricolage-bold text-black mb-2">
              Search Agents
            </label>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, description, or model..."
              className="w-full px-3 py-2 border-2 border-black rounded-[5px] focus:ring-2 focus:ring-main font-dmsans-medium"
            />
          </div>

          {/* Filter Type */}
          <div>
            <label htmlFor="filter" className="block text-sm font-bricolage-bold text-black mb-2">
              Filter Type
            </label>
            <select
              id="filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 border-2 border-black rounded-[5px] focus:ring-2 focus:ring-main font-dmsans-medium"
            >
              <option value="all">All Agents</option>
              <option value="for-rent">For Rent</option>
              <option value="for-sale">For Sale</option>
              <option value="owned">My Agents</option>
              <option value="my-listings">My Listings</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label htmlFor="sort" className="block text-sm font-bricolage-bold text-black mb-2">
              Sort By
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border-2 border-black rounded-[5px] focus:ring-2 focus:ring-main font-dmsans-medium"
            >
              <option value="name">Name</option>
              <option value="price">Price</option>
              <option value="created">Created Date</option>
              <option value="usage">Usage Cost</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <label htmlFor="order" className="block text-sm font-bricolage-bold text-black mb-2">
              Order
            </label>
            <select
              id="order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full px-3 py-2 border-2 border-black rounded-[5px] focus:ring-2 focus:ring-main font-dmsans-medium"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Marketplace Content */}
      {marketplaceAgents.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-6">🤖</div>
          <h2 className="text-3xl font-bricolage-bold text-black mb-4">No Agents Available</h2>
          <p className="text-black font-dmsans-medium mb-6">
            The marketplace is currently empty. Agents will appear here once they are minted as NFTs.
          </p>
          <div className="bg-background border-4 border-black rounded-[10px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 max-w-md mx-auto">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-black text-2xl">💡</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-bricolage-bold text-black">Getting Started</h3>
                <div className="mt-2 text-sm text-black font-dmsans-medium">
                  Create your first AI agent and mint it as an NFT to see it appear in the marketplace!
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedAgents.map((agent) => (
            <AgentCard
              key={agent.tokenId}
              agent={agent}
              onRent={() => setRentalModal({ isOpen: true, agent })}
              onUse={() => setUsageModal({ isOpen: true, agent })}
              onBuy={() => setBuyModal({ isOpen: true, agent })}
            />
          ))}
        </div>
      )}

      {/* Rental Modal */}
      {rentalModal.isOpen && rentalModal.agent && (
        <RentalModal
          agent={rentalModal.agent}
          uses={rentalUses}
          onUsesChange={setRentalUses}
          onConfirm={handleRentAgent}
          onClose={() => setRentalModal({ isOpen: false, agent: null })}
          loading={rentalLoading}
        />
      )}

      {/* Usage Modal */}
      {usageModal.isOpen && usageModal.agent && (
        <UsageModal
          agent={usageModal.agent}
          onConfirm={handleUseAgent}
          onClose={() => setUsageModal({ isOpen: false, agent: null })}
          loading={usageLoading}
        />
      )}

      {/* Buy Modal */}
      {buyModal.isOpen && buyModal.agent && (
        <BuyModal
          agent={buyModal.agent}
          onConfirm={handleBuyAgent}
          onClose={() => setBuyModal({ isOpen: false, agent: null })}
          loading={buyLoading}
        />
      )}
    </div>
  );
}

// Agent Card Component
interface AgentCardProps {
  agent: MarketplaceAgent;
  onRent: () => void;
  onUse: () => void;
  onBuy: () => void;
}

function AgentCard({ agent, onRent, onUse, onBuy }: AgentCardProps) {
  const rentPriceEth = parseFloat(ethers.formatEther(agent.rentPricePerUse));
  const salePriceEth = agent.salePrice;

  return (
    <div className="bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-[5px] overflow-hidden">
      {/* Header Section */}
      <div className="p-4 border-b-4 border-black">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bricolage-bold text-black">{agent.name}</h3>
          <button className="bg-gray-200 text-black px-3 py-1 rounded-[5px] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bricolage-bold text-sm">
            {agent.isOwner ? 'Owner' : 'Rent'}
          </button>
        </div>
      </div>

      {/* Main Content Area with Gradient */}
      <div className="relative bg-gradient-to-r from-main to-background p-4 min-h-[200px]">
        {/* Model Section */}
        <div className="absolute bottom-4 left-4">
          <div className="text-black font-bricolage-bold text-sm mb-2">Model</div>
          <button className="bg-gray-200 text-black px-3 py-1 rounded-[5px] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bricolage-bold text-sm">
            {agent.model}
          </button>
        </div>

        {/* Pricing Section */}
        <div className="absolute bottom-4 right-4 text-right">
          <div className="space-y-2">
            <div>
              <div className="text-black font-bricolage-bold text-sm">NFT Price</div>
              <div className="text-black font-bricolage-bold text-lg">
                {agent.isForSale ? salePriceEth.toFixed(4) : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-black font-bricolage-bold text-sm">Rent Price</div>
              <div className="text-black font-bricolage-bold text-lg">
                {agent.isForRent ? rentPriceEth.toFixed(4) : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Section */}
      <div className="p-4 bg-white">
        <div className="grid grid-cols-2 gap-3">
          {agent.isForRent && !agent.isOwner && (
            <button
              onClick={onRent}
              className="bg-background text-black font-bricolage-bold py-3 px-4 rounded-[5px] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all duration-200"
            >
              Rent Agent
            </button>
          )}
          {agent.isForSale && !agent.isOwner && (
            <button
              onClick={onBuy}
              className="bg-main text-black font-bricolage-bold py-3 px-4 rounded-[5px] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all duration-200"
            >
              Buy NFT
            </button>
          )}
          {agent.canUse && (
            <button
              onClick={onUse}
              className="bg-gray-200 hover:bg-gray-300 text-black font-bricolage-bold py-3 px-4 rounded-[5px] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all duration-200"
            >
              Use Agent
            </button>
          )}
          {!agent.isForRent && !agent.isForSale && !agent.canUse && (
            <div className="col-span-2 text-center py-3 px-4 text-sm text-gray-500 bg-gray-100 rounded-[5px] border-2 border-gray-300 font-dmsans-medium">
              Not Available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Rental Modal Component
interface RentalModalProps {
  agent: MarketplaceAgent;
  uses: number;
  onUsesChange: (uses: number) => void;
  onConfirm: (agent: MarketplaceAgent) => void;
  onClose: () => void;
  loading: boolean;
}

function RentalModal({ agent, uses, onUsesChange, onConfirm, onClose, loading }: RentalModalProps) {
  const rentPriceEth = parseFloat(ethers.formatEther(agent.rentPricePerUse));
  const totalCost = rentPriceEth * uses;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-6 border-4 border-black w-[420px] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] bg-white">
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-2xl font-bricolage-bold text-black mb-2">Rent Agent</h3>
          <div className="h-1 w-16 bg-main rounded-full"></div>
        </div>
        
        {/* Agent Info */}
        <div className="mb-6 p-4 bg-gradient-to-r from-main/10 to-background border-2 border-black rounded-[8px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <h4 className="font-bricolage-bold text-black text-lg mb-2">{agent.name}</h4>
          <p className="text-sm text-black font-dmsans-medium line-clamp-2">{agent.description}</p>
        </div>

        {/* Uses Input */}
        <div className="mb-6">
          <label htmlFor="uses" className="block text-sm font-bricolage-bold text-black mb-3">
            Number of Uses
          </label>
          <div className="relative">
            <input
              type="number"
              id="uses"
              min="1"
              max="1000"
              value={uses}
              onChange={(e) => onUsesChange(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-3 border-2 border-black rounded-[8px] focus:ring-2 focus:ring-main font-dmsans-medium text-lg text-center bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              placeholder="Enter number of uses"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bricolage-bold">
              uses
            </div>
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="mb-6 p-4 bg-background border-2 border-black rounded-[8px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-sm font-bricolage-bold text-black mb-3 uppercase tracking-wide">Pricing Summary</div>
          
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-black font-dmsans-medium">Price per use:</span>
              <span className="font-bricolage-bold text-black">{rentPriceEth.toFixed(4)} MATIC</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-black font-dmsans-medium">Number of uses:</span>
              <span className="font-bricolage-bold text-black">{uses}</span>
            </div>
          </div>
          
          <div className="border-t-2 border-black pt-3">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bricolage-bold text-black">Total Cost:</span>
              <span className="text-xl font-bricolage-bold text-main">{totalCost.toFixed(4)} MATIC</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={onClose}
            className="flex-1 bg-background hover:bg-gray-100 text-black font-bricolage-bold py-3 px-4 rounded-[8px] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(agent)}
            disabled={loading}
            className="flex-1 bg-main hover:bg-main/80 text-main-foreground font-bricolage-bold py-3 px-4 rounded-[8px] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            {loading ? 'Processing...' : 'Rent Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Usage Modal Component
interface UsageModalProps {
  agent: MarketplaceAgent;
  onConfirm: (agent: MarketplaceAgent) => void;
  onClose: () => void;
  loading: boolean;
}

function UsageModal({ agent, onConfirm, onClose, loading }: UsageModalProps) {
  const usageCostEth = parseFloat(ethers.formatEther(agent.usageCost));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-6 border-4 border-black w-[420px] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] bg-white">
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-2xl font-bricolage-bold text-black mb-2">Use Agent</h3>
          <div className="h-1 w-16 bg-main rounded-full"></div>
        </div>
        
        {/* Agent Info */}
        <div className="mb-6 p-4 bg-gradient-to-r from-main/10 to-background border-2 border-black rounded-[8px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <h4 className="font-bricolage-bold text-black text-lg mb-2">{agent.name}</h4>
          <p className="text-sm text-black font-dmsans-medium line-clamp-2">{agent.description}</p>
        </div>

        {/* Usage Cost */}
        <div className="mb-6 p-4 bg-background border-2 border-black rounded-[8px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-sm font-bricolage-bold text-black mb-3 uppercase tracking-wide">Usage Cost</div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-bricolage-bold text-black">Cost per use:</span>
            <span className="text-xl font-bricolage-bold text-main">{usageCostEth.toFixed(4)} MATIC</span>
          </div>
          <p className="text-xs text-black mt-2 font-dmsans-medium">
            This covers the inference costs for using the agent.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={onClose}
            className="flex-1 bg-background hover:bg-gray-100 text-black font-bricolage-bold py-3 px-4 rounded-[8px] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(agent)}
            disabled={loading}
            className="flex-1 bg-main hover:bg-main/80 text-main-foreground font-bricolage-bold py-3 px-4 rounded-[8px] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            {loading ? 'Processing...' : 'Use Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Buy Modal Component
interface BuyModalProps {
  agent: MarketplaceAgent;
  onConfirm: (agent: MarketplaceAgent) => void;
  onClose: () => void;
  loading: boolean;
}

function BuyModal({ agent, onConfirm, onClose, loading }: BuyModalProps) {
  const salePriceEth = agent.salePrice;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-6 border-4 border-black w-[420px] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] bg-white">
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-2xl font-bricolage-bold text-black mb-2">Buy Agent NFT</h3>
          <div className="h-1 w-16 bg-main rounded-full"></div>
        </div>
        
        {/* Agent Info */}
        <div className="mb-6 p-4 bg-gradient-to-r from-main/10 to-background border-2 border-black rounded-[8px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <h4 className="font-bricolage-bold text-black text-lg mb-2">{agent.name}</h4>
          <p className="text-sm text-black font-dmsans-medium line-clamp-2">{agent.description}</p>
        </div>

        {/* Sale Price */}
        <div className="mb-6 p-4 bg-background border-2 border-black rounded-[8px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-sm font-bricolage-bold text-black mb-3 uppercase tracking-wide">Purchase Price</div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-bricolage-bold text-black">Sale price:</span>
            <span className="text-xl font-bricolage-bold text-main">{salePriceEth.toFixed(4)} MATIC</span>
          </div>
          <p className="text-xs text-black mt-2 font-dmsans-medium">
            This will transfer full ownership of the NFT to you.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={onClose}
            className="flex-1 bg-background hover:bg-gray-100 text-black font-bricolage-bold py-3 px-4 rounded-[8px] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(agent)}
            disabled={loading}
            className="flex-1 bg-main hover:bg-main/80 text-main-foreground font-bricolage-bold py-3 px-4 rounded-[8px] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            {loading ? 'Processing...' : 'Buy NFT'}
          </button>
        </div>
      </div>
    </div>
  );
}
