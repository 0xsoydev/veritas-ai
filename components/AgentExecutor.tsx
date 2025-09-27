"use client"
import { useState, useEffect } from 'react';
import { AgentConfig, AgentResponse, ExecutionContext } from '@/lib/groqService';
import { GroqClient } from '@/lib/groqClient';
import { useWallet } from '@/lib/wallet-context';
import { agentStorageService, StoredChat, StoredAgent } from '@/lib/agentStorageService';
import { nftService, NFTAgent } from '@/lib/nftService';
// Markdown support - install with: npm install react-markdown remark-gfm rehype-highlight highlight.js
let ReactMarkdown: any;
let remarkGfm: any; 
let rehypeHighlight: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ReactMarkdown = require('react-markdown').default || require('react-markdown');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  remarkGfm = require('remark-gfm').default || require('remark-gfm');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  rehypeHighlight = require('rehype-highlight').default || require('rehype-highlight');
  
  // Import highlight.js CSS theme (only if package is installed)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('highlight.js/styles/github-dark.css');
} catch {
  // Packages not installed - markdown will fallback to plain text
  console.warn('Markdown packages not installed. Run: npm install react-markdown remark-gfm rehype-highlight highlight.js');
}

interface AgentExecutorProps {
  agents: StoredAgent[];
  nftAgents?: NFTAgent[];
  groqClient: GroqClient;
  onRentalUsesUpdated?: () => void;
}

export function AgentExecutor({ agents, nftAgents = [], groqClient, onRentalUsesUpdated }: AgentExecutorProps) {
  const { address } = useWallet();
  const [selectedAgent, setSelectedAgent] = useState<StoredAgent | null>(null);
  const [selectedNFTAgent, setSelectedNFTAgent] = useState<NFTAgent | null>(null);
  const [userInput, setUserInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [showMarkdown, setShowMarkdown] = useState(true);
  const [executionHistory, setExecutionHistory] = useState<Array<{
    input: string;
    response: AgentResponse;
    timestamp: number;
  }>>([]);
  const [currentChat, setCurrentChat] = useState<StoredChat | null>(null);
  const [userChats, setUserChats] = useState<StoredChat[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [sessionUsesRemaining, setSessionUsesRemaining] = useState<Map<number, number>>(new Map());

  // Load session state from localStorage on mount
  useEffect(() => {
    const loadSessionState = () => {
      try {
        const savedSessionUses = localStorage.getItem('sessionUsesRemaining');
        
        if (savedSessionUses) {
          const usesArray: [string, number][] = JSON.parse(savedSessionUses);
          const usesMap = new Map<number, number>(usesArray.map(([key, value]) => [parseInt(key), value]));
          setSessionUsesRemaining(usesMap);
        }
      } catch (error) {
        console.error('Failed to load session state:', error);
      }
    };

    loadSessionState();
  }, []);

  // Load rental uses from smart contract when address changes
  useEffect(() => {
    const loadRentalUses = async () => {
      if (!address || !nftService.isReady()) return;

      try {
        const agents = await nftService.getAllMarketplaceAgents(address);
        const rentalUses = new Map<number, number>();
        
        for (const agent of agents) {
          if (agent.rentalBalance && agent.rentalBalance > 0) {
            rentalUses.set(agent.tokenId, agent.rentalBalance);
          }
        }
        
        // Always load from smart contract, not localStorage
        setSessionUsesRemaining(rentalUses);
        console.log('🔄 Loaded rental uses from smart contract:', Array.from(rentalUses.entries()));
      } catch (error) {
        console.error('Failed to load rental uses:', error);
      }
    };

    loadRentalUses();
  }, [address]);

  // Sync rental uses when NFT agents change (e.g., after rental purchase)
  useEffect(() => {
    const syncRentalUses = async () => {
      if (!address || !nftService.isReady() || nftAgents.length === 0) return;

      try {
        const agents = await nftService.getAllMarketplaceAgents(address);
        const rentalUses = new Map<number, number>();
        
        for (const agent of agents) {
          if (agent.rentalBalance && agent.rentalBalance > 0) {
            rentalUses.set(agent.tokenId, agent.rentalBalance);
          }
        }
        
        // Update session state with fresh data from smart contract
        setSessionUsesRemaining(rentalUses);
        console.log('🔄 Synced rental uses after agent update:', Array.from(rentalUses.entries()));
      } catch (error) {
        console.error('Failed to sync rental uses:', error);
      }
    };

    syncRentalUses();
  }, [address, nftAgents]);

  // Save session state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('sessionUsesRemaining', JSON.stringify(Array.from(sessionUsesRemaining.entries())));
    } catch (error) {
      console.error('Failed to save session uses:', error);
    }
  }, [sessionUsesRemaining]);

  // Load user chats when component mounts, address changes, or selected agent changes
  useEffect(() => {
    const loadUserChats = async () => {
      if (!address) {
        console.log('💬 No wallet address, clearing chats');
        setUserChats([]);
        setCurrentChat(null);
        setLoadingChats(false);
        return;
      }

      if (!selectedAgent) {
        console.log('💬 No agent selected, clearing chats');
        setUserChats([]);
        setCurrentChat(null);
        setLoadingChats(false);
        return;
      }

      try {
        console.log('💬 Loading chats for agent:', selectedAgent.id, 'and address:', address);
        setLoadingChats(true);
        const chats = await agentStorageService.getUserChats(address);
        console.log('💬 Loaded all chats:', chats.length, 'chats');
        
        // Filter chats by the selected agent
        const agentChats = chats.filter(chat => chat.agentId === selectedAgent.id);
        console.log('💬 Filtered chats for agent', selectedAgent.id, ':', agentChats.length, 'chats');
        
        // Remove any potential duplicates by ID
        const uniqueChats = agentChats.filter((chat, index, self) => 
          index === self.findIndex(c => c.id === chat.id)
        );
        
        console.log('💬 Unique chats after deduplication:', uniqueChats.length);
        setUserChats(uniqueChats);
        
        // If we have a current chat, make sure it's still valid for this agent
        if (currentChat) {
          const stillExists = uniqueChats.some(chat => chat.id === currentChat.id);
          if (!stillExists || currentChat.agentId !== selectedAgent.id) {
            console.log('💬 Current chat no longer valid for this agent, clearing it');
            setCurrentChat(null);
            setExecutionHistory([]);
          }
        } else {
          // Clear execution history when switching agents (no current chat)
          setExecutionHistory([]);
        }
      } catch (error) {
        console.error('💬 Failed to load user chats:', error);
        setUserChats([]);
        setCurrentChat(null);
      } finally {
        setLoadingChats(false);
      }
    };

    loadUserChats();
  }, [address, selectedAgent, currentChat]);

  const executeAgent = async () => {
    if (!selectedAgent || !userInput.trim()) return;

    setIsExecuting(true);

    try {
      const context: ExecutionContext = {
        userId: 'demo-user',
        sessionId: `session-${Date.now()}`,
        timestamp: Date.now(),
        metadata: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      };

      const response = await groqClient.executeAgent(selectedAgent, userInput, context);
      
      // Add to execution history
      setExecutionHistory(prev => [...prev, {
        input: userInput,
        response,
        timestamp: Date.now()
      }]);

      // Save to chat storage if user is connected
      if (address) {
        try {
          console.log('💬 Starting chat storage for address:', address);
          let chatToUse = currentChat;
          
          // Create new chat if none exists
          if (!chatToUse) {
            console.log('💬 Creating new chat for agent:', selectedAgent.id);
            const newChat = agentStorageService.createChat(selectedAgent.id, address);
            // Store the chat in Lighthouse first
            const cid = await agentStorageService.storeChat(newChat);
            const storedChat = { ...newChat, cid };
            console.log('💬 Chat stored with CID:', cid);
            
            setCurrentChat(storedChat);
            // Check if chat already exists before adding to prevent duplicates
            setUserChats(prev => {
              const exists = prev.some(chat => chat.id === storedChat.id);
              if (exists) {
                console.log('💬 Chat already exists in list, not adding duplicate');
                return prev;
              }
              return [storedChat, ...prev];
            });
            chatToUse = storedChat;
          } else {
            console.log('💬 Using existing chat:', chatToUse.id);
          }

          // Add user message
          console.log('💬 Adding user message to chat:', chatToUse.id);
          await agentStorageService.addMessageToChat(chatToUse.id, address, 'user', userInput);

          // Add assistant response
          console.log('💬 Adding assistant response to chat:', chatToUse.id);
          await agentStorageService.addMessageToChat(chatToUse.id, address, 'assistant', response.content);

          // Update current chat with new messages
          console.log('💬 Updating chat with new messages');
          const updatedChat = await agentStorageService.getChat(chatToUse.id, address);
          if (updatedChat) {
            console.log('💬 Chat updated successfully, messages count:', updatedChat.messages.length);
            setCurrentChat(updatedChat);
            // Update the chat in the userChats list, ensuring no duplicates
            setUserChats(prev => {
              const updatedList = prev.map(chat => 
                chat.id === chatToUse.id ? updatedChat : chat
              );
              // Remove any potential duplicates by ID
              const uniqueChats = updatedList.filter((chat, index, self) => 
                index === self.findIndex(c => c.id === chat.id)
              );
              return uniqueChats;
            });
          } else {
            console.warn('💬 Failed to retrieve updated chat');
          }
        } catch (storageError) {
          console.error('💬 Failed to save chat to storage:', storageError);
          // Continue execution even if storage fails
        }
      } else {
        console.log('💬 No wallet address, skipping chat storage');
      }

      setUserInput('');
    } catch (error: unknown) {
      alert(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const executeNFTAgent = async () => {
    if (!selectedNFTAgent || !userInput.trim() || isExecuting) return;

    // For owners, execute directly
    if (selectedNFTAgent.isOwner) {
      await executeNFTAgentMessage();
      return;
    }

    // For renters, check if they have remaining uses
    const remainingUses = sessionUsesRemaining.get(selectedNFTAgent.tokenId) || 0;
    
    if (remainingUses <= 0) {
      alert('You have no remaining uses for this agent. Please rent more uses from the marketplace.');
      return;
    }

    // Execute the message
    await executeNFTAgentMessage();
  };

  const executeNFTAgentMessage = async () => {
    if (!selectedNFTAgent || !userInput.trim() || isExecuting) return;

    setIsExecuting(true);
    try {
      // Handle agent usage based on ownership
      if (selectedNFTAgent.isOwner) {
        // Owner can use for free - no payment or balance checks needed
        console.log('👑 Owner using agent for free (no MetaMask prompt)');
        const success = await nftService.useAgentPrepaid(selectedNFTAgent.tokenId);
        
        if (!success) {
          throw new Error('Failed to use agent');
        }
        
        console.log('✅ Owner used agent successfully');
      } else {
        // For renters, check if they have remaining uses
        const currentUses = sessionUsesRemaining.get(selectedNFTAgent.tokenId) || 0;
        
        if (currentUses <= 0) {
          alert('You have no remaining uses for this agent. Please rent more uses from the marketplace.');
          return;
        }

          // Use the agent (handles both prepaid and per-use inference costs)
          try {
            console.log('🔄 Attempting to use agent:', {
              tokenId: selectedNFTAgent.tokenId,
              usageCost: selectedNFTAgent.metadata.usageCost,
              isOwner: selectedNFTAgent.isOwner
            });
            
            // Check if user has prepaid inference balance
            const userAddress = address;
            if (!userAddress) {
              throw new Error('User address not available');
            }
            const prepaidBalance = await nftService.getPrepaidInferenceBalance(selectedNFTAgent.tokenId, userAddress);
            const rentalBalance = await nftService.getRentalBalance(selectedNFTAgent.tokenId, userAddress);
            
            console.log('🔍 Agent usage check:', {
              tokenId: selectedNFTAgent.tokenId,
              userAddress,
              prepaidBalance,
              rentalBalance,
              isOwner: selectedNFTAgent.isOwner
            });
            
            let success: boolean;
            
            if (prepaidBalance > 0) {
              // Use prepaid inference (no MetaMask prompt needed)
              console.log(`🎉 Using prepaid inference. Balance: ${prepaidBalance} uses remaining`);
              success = await nftService.useAgentPrepaid(selectedNFTAgent.tokenId);
            } else {
              // Pay inference cost per use
              console.log('💳 Paying inference cost per use (no prepaid balance)');
              success = await nftService.useAgent(selectedNFTAgent.tokenId, selectedNFTAgent.metadata.usageCost);
            }
            
            if (!success) {
              throw new Error('Failed to use agent');
            }

          // Update local state for renters
          const newUses = Math.max(0, currentUses - 1);
          setSessionUsesRemaining(prev => {
            const newMap = new Map(prev);
            if (newUses > 0) {
              newMap.set(selectedNFTAgent.tokenId, newUses);
            } else {
              newMap.delete(selectedNFTAgent.tokenId);
            }
            return newMap;
          });

          console.log(`✅ Used agent successfully. Remaining uses: ${newUses}`);
        } catch (paymentError) {
          console.error('❌ Failed to use agent:', paymentError);
          
          let errorMessage = 'Failed to use agent';
          if (paymentError instanceof Error) {
            if (paymentError.message.includes('Internal JSON-RPC error')) {
              errorMessage = 'Polygon Amoy network error. Please try again in a few moments. If the problem persists, check your internet connection and ensure you have enough MATIC for gas fees.';
            } else if (paymentError.message.includes('could not coalesce error')) {
              errorMessage = 'Transaction failed due to network issues. Please try again with a different gas price or wait for network congestion to clear.';
            } else if (paymentError.message.includes('user rejected')) {
              errorMessage = 'Transaction was cancelled by user.';
            } else if (paymentError.message.includes('insufficient funds')) {
              errorMessage = 'Insufficient funds. Please add more MATIC to your wallet.';
            } else {
              errorMessage = paymentError.message;
            }
          }
          
          alert(errorMessage);
          return;
        }
      }

      // Execute the agent
      const context: ExecutionContext = {
        userId: 'demo-user',
        sessionId: `session-${Date.now()}`,
        timestamp: Date.now(),
        metadata: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      };

      // Convert NFT agent to full AgentConfig for execution
      const fullAgentConfig = nftService.convertNFTMetadataToAgentConfig(selectedNFTAgent);
      
      const response = await groqClient.executeAgent(fullAgentConfig, userInput, context);
      
      // Add to execution history
      setExecutionHistory(prev => [...prev, {
        input: userInput,
        response,
        timestamp: Date.now()
      }]);

      // Save to chat if user is logged in
      if (address && currentChat) {
        try {
          await agentStorageService.addMessageToChat(currentChat.id, address, 'user', userInput);
          await agentStorageService.addMessageToChat(currentChat.id, address, 'assistant', response.content);
        } catch (error) {
          console.error('Failed to save message to chat:', error);
        }
      }

      setUserInput('');
    } catch (error) {
      console.error('NFT Agent execution failed:', error);
      
      let errorMessage = 'Agent execution failed. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('Internal JSON-RPC error')) {
          errorMessage = 'Polygon Amoy network error. Please try again in a few moments. If the problem persists, check your internet connection and ensure you have enough MATIC for gas fees.';
        } else if (error.message.includes('could not coalesce error')) {
          errorMessage = 'Transaction failed due to network issues. Please try again with a different gas price or wait for network congestion to clear.';
        } else if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was cancelled by user.';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds. Please add more MATIC to your wallet.';
        } else {
          errorMessage = `Agent execution failed: ${error.message}`;
        }
      }
      
      alert(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  };


  const clearHistory = () => {
    setExecutionHistory([]);
  };

  const clearSession = () => {
    setSessionUsesRemaining(new Map());
  };

  // Function to sync rental uses from smart contract
  const syncRentalUsesFromContract = async () => {
    if (!address || !nftService.isReady()) return;

    try {
      const agents = await nftService.getAllMarketplaceAgents(address);
      const rentalUses = new Map<number, number>();
      
      for (const agent of agents) {
        if (agent.rentalBalance && agent.rentalBalance > 0) {
          rentalUses.set(agent.tokenId, agent.rentalBalance);
        }
      }
      
      setSessionUsesRemaining(rentalUses);
      console.log('🔄 Synced rental uses from contract:', Array.from(rentalUses.entries()));
      
      // Notify parent component that rental uses were updated
      if (onRentalUsesUpdated) {
        onRentalUsesUpdated();
      }
    } catch (error) {
      console.error('Failed to sync rental uses from contract:', error);
    }
  };

  // Expose sync function to parent components
  useEffect(() => {
    if (onRentalUsesUpdated) {
      // Store the sync function in a way that parent can access it
      (window as any).syncRentalUsesFromContract = syncRentalUsesFromContract;
    }
  }, [onRentalUsesUpdated]);

  const refreshChats = async () => {
    if (!address || !selectedAgent) return;
    
    try {
      console.log('💬 Manually refreshing chats for agent:', selectedAgent.id);
      setLoadingChats(true);
      const chats = await agentStorageService.getUserChats(address);
      
      // Filter chats by the selected agent
      const agentChats = chats.filter(chat => chat.agentId === selectedAgent.id);
      
      // Remove any potential duplicates by ID
      const uniqueChats = agentChats.filter((chat, index, self) => 
        index === self.findIndex(c => c.id === chat.id)
      );
      
      console.log('💬 Refreshed chats for agent', selectedAgent.id, ':', uniqueChats.length);
      setUserChats(uniqueChats);
    } catch (error) {
      console.error('💬 Failed to refresh chats:', error);
    } finally {
      setLoadingChats(false);
    }
  };

  // Load chat messages when a chat is selected
  const loadChatMessages = (chat: StoredChat) => {
    console.log('💬 Loading messages for chat:', chat.id, 'with', chat.messages.length, 'messages');
    
    // Convert stored chat messages to execution history format
    const chatHistory = chat.messages.map((message, index) => {
      if (message.role === 'user') {
        // Find the corresponding assistant response (next message)
        const assistantMessage = chat.messages[index + 1];
        if (assistantMessage && assistantMessage.role === 'assistant') {
          return {
            input: message.content,
            response: {
              content: assistantMessage.content,
              tokenUsage: { 
                promptTokens: 0, 
                completionTokens: 0, 
                totalTokens: 0 
              }, // We don't store token usage in chat
              model: 'stored-chat', // Placeholder for stored chat
              finishReason: 'stop', // Placeholder for stored chat
              executionTime: 0, // We don't store execution time in chat
              toolsUsed: [], // We don't store tools used in chat
              cost: 0 // We don't store cost in chat
            },
            timestamp: message.timestamp
          };
        }
      }
      return null;
    }).filter((item): item is NonNullable<typeof item> => item !== null); // Remove null entries with proper type guard
    
    console.log('💬 Converted chat messages to execution history:', chatHistory.length, 'conversations');
    setExecutionHistory(chatHistory);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Agent Selection */}
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Select Agent to Test</h3>
          
          {(agents.length === 0 && nftAgents.length === 0) ? (
            <p className="text-gray-500 text-center py-8">
              No agents available. Create an agent first!
            </p>
          ) : (
            <div className="space-y-4">
              {/* NFT Agents */}
              {nftAgents.length > 0 && (
                <div>
                  <h4 className="text-md font-medium text-purple-800 mb-3">🎫 NFT Agents</h4>
                  <div className="space-y-3">
                    {nftAgents.map((agent) => (
                      <div 
                        key={`nft-${agent.tokenId}`}
                        onClick={() => setSelectedNFTAgent(agent)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          selectedNFTAgent?.tokenId === agent.tokenId
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-purple-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900">{agent.name}</h4>
                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                NFT #{agent.tokenId}
                              </span>
                              {agent.isOwner && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                  Owner
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{agent.description}</p>
                            
                            <div className="flex flex-wrap gap-1 mt-3">
                              <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                {agent.model}
                              </span>
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                {nftService.weiToEth(agent.metadata.usageCost)} MATIC/use
                              </span>
                              {agent.metadata.isForRent && (
                                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                  For Rent
                                </span>
                              )}
                              {(agent.rentalBalance || 0) > 0 && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                  {agent.rentalBalance} rental uses left
                                </span>
                              )}
                              {!agent.isOwner && (sessionUsesRemaining.get(agent.tokenId) || 0) > 0 && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  🎉 {sessionUsesRemaining.get(agent.tokenId) || 0} uses left
                                </span>
                              )}
                              
                              {/* Tool capabilities */}
                              {agent.toolConfig?.enableWebSearch && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                  🌐 Web Search
                                </span>
                              )}
                              {agent.toolConfig?.enableCodeExecution && (
                                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                  💻 Code Exec
                                </span>
                              )}
                              {agent.toolConfig?.enableBrowserAutomation && (
                                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                  🤖 Browser
                                </span>
                              )}
                              {agent.toolConfig?.enableWolframAlpha && (
                                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                  🧮 Wolfram
                                </span>
                              )}
                              {agent.toolConfig?.enableStreaming && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  ⚡ Streaming
                                </span>
                              )}
                              {agent.toolConfig?.responseFormat === 'json_object' && (
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                  📄 JSON
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Regular Agents */}
              {agents.length > 0 && (
                <div>
                  <h4 className="text-md font-medium text-blue-800 mb-3">🤖 Regular Agents</h4>
                  <div className="space-y-3">
                    {agents.map((agent, index) => (
                      <div 
                        key={`${agent.id}-${index}`}
                        onClick={() => setSelectedAgent(agent)}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedAgent?.id === agent.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{agent.name}</h4>
                            <p className="text-sm text-gray-600 mt-1">{agent.description}</p>
                            
                            <div className="flex flex-wrap gap-1 mt-3">
                              <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                {agent.model}
                              </span>
                              {agent.enableWebSearch && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                  Web Search
                                </span>
                              )}
                              {agent.enableCodeExecution && (
                                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                  Code Exec
                                </span>
                              )}
                              {agent.enableBrowserAutomation && (
                                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                  Browser
                                </span>
                              )}
                              {agent.enableWolframAlpha && (
                                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                  Wolfram
                                </span>
                              )}
                              {agent.enableStreaming && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  Streaming
                                </span>
                              )}
                              {agent.responseFormat === 'json_object' && (
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                  JSON
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Agent Details */}
        {(selectedAgent || selectedNFTAgent) && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Agent Configuration</h3>
            
            <div className="space-y-3 text-sm">
              <div>
                <strong className="text-gray-700">Model:</strong>
                <span className="ml-2 text-gray-600">{selectedAgent?.model || selectedNFTAgent?.model}</span>
              </div>
              <div>
                <strong className="text-gray-700">Temperature:</strong>
                <span className="ml-2 text-gray-600">{selectedAgent?.temperature || selectedNFTAgent?.toolConfig?.temperature}</span>
              </div>
              <div>
                <strong className="text-gray-700">Max Tokens:</strong>
                <span className="ml-2 text-gray-600">{selectedAgent?.maxTokens || selectedNFTAgent?.toolConfig?.maxTokens}</span>
              </div>
              <div>
                <strong className="text-gray-700">Response Format:</strong>
                <span className="ml-2 text-gray-600">{selectedAgent?.responseFormat || selectedNFTAgent?.toolConfig?.responseFormat}</span>
              </div>
              
              {/* Tool capabilities */}
              <div>
                <strong className="text-gray-700">Enabled Tools:</strong>
                <div className="ml-2 mt-1 flex flex-wrap gap-1">
                  {(selectedAgent?.enableWebSearch || selectedNFTAgent?.toolConfig?.enableWebSearch) && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">🌐 Web Search</span>
                  )}
                  {(selectedAgent?.enableCodeExecution || selectedNFTAgent?.toolConfig?.enableCodeExecution) && (
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">💻 Code Exec</span>
                  )}
                  {(selectedAgent?.enableBrowserAutomation || selectedNFTAgent?.toolConfig?.enableBrowserAutomation) && (
                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">🤖 Browser</span>
                  )}
                  {(selectedAgent?.enableWolframAlpha || selectedNFTAgent?.toolConfig?.enableWolframAlpha) && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">🧮 Wolfram</span>
                  )}
                  {(selectedAgent?.enableStreaming || selectedNFTAgent?.toolConfig?.enableStreaming) && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">⚡ Streaming</span>
                  )}
                  {((selectedAgent?.responseFormat === 'json_object') || (selectedNFTAgent?.toolConfig?.responseFormat === 'json_object')) && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">📄 JSON</span>
                  )}
                </div>
              </div>
              
              {(selectedAgent?.customInstructions && selectedAgent.customInstructions.length > 0) && (
                <div>
                  <strong className="text-gray-700">Custom Instructions:</strong>
                  <ul className="ml-4 mt-1 text-gray-600">
                    {selectedAgent.customInstructions.map((instruction, i) => (
                      <li key={i} className="text-xs">• {instruction}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {(selectedAgent?.guardrails && selectedAgent.guardrails.length > 0) && (
                <div>
                  <strong className="text-gray-700">Guardrails:</strong>
                  <ul className="ml-4 mt-1 text-gray-600">
                    {selectedAgent.guardrails.map((guardrail, i) => (
                      <li key={i} className="text-xs">• {guardrail}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(selectedAgent?.isNFT || selectedNFTAgent) && (
                <div className="p-3 bg-purple-50 rounded-lg">
                  <strong className="text-purple-700">NFT Details:</strong>
                  <div className="mt-1 text-xs text-purple-600">
                    <div>Usage Cost: {selectedAgent ? `$${selectedAgent.usageCost}` : `${nftService.weiToEth(selectedNFTAgent!.metadata.usageCost)} MATIC`}</div>
                    <div>Max Daily Usage: {selectedAgent?.maxUsagesPerDay || selectedNFTAgent?.metadata.maxUsagesPerDay}</div>
                    {selectedNFTAgent && (
                      <div>Token ID: #{selectedNFTAgent.tokenId}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Chat History */}
        {address && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">💬 Chat History</h3>
              <button
                onClick={refreshChats}
                disabled={loadingChats}
                className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors disabled:opacity-50"
                title="Refresh chat list"
              >
                {loadingChats ? '⏳' : '🔄'} Refresh
              </button>
            </div>
            
            {loadingChats ? (
              <p className="text-gray-500 text-center py-4">Loading chats...</p>
            ) : userChats.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500">No chats yet for {selectedAgent?.name || 'this agent'}</p>
                <p className="text-xs text-gray-400 mt-2">Start a conversation with {selectedAgent?.name || 'this agent'} to create your first chat!</p>
                <p className="text-xs text-gray-400 mt-1">Chats are stored in Lighthouse for wallet: {address.slice(0, 6)}...{address.slice(-4)}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {userChats.map((chat) => (
                  <div 
                    key={chat.id}
                    onClick={() => {
                      setCurrentChat(chat);
                      loadChatMessages(chat);
                    }}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      currentChat?.id === chat.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-gray-900">
                          {agents.find(a => a.id === chat.agentId)?.name || 'Unknown Agent'}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          {chat.messages.length} messages
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(chat.updatedAt).toLocaleDateString()}
                        </p>
                        {chat.cid && (
                          <p className="text-xs text-gray-400 mt-1 font-mono">
                            CID: {chat.cid.slice(0, 8)}...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Interface */}
      <div className="lg:col-span-2 space-y-6">
        {/* Execution History */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">
                  Chat with {selectedAgent?.name || selectedNFTAgent?.name || 'No Agent Selected'}
                </h3>
                {address && (
                  <p className="text-sm text-gray-500 font-mono">
                    Wallet: {address.slice(0, 6)}...{address.slice(-4)}
                  </p>
                )}
                {currentChat && (
                  <p className="text-sm text-blue-600 mt-1">
                    📝 Viewing stored chat: {currentChat.messages.length} messages
                  </p>
                )}
                {selectedNFTAgent && !selectedNFTAgent.isOwner && (sessionUsesRemaining.get(selectedNFTAgent.tokenId) || 0) > 0 && (
                  <p className="text-sm text-green-600 mt-1">
                    🎉 {sessionUsesRemaining.get(selectedNFTAgent.tokenId) || 0} rental uses left!
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {executionHistory.length > 0 && (
                  <div className="flex items-center gap-2">
                    {ReactMarkdown && (
                      <button
                        onClick={() => setShowMarkdown(!showMarkdown)}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          showMarkdown 
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title={showMarkdown ? 'Switch to Plain Text' : 'Switch to Markdown'}
                      >
                        {showMarkdown ? '📝 Markdown' : '📄 Plain Text'}
                      </button>
                    )}
                    {!ReactMarkdown && (
                      <div className="text-xs text-gray-500 px-2 py-1 bg-yellow-50 rounded border border-yellow-200">
                        📝 Install markdown packages for rich formatting
                      </div>
                    )}
                    <button
                      onClick={clearHistory}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Clear History
                    </button>
                    {currentChat && (
                      <button
                        onClick={() => {
                          setCurrentChat(null);
                          setExecutionHistory([]);
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800"
                        title="Exit stored chat view"
                      >
                        Exit Chat View
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="h-96 overflow-y-auto p-6">
            {executionHistory.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                {currentChat ? (
                  <div className="text-center">
                    <p>No messages in this stored chat</p>
                    <p className="text-sm text-gray-400 mt-2">This chat appears to be empty</p>
                  </div>
                ) : selectedAgent ? (
                  `Start a conversation with ${selectedAgent.name}`
                ) : (
                  'Select an agent to begin testing'
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {executionHistory.map((item, i) => (
                  <div key={i} className="space-y-3">
                    {/* User Message */}
                    <div className="flex justify-end">
                      <div className="max-w-xs lg:max-w-md px-4 py-2 bg-blue-600 text-white rounded-lg">
                        <p className="text-sm">{item.input}</p>
                      </div>
                    </div>

                    {/* Agent Response */}
                    <div className="flex justify-start">
                      <div className="max-w-xs lg:max-w-md">
                        <div className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg">
                          {showMarkdown && ReactMarkdown ? (
                            <div className="text-sm prose prose-sm max-w-none prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-code:bg-gray-200 prose-code:px-1 prose-code:rounded">
                              <ReactMarkdown
                                remarkPlugins={remarkGfm ? [remarkGfm] : []}
                                rehypePlugins={rehypeHighlight ? [rehypeHighlight] : []}
                                components={{
                                  // Custom styling for different markdown elements
                                  code: ({ inline, className, children, ...props }: { inline?: boolean; className?: string; children: React.ReactNode; [key: string]: unknown }) => {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                      <pre className="bg-gray-800 text-gray-100 p-3 rounded-lg overflow-x-auto">
                                        <code className={className} {...props}>
                                          {children}
                                        </code>
                                      </pre>
                                    ) : (
                                      <code className="bg-gray-200 px-1 py-0.5 rounded text-xs" {...props}>
                                        {children}
                                      </code>
                                    );
                                  },
                                  // Style links
                                  a: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
                                    <a
                                      {...props}
                                      className="text-blue-600 hover:text-blue-800 underline"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {children}
                                    </a>
                                  ),
                                  // Style tables
                                  table: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
                                    <div className="overflow-x-auto my-4">
                                      <table className="min-w-full border border-gray-300" {...props}>
                                        {children}
                                      </table>
                                    </div>
                                  ),
                                  th: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
                                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 font-semibold text-left" {...props}>
                                      {children}
                                    </th>
                                  ),
                                  td: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
                                    <td className="border border-gray-300 px-2 py-1" {...props}>
                                      {children}
                                    </td>
                                  ),
                                  // Style blockquotes
                                  blockquote: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
                                    <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4" {...props}>
                                      {children}
                                    </blockquote>
                                  ),
                                  // Style lists
                                  ul: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
                                    <ul className="list-disc list-inside space-y-1" {...props}>
                                      {children}
                                    </ul>
                                  ),
                                  ol: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
                                    <ol className="list-decimal list-inside space-y-1" {...props}>
                                      {children}
                                    </ol>
                                  ),
                                  // Style headings
                                  h1: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
                                    <h1 className="text-lg font-bold mb-2" {...props}>
                                      {children}
                                    </h1>
                                  ),
                                  h2: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
                                    <h2 className="text-base font-bold mb-2" {...props}>
                                      {children}
                                    </h2>
                                  ),
                                  h3: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
                                    <h3 className="text-sm font-bold mb-1" {...props}>
                                      {children}
                                    </h3>
                                  ),
                                }}
                              >
                                {item.response.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <div className="text-sm whitespace-pre-wrap">
                              {item.response.content}
                            </div>
                          )}
                        </div>
                        
                        {/* Response Metadata */}
                        <div className="mt-2 px-2 text-xs text-gray-500">
                          <div className="flex justify-between">
                            <span>Tokens: {item.response.tokenUsage.totalTokens}</span>
                            <span>Time: {item.response.executionTime}ms</span>
                          </div>
                          {item.response.toolsUsed.length > 0 && (
                            <div className="mt-1">
                              Tools used: {item.response.toolsUsed.join(', ')}
                            </div>
                          )}
                          <div className="mt-1">
                            Cost: ${item.response.cost.toFixed(6)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-6 border-t border-gray-200">
            <div className="flex space-x-3">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isExecuting && (selectedAgent ? executeAgent() : selectedNFTAgent ? executeNFTAgent() : null)}
                disabled={(!selectedAgent && !selectedNFTAgent) || isExecuting}
                placeholder={
                  (!selectedAgent && !selectedNFTAgent)
                    ? "Select an agent first..." 
                    : "Type your message..."
                }
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
              <button
                onClick={selectedAgent ? executeAgent : selectedNFTAgent ? executeNFTAgent : undefined}
                disabled={(!selectedAgent && !selectedNFTAgent) || !userInput.trim() || isExecuting}
                className={`px-6 py-2 text-white rounded-lg font-medium transition-colors ${
                  selectedNFTAgent 
                    ? 'bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400'
                    : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400'
                }`}
              >
                {isExecuting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Running...</span>
                  </div>
                ) : (
                  selectedNFTAgent ? 'Send (NFT)' : 'Send'
                )}
              </button>
            </div>

            {(selectedAgent || selectedNFTAgent) && (
              <div className="mt-3 space-y-1">
                <div className="text-xs text-gray-500">
                  <strong>Model:</strong> {selectedAgent?.model || selectedNFTAgent?.model} | 
                  <strong>Temperature:</strong> {selectedAgent?.temperature || selectedNFTAgent?.toolConfig?.temperature} | 
                  <strong>Max Tokens:</strong> {selectedAgent?.maxTokens || selectedNFTAgent?.toolConfig?.maxTokens}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(selectedAgent?.enableWebSearch || selectedNFTAgent?.toolConfig?.enableWebSearch) && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">🌐 Web Search</span>
                  )}
                  {(selectedAgent?.enableCodeExecution || selectedNFTAgent?.toolConfig?.enableCodeExecution) && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">💻 Code Exec</span>
                  )}
                  {(selectedAgent?.enableBrowserAutomation || selectedNFTAgent?.toolConfig?.enableBrowserAutomation) && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">❌ Browser (N/A)</span>
                  )}
                  {(selectedAgent?.enableWolframAlpha || selectedNFTAgent?.toolConfig?.enableWolframAlpha) && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">❌ Wolfram (N/A)</span>
                  )}
                  {(selectedAgent?.enableStreaming || selectedNFTAgent?.toolConfig?.enableStreaming) && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">⚡ Streaming</span>
                  )}
                  {(selectedAgent?.responseFormat === 'json_object' || selectedNFTAgent?.toolConfig?.responseFormat === 'json_object') && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">📄 JSON</span>
                  )}
                  {((selectedAgent?.customInstructions && selectedAgent.customInstructions.length > 0) || (selectedNFTAgent?.customInstructions && selectedNFTAgent.customInstructions.length > 0)) && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                      📋 {(selectedAgent?.customInstructions?.length || selectedNFTAgent?.customInstructions?.length || 0)} Custom Rules
                    </span>
                  )}
                  {((selectedAgent?.guardrails && selectedAgent.guardrails.length > 0) || (selectedNFTAgent?.guardrails && selectedNFTAgent.guardrails.length > 0)) && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                      🚨 {(selectedAgent?.guardrails?.length || selectedNFTAgent?.guardrails?.length || 0)} Guardrails
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Test Prompts */}
        {selectedAgent && (
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-md font-semibold mb-3">Quick Test Prompts</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {/* Base Prompts */}
              <button
                onClick={() => setUserInput("Hello! Can you introduce yourself and tell me what you can do?")}
                className="text-left p-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border text-gray-700 transition-colors"
              >
                👋 Introduction & Capabilities
              </button>
              
              {/* Feature-Specific Prompts */}
              {selectedAgent.enableWebSearch && (
                <button
                  onClick={() => setUserInput("Search for the latest news about artificial intelligence and summarize the top 3 stories")}
                  className="text-left p-2 text-sm bg-green-50 hover:bg-green-100 rounded border text-green-700 transition-colors"
                >
                  🌐 Test Browser Search
                </button>
              )}

              {selectedAgent.enableCodeExecution && (
                <button
                  onClick={() => setUserInput("Write and execute a Python function to calculate the first 10 fibonacci numbers and show the result")}
                  className="text-left p-2 text-sm bg-purple-50 hover:bg-purple-100 rounded border text-purple-700 transition-colors"
                >
                  💻 Test Code Interpreter
                </button>
              )}

              {/* Note: Browser automation and Wolfram Alpha are not available in GroqCloud's current API */}
              {(selectedAgent.enableBrowserAutomation || selectedAgent.enableWolframAlpha) && (
                <div className="col-span-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                  ⚠️ Note: Browser automation and Wolfram Alpha are not currently available in GroqCloud's API format. 
                  Only Browser Search and Code Interpreter are supported.
                </div>
              )}

              {selectedAgent.responseFormat === 'json_object' && (
                <button
                  onClick={() => setUserInput("Return a JSON object with your name, model, enabled features, and a sample task you can perform")}
                  className="text-left p-2 text-sm bg-yellow-50 hover:bg-yellow-100 rounded border text-yellow-700 transition-colors"
                >
                  📄 Test JSON Response
                </button>
              )}

              {/* Model-specific prompts */}
              {selectedAgent.model.includes('compound') && (
                <button
                  onClick={() => setUserInput("Use multiple tools to research the current price of Bitcoin, write code to calculate percentage change, and explain the market trend")}
                  className="text-left p-2 text-sm bg-indigo-50 hover:bg-indigo-100 rounded border text-indigo-700 transition-colors"
                >
                  🔧 Test Multi-Tool Usage (Compound)
                </button>
              )}

              {/* Temperature-specific prompts */}
              {selectedAgent.temperature > 0.8 && (
                <button
                  onClick={() => setUserInput("Write a creative story about an AI that discovers it can use tools")}
                  className="text-left p-2 text-sm bg-pink-50 hover:bg-pink-100 rounded border text-pink-700 transition-colors"
                >
                  🎨 Test Creativity (High Temp)
                </button>
              )}

              {selectedAgent.temperature < 0.3 && (
                <button
                  onClick={() => setUserInput("Provide a detailed, step-by-step analysis of how machine learning algorithms work")}
                  className="text-left p-2 text-sm bg-blue-50 hover:bg-blue-100 rounded border text-blue-700 transition-colors"
                >
                  🎯 Test Precision (Low Temp)
                </button>
              )}

              {/* General prompts */}
              <button
                onClick={() => setUserInput("What&apos;s 2^10 + 5*7? Show your work.")}
                className="text-left p-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border text-gray-700 transition-colors"
              >
                🔢 Basic Math Test
              </button>

              {ReactMarkdown ? (
                <button
                  onClick={() => setUserInput("Create a comprehensive markdown document explaining how to set up a Python environment. Include headings, code blocks, lists, links, and tables.")}
                  className="text-left p-2 text-sm bg-green-50 hover:bg-green-100 rounded border text-green-700 transition-colors"
                >
                  📝 Test Markdown Rendering
                </button>
              ) : (
                <button
                  onClick={() => setUserInput("Create a well-structured guide explaining how to set up a Python environment. Use clear sections, code examples, and bullet points for organization.")}
                  className="text-left p-2 text-sm bg-green-50 hover:bg-green-100 rounded border text-green-700 transition-colors"
                >
                  📝 Test Structured Response
                </button>
              )}

              {selectedAgent.customInstructions && selectedAgent.customInstructions.length > 0 && (
                <button
                  onClick={() => setUserInput("Please demonstrate how you follow your custom instructions with an example")}
                  className="text-left p-2 text-sm bg-indigo-50 hover:bg-indigo-100 rounded border text-indigo-700 transition-colors"
                >
                  📋 Test Custom Instructions
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}