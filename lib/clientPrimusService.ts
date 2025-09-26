"use client";
import { PrimusZKTLS } from "@primuslabs/zktls-js-sdk";
import { lighthouseService } from './lighthouseService';

export interface VerificationResult {
  success: boolean;
  attestation: unknown;
  userAddress: string;
  error?: string;
}

export interface SignedRequest {
  success: boolean;
  signedRequestStr: string;
  appId: string;
  userAddress: string;
  message: string;
  error?: string;
}

export class ClientPrimusService {
  private primusZKTLS: PrimusZKTLS | null = null;
  private appId: string | null = null;

  async initPrimus(appId: string): Promise<void> {
    if (!this.primusZKTLS || this.appId !== appId) {
      console.log('🔧 Creating client-side PrimusZKTLS instance...');
      this.primusZKTLS = new PrimusZKTLS();
      this.appId = appId;
      
      // Client-side initialization (without secret key)
      console.log('⏳ Initializing Primus client-side...');
      await this.primusZKTLS.init(appId);
      console.log('✅ Client-side Primus initialized');
    } else {
      console.log('♻️ Using existing client-side PrimusZKTLS instance');
    }
  }

  async handleAttestation(signedRequestStr: string, appId: string): Promise<VerificationResult> {
    try {
      console.log('🔄 Client-side attestation starting...');
      
      await this.initPrimus(appId);
      
      if (!this.primusZKTLS) {
        throw new Error('PrimusZKTLS client not initialized');
      }

      console.log('⏳ Starting attestation (client-side)...');
      const attestation = await this.primusZKTLS.startAttestation(signedRequestStr);
      console.log('✅ Attestation completed:', attestation ? 'has data' : 'null');

      console.log('⏳ Verifying attestation (client-side)...');
      const verifyResult = await this.primusZKTLS.verifyAttestation(attestation);
      console.log('✅ Verification completed:', verifyResult);

      return {
        success: verifyResult === true,
        attestation,
        userAddress: '', // Will be set by caller
      };

    } catch (error) {
      console.error('💥 Client-side attestation error:', error);
      return {
        success: false,
        attestation: null,
        userAddress: '',
        error: error instanceof Error ? error.message : 'Unknown attestation error'
      };
    }
  }

  async verifyUserIdentity(userAddress: string, forceRefresh: boolean = false): Promise<VerificationResult> {
    try {
      console.log('🚀 Starting verification flow for wallet:', userAddress);
      
      // Validate wallet address format
      if (!userAddress || !userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error('Invalid wallet address format');
      }

      // Step 0: Check for cached verification (unless force refresh)
      if (!forceRefresh) {
        console.log('🔍 Checking for cached verification...');
        const cachedVerification = await lighthouseService.getVerification(userAddress);
        
        if (cachedVerification && cachedVerification.verificationResult.success) {
          console.log('✅ Using cached verification for:', userAddress);
          return {
            ...cachedVerification.verificationResult,
            userAddress
          };
        }
        
        console.log('📭 No valid cached verification found, proceeding with fresh verification');
      } else {
        console.log('🔄 Force refresh requested, skipping cache check');
      }
      
      // Step 1: Get signed request from backend (secure)
      console.log('⏳ Getting signed request from backend API...');
      const backendResponse = await fetch('/api/primus-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userAddress }),
      });

      if (!backendResponse.ok) {
        throw new Error(`Backend error: ${backendResponse.status} ${backendResponse.statusText}`);
      }

      const signedRequestData: SignedRequest = await backendResponse.json();
      
      if (!signedRequestData.success) {
        const errorMessage = signedRequestData.error || 'Failed to get signed request from backend';
        const isConfigError = errorMessage.includes('not configured') || errorMessage.includes('environment variable');
        
        if (isConfigError) {
          throw new Error('Primus verification is not configured. Please contact the administrator to set up verification.');
        } else {
          throw new Error(errorMessage);
        }
      }

      console.log('✅ Got signed request from backend for wallet:', userAddress);

      // Step 2: Handle attestation client-side (browser APIs required)
      console.log('⏳ Processing attestation client-side...');
      const attestationResult = await this.handleAttestation(
        signedRequestData.signedRequestStr,
        signedRequestData.appId
      );

      const finalResult = {
        ...attestationResult,
        userAddress
      };

      // Step 3: Cache successful verification in Lighthouse
      if (finalResult.success) {
        console.log('💾 Caching successful verification in Lighthouse...');
        try {
          const verificationCache = lighthouseService.createVerificationCache(
            userAddress,
            finalResult,
            24 // Cache for 24 hours
          );
          
          const cid = await lighthouseService.storeVerification(verificationCache);
          console.log('✅ Verification cached successfully with CID:', cid);
        } catch (cacheError) {
          console.warn('⚠️ Failed to cache verification (non-critical):', cacheError);
          // Don't fail the verification if caching fails
        }
      }

      return finalResult;

    } catch (error) {
      console.error('💥 Verification flow error for wallet:', userAddress, error);
      return {
        success: false,
        attestation: null,
        userAddress,
        error: error instanceof Error ? error.message : 'Unknown verification error'
      };
    }
  }

  /**
   * Clear cached verification for a user (useful for logout)
   */
  async clearVerificationCache(userAddress: string): Promise<boolean> {
    try {
      console.log('🗑️ Clearing verification cache for:', userAddress);
      return await lighthouseService.deleteVerification(userAddress);
    } catch (error) {
      console.error('💥 Error clearing verification cache:', error);
      return false;
    }
  }
}

// Export singleton instance
export const clientPrimusService = new ClientPrimusService();

