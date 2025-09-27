"use client";
import { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@/lib/wallet-context';
import { nftService, NFTAgent, AgentMetadata } from '@/lib/nftService';
import { agentStorageService, StoredAgent } from '@/lib/agentStorageService';
import { ethers } from 'ethers';

interface AgentMarketplaceProps {
  agents: StoredAgent[];
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

export function AgentMarketplace({ agents, nftAgents = [] }: AgentMarketplaceProps) {
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
    let filtered = marketplaceAgents.filter(agent => {
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
      const inferenceCost = BigInt(agent.usageCost) * BigInt(rentalUses);
      const totalCost = rentalCost + inferenceCost;
      
      console.log('🔄 Attempting to rent agent:', {
        tokenId: agent.tokenId,
        uses: rentalUses,
        rentalCost: rentalCost.toString(),
        inferenceCost: inferenceCost.toString(),
        totalCost: totalCost.toString(),
        rentPricePerUse: agent.rentPricePerUse.toString(),
        usageCost: agent.usageCost.toString()
      });
      
      // Check if nftService is ready
      const isReady = await nftService.isReady();
      if (!isReady) {
        throw new Error('NFT service not ready. Please check your wallet connection.');
      }
      
      console.log('✅ NFT service is ready, proceeding with rental...');
      
      // Pay both rental and inference costs upfront
      await nftService.rentAgentWithInference(agent.tokenId, rentalUses, agent.rentPricePerUse, agent.usageCost, totalCost);
      
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
      const inferenceCostEth = parseFloat(ethers.formatEther(inferenceCost));
      const totalCostEth = rentalCostEth + inferenceCostEth;
      alert(`🎉 Successfully rented ${agent.name} for ${rentalUses} uses!\n\n✅ All costs prepaid:\n- Rental cost: ${rentalCostEth.toFixed(4)} MATIC\n- Inference cost: ${inferenceCostEth.toFixed(4)} MATIC\n- Total paid: ${totalCostEth.toFixed(4)} MATIC\n\n🚀 You can now use it continuously without any MetaMask prompts!`);
      
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Wallet Required</h2>
          <p className="text-gray-600 mb-6">
            Please connect your wallet to access the AI Agent Marketplace.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading marketplace agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Agent Marketplace</h1>
        <p className="text-gray-600">
          Discover, rent, and use AI agents created by the community
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Agents
            </label>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, description, or model..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter Type */}
          <div>
            <label htmlFor="filter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter Type
            </label>
            <select
              id="filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label htmlFor="sort" className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">Name</option>
              <option value="price">Price</option>
              <option value="created">Created Date</option>
              <option value="usage">Usage Cost</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <label htmlFor="order" className="block text-sm font-medium text-gray-700 mb-2">
              Order
            </label>
            <select
              id="order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="text-4xl mb-4">🤖</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No Agents Available</h2>
          <p className="text-gray-600 mb-6">
            The marketplace is currently empty. Agents will appear here once they are minted as NFTs.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 max-w-md mx-auto">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-blue-400">💡</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Getting Started</h3>
                <div className="mt-2 text-sm text-blue-700">
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
  const usageCostEth = parseFloat(ethers.formatEther(agent.usageCost));
  const rentPriceEth = parseFloat(ethers.formatEther(agent.rentPricePerUse));

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{agent.name}</h3>
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{agent.description}</p>
          </div>
          {agent.isOwner && (
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
              Owner
            </span>
          )}
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Model:</span>
            <span className="font-medium">{agent.model}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Inference Cost:</span>
            <span className="font-medium">{usageCostEth.toFixed(4)} MATIC/use</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Max Uses/Day:</span>
            <span className="font-medium">{agent.maxUsagesPerDay}</span>
          </div>
          {agent.isForRent && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Rent Price:</span>
              <span className="font-medium">{rentPriceEth.toFixed(4)} MATIC/use</span>
            </div>
          )}
          {agent.isForRent && (
            <div className="flex justify-between text-sm text-blue-600">
              <span className="font-medium">Total per use:</span>
              <span className="font-medium">{(usageCostEth + rentPriceEth).toFixed(4)} MATIC</span>
            </div>
          )}
          {!agent.isForRent && !agent.isOwner && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status:</span>
              <span className="font-medium text-orange-600">Not for rent</span>
            </div>
          )}
          {agent.rentalBalance > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Rental Balance:</span>
              <span className="font-medium text-green-600">{agent.rentalBalance} uses</span>
            </div>
          )}
          {agent.prepaidInferenceBalance > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Prepaid Inference:</span>
              <span className="font-medium text-blue-600">{agent.prepaidInferenceBalance} uses</span>
            </div>
          )}
          
          {/* Tool capabilities */}
          <div className="mt-3">
            <div className="text-xs text-gray-500 mb-2">Capabilities:</div>
            <div className="flex flex-wrap gap-1">
              {agent.enableWebSearch && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">🌐 Web Search</span>
              )}
              {agent.enableCodeExecution && (
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">💻 Code Exec</span>
              )}
              {agent.enableBrowserAutomation && (
                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">🤖 Browser</span>
              )}
              {agent.enableWolframAlpha && (
                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">🧮 Wolfram</span>
              )}
              {agent.enableStreaming && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">⚡ Streaming</span>
              )}
              {agent.responseFormat === 'json_object' && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">📄 JSON</span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {/* Primary actions */}
          <div className="flex space-x-2">
            {agent.canUse && (
              <button
                onClick={onUse}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
              >
                Use Agent
              </button>
            )}
            {agent.isForSale && !agent.isOwner && (
              <button
                onClick={onBuy}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
              >
                Buy NFT
              </button>
            )}
            {agent.isForRent && !agent.isOwner && (
              <button
                onClick={onRent}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
              >
                Rent Agent
              </button>
            )}
            {!agent.isOwner && !agent.canUse && !agent.isForRent && !agent.isForSale && (
              <div className="flex-1 text-center py-2 px-4 text-sm text-gray-500 bg-gray-100 rounded-md">
                Not Available
              </div>
            )}
          </div>
          
          {/* Secondary actions for owners */}
          {agent.isOwner && (
            <div className="text-xs text-gray-500 text-center">
              {agent.isForSale && agent.isForRent && "Listed for both sale and rental"}
              {agent.isForSale && !agent.isForRent && "Listed for sale only"}
              {!agent.isForSale && agent.isForRent && "Listed for rental only"}
              {!agent.isForSale && !agent.isForRent && "Not listed"}
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
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Rent Agent</h3>
          
          <div className="mb-4">
            <h4 className="font-medium text-gray-900 mb-2">{agent.name}</h4>
            <p className="text-sm text-gray-600">{agent.description}</p>
          </div>

          <div className="mb-4">
            <label htmlFor="uses" className="block text-sm font-medium text-gray-700 mb-2">
              Number of Uses
            </label>
            <input
              type="number"
              id="uses"
              min="1"
              max="1000"
              value={uses}
              onChange={(e) => onUsesChange(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-6 p-3 bg-gray-50 rounded-md">
            <div className="flex justify-between text-sm mb-1">
              <span>Rent price per use:</span>
              <span>{rentPriceEth.toFixed(4)} MATIC</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span>Inference cost per use:</span>
              <span>{parseFloat(ethers.formatEther(agent.usageCost)).toFixed(4)} MATIC</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span>Number of uses:</span>
              <span>{uses}</span>
            </div>
            <div className="border-t pt-2 mt-2">
            <div className="flex justify-between text-sm mb-1">
              <span>Rental cost ({uses} × {rentPriceEth.toFixed(4)} MATIC):</span>
              <span>{(rentPriceEth * uses).toFixed(4)} MATIC</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span>Inference cost ({uses} × {parseFloat(ethers.formatEther(agent.usageCost)).toFixed(4)} MATIC):</span>
              <span>{(parseFloat(ethers.formatEther(agent.usageCost)) * uses).toFixed(4)} MATIC</span>
            </div>
            <div className="flex justify-between font-medium text-lg text-blue-600">
              <span>Total upfront payment:</span>
              <span>{totalCost.toFixed(4)} MATIC</span>
            </div>
              <div className="text-xs text-green-600 mt-2 font-medium">
                <strong>✅ All costs prepaid!</strong> No additional MetaMask prompts when using the agent.
              </div>
            </div>
          </div>

          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-sm text-blue-700">
              <strong>💡 Before confirming:</strong>
              <ul className="mt-1 ml-4 list-disc">
                <li>Ensure MetaMask is unlocked</li>
                <li>Check you're on Polygon Amoy testnet (Chain ID: 80002)</li>
                <li>Approve the transaction when prompted</li>
              </ul>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(agent)}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm Rental'}
            </button>
          </div>
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
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Use Agent</h3>
          
          <div className="mb-4">
            <h4 className="font-medium text-gray-900 mb-2">{agent.name}</h4>
            <p className="text-sm text-gray-600">{agent.description}</p>
          </div>

          <div className="mb-6 p-3 bg-gray-50 rounded-md">
            <div className="flex justify-between font-medium">
              <span>Usage cost:</span>
              <span>{usageCostEth.toFixed(4)} MATIC</span>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              This covers the inference costs for using the agent.
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(agent)}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Use Agent'}
            </button>
          </div>
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
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Buy Agent NFT</h3>
          
          <div className="mb-4">
            <h4 className="font-medium text-gray-900 mb-2">{agent.name}</h4>
            <p className="text-sm text-gray-600">{agent.description}</p>
          </div>

          <div className="mb-6 p-3 bg-gray-50 rounded-md">
            <div className="flex justify-between font-medium">
              <span>Sale price:</span>
              <span>{salePriceEth.toFixed(4)} MATIC</span>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              This will transfer full ownership of the NFT to you.
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(agent)}
              disabled={loading}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Buy NFT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
