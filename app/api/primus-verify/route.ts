import { PrimusZKTLS } from "@primuslabs/zktls-js-sdk";
import { NextRequest, NextResponse } from 'next/server';

let primusZKTLS: PrimusZKTLS | null = null;

async function initPrimus() {
  if (!primusZKTLS) {
    console.log('🔧 Creating new PrimusZKTLS instance...');
    primusZKTLS = new PrimusZKTLS();
    
    const appId = process.env.NEXT_PUBLIC_PRIMUS_APP_ID;
    const appSecret = process.env.PRIMUS_SECRET_KEY;
    
    console.log('🔑 Environment variables check:');
    console.log('   - NEXT_PUBLIC_PRIMUS_APP_ID:', appId ? 'SET' : 'MISSING');
    console.log('   - PRIMUS_SECRET_KEY:', appSecret ? 'SET' : 'MISSING');
    
    if (!appId) {
      throw new Error('NEXT_PUBLIC_PRIMUS_APP_ID environment variable is not set');
    }
    if (!appSecret) {
      throw new Error('PRIMUS_SECRET_KEY environment variable is not set');
    }
    
    console.log('⏳ Calling primusZKTLS.init() with credentials...');
    await primusZKTLS.init(appId, appSecret);
    console.log('✅ PrimusZKTLS initialization completed');
  } else {
    console.log('♻️ Using existing PrimusZKTLS instance');
  }
  return primusZKTLS;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 API Route: Starting primus-verify request (server-side only)');
    
    const { userAddress } = await request.json();
    console.log('📍 User address received:', userAddress);
    
    // Check if environment variables are set
    const appId = process.env.NEXT_PUBLIC_PRIMUS_APP_ID;
    const appSecret = process.env.PRIMUS_SECRET_KEY;
    
    if (!appId || !appSecret) {
      console.error('❌ Missing Primus environment variables');
      return NextResponse.json(
        { 
          success: false,
          error: 'Primus verification is not configured. Please set NEXT_PUBLIC_PRIMUS_APP_ID and PRIMUS_SECRET_KEY environment variables.',
          message: 'Contact administrator to set up Primus verification'
        },
        { status: 503 }
      );
    }
    
    console.log('⏳ Initializing Primus...');
    const primus = await initPrimus();
    console.log('✅ Primus initialized successfully');
    
    const attTemplateID = "9859330b-b94f-47a4-8f13-0ca56dabe273";
    console.log('📋 Using attestation template ID:', attTemplateID);
    
    console.log('⏳ Generating request parameters...');
    const requestParams = primus.generateRequestParams(attTemplateID, userAddress);
    requestParams.setAttMode({ algorithmType: "proxytls" });
    console.log('✅ Request parameters generated');
    
    console.log('⏳ Converting to JSON and signing...');
    const requestStr = requestParams.toJsonString();
    const signedRequestStr = await primus.sign(requestStr);
    console.log('✅ Request signed successfully');
    
    // Return signed request to client for attestation (browser-only operations)
    const response = {
      success: true,
      signedRequestStr,
      appId: process.env.NEXT_PUBLIC_PRIMUS_APP_ID,
      userAddress,
      message: 'Signed request ready for client-side attestation'
    };
    
    console.log('📤 Sending signed request to client for attestation');
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('💥 API Route Error:', error);
    console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return more specific error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isConfigError = errorMessage.includes('environment variable') || errorMessage.includes('not set');
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        message: isConfigError ? 'Primus verification is not properly configured' : 'Verification failed'
      },
      { status: isConfigError ? 503 : 500 }
    );
  }
}
