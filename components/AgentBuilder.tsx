"use client"
import { useState, useEffect, useMemo, useRef } from 'react';
import { AgentConfig } from '@/lib/groqService';
import { GroqClient } from '@/lib/groqClient';
import { useWallet } from '@/lib/wallet-context';
import { agentStorageService } from '@/lib/agentStorageService';
import { nftService, NFTAgent } from '@/lib/nftService';

interface AgentBuilderProps {
  initialAgents?: AgentConfig[];
}

export function AgentBuilder({ }: AgentBuilderProps) {
  const { address } = useWallet();
  // const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [nftAgents, setNftAgents] = useState<NFTAgent[]>([]);
  // const [, setSelectedAgent] = useState<StoredAgent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingAgents, setLoadingAgents] = useState(false); // Start as false, only true when actively loading
  const [nftContractAddress, setNftContractAddress] = useState<string>('');

  // Memoize groqClient to prevent unnecessary re-renders
  const groqClient = useMemo(() => new GroqClient(), []);
  
  // Track if models have been loaded to prevent duplicate calls
  const modelsLoadedRef = useRef(false);
  
  // Track if agents have been loaded to prevent duplicate calls
  const agentsLoadedRef = useRef(false);
  const lastAddressRef = useRef<string | undefined>(undefined);
  
  // Memoize the initial agents transformation to prevent unnecessary re-renders
  // const transformedInitialAgents = useMemo(() => 
  //   initialAgents.map(agent => ({
  //     ...agent,
  //     ownerAddress: '',
  //     createdAt: Date.now(),
  //     updatedAt: Date.now(),
  //     isPublic: false,
  //     salesCount: 0,
  //     totalEarnings: 0,
  //   })), [initialAgents]
  // );

  // Agent creation form state
  const [formData, setFormData] = useState<Partial<AgentConfig>>({
    name: '',
    description: '',
    systemPrompt: 'You are a helpful AI assistant.',
    model: '', // Will be set when models load
    // Hardcoded safe defaults - not user editable
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    enabledTools: [],
    responseFormat: 'text',
    enableStreaming: true, // Streaming enabled by default
    enableWebSearch: false,
    enableCodeExecution: false,
    enableBrowserAutomation: false,
    enableWolframAlpha: false,
    customInstructions: [],
    exampleConversations: [],
    guardrails: [],
    isNFT: true, // Default to NFT minting
    usageCost: 0.01,
    maxUsagesPerDay: 1000,
    isForRent: true, // Rental enabled by default
    rentPricePerUse: 0.005,
    sellingPrice: 1.0, // New field for selling price
  });

  const [errors, setErrors] = useState<string[]>([]);

  // Function to refresh NFT agents from smart contract
  const refreshNFTAgents = async () => {
    if (!address || !nftService.isReady()) return;
    
    try {
      const marketplaceAgents = await nftService.getAllMarketplaceAgents(address);
      console.log('🔄 AgentBuilder: Refreshing NFT agents:', marketplaceAgents.length);
      
      // Filter to only agents owned by the user
      const ownedNFTAgents = marketplaceAgents
        .filter(agent => agent.isOwner)
        .map(agent => ({
          tokenId: agent.tokenId,
          nftContract: nftContractAddress,
          metadata: agent.metadata,
          toolConfig: agent.toolConfig,
          isOwner: agent.isOwner,
          rentalBalance: agent.rentalBalance,
          creator: agent.metadata.creator,
          // Convert to NFTAgent format
          id: `nft-${agent.tokenId}`,
          name: agent.metadata.name,
          description: agent.metadata.description,
          systemPrompt: '', // Will be loaded from IPFS if needed
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
      
      console.log('🔄 AgentBuilder: Refreshed owned NFT agents:', ownedNFTAgents.length);
      setNftAgents(ownedNFTAgents);
    } catch (error) {
      console.error('Failed to refresh NFT agents:', error);
    }
  };

  // Initialize NFT contract
  useEffect(() => {
    const initNFTContract = async () => {
      // In production, this would come from environment variables
      const contractAddress = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || '';
      if (contractAddress) {
        setNftContractAddress(contractAddress);
        await nftService.initializeContract(contractAddress);
      }
    };

    initNFTContract();
  }, []);

  // Load available models on component mount (only once)
  useEffect(() => {
    const loadModels = async () => {
      // Skip if models are already loaded
      if (modelsLoadedRef.current) {
        return;
      }
      
      try {
        setLoadingModels(true);
        modelsLoadedRef.current = true;
        
        // Load models
        const allModels = await groqClient.getAvailableModels();
        
        // STRICT filtering - ONLY these 6 models allowed
        const exactModelsOnly = [
          'openai/gpt-oss-120b',
          'openai/gpt-oss-20b',
          'groq/compound',
          'groq/compound-mini',
          'llama-3.3-70b-versatile',
          'llama-3.1-8b-instant'
        ];
        
        // Only keep models that are EXACTLY in our list
        const supportedModels = exactModelsOnly.filter(modelName => 
          allModels.includes(modelName)
        );
        
        // Sort models in preferred order
        const modelOrder = [
          'openai/gpt-oss-120b',      // Best overall
          'openai/gpt-oss-20b',       // Good GPT OSS alternative
          'groq/compound',            // Full compound features
          'groq/compound-mini',       // Lighter compound
          'llama-3.3-70b-versatile',  // High quality Llama
          'llama-3.1-8b-instant'      // Fast Llama
        ];
        
        const sortedModels = supportedModels.sort((a, b) => {
          const indexA = modelOrder.indexOf(a);
          const indexB = modelOrder.indexOf(b);
          return indexA - indexB;
        });
        
        setAvailableModels(sortedModels);
        
        // Set default model (first in sorted order is best)
        if (sortedModels.length > 0) {
          const defaultModel = sortedModels[0]; // Already sorted by preference
          setFormData(prev => ({ ...prev, model: prev.model || defaultModel }));
        }
      } catch (error) {
        console.error('Failed to load models:', error);
        setErrors(['Failed to load models. Please refresh the page.']);
      } finally {
        setLoadingModels(false);
      }
    };

    loadModels();
  }, [groqClient]); // Include groqClient but it's memoized so won't cause re-renders

  // Load user agents when address changes
  useEffect(() => {
    const loadUserAgents = async () => {
      // Reset loaded flag if address changed
      if (lastAddressRef.current !== address) {
        agentsLoadedRef.current = false;
      }
      
      // Skip if we've already loaded agents for this address
      if (agentsLoadedRef.current && lastAddressRef.current === address) {
        return;
      }
      
      // Only show loading if we have an address and are actually loading from storage
      if (address) {
        setLoadingAgents(true);
        agentsLoadedRef.current = true;
        lastAddressRef.current = address;
      }
      
      try {
        if (address) {
          // Load NFT agents from smart contract
          const isReady = await nftService.isReady();
          if (isReady) {
            const marketplaceAgents = await nftService.getAllMarketplaceAgents(address);
            console.log('🔍 AgentBuilder: Loaded marketplace agents:', marketplaceAgents.length);
            
            // Filter to only agents owned by the user
            const ownedNFTAgents = marketplaceAgents
              .filter(agent => agent.isOwner)
              .map(agent => ({
                tokenId: agent.tokenId,
                nftContract: nftContractAddress,
                metadata: agent.metadata,
                toolConfig: agent.toolConfig,
                isOwner: agent.isOwner,
                rentalBalance: agent.rentalBalance,
                creator: agent.metadata.creator,
                // Convert to NFTAgent format
                id: `nft-${agent.tokenId}`,
                name: agent.metadata.name,
                description: agent.metadata.description,
                systemPrompt: '', // Will be loaded from IPFS if needed
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
            
            console.log('🔍 AgentBuilder: Owned NFT agents:', ownedNFTAgents.length);
            setNftAgents(ownedNFTAgents);
          }
        } else {
          // No wallet connected - no agents to show
          setNftAgents([]);
          agentsLoadedRef.current = true;
          lastAddressRef.current = address;
        }
      } catch (error) {
        console.error('Failed to load user agents:', error);
        setErrors(['Failed to load user agents. Please refresh the page.']);
      } finally {
        setLoadingAgents(false);
      }
    };

    loadUserAgents();
  }, [address, nftContractAddress]); // Include nftContractAddress

  const handleCreateAgent = async () => {
    setIsCreating(true);
    setErrors([]);

    try {
      // Validate configuration
      const validation = await groqClient.validateAgentConfig(formData);
      if (!validation.valid) {
        setErrors(validation.errors);
        return;
      }

      // Show warnings if any
      if ('warnings' in validation && validation.warnings && validation.warnings.length > 0) {
        const proceed = confirm(
          `⚠️ Warnings:\n\n${validation.warnings.join('\n\n')}\n\nDo you want to continue creating the agent anyway?`
        );
        if (!proceed) {
          return;
        }
      }

      // Create agent with wallet address
      const newAgent = await groqClient.createAgent(formData, address);
      
      // Handle NFT agent creation
      if (address) {
        try {
          // Ensure NFT service is ready
          const isReady = await nftService.isReady();
          if (!isReady) {
            throw new Error('NFT service not ready. Please check your wallet connection.');
          }

          // Store agent in Lighthouse storage first (needed for NFT metadata)
          const cid = await agentStorageService.storeAgent(newAgent, address);
          
          // Mint NFT - if this fails, the entire agent creation fails
          let tokenId: number;
          try {
            tokenId = await nftService.mintAgent(
              newAgent,
              cid,
              formData.isForRent || false,
              formData.rentPricePerUse || 0
            );
          } catch (mintError) {
            console.error('❌ NFT minting failed, cleaning up stored agent...');
            // TODO: Implement agent deletion from Lighthouse if needed
            // For now, we just throw the error and let the user retry
            throw new Error(`NFT minting failed: ${mintError instanceof Error ? mintError.message : 'Unknown error'}`);
          }
          
          // Only create the agent entry if NFT minting was successful
          const nftAgent: NFTAgent = {
            ...newAgent,
            tokenId,
            nftContract: nftContractAddress,
            metadata: {
              name: newAgent.name,
              description: newAgent.description,
              model: newAgent.model,
              usageCost: nftService.ethToWei(newAgent.usageCost.toString()),
              maxUsagesPerDay: newAgent.maxUsagesPerDay,
              isForRent: formData.isForRent || false,
              rentPricePerUse: nftService.ethToWei((formData.rentPricePerUse || 0).toString()),
              ipfsHash: cid,
              creator: address.toLowerCase(),
              createdAt: Math.floor(Date.now() / 1000),
            },
            toolConfig: {
              enableWebSearch: newAgent.enableWebSearch || false,
              enableCodeExecution: newAgent.enableCodeExecution || false,
              enableBrowserAutomation: newAgent.enableBrowserAutomation || false,
              enableWolframAlpha: newAgent.enableWolframAlpha || false,
              enableStreaming: newAgent.enableStreaming || false,
              responseFormat: newAgent.responseFormat || 'text',
              temperature: Math.round((newAgent.temperature || 0.7) * 1000), // Scale by 1000
              maxTokens: newAgent.maxTokens || 4096,
              topP: Math.round((newAgent.topP || 1.0) * 1000), // Scale by 1000
              frequencyPenalty: Math.round((newAgent.frequencyPenalty || 0) * 1000), // Scale by 1000
              presencePenalty: Math.round((newAgent.presencePenalty || 0) * 1000), // Scale by 1000
            },
            isOwner: true,
            creator: address.toLowerCase(),
          };
          
          // Note: Agent is minted but not automatically listed
          // User can choose to list it for sale or rental using the buttons in the UI
          
          setNftAgents(prev => [...prev, nftAgent]);
          console.log('✅ NFT minted successfully:', tokenId);
        } catch (error) {
          console.error('Failed to create agent:', error);
          // If NFT minting fails, don't create the agent at all
          // The agent is not stored in Lighthouse or added to the UI
          throw error;
        }
      } else {
        // Wallet required for NFT agent creation
        throw new Error('Wallet required for NFT agent creation');
      }
      
       // Reset form
       setFormData({
         name: '',
         description: '',
         systemPrompt: 'You are a helpful AI assistant.',
         model: availableModels[0] || 'openai/gpt-oss-120b',
         // Hardcoded safe defaults - not user editable
         temperature: 0.7,
         maxTokens: 4096,
         topP: 1.0,
         frequencyPenalty: 0,
         presencePenalty: 0,
         enabledTools: [],
         responseFormat: 'text',
         enableStreaming: true, // Streaming enabled by default
         enableWebSearch: false,
         enableCodeExecution: false,
         enableBrowserAutomation: false,
         enableWolframAlpha: false,
         customInstructions: [],
         exampleConversations: [],
         guardrails: [],
         isNFT: true, // Default to NFT minting
         usageCost: 0.01,
         maxUsagesPerDay: 1000,
         isForRent: true, // Rental enabled by default
         rentPricePerUse: 0.005,
         sellingPrice: 1.0,
      });

      // Success message - only show if we reach this point (meaning creation was successful)
      if (newAgent.isNFT) {
        alert('🎉 NFT Agent created and minted successfully on Polygon Amoy! You can now use the "List for Sale" or "Enable Rental" buttons to make it available in the marketplace.');
      } else {
        alert('🎉 Agent created successfully!');
      }
    } catch (error: unknown) {
      console.error('Agent creation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Provide more specific error messages for common issues
      if (errorMessage.includes('NFT service not ready')) {
        setErrors(['Please connect your wallet and ensure you are on the correct network (Polygon Amoy testnet)']);
      } else if (errorMessage.includes('Failed to get token ID')) {
        setErrors(['NFT minting failed. Please check your wallet connection and try again.']);
      } else if (errorMessage.includes('Wallet required for NFT agent creation')) {
        setErrors(['Please connect your wallet to create NFT agents.']);
      } else if (errorMessage.includes('Internal JSON-RPC error')) {
        setErrors(['Transaction failed on Polygon Amoy. Please check your wallet has enough MATIC for gas fees and try again.']);
      } else {
        setErrors([errorMessage]);
      }
    } finally {
      setIsCreating(false);
    }
  };

  // const addCustomInstruction = () => {
  //   const instruction = prompt('Enter custom instruction:');
  //   if (instruction) {
  //     setFormData(prev => ({
  //       ...prev,
  //       customInstructions: [...(prev.customInstructions || []), instruction]
  //     }));
  //   }
  // };

  // const addExampleConversation = () => {
  //   const input = prompt('Enter example user input:');
  //   const output = prompt('Enter expected assistant output:');
  //   if (input && output) {
  //     setFormData(prev => ({
  //       ...prev,
  //       exampleConversations: [...(prev.exampleConversations || []), { input, output }]
  //     }));
  //   }
  // };

  // const addGuardrail = () => {
  //   const guardrail = prompt('Enter guardrail/constraint:');
  //   if (guardrail) {
  //     setFormData(prev => ({
  //       ...prev,
  //       guardrails: [...(prev.guardrails || []), guardrail]
  //     }));
  //   }
  // };

  return (
    <div className="mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bricolage-bold text-black">🤖 AI Agent Builder</h1>
            <p className="text-black font-dmsans-medium">Create, deploy, and monetize custom AI agents</p>
          </div>
          <div className="flex space-x-4">
            <span className="bg-white text-black px-3 py-1 rounded-[5px] text-sm font-bricolage-bold border-2 border-black">
              {loadingAgents ? 'Loading...' : `${nftAgents.length} NFT Agent${nftAgents.length !== 1 ? 's' : ''} Created`}
            </span>
            {address && (
              <span className="bg-white text-black px-3 py-1 rounded-[5px] text-sm font-bricolage-bold border-2 border-black">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            )}
            {address && (
              <span className="bg-white text-black px-3 py-1 rounded-[5px] text-sm font-bricolage-bold border-2 border-black">
                💾 Stored in Lighthouse
              </span>
            )}
            {nftContractAddress && (
              <span className="bg-white text-black px-3 py-1 rounded-[5px] text-xs font-bricolage-bold border-2 border-black">
                📋 {nftContractAddress.slice(0, 6)}...{nftContractAddress.slice(-4)}
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Agent Creation Form */}
            <div className="lg:col-span-2">
              <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] p-6">
                <h2 className="text-xl font-bricolage-bold text-black mb-6">Create New AI Agent</h2>
                
                {errors.length > 0 && (
                  <div className="mb-6 p-4 bg-red-100 border-4 border-black rounded-[5px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    {errors.map((error, i) => (
                      <p key={i} className="text-red-600 text-sm font-bricolage-bold">• {error}</p>
                    ))}
                  </div>
                )}

                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bricolage-bold text-black mb-2">
                        Agent Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border-2 border-black rounded-[5px] focus:ring-2 focus:ring-main font-dmsans-medium"
                        placeholder="My AI Assistant"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bricolage-bold text-black mb-2">
                        Model *
                      </label>
                      <select
                        value={formData.model}
                        onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                        disabled={loadingModels}
                        className="w-full px-3 py-2 border-2 border-black rounded-[5px] focus:ring-2 focus:ring-main disabled:bg-gray-100 font-dmsans-medium"
                      >
                        {loadingModels ? (
                          <option value="">Loading models...</option>
                        ) : (
                          availableModels.map(model => {
                            let displayName = '';
                            
                            switch (model) {
                              case 'openai/gpt-oss-120b':
                                displayName = '🧠 GPT OSS 120B (Best Overall)';
                                break;
                              case 'openai/gpt-oss-20b':
                                displayName = '🧠 GPT OSS 20B (Good Quality)';
                                break;
                              case 'groq/compound':
                                displayName = '🔧 Compound (Browser Automation)';
                                break;
                              case 'groq/compound-mini':
                                displayName = '🔧 Compound Mini (Lighter)';
                                break;
                              case 'llama-3.3-70b-versatile':
                                displayName = '🦙 Llama 3.3 70B (High Quality)';
                                break;
                              case 'llama-3.1-8b-instant':
                                displayName = '🦙 Llama 3.1 8B (Fast)';
                                break;
                              default:
                                displayName = model;
                            }
                            
                            return (
                              <option key={model} value={model}>
                                {displayName}
                              </option>
                            );
                          })
                        )}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bricolage-bold text-black mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border-2 border-black rounded-[5px] focus:ring-2 focus:ring-main font-dmsans-medium"
                      placeholder="Describe what your AI agent does..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bricolage-bold text-black mb-2">
                      System Prompt *
                    </label>
                    <textarea
                      value={formData.systemPrompt}
                      onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 border-2 border-black rounded-[5px] focus:ring-2 focus:ring-main font-dmsans-medium"
                      placeholder="You are a helpful AI assistant that..."
                    />
                  </div>

                  {/* Model Parameters - Hidden with safe defaults */}
                  <div className="hidden">
                    {/* These parameters are hardcoded with safe defaults to prevent user errors */}
                    <input type="hidden" value={formData.temperature || 0.7} />
                    <input type="hidden" value={formData.maxTokens || 4096} />
                    <input type="hidden" value={formData.topP || 1.0} />
                    <input type="hidden" value={formData.responseFormat || 'text'} />
                  </div>

                  {/* Advanced Features */}
                  <div>
                    <h3 className="text-lg font-bricolage-bold text-black mb-4">🛠️ Advanced Features</h3>
                    
                    <div className="space-y-2 mb-3">
                      {/* <div className="p-3 bg-green-100 border-4 border-black rounded-[5px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-sm text-green-700 font-dmsans-medium">
                        <strong className="font-bricolage-bold">🎯 Model-Specific Features:</strong><br/>
                        • <strong className="font-bricolage-bold">GPT OSS:</strong> Browser Search, Code Interpreter, JSON Mode, Streaming<br/>
                        • <strong className="font-bricolage-bold">Compound:</strong> Web Search, Code Interpreter, Browser Automation, Streaming<br/>
                        • <strong className="font-bricolage-bold">Llama:</strong> Basic Chat, Streaming, JSON Mode (limited)<br/>
                        • <strong className="font-bricolage-bold">Other:</strong> Basic Chat, Streaming
                      </div>
                       */}
                      {/* <div className="p-3 bg-blue-100 border-4 border-black rounded-[5px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-sm text-blue-700 font-dmsans-medium">
                        <strong className="font-bricolage-bold">🔧 Model Recommendations:</strong><br/>
                        • <strong className="font-bricolage-bold">Best Overall:</strong> GPT OSS 120B (all features, highest quality)<br/>
                        • <strong className="font-bricolage-bold">Browser Automation:</strong> Compound (unique automation features)<br/>
                        • <strong className="font-bricolage-bold">Fast Responses:</strong> Llama 3.1 8B (instant, efficient)<br/>
                        • <strong className="font-bricolage-bold">High Quality Chat:</strong> Llama 3.3 70B (excellent reasoning)
                      </div> */}
                      
                      {/* <div className="p-3 bg-yellow-100 border-4 border-black rounded-[5px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-sm text-yellow-700 font-dmsans-medium">
                        ❌ <strong className="font-bricolage-bold">Not Available:</strong> Wolfram Alpha (in any model)
                      </div> */}
                    </div>
                    
                    <div className="space-y-3">
                      <label className="flex items-center p-3 bg-gray-100 border-2 border-gray-400 rounded-[5px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] opacity-75 cursor-not-allowed">
                        <input
                          type="checkbox"
                          checked={true}
                          disabled
                          className="mr-3 w-5 h-5 border-2 border-gray-400 rounded focus:ring-2 focus:ring-main bg-black"
                          style={{
                            accentColor: '#000000',
                            color: '#ffffff'
                          }}
                        />
                        <span className="text-sm font-bricolage-bold text-gray-600">Enable Streaming (Required)</span>
                      </label>
                      
                      <label className={`flex items-center p-3 border-2 border-black rounded-[5px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all cursor-pointer ${formData.enableWebSearch ? 'bg-main' : 'bg-white'}`}>
                        <input
                          type="checkbox"
                          checked={formData.enableWebSearch}
                          onChange={(e) => setFormData(prev => ({ ...prev, enableWebSearch: e.target.checked }))}
                          className={`mr-3 w-5 h-5 border-2 border-black rounded focus:ring-2 focus:ring-main ${formData.enableWebSearch ? 'bg-black' : 'bg-white'}`}
                          style={{
                            accentColor: formData.enableWebSearch ? '#000000' : '#ffffff',
                            color: formData.enableWebSearch ? '#ffffff' : '#000000'
                          }}
                        />
                        <span className={`text-sm font-bricolage-bold ${formData.enableWebSearch ? 'text-main-foreground' : 'text-black'}`}>🌐 Browser Search</span>
                      </label>
                      
                      <label className={`flex items-center p-3 border-2 border-black rounded-[5px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all cursor-pointer ${formData.enableCodeExecution ? 'bg-main' : 'bg-white'}`}>
                        <input
                          type="checkbox"
                          checked={formData.enableCodeExecution}
                          onChange={(e) => setFormData(prev => ({ ...prev, enableCodeExecution: e.target.checked }))}
                          className={`mr-3 w-5 h-5 border-2 border-black rounded focus:ring-2 focus:ring-main ${formData.enableCodeExecution ? 'bg-black' : 'bg-white'}`}
                          style={{
                            accentColor: formData.enableCodeExecution ? '#000000' : '#ffffff',
                            color: formData.enableCodeExecution ? '#ffffff' : '#000000'
                          }}
                        />
                        <span className={`text-sm font-bricolage-bold ${formData.enableCodeExecution ? 'text-main-foreground' : 'text-black'}`}>💻 Code Interpreter</span>
                      </label>
                      
                      <label className={`flex items-center p-3 border-2 border-black rounded-[5px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all cursor-pointer ${formData.enableBrowserAutomation ? 'bg-main' : 'bg-white'}`}>
                        <input
                          type="checkbox"
                          checked={formData.enableBrowserAutomation}
                          onChange={(e) => setFormData(prev => ({ ...prev, enableBrowserAutomation: e.target.checked }))}
                          className={`mr-3 w-5 h-5 border-2 border-black rounded focus:ring-2 focus:ring-main ${formData.enableBrowserAutomation ? 'bg-black' : 'bg-white'}`}
                          style={{
                            accentColor: formData.enableBrowserAutomation ? '#000000' : '#ffffff',
                            color: formData.enableBrowserAutomation ? '#ffffff' : '#000000'
                          }}
                        />
                        <span className={`text-sm font-bricolage-bold ${formData.enableBrowserAutomation ? 'text-main-foreground' : 'text-black'}`}>🌐 Browser Automation</span>
                      </label>

                      <label className="flex items-center p-3 bg-gray-100 border-2 border-gray-400 rounded-[5px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] opacity-75 cursor-not-allowed">
                        <input
                          type="checkbox"
                          checked={true}
                          disabled
                          className="mr-3 w-5 h-5 border-2 border-gray-400 rounded focus:ring-2 focus:ring-main bg-black"
                          style={{
                            accentColor: '#000000',
                            color: '#ffffff'
                          }}
                        />
                        <span className="text-sm font-bricolage-bold text-gray-600">Mint as INFT (Required)</span>
                      </label>
                    </div>
                  </div>

                  {/* Custom Instructions */}
                  {/* <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-bricolage-bold text-black">
                        Custom Instructions
                      </label>
                      <button
                        type="button"
                        onClick={addCustomInstruction}
                        className="text-sm text-main hover:text-main/80 font-bricolage-bold border-2 border-black bg-white px-3 py-1 rounded-[5px] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                      >
                        + Add Instruction
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formData.customInstructions?.map((instruction, index) => (
                        <div key={`instruction-${index}`} className="flex items-center space-x-2">
                          <span className="text-sm text-black flex-1 px-3 py-2 bg-white border-2 border-black rounded-[5px] font-dmsans-medium">
                            {instruction}
                          </span>
                          <button
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              customInstructions: prev.customInstructions?.filter((_, index) => index !== prev.customInstructions?.indexOf(instruction))
                            }))}
                            className="text-red-600 hover:text-red-800 text-sm font-bricolage-bold border-2 border-red-600 bg-white px-2 py-1 rounded-[5px] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div> */}

                  {/* Example Conversations */}
                  {/* <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-bricolage-bold text-black">
                        Example Conversations
                      </label>
                      <button
                        type="button"
                        onClick={addExampleConversation}
                        className="text-sm text-main hover:text-main/80 font-bricolage-bold border-2 border-black bg-white px-3 py-1 rounded-[5px] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                      >
                        + Add Example
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formData.exampleConversations?.map((example, index) => (
                        <div key={`example-${index}`} className="p-3 bg-white border-2 border-black rounded-[5px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] space-y-2">
                          <div className="text-sm font-dmsans-medium">
                            <strong className="font-bricolage-bold">User:</strong> {example.input}
                          </div>
                          <div className="text-sm font-dmsans-medium">
                            <strong className="font-bricolage-bold">Assistant:</strong> {example.output}
                          </div>
                          <button
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              exampleConversations: prev.exampleConversations?.filter((_, idx) => idx !== index)
                            }))}
                            className="text-red-600 hover:text-red-800 text-xs font-bricolage-bold border border-red-600 bg-white px-2 py-1 rounded-[3px] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div> */}

                  {/* Guardrails */}
                  {/* <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-bricolage-bold text-black">
                        Guardrails & Constraints
                      </label>
                      <button
                        type="button"
                        onClick={addGuardrail}
                        className="text-sm text-main hover:text-main/80 font-bricolage-bold border-2 border-black bg-white px-3 py-1 rounded-[5px] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                      >
                        + Add Guardrail
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formData.guardrails?.map((guardrail, index) => (
                        <div key={`guardrail-${index}`} className="flex items-center space-x-2">
                          <span className="text-sm text-black flex-1 px-3 py-2 bg-red-100 border-2 border-black rounded-[5px] font-dmsans-medium">
                            {guardrail}
                          </span>
                          <button
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              guardrails: prev.guardrails?.filter((_, idx) => idx !== prev.guardrails?.indexOf(guardrail))
                            }))}
                            className="text-red-600 hover:text-red-800 text-sm font-bricolage-bold border-2 border-red-600 bg-white px-2 py-1 rounded-[5px] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div> */}

                  {/* INFT Settings */}
                  {formData.isNFT && (
                    <div className="p-4 border-2 border-black bg-background rounded-[5px]">
                      <h4 className="font-bricolage-bold text-black mb-3">🎫 INFT Marketplace Settings</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bricolage-bold text-black mb-1">
                            Usage Cost (per execution)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={formData.usageCost || 0}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              setFormData(prev => ({ ...prev, usageCost: isNaN(value) ? 0 : value }));
                            }}
                            className="w-full px-3 py-2 bg-white border-2 border-black rounded-[5px] focus:ring-2 focus:ring-main font-dmsans-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bricolage-bold text-black mb-1">
                            Max Usages Per Day
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={formData.maxUsagesPerDay || 1000}
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              setFormData(prev => ({ ...prev, maxUsagesPerDay: isNaN(value) ? 1000 : value }));
                            }}
                            className="w-full px-3 py-2 border-2 bg-white border-black rounded-[5px] focus:ring-2 focus:ring-main font-dmsans-medium"
                          />
                        </div>
                      </div>
                      
                      {/* Selling Price */}
                      <div className="mt-4">
                        <label className="block text-sm font-bricolage-bold text-black mb-1">
                          Selling Price (MATIC)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={formData.sellingPrice || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                              setFormData(prev => ({ ...prev, sellingPrice: 0 }));
                            } else {
                              const numValue = parseFloat(value);
                              if (!isNaN(numValue) && numValue >= 0) {
                                setFormData(prev => ({ ...prev, sellingPrice: numValue }));
                              }
                            }
                          }}
                          className="w-full px-3 py-2 bg-white border-2 border-black rounded-[5px] focus:ring-2 focus:ring-main font-dmsans-medium"
                          placeholder="1.0"
                        />
                        <p className="text-xs text-gray-600 mt-1 font-dmsans-medium">
                          Price for full ownership of the NFT
                        </p>
                      </div>
                      
                      {/* Rental Settings */}
                      <div className="mt-4">
                        <label className="block text-sm font-bricolage-bold text-black mb-1">
                          Rent Price per Use (MATIC)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={formData.rentPricePerUse || 0}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            setFormData(prev => ({ ...prev, rentPricePerUse: isNaN(value) ? 0 : value }));
                          }}
                          className="w-full px-3 py-2 bg-white border-2 border-black rounded-[5px] focus:ring-2 focus:ring-main font-dmsans-medium"
                          placeholder="0.005"
                        />
                        <p className="text-xs text-gray-600 mt-1 font-dmsans-medium">
                          Price for each use of the agent (rental is enabled by default)
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Debug Section */}
                  {/* {process.env.NODE_ENV === 'development' && (
                    <div className="p-4 bg-gray-100 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">🔧 Debug Tools</h4>
                      <div className="space-y-2">
                        <button
                          onClick={async () => {
                            try {
                              console.log('🔍 Contract Address:', process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS);
                              const isReady = await nftService.isReady();
                              console.log('🔍 NFT Service Ready:', isReady);
                              if (isReady) {
                                await nftService.validateContract();
                                alert('✅ Contract validation passed!');
                              } else {
                                alert('❌ NFT Service not ready');
                              }
                            } catch (error) {
                              console.error('❌ Debug failed:', error);
                              alert(`❌ Debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                            }
                          }}
                          className="text-sm bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded"
                        >
                          Test Contract Connection
                        </button>
                        <button
                          onClick={() => {
                            console.log('🔍 Environment Variables:', {
                              NFT_CONTRACT: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS,
                              NODE_ENV: process.env.NODE_ENV
                            });
                            alert(`Contract Address: ${process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || 'Not set'}`);
                          }}
                          className="text-sm bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded ml-2"
                        >
                          Check Environment
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const result = await (window as any).testContractConnection();
                              if (result.success) {
                                alert(`✅ Contract test passed! Total agents: ${result.totalAgents}`);
                              } else {
                                alert(`❌ Contract test failed: ${result.error}`);
                              }
                            } catch (error) {
                              alert(`❌ Test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                            }
                          }}
                          className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded ml-2"
                        >
                          Test Contract
                        </button>
                      </div>
                    </div>
                  )} */}

                  {/* Create Button */}
                  <button
                    onClick={handleCreateAgent}
                    disabled={isCreating}
                    className="w-full bg-main disabled:bg-gray-400 text-main-foreground py-3 px-6 rounded-[5px] font-bricolage-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    {isCreating ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Creating Agent...
                      </div>
                    ) : (
                      'Create AI Agent'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Agents List */}
            <div className="space-y-6">
              <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] p-6">
                <h3 className="text-lg font-bricolage-bold text-black mb-4">
                  Your NFT Agents {loadingAgents ? '(Loading...)' : `(${nftAgents.length})`}
                </h3>
                
                {loadingAgents ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black mx-auto mb-2"></div>
                    <p className="text-black font-dmsans-medium">Loading your agents...</p>
                  </div>
                ) : (nftAgents.length === 0) ? (
                  <p className="text-black text-center py-8 font-dmsans-medium">
                    No NFT agents created yet. Create your first NFT AI agent!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {/* NFT Agents */}
                    {nftAgents.map((agent, index) => (
                      <div key={`nft-${agent.tokenId}-${index}`} className="p-6 border-2 border-black rounded-[5px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all bg-background min-h-[140px] flex flex-col">
                        {/* Top section with name and metadata */}
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bricolage-bold text-black">{agent.name}</h4>
                            <span className="text-xs bg-white text-black px-1 py-1 rounded-[3px] font-bricolage-bold border border-black">
                              #{agent.tokenId}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-white text-black px-1 py-1 rounded-[3px] font-bricolage-bold border border-black truncate max-w-[120px]" title={agent.model}>
                              {agent.model.length > 15 ? `${agent.model.substring(0, 15)}...` : agent.model}
                            </span>
                            <span className="text-xs bg-white text-black px-1 py-1 rounded-[3px] font-bricolage-bold border border-black">
                              Owner
                            </span>
                          </div>
                        </div>
                        
                        {/* Spacer to push buttons to bottom */}
                        <div className="flex-1"></div>
                        
                        {/* Bottom section with action buttons */}
                        <div className="flex gap-3">
                          <button
                            onClick={async (event) => {
                              console.log('🖱️ List for Sale button clicked for agent:', agent);
                              
                              const sellingPrice = prompt('Enter selling price in MATIC:', '1.0');
                              
                              if (sellingPrice && !isNaN(parseFloat(sellingPrice))) {
                                try {
                                  console.log('💰 Selling price entered:', sellingPrice);
                                  
                                  // Ensure NFT service is ready
                                  console.log('🔍 Checking NFT service readiness...');
                                  const isReady = await nftService.isReady();
                                  if (!isReady) {
                                    console.error('❌ NFT service not ready');
                                    alert('NFT service not ready. Please check your wallet connection.');
                                    return;
                                  }
                                  console.log('✅ NFT service is ready');

                                  // Show loading state
                                  const button = event.target as HTMLButtonElement;
                                  const originalText = button.textContent;
                                  button.textContent = 'Listing...';
                                  button.disabled = true;

                                  console.log('📝 Starting listing process...');
                                  
                                  // List for sale
                                  await nftService.listAgentForSale(agent.tokenId, parseFloat(sellingPrice));
                                  
                                  console.log('✅ Listing completed successfully');
                                  alert(`NFT Agent "${agent.name}" listed for sale at ${sellingPrice} MATIC!`);
                                  
                                  // Refresh NFT agents to show updated status
                                  await refreshNFTAgents();
                                } catch (error) {
                                  console.error('❌ Failed to list NFT agent for sale:', error);
                                  
                                  let errorMessage = 'Failed to list NFT agent for sale';
                                  if (error instanceof Error) {
                                    if (error.message.includes('Not the owner')) {
                                      errorMessage = 'You are not the owner of this agent. Please check your wallet connection and ensure you are the owner.';
                                    } else if (error.message.includes('Internal JSON-RPC error')) {
                                      errorMessage = 'Polygon Amoy network error. Please try again in a few moments. If the problem persists, check your internet connection and ensure you have enough MATIC for gas fees.';
                                    } else if (error.message.includes('could not coalesce error')) {
                                      errorMessage = 'Transaction failed due to network issues. Please try again with a different gas price or wait for network congestion to clear.';
                                    } else {
                                      errorMessage = error.message;
                                    }
                                  }
                                  
                                  alert(errorMessage);
                                } finally {
                                  // Reset button state
                                  const button = event.target as HTMLButtonElement;
                                  button.textContent = 'List for Sale';
                                  button.disabled = false;
                                }
                              } else {
                                console.log('❌ Invalid price entered or cancelled');
                              }
                            }}
                            className="flex-1 text-sm mt-6 text-black font-bricolage-bold border border-black bg-main px-3 py-3 rounded-[4px] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
                          >
                            List for Sale
                          </button>
                          <button
                            onClick={async (event) => {
                              console.log('🖱️ Enable Rental button clicked for agent:', agent);
                              
                              const rentalPrice = prompt('Enter rental price per use in MATIC:', nftService.weiToEth(agent.metadata.rentPricePerUse));
                              
                              if (rentalPrice && !isNaN(parseFloat(rentalPrice))) {
                                try {
                                  console.log('💰 Rental price entered:', rentalPrice);
                                  
                                  // Ensure NFT service is ready
                                  console.log('🔍 Checking NFT service readiness...');
                                  const isReady = await nftService.isReady();
                                  if (!isReady) {
                                    console.error('❌ NFT service not ready');
                                    alert('NFT service not ready. Please check your wallet connection.');
                                    return;
                                  }
                                  console.log('✅ NFT service is ready');

                                  // Show loading state
                                  const button = event.target as HTMLButtonElement;
                                  const originalText = button.textContent;
                                  button.textContent = 'Enabling...';
                                  button.disabled = true;

                                  console.log('📝 Starting rental enable process...');
                                  
                                  // Update agent metadata to enable rental
                                  const updatedMetadata = {
                                    ...agent.metadata,
                                    isForRent: true,
                                    rentPricePerUse: nftService.ethToWei(rentalPrice)
                                  };
                                  
                                  // Update metadata
                                  await nftService.updateAgentMetadata(agent.tokenId, updatedMetadata);
                                  
                                  console.log('✅ Rental enabled successfully');
                                  alert(`NFT Agent "${agent.name}" enabled for rental at ${rentalPrice} MATIC/use!`);
                                  
                                  // Refresh NFT agents to show updated status
                                  await refreshNFTAgents();
                                } catch (error) {
                                  console.error('❌ Failed to enable rental for NFT agent:', error);
                                  
                                  let errorMessage = 'Failed to enable rental';
                                  if (error instanceof Error) {
                                    if (error.message.includes('Not the owner')) {
                                      errorMessage = 'You are not the owner of this agent. Please check your wallet connection and ensure you are the owner.';
                                    } else if (error.message.includes('Internal JSON-RPC error')) {
                                      errorMessage = 'Polygon Amoy network error. Please try again in a few moments. If the problem persists, check your internet connection and ensure you have enough MATIC for gas fees.';
                                    } else if (error.message.includes('could not coalesce error')) {
                                      errorMessage = 'Transaction failed due to network issues. Please try again with a different gas price or wait for network congestion to clear.';
                                    } else {
                                      errorMessage = error.message;
                                    }
                                  }
                                  
                                  alert(errorMessage);
                                } finally {
                                  // Reset button state
                                  const button = event.target as HTMLButtonElement;
                                  button.textContent = 'Enable Rental';
                                  button.disabled = false;
                                }
                              } else {
                                console.log('❌ Invalid price entered or cancelled');
                              }
                            }}
                            className="flex-1 text-sm mt-6 font-bricolage-bold border border-black bg-white px-3 py-3 rounded-[4px] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
                          >
                            Enable Rental
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
    </div>
  );
}
