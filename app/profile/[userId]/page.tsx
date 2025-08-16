"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { getUserProfile, getFollowStats, isFollowing, followUser, unfollowUser, createOrGetChat } from "@/lib/supabase-actions"

interface User {
  id: string
  username: string
  bio: string
  interests: string
  isVerified: boolean
  avatar_url: string | null
}

interface CurrentUser {
  id: string
  username: string
  bio: string
  interests: string
  isVerified: boolean
  avatar_url: string | null
}

interface FollowStats {
  followers: number
  following: number
}

export default function UserProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [followStats, setFollowStats] = useState<FollowStats>({ followers: 0, following: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isFollowingUser, setIsFollowingUser] = useState(false)
  const [isFollowLoading, setIsFollowLoading] = useState(false)
  const router = useRouter()
  const params = useParams()
  const userId = params.userId as string

  useEffect(() => {
    checkUserSession()
  }, [])

  useEffect(() => {
    if (currentUser && userId) {
      loadUserProfile()
    }
  }, [currentUser, userId])

  const checkUserSession = async () => {
    const verificationData = localStorage.getItem('verifiedUserData')
    
    if (!verificationData) {
      router.push('/verify')
      return
    }

    try {
      const parsedData = JSON.parse(verificationData)
      
      if (!parsedData.userId || !parsedData.isVerified) {
        router.push('/verify')
        return
      }

      const profileData = await getUserProfile(parsedData.userId)
      
      if (!profileData) {
        router.push('/create-profile')
        return
      }

      setCurrentUser({
        id: parsedData.userId,
        username: profileData.username,
        bio: profileData.bio,
        interests: profileData.interests,
        isVerified: profileData.is_verified,
        avatar_url: profileData.avatar_url
      });
    } catch (error) {
      console.error('Error loading current user session:', error)
      router.push('/verify')
    }
  }

  const loadUserProfile = async () => {
    if (!userId || !currentUser) return

    // If viewing own profile, redirect to main profile page
    if (userId === currentUser.id) {
      router.push('/profile')
      return
    }

    try {
      const profileData = await getUserProfile(userId)
      
      if (!profileData) {
        router.push('/discover') // User not found, go back to discover
        return
      }

      const stats = await getFollowStats(userId)
      const followingStatus = await isFollowing(currentUser.id, userId)

      setUser({
        id: userId,
        username: profileData.username,
        bio: profileData.bio,
        interests: profileData.interests,
        isVerified: profileData.is_verified,
        avatar_url: profileData.avatar_url
      });

      setFollowStats(stats)
      setIsFollowingUser(followingStatus)
    } catch (error) {
      console.error('Error loading user profile:', error)
      router.push('/discover')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFollowToggle = async () => {
    if (!currentUser || !user || isFollowLoading) return

    setIsFollowLoading(true)
    try {
      // Optimistic update
      const wasFollowing = isFollowingUser
      setIsFollowingUser(!wasFollowing)
      setFollowStats(prev => ({
        ...prev,
        followers: wasFollowing ? prev.followers - 1 : prev.followers + 1
      }))

      if (wasFollowing) {
        await unfollowUser(currentUser.id, user.id)
      } else {
        await followUser(currentUser.id, user.id)
      }
    } catch (error) {
      console.error("Error toggling follow:", error)
      // Revert optimistic update
      setIsFollowingUser(!isFollowingUser)
      setFollowStats(prev => ({
        ...prev,
        followers: isFollowingUser ? prev.followers + 1 : prev.followers - 1
      }))
    } finally {
      setIsFollowLoading(false)
    }
  }

  const handleMessage = async () => {
    if (!currentUser || !user) return

    try {
      const chatId = await createOrGetChat(currentUser.id, user.id)
      router.push(`/chat?chatId=${chatId}`)
    } catch (error) {
      console.error("Error creating chat:", error)
    }
  }

  if (isLoading || !user || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#fff6c9" }}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-black">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#fff6c9" }}>
      {/* Navigation */}
      <nav className="bg-white shadow-sm px-6 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold" style={{ color: "#1c7f8f" }}>
            Hyumane
          </Link>
          <div className="flex items-center space-x-4">
            <Link href="/feed" className="font-medium text-black hover:text-black">
              Feed
            </Link>
            <Link href="/chat" className="font-medium text-black hover:text-black">
              Chat
            </Link>
            <Link href="/discover" className="font-medium text-black hover:text-black">
              Discover
            </Link>
            <Link href="/profile" className="font-medium text-black hover:text-black">
              Profile
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            {/* Back Button */}
            <div className="mb-6 text-left">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-black hover:text-gray-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            </div>

            {/* Avatar */}
            <div className="mb-6">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt="Profile"
                  className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-gray-100"
                />
              ) : (
                <div
                  className="w-32 h-32 rounded-full mx-auto flex items-center justify-center border-4 border-gray-100"
                  style={{ backgroundColor: "#1c7f8f" }}
                >
                  <span className="text-white text-4xl font-bold">{user.username.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>

            {/* Username and Verification */}
            <div className="mb-4">
              <h1 className="text-3xl font-bold flex items-center justify-center gap-2 text-black">
                @{user.username}
                {user.isVerified && <span className="text-green-600">✓</span>}
              </h1>
            </div>

            {/* Follow Stats */}
            <div className="flex justify-center space-x-8 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-black">{followStats.followers}</div>
                <div className="text-black text-sm">Followers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-black">{followStats.following}</div>
                <div className="text-black text-sm">Following</div>
              </div>
            </div>

            {/* Bio */}
            {user.bio && (
              <div className="mb-6">
                <p className="text-black text-lg">{user.bio}</p>
              </div>
            )}

            {/* Interests */}
            {user.interests && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2 text-black">Interests</h3>
                <p className="text-black">{user.interests}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleFollowToggle}
                disabled={isFollowLoading}
                className={`px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                  isFollowingUser
                    ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    : "text-white hover:opacity-90"
                }`}
                style={!isFollowingUser ? { backgroundColor: "#1c7f8f" } : {}}
              >
                {isFollowLoading ? "..." : (isFollowingUser ? "Following" : "Follow")}
              </button>
              
              <button
                onClick={handleMessage}
                className="px-6 py-3 rounded-lg font-medium border border-gray-300 text-black hover:bg-gray-50 transition-colors"
              >
                Message
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
