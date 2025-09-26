"use client";
import { WalletConnection } from '@/components/WalletConnection';
import { AuthGuard } from '@/components/AuthGuard';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navigation = [
    { name: 'Dashboard', href: '/app', current: pathname === '/app' },
    { name: 'Create Agent', href: '/app/create', current: pathname === '/app/create' },
    { name: 'Chat', href: '/app/chat', current: pathname === '/app/chat' },
    { name: 'Marketplace', href: '/app/marketplace', current: pathname === '/app/marketplace' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with wallet connection - always visible */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">🤖 Veritas AI Platform</h1>
                <p className="text-gray-600">Create, deploy, and monetize custom AI agents</p>
              </div>
              
              {/* Navigation */}
              <nav className="hidden md:flex space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      item.current
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>
            
            <WalletConnection />
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden bg-white border-b">
        <div className="px-4 py-2 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                item.current
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>
      </div>
      
      {/* Main content with auth guard */}
      <AuthGuard>
        {children}
      </AuthGuard>
    </div>
  );
}

