"use client"
import { useState, useEffect, useCallback } from 'react';
import { AgentResponse, ExecutionContext } from '@/lib/groqService';
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
  const [selectedAgent] = useState<StoredAgent | null>(null);
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

  // Function to sync rental uses from smart contract
  const syncRentalUsesFromContract = useCallback(async () => {
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
  }, [address, onRentalUsesUpdated]);

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

  // const executeAgent = async () => {
  //   if (!selectedAgent || !userInput.trim()) return;

  //   setIsExecuting(true);

  //   try {
  //     const context: ExecutionContext = {
  //       userId: 'demo-user',
  //       sessionId: `session-${Date.now()}`,
  //       timestamp: Date.now(),
  //       metadata: {
  //         userAgent: navigator.userAgent,
  //         timestamp: new Date().toISOString()
  //       }
  //     };

  //     const response = await groqClient.executeAgent(selectedAgent, userInput, context);
      
  //     // Add to execution history
  //     setExecutionHistory(prev => [...prev, {
  //       input: userInput,
  //       response,
  //       timestamp: Date.now()
  //     }]);

  //     // Save to chat storage if user is connected
  //     if (address) {
  //       try {
  //         console.log('💬 Starting chat storage for address:', address);
  //         let chatToUse = currentChat;
          
  //         // Create new chat if none exists
  //         if (!chatToUse) {
  //           console.log('💬 Creating new chat for agent:', selectedAgent.id);
  //           const newChat = agentStorageService.createChat(selectedAgent.id, address);
  //           // Store the chat in Lighthouse first
  //           const cid = await agentStorageService.storeChat(newChat);
  //           const storedChat = { ...newChat, cid };
  //           console.log('💬 Chat stored with CID:', cid);
            
  //           setCurrentChat(storedChat);
  //           // Check if chat already exists before adding to prevent duplicates
  //           setUserChats(prev => {
  //             const exists = prev.some(chat => chat.id === storedChat.id);
  //             if (exists) {
  //               console.log('💬 Chat already exists in list, not adding duplicate');
  //               return prev;
  //             }
  //             return [storedChat, ...prev];
  //           });
  //           chatToUse = storedChat;
  //         } else {
  //           console.log('💬 Using existing chat:', chatToUse.id);
  //         }

  //         // Add user message
  //         console.log('💬 Adding user message to chat:', chatToUse.id);
  //         await agentStorageService.addMessageToChat(chatToUse.id, address, 'user', userInput);

  //         // Add assistant response
  //         console.log('💬 Adding assistant response to chat:', chatToUse.id);
  //         await agentStorageService.addMessageToChat(chatToUse.id, address, 'assistant', response.content);

  //         // Update current chat with new messages
  //         console.log('💬 Updating chat with new messages');
  //         const updatedChat = await agentStorageService.getChat(chatToUse.id, address);
  //         if (updatedChat) {
  //           console.log('💬 Chat updated successfully, messages count:', updatedChat.messages.length);
  //           setCurrentChat(updatedChat);
  //           // Update the chat in the userChats list, ensuring no duplicates
  //           setUserChats(prev => {
  //             const updatedList = prev.map(chat => 
  //               chat.id === chatToUse.id ? updatedChat : chat
  //             );
  //             // Remove any potential duplicates by ID
  //             const uniqueChats = updatedList.filter((chat, index, self) => 
  //               index === self.findIndex(c => c.id === chat.id)
  //             );
  //             return uniqueChats;
  //           });
  //         } else {
  //           console.warn('💬 Failed to retrieve updated chat');
  //         }
  //       } catch (storageError) {
  //         console.error('💬 Failed to save chat to storage:', storageError);
  //         // Continue execution even if storage fails
  //       }
  //     } else {
  //       console.log('💬 No wallet address, skipping chat storage');
  //     }

  //     setUserInput('');
  //   } catch (error: unknown) {
  //     alert(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  //   } finally {
  //     setIsExecuting(false);
  //   }
  // };

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

  // const clearSession = () => {
  //   setSessionUsesRemaining(new Map());
  // };

  // Expose sync function to parent components
  useEffect(() => {
    if (onRentalUsesUpdated) {
      // Store the sync function in a way that parent can access it
      (window as any).syncRentalUsesFromContract = syncRentalUsesFromContract;
    }
  }, [onRentalUsesUpdated, syncRentalUsesFromContract]);

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
        <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] p-6">
          <h3 className="text-lg font-bricolage-bold text-black mb-4">Select Agent to Test</h3>
          
          {nftAgents.length === 0 ? (
            <p className="text-black text-center py-8 font-dmsans-medium">
              No NFT agents available. Create an agent first!
            </p>
          ) : (
            <div className="space-y-4">
              {/* NFT Agents */}
              {nftAgents.length > 0 && (
                <div>
                  <h4 className="text-md font-bricolage-bold text-blacktext-gray-600">🎫 NFT Agents</h4>
                  <div className="space-y-3">
                    {nftAgents.map((agent) => (
                      <div 
                        key={`nft-${agent.tokenId}`}
                        onClick={() => setSelectedNFTAgent(agent)}
                        className={`p-4 border-2 border-black rounded-[5px] cursor-pointer transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none ${
                          selectedNFTAgent?.tokenId === agent.tokenId
                            ? 'bg-main text-main-foreground'
                            : 'bg-background hover:bg-lime-200'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className={`font-bricolage-bold ${selectedNFTAgent?.tokenId === agent.tokenId ? 'text-main-foreground' : 'text-black'}`}>{agent.name}</h4>
                              <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">
                                #{agent.tokenId}
                              </span>
                              {agent.isOwner && (
                                <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">
                                  Owner
                                </span>
                              )}
                            </div>
                            <p className={`text-sm mt-1 font-dmsans-medium ${selectedNFTAgent?.tokenId === agent.tokenId ? 'text-main-foreground' : 'text-black'}`}>{agent.description}</p>
                            
                            <div className="flex flex-wrap gap-1 mt-3">
                              <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">
                                {agent.model}
                              </span>
                              <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">
                                {nftService.weiToEth(agent.metadata.usageCost)} MATIC/use
                              </span>
                              {agent.metadata.isForRent && (
                                <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">
                                  For Rent
                                </span>
                              )}
                              {(agent.rentalBalance || 0) > 0 && (
                                <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">
                                  {agent.rentalBalance} rental uses left
                                </span>
                              )}
                              {!agent.isOwner && (sessionUsesRemaining.get(agent.tokenId) || 0) > 0 && (
                                <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">
                                  🎉 {sessionUsesRemaining.get(agent.tokenId) || 0} uses left
                                </span>
                              )}
                              
                              {/* Tool capabilities */}
                              {agent.toolConfig?.enableWebSearch && (
                                <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">
                                  🌐 Web Search
                                </span>
                              )}
                              {agent.toolConfig?.enableCodeExecution && (
                                <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">
                                  💻 Code Exec
                                </span>
                              )}
                              {agent.toolConfig?.enableBrowserAutomation && (
                                <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">
                                  🤖 Browser
                                </span>
                              )}
                              {agent.toolConfig?.enableWolframAlpha && (
                                <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">
                                  🧮 Wolfram
                                </span>
                              )}
                              {agent.toolConfig?.enableStreaming && (
                                <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">
                                  ⚡ Streaming
                                </span>
                              )}
                              {agent.toolConfig?.responseFormat === 'json_object' && (
                                <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">
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

            </div>
          )}
        </div>

        {/* Agent Details */}
        {(selectedAgent || selectedNFTAgent) && (
          <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] p-6">
            <h3 className="text-lg font-bricolage-bold text-black mb-4">Agent Configuration</h3>
            
            <div className="space-y-3 text-sm">
              <div>
                <strong className="text-black font-bricolage-bold">Model:</strong>
                <span className="ml-2 text-black font-dmsans-medium">{selectedAgent?.model || selectedNFTAgent?.model}</span>
              </div>
              <div>
                <strong className="text-black font-bricolage-bold">Temperature:</strong>
                <span className="ml-2 text-black font-dmsans-medium">{selectedAgent?.temperature || selectedNFTAgent?.toolConfig?.temperature}</span>
              </div>
              <div>
                <strong className="text-black font-bricolage-bold">Max Tokens:</strong>
                <span className="ml-2 text-black font-dmsans-medium">{selectedAgent?.maxTokens || selectedNFTAgent?.toolConfig?.maxTokens}</span>
              </div>
              <div>
                <strong className="text-black font-bricolage-bold">Response Format:</strong>
                <span className="ml-2 text-black font-dmsans-medium">{selectedAgent?.responseFormat || selectedNFTAgent?.toolConfig?.responseFormat}</span>
              </div>
              
              {/* Tool capabilities */}
              <div>
                <strong className="text-black font-bricolage-bold">Enabled Tools:</strong>
                <div className="ml-2 mt-1 flex flex-wrap gap-1">
                  {(selectedAgent?.enableWebSearch || selectedNFTAgent?.toolConfig?.enableWebSearch) && (
                    <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">🌐 Web Search</span>
                  )}
                  {(selectedAgent?.enableCodeExecution || selectedNFTAgent?.toolConfig?.enableCodeExecution) && (
                    <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">💻 Code Exec</span>
                  )}
                  {(selectedAgent?.enableBrowserAutomation || selectedNFTAgent?.toolConfig?.enableBrowserAutomation) && (
                    <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">🤖 Browser</span>
                  )}
                  {(selectedAgent?.enableWolframAlpha || selectedNFTAgent?.toolConfig?.enableWolframAlpha) && (
                    <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">🧮 Wolfram</span>
                  )}
                  {(selectedAgent?.enableStreaming || selectedNFTAgent?.toolConfig?.enableStreaming) && (
                    <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">⚡ Streaming</span>
                  )}
                  {((selectedAgent?.responseFormat === 'json_object') || (selectedNFTAgent?.toolConfig?.responseFormat === 'json_object')) && (
                    <span className="text-xs bg-white text-black px-2 py-1 rounded-[3px] font-bricolage-bold border border-black">📄 JSON</span>
                  )}
                </div>
              </div>
              
              {(selectedAgent?.customInstructions && selectedAgent.customInstructions.length > 0) && (
                <div>
                  <strong className="text-black font-bricolage-bold">Custom Instructions:</strong>
                  <ul className="ml-4 mt-1 text-black font-dmsans-medium">
                    {selectedAgent.customInstructions.map((instruction, i) => (
                      <li key={i} className="text-xs">• {instruction}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {(selectedAgent?.guardrails && selectedAgent.guardrails.length > 0) && (
                <div>
                  <strong className="text-black font-bricolage-bold">Guardrails:</strong>
                  <ul className="ml-4 mt-1 text-black font-dmsans-medium">
                    {selectedAgent.guardrails.map((guardrail, i) => (
                      <li key={i} className="text-xs">• {guardrail}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(selectedAgent?.isNFT || selectedNFTAgent) && (
                <div className="p-3 bg-background border-2 border-black rounded-[5px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <strong className="text-black font-bricolage-bold">NFT Details:</strong>
                  <div className="mt-1 text-xs text-black font-dmsans-medium">
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
          <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bricolage-bold text-black">💬 Chat History</h3>
              <button
                onClick={refreshChats}
                disabled={loadingChats}
                className="text-xs px-3 py-2 bg-white hover:bg-gray-50 text-black rounded-[5px] font-bricolage-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                title="Refresh chat list"
              >
                {loadingChats ? '⏳' : '🔄'} Refresh
              </button>
            </div>
            
            {loadingChats ? (
              <p className="text-black text-center py-4 font-dmsans-medium">Loading chats...</p>
            ) : userChats.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-black font-dmsans-medium">No chats yet for {selectedAgent?.name || 'this agent'}</p>
                <p className="text-xs text-black mt-2 font-dmsans-medium">Start a conversation with {selectedAgent?.name || 'this agent'} to create your first chat!</p>
                <p className="text-xs text-black mt-1 font-dmsans-medium">Chats are stored in Lighthouse for wallet: {address.slice(0, 6)}...{address.slice(-4)}</p>
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
                    className={`p-3 border-2 border-black rounded-[5px] cursor-pointer transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none ${
                      currentChat?.id === chat.id
                        ? 'bg-main text-main-foreground'
                        : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className={`font-bricolage-bold text-sm ${currentChat?.id === chat.id ? 'text-main-foreground' : 'text-black'}`}>
                          {agents.find(a => a.id === chat.agentId)?.name || 'Unknown Agent'}
                        </h4>
                        <p className={`text-xs mt-1 font-dmsans-medium ${currentChat?.id === chat.id ? 'text-main-foreground' : 'text-black'}`}>
                          {chat.messages.length} messages
                        </p>
                        <p className={`text-xs mt-1 font-dmsans-medium ${currentChat?.id === chat.id ? 'text-main-foreground' : 'text-black'}`}>
                          {new Date(chat.updatedAt).toLocaleDateString()}
                        </p>
                        {chat.cid && (
                          <p className={`text-xs mt-1 font-mono ${currentChat?.id === chat.id ? 'text-main-foreground' : 'text-black'}`}>
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
      <div className="lg:col-span-2">
        {/* Chat Header */}
        <div className="bg-main border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] pt-4 pb-6 pl-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-3xl font-bricolage-bold text-black mb-4">
                Chat with {selectedAgent?.name || selectedNFTAgent?.name || 'No Agent Selected'}
              </h3>
              {/* {address && (
                <p className="text-sm text-black font-mono font-dmsans-medium">
                  Wallet: {address.slice(0, 6)}...{address.slice(-4)}
                </p>
              )} */}
              {currentChat && (
                <p className="text-sm text-black mt-1 font-dmsans-medium">
                  📝 Viewing stored chat: {currentChat.messages.length} messages
                </p>
              )}
              {selectedNFTAgent && !selectedNFTAgent.isOwner && (sessionUsesRemaining.get(selectedNFTAgent.tokenId) || 0) > 0 && (
                <p className="text-sm text-black mt-1 font-dmsans-medium">
                  🎉 {sessionUsesRemaining.get(selectedNFTAgent.tokenId) || 0} rental uses left!
                </p>
              )}
            </div>
            {executionHistory.length > 0 && (
              <div className="flex items-center gap-2">
                {ReactMarkdown && (
                  <button
                    onClick={() => setShowMarkdown(!showMarkdown)}
                    className={`text-xs px-3 py-2 rounded-[5px] font-bricolage-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all ${
                      showMarkdown 
                        ? 'bg-main text-main-foreground' 
                        : 'bg-white text-black hover:bg-gray-50'
                    }`}
                    title={showMarkdown ? 'Switch to Plain Text' : 'Switch to Markdown'}
                  >
                    {showMarkdown ? '📝 Markdown' : '📄 Plain Text'}
                  </button>
                )}
                {!ReactMarkdown && (
                  <div className="text-sm text-black px-3 py-2 bg-background rounded-[5px] border-2 border-black font-dmsans-medium">
                    📝 Install markdown packages for rich formatting
                  </div>
                )}
                <button
                  onClick={clearHistory}
                  className="text-sm text-black hover:text-red-600 font-bricolage-bold px-3 py-2 mr-4 bg-white border-2 border-black rounded-[5px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
                >
                  Clear History
                </button>
                {currentChat && (
                  <button
                    onClick={() => {
                      setCurrentChat(null);
                      setExecutionHistory([]);
                    }}
                    className="text-sm text-black hover:text-blue-600 font-bricolage-bold px-3 py-2 bg-white border-2 border-black rounded-[5px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
                    title="Exit stored chat view"
                  >
                    Exit Chat View
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Execution History */}
        <div className="bg-white border-3 -mt-7 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px]">
          <div className="h-[60svh] overflow-y-auto p-6">
            {executionHistory.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                {currentChat ? (
                  <div className="text-center p-6 bg-background border-2 border-black rounded-[10px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <p className="text-black font-dmsans-medium">No messages in this stored chat</p>
                    <p className="text-sm text-black mt-2 font-dmsans-medium">This chat appears to be empty</p>
                  </div>
                ) : selectedAgent ? (
                  <div className="text-center p-6 bg-background border-2 border-black rounded-[10px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <p className="text-black font-dmsans-medium">Start a conversation with {selectedAgent.name}</p>
                  </div>
                ) : (
                  <div className="text-center p-6 bg-background border-2 border-black rounded-[10px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <p className="text-black font-dmsans-medium">Select an agent to begin testing</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {executionHistory.map((item, i) => (
                  <div key={i} className="space-y-4">
                    {/* User Message */}
                    <div className="flex justify-end">
                      <div className="max-w-xs lg:max-w-md px-4 py-3 bg-main text-main-foreground border-2 border-black rounded-[10px]">
                        <p className="text-sm font-dmsans-medium">{item.input}</p>
                      </div>
                    </div>

                    {/* Agent Response */}
                    <div className="flex justify-start">
                      <div className="max-w-xs lg:max-w-md">
                        <div className="px-4 py-3 bg-white text-black border-2 border-black rounded-[10px]">
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
                            <div className="text-sm whitespace-pre-wrap font-dmsans-medium">
                              {item.response.content}
                            </div>
                          )}
                        </div>
                        
                        {/* Response Metadata */}
                        <div className="mt-2 text-xs text-gray-500 font-dmsans-medium">
                          <div className="flex justify-between">
                            <span>Tokens: {item.response.tokenUsage.totalTokens}</span>
                            <span>Time: {item.response.executionTime}ms</span>
                            <span>Cost: ${item.response.cost.toFixed(6)}</span>
                          </div>
                          {item.response.toolsUsed.length > 0 && (
                            <div className="mt-1">
                              Tools: {item.response.toolsUsed.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-6  border-black">
            <div className="flex items-center space-x-3">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isExecuting && (selectedNFTAgent ? executeNFTAgent() : null)}
                disabled={!selectedNFTAgent || isExecuting}
                placeholder={
                  !selectedNFTAgent
                    ? "Select an NFT agent first..." 
                    : "Type your message..."
                }
                className="flex-1 px-6 py-4 border-2 border-black rounded-full focus:ring-2 focus:ring-main disabled:bg-gray-100 font-dmsans-medium"
              />
              <button
                onClick={selectedNFTAgent ? executeNFTAgent : undefined}
                disabled={!selectedNFTAgent || !userInput.trim() || isExecuting}
                className={`w-12 h-12 text-white rounded-full font-bricolage-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all disabled:bg-gray-400 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center ${
                  selectedNFTAgent 
                    ? 'bg-main hover:bg-main/80'
                    : 'bg-main hover:bg-main/80'
                }`}
              >
                {isExecuting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <svg 
                    className="w-5 h-5" 
                    fill="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                )}
              </button>
            </div>

            {selectedNFTAgent && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-1">
                  {selectedNFTAgent?.toolConfig?.enableWebSearch && (
                    <span className="text-xs bg-white text-black px-2 py-0.5 rounded-[3px] font-bricolage-bold border border-black">🌐 Web Search</span>
                  )}
                  {selectedNFTAgent?.toolConfig?.enableCodeExecution && (
                    <span className="text-xs bg-white text-black px-2 py-0.5 rounded-[3px] font-bricolage-bold border border-black">💻 Code Exec</span>
                  )}
                  {selectedNFTAgent?.toolConfig?.enableBrowserAutomation && (
                    <span className="text-xs bg-white text-black px-2 py-0.5 rounded-[3px] font-bricolage-bold border border-black">❌ Browser (N/A)</span>
                  )}
                  {selectedNFTAgent?.toolConfig?.enableWolframAlpha && (
                    <span className="text-xs bg-white text-black px-2 py-0.5 rounded-[3px] font-bricolage-bold border border-black">❌ Wolfram (N/A)</span>
                  )}
                  {selectedNFTAgent?.toolConfig?.enableStreaming && (
                    <span className="text-xs bg-white text-black px-2 py-0.5 rounded-[3px] font-bricolage-bold border border-black">⚡ Streaming</span>
                  )}
                  {selectedNFTAgent?.toolConfig?.responseFormat === 'json_object' && (
                    <span className="text-xs bg-white text-black px-2 py-0.5 rounded-[3px] font-bricolage-bold border border-black">📄 JSON</span>
                  )}
                  {selectedNFTAgent?.customInstructions && selectedNFTAgent.customInstructions.length > 0 && (
                    <span className="text-xs bg-white text-black px-2 py-0.5 rounded-[3px] font-bricolage-bold border border-black">
                      📋 {selectedNFTAgent.customInstructions.length} Custom Rules
                    </span>
                  )}
                  {selectedNFTAgent?.guardrails && selectedNFTAgent.guardrails.length > 0 && (
                    <span className="text-xs bg-white text-black px-2 py-0.5 rounded-[3px] font-bricolage-bold border border-black">
                      🚨 {selectedNFTAgent.guardrails.length} Guardrails
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>


      </div>
    </div>
  );
}