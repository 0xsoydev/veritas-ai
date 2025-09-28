"use client";
import Link from 'next/link';
import Image from 'next/image';
import { useWallet } from '@/lib/wallet-context';
import { Button } from '@/components/ui/button';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Navbar() {
  const { address, isVerified, isVerifying, error, verifyUser } = useWallet();

  return (
    <nav className="border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-[10px] py-6 px-4 mb-8 mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo/Brand */}
          <div className="flex items-center space-x-4">
            <Link href="/app" className="flex items-center space-x-2">
              <Image 
                src="/veritas-main.svg" 
                alt="Veritas Logo" 
                width={120} 
                height={40}
                className="h-8 w-auto"
              />
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            <Link 
              href="/app" 
              className="text-black text-lg hover:text-main transition-colors font-dmsans-semibold"
            >
              Dashboard
            </Link>
            <Link 
              href="/app/create" 
              className="text-black text-lg font-dmsans-semibold hover:text-main transition-colors"
            >
              Create
            </Link>
            <Link 
              href="/app/chat" 
              className="text-black text-lg font-dmsans-semibold hover:text-main transition-colors"
            >
              Chat
            </Link>
            <Link 
              href="/app/marketplace" 
              className="text-black text-lg font-dmsans-semibold hover:text-main transition-colors"
            >
              Marketplace
            </Link>
          </div>

          {/* Wallet Connection */}
          <div className="flex items-center space-x-4">
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
              }) => {
                const ready = mounted && authenticationStatus !== 'loading';
                const connected =
                  ready &&
                  account &&
                  chain &&
                  (!authenticationStatus ||
                    authenticationStatus === 'authenticated');

                return (
                  <div
                    {...(!ready && {
                      'aria-hidden': true,
                      'style': {
                        opacity: 0,
                        pointerEvents: 'none',
                        userSelect: 'none',
                      },
                    })}
                  >
                    {(() => {
                      if (!connected) {
                        return (
                          <Button
                            onClick={openConnectModal}
                            className="bg-main text-main-foreground border-2 border-black font-bold uppercase hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                          >
                            CONNECT WALLET
                          </Button>
                        );
                      }

                      if (chain.unsupported) {
                        return (
                          <Button
                            onClick={openChainModal}
                            className="bg-red-500 text-white border-2 border-black font-bold uppercase hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                          >
                            WRONG NETWORK
                          </Button>
                        );
                      }

                      return (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={openChainModal}
                            className="flex items-center space-x-1 px-3 py-2 border-2 border-black bg-white rounded-[5px] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                          >
                            {chain.hasIcon && (
                              <div className="w-5 h-5">
                                {chain.iconUrl && (
                                  <Image
                                    alt={chain.name ?? 'Chain icon'}
                                    src={chain.iconUrl}
                                    width={20}
                                    height={20}
                                    className="w-5 h-5"
                                  />
                                )}
                              </div>
                            )}
                          </button>
                          <button
                            onClick={openAccountModal}
                            className="px-3 py-2 border-2 border-black bg-main text-main-foreground rounded-[5px] font-bold text-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                          >
                            {account.displayName}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              }}
            </ConnectButton.Custom>
            
            {address && !isVerified && !isVerifying && (
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => verifyUser()}
                  className="px-3 py-1 bg-main hover:bg-main/80 text-main-foreground text-sm rounded-[5px] font-bold border-2 border-black transition-all"
                >
                  VERIFY IDENTITY
                </Button>
                {error && (
                  <div className="flex flex-col items-end">
                    <span className="text-red-600 text-xs max-w-xs truncate font-bold" title={error}>
                      {error}
                    </span>
                    <button
                      onClick={() => verifyUser()}
                      className="text-main text-xs hover:text-main/80 underline font-bold"
                    >
                      TRY AGAIN
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden mt-4 pt-4 border-t-2 border-black">
          <div className="flex flex-col space-y-3">
            <Link 
              href="/app" 
              className="text-black font-dmsans-bold uppercase tracking-wide hover:text-main transition-colors py-2"
            >
              DASHBOARD
            </Link>
            <Link 
              href="/app/create" 
              className="text-black font-dmsans-bold uppercase tracking-wide hover:text-main transition-colors py-2"
            >
              CREATE
            </Link>
            <Link 
              href="/app/chat" 
              className="text-black font-dmsans-bold uppercase tracking-wide hover:text-main transition-colors py-2"
            >
              CHAT
            </Link>
            <Link 
              href="/app/marketplace" 
              className="text-black font-dmsans-bold uppercase tracking-wide hover:text-main transition-colors py-2"
            >
              MARKETPLACE
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
