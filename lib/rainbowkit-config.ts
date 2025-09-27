import { getDefaultWallets } from '@rainbow-me/rainbowkit';
import { createConfig, http } from 'wagmi';
import { mainnet, polygon, arbitrum, optimism, base, sepolia, localhost } from 'wagmi/chains';

// Define Polygon Amoy chain
const polygonAmoy = {
  id: 80002,
  name: 'Polygon Amoy',
  nativeCurrency: {
    decimals: 18,
    name: 'MATIC',
    symbol: 'MATIC',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc-amoy.polygon.technology'],
    },
    public: {
      http: ['https://rpc-amoy.polygon.technology'],
    },
  },
  blockExplorers: {
    default: {
      name: 'PolygonScan Amoy',
      url: 'https://amoy.polygonscan.com',
    },
  },
  testnet: true,
} as const;

// Define localhost chain with correct Chain ID
const localhostChain = {
  id: 31337,
  name: 'Localhost',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
    },
    public: {
      http: ['http://127.0.0.1:8545'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Local Explorer',
      url: 'http://localhost:8545',
    },
  },
  testnet: true,
} as const;

const { connectors } = getDefaultWallets({
  appName: 'Veritas AI Agent Platform',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'your-project-id',
});

export const config = createConfig({
  chains: [mainnet, polygon, arbitrum, optimism, base, sepolia, polygonAmoy, localhostChain],
  connectors,
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
    [polygonAmoy.id]: http(),
    [localhostChain.id]: http('http://127.0.0.1:8545'),
  },
  ssr: true,
});
