"use client";
import { useWallet } from '@/lib/wallet-context';
import { agentStorageService, StoredAgent } from '@/lib/agentStorageService';
import { nftService, NFTAgent } from '@/lib/nftService';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import NetworkDebug from '@/components/NetworkDebug';

export default function AppDashboard() {
  const { address, isVerified } = useWallet();
  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [nftAgents, setNftAgents] = useState<NFTAgent[]>([]);
  const [loading, setLoading] = useState(true);

  // Load user agents and NFT agents
  useEffect(() => {
    const loadAgents = async () => {
      if (!address) {
        setAgents([]);
        setNftAgents([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Load regular agents from Lighthouse
        const userAgents = await agentStorageService.getUserAgents(address);
        setAgents(userAgents);
        
        // Load NFT agents from smart contract
        const isReady = await nftService.isReady();
        if (isReady) {
          const marketplaceAgents = await nftService.getAllMarketplaceAgents(address);
          console.log('🔍 Dashboard: Loaded marketplace agents:', marketplaceAgents.length);
          
          // Filter to only agents owned by the user
          const ownedNFTAgents = marketplaceAgents
            .filter(agent => agent.isOwner)
            .map(agent => ({
              tokenId: agent.tokenId,
              nftContract: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || '',
              metadata: agent.metadata,
              isOwner: agent.isOwner,
              rentalBalance: agent.rentalBalance,
              creator: agent.metadata.creator,
              // Convert to NFTAgent format
              id: `nft-${agent.tokenId}`,
              name: agent.metadata.name,
              description: agent.metadata.description,
              systemPrompt: '', // Will be loaded from IPFS if needed
              model: agent.metadata.model,
              temperature: 0.7,
              maxTokens: 4096,
              topP: 1.0,
              frequencyPenalty: 0,
              presencePenalty: 0,
              enabledTools: [],
              responseFormat: 'text' as const,
              enableStreaming: false,
              enableWebSearch: false,
              enableCodeExecution: false,
              enableBrowserAutomation: false,
              enableWolframAlpha: false,
              customInstructions: [],
              exampleConversations: [],
              guardrails: [],
              isNFT: true,
              ownerAddress: agent.owner,
              usageCost: parseFloat(nftService.weiToEth(agent.metadata.usageCost)),
              maxUsagesPerDay: agent.metadata.maxUsagesPerDay,
              isForRent: agent.metadata.isForRent,
              rentPricePerUse: parseFloat(nftService.weiToEth(agent.metadata.rentPricePerUse)),
            }));
          
          console.log('🔍 Dashboard: Owned NFT agents:', ownedNFTAgents.length);
          setNftAgents(ownedNFTAgents);
        }
      } catch (error) {
        console.error('Failed to load agents:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAgents();
  }, [address]);

  const stats = {
    totalAgents: agents.length + nftAgents.length,
    publicAgents: agents.filter(a => a.isPublic).length,
    nftAgents: nftAgents.length,
    regularAgents: agents.length,
    totalEarnings: agents.reduce((sum, agent) => sum + (agent.totalEarnings || 0), 0),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Veritas AI Platform</h1>
        <p className="text-gray-600">
          {isVerified 
            ? `Create, deploy, and monetize custom AI agents on Polygon Amoy testnet with wallet ${address?.slice(0, 6)}...${address?.slice(-4)}`
            : 'Connect your wallet to start creating AI agents on Polygon Amoy testnet'
          }
        </p>
      </div>

      {/* Debug Section - Remove this after fixing */}
      <div className="mb-8">
        <NetworkDebug />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-lg">🤖</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Agents</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? '...' : stats.totalAgents}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600 text-lg">🌐</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Public Agents</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? '...' : stats.publicAgents}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 text-lg">🎫</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">INFT Agents</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? '...' : stats.nftAgents}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-yellow-600 text-lg">💰</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Earnings</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${loading ? '...' : stats.totalEarnings.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🚀 Quick Actions</h3>
          <div className="space-y-3">
            <Link
              href="/app/create"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-3 px-4 rounded-lg font-medium transition-colors"
            >
              Create New Agent
            </Link>
            <Link
              href="/app/chat"
              className="block w-full bg-green-600 hover:bg-green-700 text-white text-center py-3 px-4 rounded-lg font-medium transition-colors"
            >
              Chat with Agents
            </Link>
            <Link
              href="/app/marketplace"
              className="block w-full bg-purple-600 hover:bg-purple-700 text-white text-center py-3 px-4 rounded-lg font-medium transition-colors"
            >
              Browse Marketplace
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Recent Agents</h3>
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading agents...</p>
            </div>
          ) : (agents.length === 0 && nftAgents.length === 0) ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🤖</div>
              <p className="text-gray-500">No agents created yet</p>
              <Link
                href="/app/create"
                className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
              >
                Create your first agent →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Show regular agents */}
              {agents.slice(0, 3).map((agent, index) => (
                <div key={`${agent.id}-${index}`} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-sm">{agent.name}</h4>
                      <p className="text-xs text-gray-600 mt-1">{agent.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {agent.model}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                          Regular
                        </span>
                      </div>
                    </div>
                    <Link
                      href="/app/chat"
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Chat →
                    </Link>
                  </div>
                </div>
              ))}
              
              {/* Show NFT agents */}
              {nftAgents.slice(0, 3 - agents.length).map((agent, index) => (
                <div key={`nft-${agent.tokenId}-${index}`} className="p-3 border border-purple-200 rounded-lg bg-purple-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-sm">{agent.name}</h4>
                      <p className="text-xs text-gray-600 mt-1">{agent.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {agent.model}
                        </span>
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                          NFT #{agent.tokenId}
                        </span>
                        {agent.metadata.isForRent && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            For Rent
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      href="/app/chat"
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Chat →
                    </Link>
                  </div>
                </div>
              ))}
              
              {(agents.length + nftAgents.length) > 3 && (
                <Link
                  href="/app/chat"
                  className="block text-center text-sm text-blue-600 hover:text-blue-800 py-2"
                >
                  View all {agents.length + nftAgents.length} agents →
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Getting Started</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-2">
              <span className="text-blue-600 font-bold">1.</span>
              <span>Connect your wallet and switch to Polygon Amoy testnet</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-600 font-bold">2.</span>
              <span>Create your first AI agent with custom capabilities</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-600 font-bold">3.</span>
              <span>Test your agent in the chat interface</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-600 font-bold">4.</span>
              <span>Mint as NFT and list on the marketplace to earn</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">🌟 Platform Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <span className="text-blue-600 text-xl">🤖</span>
            </div>
            <h4 className="font-medium text-gray-900 mb-2">AI Agent Creation</h4>
            <p className="text-sm text-gray-600">Build custom AI agents with advanced capabilities and tools</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <span className="text-green-600 text-xl">💬</span>
            </div>
            <h4 className="font-medium text-gray-900 mb-2">Real-time Chat</h4>
            <p className="text-sm text-gray-600">Interact with your agents through an intuitive chat interface</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <span className="text-purple-600 text-xl">🎫</span>
            </div>
            <h4 className="font-medium text-gray-900 mb-2">INFT Marketplace</h4>
            <p className="text-sm text-gray-600">Buy, sell, and trade AI agents as blockchain assets on Polygon Amoy testnet</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <span className="text-yellow-600 text-xl">🔐</span>
            </div>
            <h4 className="font-medium text-gray-900 mb-2">Wallet Verification</h4>
            <p className="text-sm text-gray-600">Secure identity verification using blockchain technology</p>
          </div>
        </div>
      </div>
    </div>
  );
}

