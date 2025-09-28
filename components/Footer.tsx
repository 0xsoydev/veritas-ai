import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="mt-16">
      <div className="border-4 border-b-0 rounded-t-[10px] p-8 min-h-[200px]" style={{ backgroundColor: '#191A23' }}>
        {/* Main Content Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          {/* Left Column - Branding and Navigation */}
          <div className="space-y-6">
            {/* Logo and Navigation Links */}
            <div className="flex items-start gap-8">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <Image 
                  src="/veritas-white.svg" 
                  alt="Veritas Logo" 
                  width={120} 
                  height={40}
                  className="h-8 w-auto"
                />
              </div>
              
              {/* Navigation Links */}
              <div className="space-y-2">
                <div className="text-white text-sm font-dmsans-medium tracking-wide hover:text-gray-300 cursor-pointer pt-1 pb-1">
                  Dashboard
                </div>
                <div className="text-white text-sm font-dmsans-medium tracking-wide hover:text-gray-300 cursor-pointer pt-1 pb-1">
                  Marketplace
                </div>
                <div className="text-white text-sm font-dmsans-medium tracking-wide hover:text-gray-300 cursor-pointer pt-1 pb-1">
                  Create Agent
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column - Certifications */}
          <div className="space-y-6">
            {/* Certifications */}
            <div className="space-y-2">
              <div className="text-white font-bricolage-bold text-sm tracking-wide">
                Powered By
              </div>
              <div className="flex gap-3 flex-wrap">
                <div className="bg-neutral-500 border-2 rounded-[5px] px-3 py-2">
                  <div className="text-white font-bricolage-bold text-xs uppercase tracking-wide">
                    POLYGON
                  </div>
                </div>
                <div className="bg-neutral-500 border-2 rounded-[5px] px-3 py-2">
                  <div className="text-white font-bricolage-bold text-xs uppercase tracking-wide">
                    PRIMUS ZKTLS
                  </div>
                </div>
                <div className="bg-neutral-500 border-2 rounded-[5px] px-3 py-2">
                  <div className="text-white font-bricolage-bold text-xs uppercase tracking-wide">
                    LIGHTHOUSE STORAGE
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom Section - Legal and Copyright */}
        <div className="border-t-1 border-neutral-700 pt-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-neutral-500 font-dmsans-medium text-xs">
              © 2024 VERITAS. All trademarks used on this platform are the property of VERITAS. All rights reserved.
            </div>
            <div className="flex gap-4">
              <div className="text-neutral-500 text-xs font-dmsans-medium uppercase tracking-wide hover:text-gray-300 cursor-pointer">
                Privacy Policy
              </div>
              <div className="text-neutral-500 text-xs font-dmsans-medium uppercase tracking-wide hover:text-gray-300 cursor-pointer">
                Terms
              </div>
              <div className="text-neutral-500 text-xs font-dmsans-medium uppercase tracking-wide hover:text-gray-300 cursor-pointer">
                Cookie Policy
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
