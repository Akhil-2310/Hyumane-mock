"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getUniversalLink } from '@selfxyz/core';
import { SelfQRcodeWrapper, SelfAppBuilder,type SelfApp } from '@selfxyz/qrcode';
import { v4 as uuidv4 } from 'uuid';

export default function VerifyPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [universalLink, setUniversalLink] = useState("");
  const router = useRouter()

  // Create the SelfApp configuration
  useEffect(() => {
    try {
      const newUserId = uuidv4();
      setUserId(newUserId);
      
      const app = new SelfAppBuilder({
        version: 2,
        appName: "Hyumane",
        scope: "hyumane",
        endpoint: "https://hyumane.vercel.app/api/verify",
        logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png",
        userId: newUserId,
        endpointType: "https",
        userIdType: "uuid",
        userDefinedData: "Welcome to Hyumane!",
        devMode: true,
        disclosures: {
          minimumAge: 5,
          ofac: false,
          excludedCountries: [],
        }
      }).build();
      setSelfApp(app);
      setUniversalLink(getUniversalLink(app));
    } catch (error) {
      console.error("Failed to initialize Self app:", error);
    }
  }, []);

  const handleVerificationSuccess = () => {
    const verificationDate = new Date().toISOString();
    
    // Store basic verified user data for session management
    localStorage.setItem('verifiedUserData', JSON.stringify({
      userId: userId,
      isVerified: true,
      verificationDate: verificationDate
    }));
    
    setIsVerified(true);
    setVerificationError(null);
  }

  const handleVerificationError = (error: any) => {
    const errorCode = error.error_code || 'Unknown';
    const reason = error.reason || 'Unknown error';
    console.error(`Error ${errorCode}: ${reason}`);
    setVerificationError(`Verification failed: ${reason}`)
  }

  const handleContinue = () => {
    // Check if user has profile, if not go to create-profile, if yes go to feed
    router.push("/create-profile")
  }

  // Don't render until we have a userId and selfApp
  if (!userId || !selfApp) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#fff6c9" }}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-black">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#fff6c9" }}>
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <Link href="/" className="text-2xl font-bold" style={{ color: "#1c7f8f" }}>
              Hyumane
            </Link>
            <h1 className="text-2xl font-bold mt-4 mb-2 text-black">Verify Your Identity</h1>
            <p className="text-black">Scan this QR code with the Self app to verify you're a real human</p>
          </div>

          {!isVerified ? (
            <div className="text-center">
              <div className="mb-6">
                <SelfQRcodeWrapper
                 selfApp={selfApp}
                  onSuccess={handleVerificationSuccess}
                  onError={handleVerificationError}
                  size={300}
                />
              </div>

              {verificationError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {verificationError}
                </div>
              )}

              <div className="text-center mb-4">
                <p className="text-xs text-black">
                  Your passport data is encrypted and only used for verification
                </p>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-sm mb-2 text-black">How it works:</h3>
                <ol className="text-xs text-black space-y-1">
                  <li>1. Download the Self app</li>
                  <li>2. Scan your passport with the app</li>
                  <li>3. Scan the QR code above</li>
                  <li>4. Get verified as a real human</li>
                </ol>
              </div>

              <p className="text-xs text-black mt-4">
                User ID: {userId.substring(0, 8)}...
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#1c7f8f" }}
              >
                <span className="text-2xl text-white">✓</span>
              </div>
              <h2 className="text-xl font-bold mb-2 text-black">Verification Complete!</h2>
              <p className="text-black mb-6">Welcome to Hyumane. You're now verified as a real human.</p>
              
              <button
                onClick={handleContinue}
                className="w-full py-3 px-4 rounded-lg font-medium transition-colors"
                style={{ backgroundColor: "#1c7f8f", color: "white" }}
              >
                Continue to Profile Setup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
