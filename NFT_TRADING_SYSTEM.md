# AI Agent NFT Trading System

This document describes the implementation of the NFT trading system for AI Agents in the Veritas platform.

## Overview

The system allows users to:
- **Mint AI Agents as NFTs** by default when creating agents
- **Buy AI Agent NFTs** from other users (full ownership transfer)
- **Rent AI Agent NFTs** for temporary usage (pay-per-use)
- **Trade AI Agents** on the marketplace with proper ownership management

## Architecture

### Smart Contract (`contracts/AIAgentNFT.sol`)

The `AIAgentNFT` contract extends OpenZeppelin's ERC721 with additional functionality:

- **Agent Metadata**: Stores agent configuration, pricing, and rental information
- **Ownership Transfer**: Standard NFT ownership transfer with proper tracking
- **Rental System**: Users can rent agents for a specific number of uses
- **Usage Tracking**: Tracks daily usage limits and rental balances
- **Payment Handling**: Manages both rental payments and usage costs

### Key Features

1. **Minting**: Agents are automatically minted as NFTs when created
2. **Ownership**: Clear ownership tracking with transfer capabilities
3. **Rental**: Non-owners can rent agents for temporary usage
4. **Usage Costs**: Both owners and renters pay inference costs per use
5. **Daily Limits**: Enforced usage limits per day for renters

## Implementation Details

### Agent Creation Flow

1. User creates agent in `AgentBuilder`
2. Agent is stored in Lighthouse IPFS
3. NFT is automatically minted with agent metadata
4. Agent becomes available for trading/rental

### Trading Flow

1. **Purchase**: User A buys NFT from User B
   - NFT ownership transfers to User A
   - User B loses access to the agent
   - User A gains full ownership rights

2. **Rental**: User A rents agent from User B
   - User A pays rental fee for specific number of uses
   - User A can use agent within their rental balance
   - User B retains ownership

### Usage Flow

1. **Owner Usage**: Pay only inference costs
2. **Renter Usage**: Pay inference costs + consume rental balance
3. **Payment Modal**: Shows costs before execution
4. **Blockchain Integration**: All payments handled via smart contract

## File Structure

```
contracts/
├── AIAgentNFT.sol          # Main NFT contract
scripts/
├── deploy-nft.ts           # Deployment script
lib/
├── nftService.ts           # Frontend NFT service
components/
├── AgentBuilder.tsx        # Updated with NFT minting
├── AgentMarketplace.tsx    # Updated with NFT trading
├── AgentExecutor.tsx       # Updated with NFT usage
```

## Environment Variables

Add to your `.env.local`:

```env
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0x... # Deployed contract address
LIGHTHOUSE_API_KEY=your_lighthouse_key
```

## Deployment

1. Install dependencies:
   ```bash
   npm install
   ```

2. Compile contracts:
   ```bash
   npm run compile
   ```

3. Deploy to local network:
   ```bash
   npm run deploy
   ```

4. Deploy to Sepolia:
   ```bash
   npm run deploy:sepolia
   ```

## Usage

### Creating NFT Agents

1. Go to `/app/create`
2. Fill in agent configuration
3. Enable "Mint as INFT" (default)
4. Set rental options if desired
5. Create agent - NFT is automatically minted

### Trading Agents

1. Go to `/app/marketplace`
2. Browse available NFT agents
3. Purchase for full ownership or rent for temporary usage
4. Use agents in `/app/chat`

### Using Agents

1. Go to `/app/chat`
2. Select an NFT agent
3. Pay usage costs (owners pay less, renters pay more)
4. Execute agent with your input

## Key Benefits

1. **True Ownership**: NFT owners have exclusive rights to their agents
2. **Monetization**: Agents can be sold and rented for profit
3. **Decentralized**: No central authority controls agent access
4. **Transparent**: All transactions on blockchain
5. **Flexible**: Both ownership and rental models supported

## Security Considerations

1. **Ownership Verification**: All operations verify NFT ownership
2. **Payment Security**: All payments handled by smart contract
3. **Usage Limits**: Daily limits prevent abuse
4. **Access Control**: Only owners/renters can use agents

## Future Enhancements

1. **Auction System**: Bidding for rare agents
2. **Royalty System**: Creators earn from secondary sales
3. **Agent Collections**: Grouped agent packages
4. **Advanced Rental**: Time-based rentals
5. **Governance**: Community voting on agent policies
