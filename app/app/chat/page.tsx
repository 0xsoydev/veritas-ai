"use client";
import { useState, useEffect, useMemo } from 'react';
import { AgentExecutor } from '@/components/AgentExecutor';
import { GroqClient } from '@/lib/groqClient';
import { useWallet } from '@/lib/wallet-context';
import { agentStorageService, StoredAgent } from '@/lib/agentStorageService';
import { nftService, NFTAgent } from '@/lib/nftService';

export default function ChatPage() {
  const { address } = useWallet();
  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [nftAgents, setNftAgents] = useState<NFTAgent[]>([]);
  const [loading, setLoading] = useState(true);

  // Memoize groqClient to prevent unnecessary re-renders
  const groqClient = useMemo(() => new GroqClient(), []);

  // Load user agents and rented NFT agents when address changes
  useEffect(() => {
    const loadUserAgents = async () => {
      if (!address) {
        setAgents([]);
        setNftAgents([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Load user-created agents
        const userAgents = await agentStorageService.getUserAgents(address);
        setAgents(userAgents);
        
        // Load rented NFT agents
        const isReady = await nftService.isReady();
        if (isReady) {
          const marketplaceAgents = await nftService.getAllMarketplaceAgents(address);
          console.log('🔍 Loaded marketplace agents:', marketplaceAgents.length);
          console.log('🔍 Agent details:', marketplaceAgents.map(a => ({
            tokenId: a.tokenId,
            name: a.metadata.name,
            isOwner: a.isOwner,
            canUse: a.canUse,
            owner: a.owner,
            userAddress: address
          })));
          
          // Filter to only agents the user can use (owned or rented)
          const usableNFTAgents = marketplaceAgents
            .filter(agent => agent.canUse)
            .map(agent => ({
              tokenId: agent.tokenId,
              nftContract: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || '',
              metadata: agent.metadata,
              toolConfig: agent.toolConfig, // Include toolConfig from marketplace
              isOwner: agent.isOwner,
              rentalBalance: agent.rentalBalance,
              creator: agent.metadata.creator,
              // Convert to NFTAgent format
              id: `nft-${agent.tokenId}`,
              name: agent.metadata.name,
              description: agent.metadata.description,
              systemPrompt: '', // Will be loaded from IPFS
              model: agent.metadata.model,
              temperature: agent.toolConfig.temperature,
              maxTokens: agent.toolConfig.maxTokens,
              topP: agent.toolConfig.topP,
              frequencyPenalty: agent.toolConfig.frequencyPenalty,
              presencePenalty: agent.toolConfig.presencePenalty,
              enabledTools: [],
              responseFormat: agent.toolConfig.responseFormat as 'text' | 'json_object',
              enableStreaming: agent.toolConfig.enableStreaming,
              enableWebSearch: agent.toolConfig.enableWebSearch,
              enableCodeExecution: agent.toolConfig.enableCodeExecution,
              enableBrowserAutomation: agent.toolConfig.enableBrowserAutomation,
              enableWolframAlpha: agent.toolConfig.enableWolframAlpha,
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
          
          console.log('🔍 Filtered usable NFT agents:', usableNFTAgents.length);
          console.log('🔍 Usable agents details:', usableNFTAgents.map(a => ({
            tokenId: a.tokenId,
            name: a.name,
            isOwner: a.isOwner
          })));
          
          setNftAgents(usableNFTAgents);
        }
      } catch (error) {
        console.error('Failed to load user agents:', error);
        setAgents([]);
        setNftAgents([]);
      } finally {
        setLoading(false);
      }
    };

    loadUserAgents();
  }, [address]);

  // Refresh agents when page becomes visible (user returns from marketplace)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && address) {
        // Page became visible, refresh agents
        const loadUserAgents = async () => {
          try {
            const isReady = await nftService.isReady();
            if (isReady) {
              const marketplaceAgents = await nftService.getAllMarketplaceAgents(address);
              
              const usableNFTAgents = marketplaceAgents
                .filter(agent => agent.canUse)
                .map(agent => ({
                  tokenId: agent.tokenId,
                  nftContract: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || '',
                  metadata: agent.metadata,
                  toolConfig: agent.toolConfig, // Include toolConfig from marketplace
                  isOwner: agent.isOwner,
                  rentalBalance: agent.rentalBalance,
                  creator: agent.metadata.creator,
                  id: `nft-${agent.tokenId}`,
                  name: agent.metadata.name,
                  description: agent.metadata.description,
                  systemPrompt: '',
                  model: agent.metadata.model,
                  temperature: agent.toolConfig.temperature,
                  maxTokens: agent.toolConfig.maxTokens,
                  topP: agent.toolConfig.topP,
                  frequencyPenalty: agent.toolConfig.frequencyPenalty,
                  presencePenalty: agent.toolConfig.presencePenalty,
                  enabledTools: [],
                  responseFormat: agent.toolConfig.responseFormat as 'text' | 'json_object',
                  enableStreaming: agent.toolConfig.enableStreaming,
                  enableWebSearch: agent.toolConfig.enableWebSearch,
                  enableCodeExecution: agent.toolConfig.enableCodeExecution,
                  enableBrowserAutomation: agent.toolConfig.enableBrowserAutomation,
                  enableWolframAlpha: agent.toolConfig.enableWolframAlpha,
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
              
              setNftAgents(usableNFTAgents);
            }
          } catch (error) {
            console.error('Failed to refresh agents:', error);
          }
        };

        loadUserAgents();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [address]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your agents...</p>
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Wallet Required</h2>
          <p className="text-gray-600 mb-6">
            Please connect your wallet to chat with your AI agents.
          </p>
        </div>
      </div>
    );
  }

  if (agents.length === 0 && nftAgents.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🤖</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No Agents Available</h2>
          <p className="text-gray-600 mb-6">
            You haven't created any agents or rented any NFT agents yet. Create your first AI agent or rent one from the marketplace!
          </p>
          <div className="flex space-x-4 justify-center">
            <a
              href="/app/create"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-medium transition-colors"
            >
              Create Agent
            </a>
            <a
              href="/app/marketplace"
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-lg font-medium transition-colors"
            >
              Browse Marketplace
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <AgentExecutor agents={agents} nftAgents={nftAgents} groqClient={groqClient} onRentalUsesUpdated={() => {
    // Refresh NFT agents when rental uses are updated
    const refreshNFTAgents = async () => {
      if (!address) return;
      
      try {
        const isReady = await nftService.isReady();
        if (isReady) {
          const marketplaceAgents = await nftService.getAllMarketplaceAgents(address);
          
          const usableNFTAgents = marketplaceAgents
            .filter(agent => agent.canUse)
            .map(agent => ({
              tokenId: agent.tokenId,
              nftContract: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || '',
              metadata: agent.metadata,
              toolConfig: agent.toolConfig, // Include toolConfig from marketplace
              isOwner: agent.isOwner,
              rentalBalance: agent.rentalBalance,
              creator: agent.metadata.creator,
              id: `nft-${agent.tokenId}`,
              name: agent.metadata.name,
              description: agent.metadata.description,
              systemPrompt: '',
              model: agent.metadata.model,
              temperature: agent.toolConfig.temperature,
              maxTokens: agent.toolConfig.maxTokens,
              topP: agent.toolConfig.topP,
              frequencyPenalty: agent.toolConfig.frequencyPenalty,
              presencePenalty: agent.toolConfig.presencePenalty,
              enabledTools: [],
              responseFormat: agent.toolConfig.responseFormat as 'text' | 'json_object',
              enableStreaming: agent.toolConfig.enableStreaming,
              enableWebSearch: agent.toolConfig.enableWebSearch,
              enableCodeExecution: agent.toolConfig.enableCodeExecution,
              enableBrowserAutomation: agent.toolConfig.enableBrowserAutomation,
              enableWolframAlpha: agent.toolConfig.enableWolframAlpha,
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
          
          setNftAgents(usableNFTAgents);
        }
      } catch (error) {
        console.error('Failed to refresh NFT agents:', error);
      }
    };
    
    refreshNFTAgents();
  }} />;
}
