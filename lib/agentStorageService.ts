"use client";
import lighthouse from '@lighthouse-web3/sdk';
import { AgentConfig } from './groqService';

export interface StoredAgent extends AgentConfig {
  id: string;
  ownerAddress: string;
  createdAt: number;
  updatedAt: number;
  cid?: string; // Lighthouse file CID
  isPublic: boolean; // Whether agent is available for sale
  price?: number; // Price in ETH for selling
  salesCount: number; // Number of times sold
  totalEarnings: number; // Total earnings from sales
}

export interface StoredChat {
  id: string;
  agentId: string;
  userAddress: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  createdAt: number;
  updatedAt: number;
  cid?: string; // Lighthouse file CID
}

export interface AgentMarketplaceListing {
  agentId: string;
  ownerAddress: string;
  agent: StoredAgent;
  price: number;
  isActive: boolean;
  createdAt: number;
  cid?: string;
}

export class AgentStorageService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ LIGHTHOUSE_API_KEY not found in environment variables');
    }
  }

  // ===== AGENT STORAGE METHODS =====

  /**
   * Generate filename for agent storage
   */
  private getAgentFilename(agentId: string, ownerAddress: string): string {
    return `agent_${ownerAddress.toLowerCase()}_${agentId}.json`;
  }

  /**
   * Store an agent configuration
   */
  async storeAgent(agent: AgentConfig, ownerAddress: string): Promise<string> {
    try {
      if (!this.apiKey) {
        throw new Error('Lighthouse API key not configured');
      }

      console.log('📤 Storing agent in Lighthouse:', agent.name, 'for owner:', ownerAddress);
      
      const storedAgent: StoredAgent = {
        ...agent,
        ownerAddress: ownerAddress.toLowerCase(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPublic: false,
        salesCount: 0,
        totalEarnings: 0,
      };

      const filename = this.getAgentFilename(agent.id, ownerAddress);
      const data = JSON.stringify(storedAgent, null, 2);
      
      const response = await lighthouse.uploadText(
        data,
        this.apiKey,
        filename
      );

      console.log('✅ Agent stored in Lighthouse:', response.data.Hash);
      return response.data.Hash;

    } catch (error) {
      console.error('💥 Error storing agent in Lighthouse:', error);
      throw new Error(`Failed to store agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve an agent by ID and owner
   */
  async getAgent(agentId: string, ownerAddress: string): Promise<StoredAgent | null> {
    try {
      if (!this.apiKey) {
        console.warn('⚠️ Lighthouse API key not configured, cannot retrieve agent');
        return null;
      }

      console.log('📥 Retrieving agent from Lighthouse:', agentId, 'for owner:', ownerAddress);
      
      const filename = this.getAgentFilename(agentId, ownerAddress);
      
      const files = await lighthouse.getUploads(this.apiKey);
      const agentFile = files.data.fileList.find((file: any) => file.fileName === filename);
      
      if (!agentFile) {
        console.log('📭 No agent found:', agentId);
        return null;
      }

      const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${agentFile.cid}`);
      if (!response.ok) {
        console.warn('⚠️ Failed to download agent file from Lighthouse');
        return null;
      }

      const agent: StoredAgent = await response.json();
      console.log('✅ Retrieved agent:', agent.name);
      return agent;

    } catch (error) {
      console.error('💥 Error retrieving agent from Lighthouse:', error);
      return null;
    }
  }

  /**
   * Get all agents for a specific owner
   */
  async getUserAgents(ownerAddress: string): Promise<StoredAgent[]> {
    try {
      if (!this.apiKey) {
        console.warn('⚠️ Lighthouse API key not configured, cannot retrieve agents');
        return [];
      }

      console.log('📥 Retrieving all agents for user:', ownerAddress);
      
      const files = await lighthouse.getUploads(this.apiKey);
      const userAgentFiles = files.data.fileList.filter((file: any) => 
        file.fileName.startsWith(`agent_${ownerAddress.toLowerCase()}_`)
      );

      const agents: StoredAgent[] = [];
      
      for (const file of userAgentFiles) {
        try {
          const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${file.cid}`);
          if (response.ok) {
            const agent: StoredAgent = await response.json();
            agents.push(agent);
          }
        } catch (error) {
          console.warn('⚠️ Failed to load agent file:', file.fileName);
        }
      }

      console.log('✅ Retrieved', agents.length, 'agents for user:', ownerAddress);
      return agents.sort((a, b) => b.updatedAt - a.updatedAt); // Sort by most recent

    } catch (error) {
      console.error('💥 Error retrieving user agents from Lighthouse:', error);
      return [];
    }
  }

  /**
   * Update an existing agent
   */
  async updateAgent(agentId: string, ownerAddress: string, updates: Partial<StoredAgent>): Promise<string> {
    try {
      const existingAgent = await this.getAgent(agentId, ownerAddress);
      if (!existingAgent) {
        throw new Error('Agent not found');
      }

      const updatedAgent: StoredAgent = {
        ...existingAgent,
        ...updates,
        updatedAt: Date.now(),
      };

      return await this.storeAgent(updatedAgent, ownerAddress);

    } catch (error) {
      console.error('💥 Error updating agent:', error);
      throw new Error(`Failed to update agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ===== CHAT STORAGE METHODS =====

  /**
   * Generate filename for chat storage
   */
  private getChatFilename(chatId: string, userAddress: string): string {
    return `chat_${userAddress.toLowerCase()}_${chatId}.json`;
  }

  /**
   * Store a chat conversation
   */
  async storeChat(chat: StoredChat): Promise<string> {
    try {
      if (!this.apiKey) {
        throw new Error('Lighthouse API key not configured');
      }

      console.log('📤 Storing chat in Lighthouse:', chat.id, 'for user:', chat.userAddress);
      
      const filename = this.getChatFilename(chat.id, chat.userAddress);
      const data = JSON.stringify(chat, null, 2);
      
      const response = await lighthouse.uploadText(
        data,
        this.apiKey,
        filename
      );

      console.log('✅ Chat stored in Lighthouse:', response.data.Hash);
      return response.data.Hash;

    } catch (error) {
      console.error('💥 Error storing chat in Lighthouse:', error);
      throw new Error(`Failed to store chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve a chat by ID and user
   */
  async getChat(chatId: string, userAddress: string): Promise<StoredChat | null> {
    try {
      if (!this.apiKey) {
        console.warn('⚠️ Lighthouse API key not configured, cannot retrieve chat');
        return null;
      }

      console.log('📥 Retrieving chat from Lighthouse:', chatId, 'for user:', userAddress);
      
      const filename = this.getChatFilename(chatId, userAddress);
      
      const files = await lighthouse.getUploads(this.apiKey);
      const chatFile = files.data.fileList.find((file: any) => file.fileName === filename);
      
      if (!chatFile) {
        console.log('📭 No chat found:', chatId);
        return null;
      }

      const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${chatFile.cid}`);
      if (!response.ok) {
        console.warn('⚠️ Failed to download chat file from Lighthouse');
        return null;
      }

      const chat: StoredChat = await response.json();
      console.log('✅ Retrieved chat with', chat.messages.length, 'messages');
      return chat;

    } catch (error) {
      console.error('💥 Error retrieving chat from Lighthouse:', error);
      return null;
    }
  }

  /**
   * Get all chats for a specific user
   */
  async getUserChats(userAddress: string): Promise<StoredChat[]> {
    try {
      if (!this.apiKey) {
        console.warn('⚠️ Lighthouse API key not configured, cannot retrieve chats');
        return [];
      }

      console.log('📥 Retrieving all chats for user:', userAddress);
      
      const files = await lighthouse.getUploads(this.apiKey);
      const userChatFiles = files.data.fileList.filter((file: any) => 
        file.fileName.startsWith(`chat_${userAddress.toLowerCase()}_`)
      );

      const chats: StoredChat[] = [];
      
      for (const file of userChatFiles) {
        try {
          const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${file.cid}`);
          if (response.ok) {
            const chat: StoredChat = await response.json();
            chats.push(chat);
          }
        } catch (error) {
          console.warn('⚠️ Failed to load chat file:', file.fileName);
        }
      }

      console.log('✅ Retrieved', chats.length, 'chats for user:', userAddress);
      return chats.sort((a, b) => b.updatedAt - a.updatedAt); // Sort by most recent

    } catch (error) {
      console.error('💥 Error retrieving user chats from Lighthouse:', error);
      return [];
    }
  }

  /**
   * Create a new chat
   */
  createChat(agentId: string, userAddress: string): StoredChat {
    return {
      id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      userAddress: userAddress.toLowerCase(),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Add a message to a chat
   */
  async addMessageToChat(chatId: string, userAddress: string, role: 'user' | 'assistant', content: string): Promise<void> {
    try {
      const chat = await this.getChat(chatId, userAddress);
      if (!chat) {
        throw new Error('Chat not found');
      }

      chat.messages.push({
        role,
        content,
        timestamp: Date.now(),
      });
      chat.updatedAt = Date.now();

      await this.storeChat(chat);

    } catch (error) {
      console.error('💥 Error adding message to chat:', error);
      throw new Error(`Failed to add message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ===== MARKETPLACE METHODS =====

  /**
   * List an agent for sale
   */
  async listAgentForSale(agentId: string, ownerAddress: string, price: number): Promise<string> {
    try {
      const agent = await this.getAgent(agentId, ownerAddress);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const listing: AgentMarketplaceListing = {
        agentId,
        ownerAddress: ownerAddress.toLowerCase(),
        agent,
        price,
        isActive: true,
        createdAt: Date.now(),
      };

      const filename = `marketplace_${agentId}_${ownerAddress.toLowerCase()}.json`;
      const data = JSON.stringify(listing, null, 2);
      
      const response = await lighthouse.uploadText(
        data,
        this.apiKey,
        filename
      );

      // Update agent to be public
      await this.updateAgent(agentId, ownerAddress, { isPublic: true, price });

      console.log('✅ Agent listed for sale:', response.data.Hash);
      return response.data.Hash;

    } catch (error) {
      console.error('💥 Error listing agent for sale:', error);
      throw new Error(`Failed to list agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all agents available for sale
   */
  async getMarketplaceAgents(): Promise<AgentMarketplaceListing[]> {
    try {
      if (!this.apiKey) {
        console.warn('⚠️ Lighthouse API key not configured, cannot retrieve marketplace');
        return [];
      }

      console.log('📥 Retrieving marketplace agents from Lighthouse');
      
      const files = await lighthouse.getUploads(this.apiKey);
      const marketplaceFiles = files.data.fileList.filter((file: any) => 
        file.fileName.startsWith('marketplace_')
      );

      const listings: AgentMarketplaceListing[] = [];
      
      for (const file of marketplaceFiles) {
        try {
          const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${file.cid}`);
          if (response.ok) {
            const listing: AgentMarketplaceListing = await response.json();
            if (listing.isActive) {
              listings.push(listing);
            }
          }
        } catch (error) {
          console.warn('⚠️ Failed to load marketplace listing:', file.fileName);
        }
      }

      console.log('✅ Retrieved', listings.length, 'marketplace listings');
      return listings.sort((a, b) => b.createdAt - a.createdAt); // Sort by most recent

    } catch (error) {
      console.error('💥 Error retrieving marketplace from Lighthouse:', error);
      return [];
    }
  }

  /**
   * Purchase an agent (simplified - in real implementation, this would involve blockchain transactions)
   */
  async purchaseAgent(listing: AgentMarketplaceListing, buyerAddress: string): Promise<StoredAgent> {
    try {
      console.log('🛒 Purchasing agent:', listing.agent.name, 'for', listing.price, 'ETH');
      
      // Create a copy of the agent for the buyer
      const purchasedAgent: StoredAgent = {
        ...listing.agent,
        id: `${listing.agent.id}_${Date.now()}`, // New unique ID
        ownerAddress: buyerAddress.toLowerCase(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPublic: false, // Buyer's copy is private by default
        price: undefined,
        salesCount: 0,
        totalEarnings: 0,
      };

      // Store the purchased agent
      await this.storeAgent(purchasedAgent, buyerAddress);

      // Update original agent's sales count
      await this.updateAgent(listing.agentId, listing.ownerAddress, {
        salesCount: listing.agent.salesCount + 1,
        totalEarnings: listing.agent.totalEarnings + listing.price,
      });

      console.log('✅ Agent purchased successfully');
      return purchasedAgent;

    } catch (error) {
      console.error('💥 Error purchasing agent:', error);
      throw new Error(`Failed to purchase agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const agentStorageService = new AgentStorageService();
