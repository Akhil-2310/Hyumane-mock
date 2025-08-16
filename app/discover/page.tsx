"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getAllUsers, getUserProfile, isFollowing, followUser, unfollowUser, createOrGetChat } from "@/lib/supabase-actions"

interface User {
  verified_user_id: string
  username: string
  bio: string
  avatar_url: string | null
  is_verified: boolean
}

interface CurrentUser {
  id: string
  username: string
  bio: string
  interests: string
  isVerified: boolean
  avatar_url: string | null
}

export default function DiscoverPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [followingStatus, setFollowingStatus] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()

  useEffect(() => {
    checkUserSession()
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadUsers()
    }
  }, [currentUser])

  useEffect(() => {
    // Filter users based on search query
    if (!searchQuery.trim()) {
      setFilteredUsers(users)
    } else {
      const filtered = users.filter(user => 
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.bio.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredUsers(filtered)
    }
  }, [searchQuery, users])

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
      console.error('Error loading user session:', error)
      router.push('/verify')
    } finally {
      setIsLoading(false)
    }
  }

  const loadUsers = async () => {
    if (!currentUser) return

    try {
      const fetchedUsers = await getAllUsers(currentUser.id)
      setUsers(fetchedUsers)
      setFilteredUsers(fetchedUsers)

      // Check following status for all users
      const followingMap: Record<string, boolean> = {}
      for (const user of fetchedUsers) {
        followingMap[user.verified_user_id] = await isFollowing(currentUser.id, user.verified_user_id)
      }
      setFollowingStatus(followingMap)
    } catch (error) {
      console.error("Error loading users:", error)
    }
  }

  const handleFollowToggle = async (userId: string) => {
    if (!currentUser) return

    try {
      const wasFollowing = followingStatus[userId]
      
      // Optimistic update
      setFollowingStatus(prev => ({
        ...prev,
        [userId]: !wasFollowing
      }))

      if (wasFollowing) {
        await unfollowUser(currentUser.id, userId)
      } else {
        await followUser(currentUser.id, userId)
      }
    } catch (error) {
      console.error("Error toggling follow:", error)
      // Revert optimistic update
      setFollowingStatus(prev => ({
        ...prev,
        [userId]: !prev[userId]
      }))
    }
  }

  const handleMessage = async (userId: string) => {
    if (!currentUser) return

    try {
      // Create or get existing chat
      const chatId = await createOrGetChat(currentUser.id, userId)
      // Redirect to chat page with this chat selected
      router.push(`/chat?chatId=${chatId}`)
    } catch (error) {
      console.error("Error creating chat:", error)
    }
  }

  const clearSearch = () => {
    setSearchQuery("")
  }

  if (isLoading || !currentUser) {
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
            <Link href="/discover" className="font-medium" style={{ color: "#1c7f8f" }}>
              Discover
            </Link>
            <Link href="/profile" className="font-medium text-black hover:text-black">
              Profile
            </Link>
            <div className="flex items-center space-x-2">
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "#1c7f8f" }}
                >
                  <span className="text-white text-sm font-bold">{currentUser.username.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-black">Discover People</h1>
          <p className="text-black">Find and connect with verified humans on Hyumane</p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by name or bio..."
              className="block w-full pl-10 pr-10 py-3 border border-black rounded-lg focus:outline-none focus:ring-2 placeholder:text-black"
              onFocus={(e) => {
                e.target.style.borderColor = "#1c7f8f";
                e.target.style.boxShadow = "0 0 0 2px rgba(28, 127, 143, 0.2)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#d1d5db";
                e.target.style.boxShadow = "none";
              }}
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          {searchQuery && (
            <div className="mt-3 text-sm text-black">
              {filteredUsers.length === 0 ? (
                <p>No users found matching "{searchQuery}"</p>
              ) : (
                <p>Found {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} matching "{searchQuery}"</p>
              )}
            </div>
          )}
        </div>

        {filteredUsers.length === 0 && !searchQuery ? (
          <div className="text-center py-12">
            <div className="text-black">
              <p className="mb-2">No other users found</p>
              <p className="text-sm">Be the first to invite your friends to Hyumane!</p>
            </div>
          </div>
        ) : filteredUsers.length === 0 && searchQuery ? (
          <div className="text-center py-12">
            <div className="text-black">
              <p className="mb-2">No users found</p>
              <p className="text-sm">Try a different search term or browse all users</p>
              <button
                onClick={clearSearch}
                className="mt-4 px-4 py-2 rounded-lg font-medium transition-colors"
                style={{ backgroundColor: "#1c7f8f", color: "white" }}
              >
                Clear Search
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((user) => (
              <div key={user.verified_user_id} className="bg-white rounded-lg shadow-sm p-6">
                <div className="text-center">
                  {/* Clickable Profile Section */}
                  <div 
                    className="cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors mb-4"
                    onClick={() => router.push(`/profile/${user.verified_user_id}`)}
                  >
                    {/* Avatar */}
                    <div className="mb-4">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt="Profile"
                          className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-gray-100"
                        />
                      ) : (
                        <div
                          className="w-20 h-20 rounded-full mx-auto flex items-center justify-center border-2 border-gray-100"
                          style={{ backgroundColor: "#1c7f8f" }}
                        >
                          <span className="text-white text-2xl font-bold">{user.username.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                    </div>

                    {/* Username and Verification */}
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold flex items-center justify-center gap-1 text-black">
                        @{user.username}
                        {user.is_verified && <span className="text-green-600">✓</span>}
                      </h3>
                    </div>

                    {/* Bio */}
                    {user.bio && (
                      <div className="mb-4">
                        <p className="text-black text-sm line-clamp-2">{user.bio}</p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <button
                      onClick={() => handleFollowToggle(user.verified_user_id)}
                      className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                        followingStatus[user.verified_user_id]
                          ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          : "text-white hover:opacity-90"
                      }`}
                      style={!followingStatus[user.verified_user_id] ? { backgroundColor: "#1c7f8f" } : {}}
                    >
                      {followingStatus[user.verified_user_id] ? "Following" : "Follow"}
                    </button>
                    
                    <button
                      onClick={() => handleMessage(user.verified_user_id)}
                      className="w-full py-2 px-4 rounded-lg font-medium border border-gray-300 text-black hover:bg-gray-50 transition-colors"
                    >
                      Message
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 