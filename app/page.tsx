"use client"

import { useRouter } from "next/navigation"
import { getUserProfile } from "@/lib/supabase-actions"

export default function LandingPage() {
  const router = useRouter()

  const handleLaunchApp = async () => {
    // Check if user already has verification data
    const verificationData = localStorage.getItem('verifiedUserData')
    
    if (!verificationData) {
      // No verification data, go to verify page
      router.push('/verify')
      return
    }

    try {
      const parsedData = JSON.parse(verificationData)
      
      if (!parsedData.userId || !parsedData.isVerified) {
        // Invalid verification data, go to verify page
        router.push('/verify')
        return
      }

      // Check if user has a profile
      const profileData = await getUserProfile(parsedData.userId)
      
      if (!profileData) {
        // Has verification but no profile, go to create profile
        router.push('/create-profile')
        return
      }

      // Has both verification and profile, go to feed
      router.push('/feed')
    } catch (error) {
      console.error('Error checking user status:', error)
      // On error, default to verify page
      router.push('/verify')
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#fff6c9", color: "#000000" }}>
      {/* Navbar */}
      <nav className="px-6 py-4 flex justify-between items-center border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <img src="/logo.png" alt="Hyumane Logo" className="h-16 w-16" />
          <span className="text-2xl font-bold">Hyumane</span>
        </div>

        <button
          onClick={handleLaunchApp}
          className="px-6 py-2 rounded-lg font-medium transition-colors hover:opacity-90"
          style={{ backgroundColor: "#1c7f8f", color: "white" }}
        >
          Launch App
        </button>
      </nav>


      {/* Hero Section */}
      <section className="px-6 py-20 text-center max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          A Digital Space for <span className="block mt-2" style={{ color: "#1c7f8f" }}>Real People</span>
        </h1>
        <p className="text-xl md:text-2xl mb-8 text-gray-700">
          By humans, for humans. Connect authentically in a verified community where every person is real.
        </p>
        <button
          onClick={handleLaunchApp}
          className="inline-block px-8 py-4 text-lg font-medium rounded-lg transition-colors hover:opacity-90"
          style={{ backgroundColor: "#1c7f8f", color: "white" }}
        >
          Join the Community
        </button>
      </section>

      {/* Philosophy Section */}
      <section className="px-6 py-16 max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold text-center mb-12">Our Philosophy</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center p-6 rounded-lg border border-gray-200 bg-white/50">
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#1c7f8f" }}
            >
              <span className="text-2xl text-white">🔐</span>
            </div>
            <h3 className="text-xl font-bold mb-3">Reputation-Based</h3>
            <p className="text-gray-700">
              Build trust through meaningful interactions. Quality connections over quantity followers.
            </p>
          </div>

          <div className="text-center p-6 rounded-lg border border-gray-200 bg-white/50">
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#1c7f8f" }}
            >
              <span className="text-2xl text-white">🤝</span>
            </div>
            <h3 className="text-xl font-bold mb-3">Human-Centered Design</h3>
            <p className="text-gray-700">
              No AI, no bots, no automation. Just real people sharing genuine moments and thoughts.
            </p>
          </div>

          <div className="text-center p-6 rounded-lg border border-gray-200 bg-white/50">
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#1c7f8f" }}
            >
              <span className="text-2xl text-white">🌱</span>
            </div>
            <h3 className="text-xl font-bold mb-3">Cozy Community</h3>
            <p className="text-gray-700">
              Like a neighborhood café where everyone knows your name. Intimate, warm, and welcoming.
            </p>
          </div>
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="px-6 py-16 bg-white/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">What Makes Us Different</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
            {/* Feature 1 */}
            <div className="flex items-start space-x-4">
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ backgroundColor: "#1c7f8f" }}
              >
                <span className="text-white font-bold">✓</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Chronological Feed</h3>
                <p className="text-gray-700">
                  See posts in the order they were shared, not by algorithm manipulation.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex items-start space-x-4">
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ backgroundColor: "#1c7f8f" }}
              >
                <span className="text-white font-bold">✓</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Meaningful Connections</h3>
                <p className="text-gray-700">
                  One-to-one chats and thoughtful interactions, not broadcast shouting.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex items-start space-x-4">
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ backgroundColor: "#1c7f8f" }}
              >
                <span className="text-white font-bold">✓</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Verified Humans</h3>
                <p className="text-gray-700">
                  Every member is verified as a real person during our joining process.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex items-start space-x-4">
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ backgroundColor: "#1c7f8f" }}
              >
                <span className="text-white font-bold">✓</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Quality Over Quantity</h3>
                <p className="text-gray-700">
                  Small, curated community focused on genuine relationships.
                </p>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="flex items-start space-x-4">
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ backgroundColor: "#1c7f8f" }}
              >
                <span className="text-white font-bold">✓</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Privacy First</h3>
                <p className="text-gray-700">
                  Every member is verified as a real person during our joining process.
                </p>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="flex items-start space-x-4">
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ backgroundColor: "#1c7f8f" }}
              >
                <span className="text-white font-bold">✓</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Mindful Design</h3>
                <p className="text-gray-700">
                  Built to encourage thoughtful sharing, not endless scrolling.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Footer */}
      <footer className="px-6 py-12 border-t border-gray-200">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-2xl font-bold mb-4">Hyumane</div>
          <p className="text-gray-600 mb-6">Building authentic digital communities, one verified human at a time.</p>
          <div className="flex justify-center space-x-8 text-sm text-gray-600">
            <a href="#" className="hover:underline">
              Privacy Policy
            </a>
            <a href="#" className="hover:underline">
              Terms of Service
            </a>
            <a href="#" className="hover:underline">
              Contact Us
            </a>
            <a href="#" className="hover:underline">
              Help Center
            </a>
          </div>
          <div className="mt-6 text-sm text-gray-500">© 2025 Hyumane. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}
