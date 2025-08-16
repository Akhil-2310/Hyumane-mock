"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createProfile } from "@/lib/supabase-actions"
import { uploadAvatar } from "@/lib/supabase-actions"

interface VerifiedUserData {
  userId: string;
  verifiedName: string;
  isVerified: boolean;
  verificationDate: string;
}

export default function CreateProfilePage() {
  const [formData, setFormData] = useState({
    username: "",
    bio: "",
    interests: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [verifiedUserData, setVerifiedUserData] = useState<VerifiedUserData | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Load verified user data from localStorage
    const storedData = localStorage.getItem('verifiedUserData');
    if (storedData) {
      const userData: VerifiedUserData = JSON.parse(storedData);
      setVerifiedUserData(userData);
    } else {
      // If no verification data, redirect to verification
      router.push('/verify');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      let avatarUrl: string | undefined;
      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile, verifiedUserData!.userId);
      }
      await createProfile({
        ...formData,
        verifiedUserId: verifiedUserData!.userId,
        isVerified: verifiedUserData?.isVerified || false,
        verificationDate: verifiedUserData?.verificationDate || '',
        avatarUrl,
      });
      
      router.push("/feed")
    } catch (error) {
      console.error("Error creating profile:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setAvatarFile(file);
    if (file) {
      setAvatarPreview(URL.createObjectURL(file));
    } else {
      setAvatarPreview(null);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#fff6c9" }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 text-black">Create Your Profile</h1>
            <p className="text-black">Set up your Hyumane identity</p>
            
            {verifiedUserData && (
              <div 
                className="mt-4 p-3 rounded-lg flex items-center justify-center space-x-2"
                style={{ backgroundColor: "#f0fdf4", color: "#166534" }}
              >
                <span className="text-lg">✓</span>
                <span className="font-medium">Identity Verified</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2 text-black">
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
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
                name="bio"
                value={formData.bio}
                onChange={handleChange}
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
                name="interests"
                value={formData.interests}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                placeholder="Photography, Travel, Technology..."
              />
            </div>

            <div>
              <label htmlFor="avatar" className="block text-sm font-medium mb-2 text-black">
                Profile Picture
              </label>
              <div className="flex items-center space-x-4">
                {/* Hidden native file input */}
                <input
                  type="file"
                  id="avatar"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Styled button that triggers the input */}
                <label
                  htmlFor="avatar"
                  className="px-4 py-2 rounded-lg font-medium cursor-pointer transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#1c7f8f", color: "white" }}
                >
                  {avatarFile ? "Change file" : "Choose file"}
                </label>

                {/* File name or placeholder */}
                <span className="text-sm text-black italic truncate max-w-[160px]">
                  {avatarFile ? avatarFile.name : "No file chosen"}
                </span>
              </div>

              {avatarPreview && (
                <img src={avatarPreview} alt="preview" className="mt-4 w-24 h-24 rounded-full object-cover" />
              )}
            </div>

            <button
              type="submit"
              disabled={!formData.username.trim() || isLoading}
              className="w-full py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: "#1c7f8f", color: "white" }}
            >
              {isLoading ? "Creating Profile..." : "Create Profile"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
