"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getUserProfile, getFollowStats, updateProfile, uploadAvatar } from "@/lib/supabase-actions"

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

export default function ProfilePage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [followStats, setFollowStats] = useState<FollowStats>({ followers: 0, following: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    username: "",
    bio: "",
    interests: "",
  })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkUserSession()
  }, [])

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

      const stats = await getFollowStats(parsedData.userId)

      setCurrentUser({
        id: parsedData.userId,
        username: profileData.username,
        bio: profileData.bio,
        interests: profileData.interests,
        isVerified: profileData.is_verified,
        avatar_url: profileData.avatar_url
      });

      setFollowStats(stats)

      setEditForm({
        username: profileData.username,
        bio: profileData.bio,
        interests: profileData.interests,
      })
    } catch (error) {
      console.error('Error loading profile:', error)
      router.push('/verify')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return

    setIsSaving(true)
    try {
      let avatarUrl = currentUser.avatar_url

      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile, currentUser.id)
      }

      await updateProfile(currentUser.id, {
        username: editForm.username,
        bio: editForm.bio,
        interests: editForm.interests,
        avatarUrl: avatarUrl || undefined,
      })

      setCurrentUser({
        ...currentUser,
        username: editForm.username,
        bio: editForm.bio,
        interests: editForm.interests,
        avatar_url: avatarUrl,
      })

      setIsEditing(false)
      setAvatarFile(null)
      setAvatarPreview(null)
    } catch (error) {
      console.error("Error updating profile:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setAvatarFile(file)
    if (file) {
      setAvatarPreview(URL.createObjectURL(file))
    } else {
      setAvatarPreview(null)
    }
  }

  if (isLoading || !currentUser) {
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
            <Link href="/profile" className="font-medium text-black">
              Profile
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {!isEditing ? (
          // Profile Display Mode
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              {/* Avatar */}
              <div className="mb-6">
                {currentUser.avatar_url ? (
                  <img
                    src={currentUser.avatar_url}
                    alt="Profile"
                    className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-gray-100"
                  />
                ) : (
                  <div
                    className="w-32 h-32 rounded-full mx-auto flex items-center justify-center border-4 border-gray-100"
                    style={{ backgroundColor: "#1c7f8f" }}
                  >
                    <span className="text-white text-4xl font-bold">{currentUser.username.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>

              {/* Username and Verification */}
              <div className="mb-4">
                <h1 className="text-3xl font-bold flex items-center justify-center gap-2 text-black">
                  @{currentUser.username}
                  {currentUser.isVerified && <span className="text-green-600">✓</span>}
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
              {currentUser.bio && (
                <div className="mb-6">
                  <p className="text-black text-lg">{currentUser.bio}</p>
                </div>
              )}

              {/* Interests */}
              {currentUser.interests && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-black">Interests</h3>
                  <p className="text-black">{currentUser.interests}</p>
                </div>
              )}

              {/* Edit Button */}
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-3 rounded-lg font-medium transition-colors"
                style={{ backgroundColor: "#1c7f8f", color: "white" }}
              >
                Edit Profile
              </button>
            </div>
          </div>
        ) : (
          // Edit Mode
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2 text-black">Edit Profile</h1>
              <p className="text-black">Update your Hyumane identity</p>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-2 text-black">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                  placeholder="@username"
                />
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium mb-2 text-black">
                  Bio
                </label>
                <textarea
                  id="bio"
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                  placeholder="Tell us about yourself..."
                />
              </div>

              <div>
                <label htmlFor="interests" className="block text-sm font-medium mb-2 text-black">
                  Interests
                </label>
                <input
                  type="text"
                  id="interests"
                  value={editForm.interests}
                  onChange={(e) => setEditForm({ ...editForm, interests: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                  placeholder="Photography, Travel, Technology..."
                />
              </div>

              <div>
                <label htmlFor="avatar" className="block text-sm font-medium mb-2 text-black">
                  Profile Picture
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    id="avatar"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <label
                    htmlFor="avatar"
                    className="px-4 py-2 rounded-lg font-medium cursor-pointer transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "#1c7f8f", color: "white" }}
                  >
                    {avatarFile ? "Change file" : "Choose file"}
                  </label>

                  <span className="text-sm text-black italic truncate max-w-[160px]">
                    {avatarFile ? avatarFile.name : "No file chosen"}
                  </span>
                </div>

                {(avatarPreview || currentUser.avatar_url) && (
                  <img
                    src={avatarPreview || currentUser.avatar_url || ""}
                    alt="preview"
                    className="mt-4 w-24 h-24 rounded-full object-cover"
                  />
                )}
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={!editForm.username.trim() || isSaving}
                  className="flex-1 py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 hover:opacity-90"
                  style={{ backgroundColor: "#1c7f8f", color: "white" }}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false)
                    setAvatarFile(null)
                    setAvatarPreview(null)
                    setEditForm({
                      username: currentUser.username,
                      bio: currentUser.bio,
                      interests: currentUser.interests,
                    })
                  }}
                  className="flex-1 py-3 px-4 rounded-lg font-medium border border-gray-300 text-black hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
} 