"use client";
import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Home() {
  const [currentText, setCurrentText] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const texts = ['that work.', 'that are useful.', 'that earn.'];

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentText((prev) => (prev + 1) % texts.length);
        setIsVisible(true);
      }, 300);
    }, 3000);

    return () => clearInterval(interval);
  }, [texts.length]);

  return (
    <div className="min-h-screen bg-none">
      {/* Hero Section */}
      <section className="py-16 px-4 bg-lime-300 rounded-xl h-[50svh] border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {/* Call to Action */}
          <div>
            <h1 className="flex flex-col text-7xl font-bricolage-bold leading-tight mb-6">
              Create AI Agents
              <span 
                className={`text-7xl transition-all duration-500 ease-in-out ${
                  isVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4'
                }`}
              >
                {texts[currentText]}
              </span>
            </h1>
            <p className="text-xl font-dmsans-medium mb-8 leading-relaxed">
              Build, deploy, and monetize custom AI agents with blockchain verification. 
              No coding required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/app/create">
                <button className="bg-black text-white px-8 py-4 rounded-lg font-bricolage-semibold text-lg shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:shadow-[0px_0px_0px_0px_rgba(255,255,255,1)] hover:translate-x-1 hover:translate-y-1 transition-all duration-200 border-2 border-black">
                  START BUILDING
                </button>
              </Link>
              <Link href="/app/marketplace">
                <button className="bg-secondary-background text-foreground px-8 py-4 rounded-lg font-bricolage-semibold text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 transition-all duration-200 border-2 border-black">
                  VIEW MARKETPLACE
                </button>
              </Link>
            </div>
          </div>

          {/* Robot Image */}
          <div className="flex items-center justify-center">
            <Image 
              src="/robot.png" 
              alt="AI Agent Robot" 
              width={600} 
              height={600}
              className="max-w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* Marquee Section */}
      <section className="py-8 mt-6 rounded-lg bg-black text-white overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          <div className="flex items-center space-x-8 text-2xl font-bricolage-bold">
            <span>Trusted Information</span>
            <span className="text-chart-1">•</span>
            <span>zkTLS Verified</span>
            <span className="text-chart-1">•</span>
            <span>Monetize your Agents</span>
            <span className="text-chart-1">•</span>
            <span>Trusted Information</span>
            <span className="text-chart-1">•</span>
            <span>zkTLS Verified</span>
            <span className="text-chart-1">•</span>
            <span>MONETIZE YOUR AGENTS</span>
            <span className="text-chart-1">•</span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bricolage-bold text-center mb-12">
            FEATURES
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-lime-300 text-main-foreground p-8 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black">
              <div className="w-16 h-16 bg-white rounded-lg mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black flex items-center justify-center">
                <span className="text-2xl font-bricolage-bold text-main">1</span>
              </div>
              <h3 className="text-2xl font-bricolage-bold mb-4">zkTLS POWERED VERIFICATION</h3>
              <p className="font-dmsans-medium leading-relaxed">
                Every wallet is cryptographically verified using zero-knowledge proofs 
                and TLS verification, ensuring complete authenticity and preventing tampering.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-lime-300 text-main-foreground p-8 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black">
              <div className="w-16 h-16 bg-white rounded-lg mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black flex items-center justify-center">
                <span className="text-2xl font-bricolage-bold text-main">2</span>
              </div>
              <h3 className="text-2xl font-bricolage-bold mb-4">TRUSTED INFORMATION</h3>
              <p className="font-dmsans-medium leading-relaxed">
                Every wallet on our platform represents a verified human creator. 
                Our identity verification ensures all AI agents are created by real people, 
                not bots or automated systems.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-lime-300 text-main-foreground p-8 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black">
              <div className="w-16 h-16 bg-white rounded-lg mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black flex items-center justify-center">
                <span className="text-2xl font-bricolage-bold text-main">3</span>
              </div>
              <h3 className="text-2xl font-bricolage-bold mb-4">MONETIZE AGENTS</h3>
              <p className="font-dmsans-medium leading-relaxed">
                Turn your AI agents into revenue streams. Sell them on our marketplace 
                or offer them as services to users worldwide.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}