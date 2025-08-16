import { NextRequest, NextResponse } from "next/server";
import { 
  SelfBackendVerifier, 
  DefaultConfigStore,
  AllIds, VerificationConfig
} from '@selfxyz/core';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: NextRequest) {
  console.log("=== Self.xyz Verification Request ===");
  
  try {
    const body = await req.json();
    console.log("Request body:", JSON.stringify(body, null, 2));
    
    const { 
      attestationId, 
      proof, 
      publicSignals, 
      pubSignals, 
      userContextData 
    } = body;
    
    // Handle both parameter naming conventions
    const signals = publicSignals || pubSignals;
    
    console.log("Extracted parameters:");
    console.log("- attestationId:", attestationId);
    console.log("- proof:", proof ? "present" : "missing");
    console.log("- publicSignals:", publicSignals ? "present" : "missing");
    console.log("- pubSignals:", pubSignals ? "present" : "missing");
    console.log("- signals (final):", signals ? "present" : "missing");
    console.log("- userContextData:", userContextData ? "present" : "missing");
    console.log("- All body keys:", Object.keys(body));
    

    if (!proof || !signals || !attestationId || !userContextData) {
      console.log("❌ Missing required parameters");
      
      
      return NextResponse.json({
        status: 'error',
        result: false,
        reason: "Proof, publicSignals, attestationId and userContextData are required",
        error_code: "INVALID_INPUTS"
      }, { 
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    const disclosures_config: VerificationConfig = {
      excludedCountries: [],
      ofac: false,
      minimumAge: 5,
    };

    const configStore = new DefaultConfigStore(disclosures_config);

    const selfBackendVerifier = new SelfBackendVerifier(
      "hyumane",
      "https://hyumane.vercel.app/api/verify",
      true, // dev mode
      AllIds,
      configStore,
      "uuid", // user ID type as string
    );

    const result = await selfBackendVerifier.verify(
      attestationId,
      proof,
      signals,
      userContextData
    );
    
    if (!result.isValidDetails.isValid) {
      return NextResponse.json({
        status: "error",
        result: false,
        reason: "Verification failed",
        error_code: "VERIFICATION_FAILED",
        details: result.isValidDetails,
      }, { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    if (result.isValidDetails.isValid) {
      return NextResponse.json({
        status: "success",
        result: result.isValidDetails.isValid,
        credentialSubject: result.discloseOutput,
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    } else {
      return NextResponse.json({
        status: "error",
        result: result.isValidDetails.isValid,
        reason: "Verification failed",
        error_code: "VERIFICATION_FAILED",
        details: result,
      }, { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
  } catch (error) {
    console.error("Error verifying proof:", error);
    return NextResponse.json({
      status: "error",
      result: false,
      reason: "Internal Error",
      error_code: "INTERNAL_ERROR"
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
}
