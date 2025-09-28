"use client";
import { useWallet } from '@/lib/wallet-context';
import { nftService, NFTAgent } from '@/lib/nftService';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowUpRight } from 'lucide-react';

export default function AppDashboard() {
  const { address } = useWallet();
  const [agentsForRent, setAgentsForRent] = useState<NFTAgent[]>([]);
  const [agentsForSale, setAgentsForSale] = useState<NFTAgent[]>([]);
  const [totalOwnedAgents, setTotalOwnedAgents] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Load user agents and NFT agents
  useEffect(() => {
    const loadAgents = async () => {
      if (!address) {
        setAgentsForRent([]);
        setAgentsForSale([]); setTotalOwnedAgents(0);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Load NFT agents from smart contract
        const isReady = await nftService.isReady();
        if (isReady) {
          const marketplaceAgents = await nftService.getAllMarketplaceAgents(address);
          console.log('🔍 Dashboard: Loaded marketplace agents:', marketplaceAgents.length);
          
          // Get all agents owned by the user first
          const ownedAgents = marketplaceAgents.filter(agent => agent.isOwner);
          console.log('🔍 Dashboard: Total owned agents:', ownedAgents.length);
          setTotalOwnedAgents(ownedAgents.length);
          
          // Filter to agents listed for sale by the user (owned by user and listed for sale)
          const agentsForSaleByUser = ownedAgents
            .filter(agent => agent.isForSale)
            .map(agent => ({
              tokenId: agent.tokenId,
              nftContract: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || '',
              metadata: agent.metadata,
              isOwner: agent.isOwner,
              rentalBalance: agent.rentalBalance,
              creator: agent.metadata.creator,
              toolConfig: {
                enableWebSearch: false,
                enableCodeExecution: false,
                enableBrowserAutomation: false,
                enableWolframAlpha: false,
                enableStreaming: false,
                responseFormat: 'text',
                temperature: 700, // 0.7 scaled by 1000
                maxTokens: 4096,
                topP: 1000, // 1.0 scaled by 1000
                frequencyPenalty: 0,
                presencePenalty: 0,
              },
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
          
          console.log('🔍 Dashboard: Agents for sale by user:', agentsForSaleByUser.length);
          setAgentsForSale(agentsForSaleByUser);
          
          // Load agents listed for rent by the user (owned by user and marked for rent)
          const agentsForRentByUser = ownedAgents
            .filter(agent => agent.metadata.isForRent)
            .map(agent => ({
              tokenId: agent.tokenId,
              nftContract: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || '',
              metadata: agent.metadata,
              isOwner: agent.isOwner,
              rentalBalance: agent.rentalBalance,
              creator: agent.metadata.creator,
              toolConfig: {
                enableWebSearch: false,
                enableCodeExecution: false,
                enableBrowserAutomation: false,
                enableWolframAlpha: false,
                enableStreaming: false,
                responseFormat: 'text',
                temperature: 700, // 0.7 scaled by 1000
                maxTokens: 4096,
                topP: 1000, // 1.0 scaled by 1000
                frequencyPenalty: 0,
                presencePenalty: 0,
              },
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
          
          console.log('🔍 Dashboard: Agents for rent by user:', agentsForRentByUser.length);
          setAgentsForRent(agentsForRentByUser);
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
    totalAgents: totalOwnedAgents,
    agentsForRent: agentsForRent.length,
    agentsForSale: agentsForSale.length,
  };

  return (
    <div className="mx-auto py-8">
      {/* Welcome Section */}

      {/* Debug Section - Remove this after fixing */}
      {/* <div className="mb-8 p-4 bg-yellow-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-[5px]">
        <NetworkDebug />
      </div> */}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        <div className="border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] p-6 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all bg-white">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-500 border-2 border-black rounded-[5px] flex items-center justify-center">
                <span className="text-white text-2xl font-black">🤖</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-lg font-bricolage-semibold text-black">Total Agents</p>
              <p className="text-3xl font-bricolage-bold text-black">
                {loading ? '...' : stats.totalAgents}
              </p>
            </div>
          </div>
        </div>

        <div className="border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] p-6 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-green-500 border-2 border-black rounded-[5px] flex items-center justify-center">
                <span className="text-white text-2xl font-black">🏠</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-lg font-bricolage-semibold text-black">Listed for Rent</p>
              <p className="text-3xl font-bricolage-bold text-black">
                {loading ? '...' : stats.agentsForRent}
              </p>
            </div>
          </div>
        </div>

        <div className="border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] p-6 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-purple-500 border-2 border-black rounded-[5px] flex items-center justify-center">
                <span className="text-white text-2xl font-black">💰</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-lg font-bricolage-semibold text-black">Listed for Sale</p>
              <p className="text-3xl font-bricolage-bold text-black">
                {loading ? '...' : stats.agentsForSale}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Main Actions and Recent Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-1 flex flex-col space-y-4 h-full">
          <div className="border-4 bg-white border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] p-6 flex-1 flex flex-col justify-center">
            <h3 className="text-lg font-dmsans-bold text-black mb-4 text-start">Create your own Agent</h3>
              <Button asChild className="w-full h-16 text-xl font-bricolage-bold">
                <Link href="/app/create" className="flex items-center justify-between w-full">
                  <span>Create Agent</span>
                  <ArrowUpRight className="w-8 h-8" />
                </Link>
              </Button>
          </div>
          
          <div className="border-4 bg-white border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] p-6 flex-1 flex flex-col justify-center">
            <h3 className="text-lg font-dmsans-bold text-black mb-4 text-start">Chat with your Agents</h3>
            <Button asChild className="w-full h-16 text-xl font-bricolage-bold">
              <Link href="/app/chat" className="flex items-center justify-between w-full">
                <span>Chat with Agents</span>
                <ArrowUpRight className="w-8 h-8" />
              </Link>
            </Button>
          </div>
          
          <div className="border-4 bg-white border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] p-6 flex-1 flex flex-col justify-center">
            <h3 className="text-lg font-dmsans-bold text-black mb-4 text-start">Marketplace</h3>
            <Button asChild className="w-full h-16 text-xl font-bricolage-bold">
              <Link href="/app/marketplace" className="flex items-center justify-between w-full">
                <span>Browse Marketplace</span>
                <ArrowUpRight className="w-8 h-8" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] p-8 lg:col-span-2">
          <h3 className="text-2xl font-bricolage-bold text-black mb-6">Recent Agents</h3>
          {loading ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-black font-bricolage-bold">Loading agents...</p>
            </div>
          ) : (totalOwnedAgents === 0) ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-6">🤖</div>
              <p className="text-black font-bricolage-bold mb-4">No agents created yet</p>
              <Button asChild variant="outline" className="font-bricolage-bold">
                <Link href="/app/create">
                  Create your first agent →
                </Link>
              </Button>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-4 scrollbar-hide p-2">
              {/* Show agents for rent */}
              {agentsForRent.slice(0, 3).map((agent, index) => (
                <div key={`rent-${agent.tokenId}-${index}`} className="p-4 border-2 border-black bg-background rounded-[5px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all min-h-[120px] flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-bricolage-bold text-black text-base mb-2">{agent.name}</h4>
                      <p className="text-xs text-black font-dmsans-medium min-h-[32px] line-clamp-2">
                        {agent.description || 'No description available'}
                      </p>
                    </div>
                    <Button asChild size="sm" className="ml-4 flex-shrink-0 font-bricolage-bold">
                      <Link href="/app/chat" className="flex items-center gap-1">
                        Chat
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mt-auto flex-wrap">
                    <span className="text-xs bg-main text-main-foreground px-3 py-1 rounded-[3px] font-bricolage-bold border border-black">
                      {agent.model}
                    </span>
                    <span className="text-xs bg-green-500 text-white px-3 py-1 rounded-[3px] font-bricolage-bold border border-black">
                      For Rent
                    </span>
                  </div>
                </div>
              ))}
              
              {/* Show agents for sale */}
              {agentsForSale.slice(0, Math.max(0, 3 - agentsForRent.length)).map((agent, index) => (
                <div key={`sale-${agent.tokenId}-${index}`} className="p-4 border-2 border-black bg-background rounded-[5px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all min-h-[120px] flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-bricolage-bold text-black text-base mb-2">{agent.name}</h4>
                      <p className="text-xs text-black font-dmsans-medium min-h-[32px] line-clamp-2">
                        {agent.description || 'No description available'}
                      </p>
                    </div>
                    <Button asChild size="sm" className="ml-4 flex-shrink-0 font-bricolage-bold">
                      <Link href="/app/chat" className="flex items-center gap-1">
                        Chat
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mt-auto flex-wrap">
                    <span className="text-xs bg-main text-main-foreground px-3 py-1 rounded-[3px] font-bricolage-bold border border-black">
                      {agent.model}
                    </span>
                    <span className="text-xs bg-purple-500 text-white px-3 py-1 rounded-[3px] font-bricolage-bold border border-black">
                      For Sale
                    </span>
                  </div>
                </div>
              ))}
              
              {totalOwnedAgents > 3 && (
                <Button asChild variant="outline" className="w-full bg-main font-bricolage-bold">
                  <Link href="/app/chat">
                    View all {totalOwnedAgents} agents →
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
