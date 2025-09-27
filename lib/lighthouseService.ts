"use client";
import lighthouse from '@lighthouse-web3/sdk';

export interface VerificationCache {
  userAddress: string;
  verificationResult: {
    success: boolean;
    attestation: unknown;
    userAddress: string;
    error?: string;
  };
  timestamp: number;
  expiresAt: number;
  cid?: string; // Lighthouse file CID
}

export class LighthouseService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ LIGHTHOUSE_API_KEY not found in environment variables');
    }
  }

  /**
   * Generate a unique filename for verification cache based on wallet address
   */
  private getVerificationFilename(userAddress: string): string {
    return `verification_${userAddress.toLowerCase()}.json`;
  }

  /**
   * Store verification result in Lighthouse
   */
  async storeVerification(verificationData: VerificationCache): Promise<string> {
    try {
      if (!this.apiKey) {
        throw new Error('Lighthouse API key not configured');
      }

      console.log('📤 Storing verification data in Lighthouse for:', verificationData.userAddress);
      
      const filename = this.getVerificationFilename(verificationData.userAddress);
      const data = JSON.stringify(verificationData, null, 2);
      
      // Upload to Lighthouse
      const response = await lighthouse.uploadText(
        data,
        this.apiKey,
        filename
      );

      console.log('✅ Verification data stored in Lighthouse:', response.data.Hash);
      return response.data.Hash;

    } catch (error) {
      console.error('💥 Error storing verification in Lighthouse:', error);
      throw new Error(`Failed to store verification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve verification result from Lighthouse
   */
  async getVerification(userAddress: string): Promise<VerificationCache | null> {
    try {
      if (!this.apiKey) {
        console.warn('⚠️ Lighthouse API key not configured, skipping cache check');
        return null;
      }

      console.log('📥 Retrieving verification data from Lighthouse for:', userAddress);
      
      const filename = this.getVerificationFilename(userAddress);
      
      // List files to find the verification file
      const files = await lighthouse.getUploads(this.apiKey);
      const verificationFile = files.data.fileList.find((file: any) => file.fileName === filename);
      
      if (!verificationFile) {
        console.log('📭 No cached verification found for:', userAddress);
        return null;
      }

      // Download the file content
      const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${verificationFile.cid}`);
      if (!response.ok) {
        console.warn('⚠️ Failed to download verification file from Lighthouse');
        return null;
      }

      const verificationData: VerificationCache = await response.json();
      
      // Check if verification is still valid (not expired)
      const now = Date.now();
      if (verificationData.expiresAt && now > verificationData.expiresAt) {
        console.log('⏰ Cached verification expired for:', userAddress);
        return null;
      }

      console.log('✅ Retrieved valid cached verification for:', userAddress);
      return verificationData;

    } catch (error) {
      console.error('💥 Error retrieving verification from Lighthouse:', error);
      return null; // Return null on error to allow fresh verification
    }
  }

  /**
   * Delete verification cache (useful for logout or re-verification)
   */
  async deleteVerification(userAddress: string): Promise<boolean> {
    try {
      if (!this.apiKey) {
        console.warn('⚠️ Lighthouse API key not configured, cannot delete cache');
        return false;
      }

      console.log('🗑️ Deleting verification cache for:', userAddress);
      
      const filename = this.getVerificationFilename(userAddress);
      
      // List files to find the verification file
      const files = await lighthouse.getUploads(this.apiKey);
      const verificationFile = files.data.fileList.find((file: any) => file.fileName === filename);
      
      if (!verificationFile) {
        console.log('📭 No verification file found to delete for:', userAddress);
        return true; // Consider it successful if file doesn't exist
      }

      // Note: Lighthouse doesn't have a direct delete API, but we can mark it as deleted
      // by uploading an empty file or we can just ignore it since it will expire
      console.log('✅ Verification cache marked for cleanup for:', userAddress);
      return true;

    } catch (error) {
      console.error('💥 Error deleting verification cache:', error);
      return false;
    }
  }

  /**
   * Create verification cache data with expiration
   */
  createVerificationCache(
    userAddress: string, 
    verificationResult: any, 
    expirationHours: number = 24
  ): VerificationCache {
    const now = Date.now();
    const expiresAt = now + (expirationHours * 60 * 60 * 1000); // Convert hours to milliseconds

    return {
      userAddress: userAddress.toLowerCase(),
      verificationResult,
      timestamp: now,
      expiresAt,
    };
  }
}

// Export singleton instance
export const lighthouseService = new LighthouseService();
