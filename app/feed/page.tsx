"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getPosts, createPost, getUserProfile, isFollowing, followUser, unfollowUser, likePost, unlikePost, createReply, getReplies, uploadPostImage } from "@/lib/supabase-actions"
import { supabase } from "@/lib/supabase"

interface Post {
  id: string
  content: string
  username: string
  avatar: string | null
  author_id: string
  created_at: string
  likes: number
  isLiked: boolean
  replies: number
  image_url: string | null
}

interface Reply {
  id: string
  content: string
  username: string
  avatar: string | null
  author_id: string
  created_at: string
}

interface CurrentUser {
  id: string
  username: string
  bio: string
  interests: string
  isVerified: boolean
  avatar_url: string | null
}

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [newPost, setNewPost] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [followingStatus, setFollowingStatus] = useState<Record<string, boolean>>({})
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [showReplies, setShowReplies] = useState<Record<string, boolean>>({})
  const [replies, setReplies] = useState<Record<string, Reply[]>>({})
  const [activeTab, setActiveTab] = useState<'following' | 'everyone'>('following')
  const [isTabLoading, setIsTabLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isPosting, setIsPosting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkUserSession()
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadPosts()
    }
  }, [currentUser, activeTab])

  // Real-time subscription for likes
  useEffect(() => {
    if (!currentUser) return

    const likesSubscription = supabase
      .channel('likes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes'
        },
        () => {
          // Reload posts when likes change
          loadPosts()
        }
      )
      .subscribe()

    return () => {
      likesSubscription.unsubscribe()
    }
  }, [currentUser])

  // Real-time subscription for replies
  useEffect(() => {
    if (!currentUser) return

    const repliesSubscription = supabase
      .channel('replies')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'replies'
        },
        (payload) => {
          // Reload posts to update reply counts
          loadPosts()
          
          // Always reload replies for this post if we have them cached
          if (replies[payload.new.post_id]) {
            loadReplies(payload.new.post_id)
          }
          
          // If we're currently showing replies for this post, make sure they're visible
          if (showReplies[payload.new.post_id]) {
            loadReplies(payload.new.post_id)
          }
        }
      )
      .subscribe()

    return () => {
      repliesSubscription.unsubscribe()
    }
  }, [currentUser])

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
    }
  }

  const loadPosts = async () => {
    try {
      setIsTabLoading(true)
      const fetchedPosts = await getPosts(currentUser?.id, activeTab === 'following')
      setPosts(fetchedPosts)
      
      // Check following status for all post authors
      if (currentUser) {
        const followingMap: Record<string, boolean> = {}
        for (const post of fetchedPosts) {
          if (post.author_id !== currentUser.id) {
            followingMap[post.author_id] = await isFollowing(currentUser.id, post.author_id)
          }
        }
        setFollowingStatus(followingMap)
      }
    } catch (error) {
      console.error("Error loading posts:", error)
    } finally {
      setIsLoading(false)
      setIsTabLoading(false)
    }
  }

  const loadReplies = async (postId: string) => {
    try {
      const fetchedReplies = await getReplies(postId)
      setReplies(prev => ({
        ...prev,
        [postId]: fetchedReplies
      }))
    } catch (error) {
      console.error("Error loading replies:", error)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setImageFile(file)
    if (file) {
      setImagePreview(URL.createObjectURL(file))
    } else {
      setImagePreview(null)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newPost.trim() && !imageFile) || !currentUser) return;

    setIsPosting(true);

    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        imageUrl = await uploadPostImage(imageFile, currentUser.id);
      }

      // Optimistic UI update with real user data
      const tempId = Date.now().toString();
      const optimisticPost: Post = {
        id: tempId,
        content: newPost.trim(),
        username: currentUser.username,
        avatar: currentUser.avatar_url,
        author_id: currentUser.id,
        created_at: new Date().toISOString(),
        likes: 0,
        isLiked: false,
        replies: 0,
        image_url: imageUrl || null,
      };
      setPosts([optimisticPost, ...posts]);
      setNewPost("");
      setImageFile(null);
      setImagePreview(null);

      await createPost(optimisticPost.content, currentUser.id, imageUrl);
      loadPosts();
    } catch (error) {
      console.error("Error creating post:", error);
      // Revert optimistic update on error
      setPosts(posts.filter(p => p.id !== Date.now().toString()));
    } finally {
      setIsPosting(false);
    }
  }

  const handleLike = async (postId: string, isCurrentlyLiked: boolean) => {
    if (!currentUser) return

    // Optimistic UI update
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              isLiked: !isCurrentlyLiked,
              likes: isCurrentlyLiked ? post.likes - 1 : post.likes + 1
            }
          : post
      )
    )

    try {
      if (isCurrentlyLiked) {
        await unlikePost(postId, currentUser.id)
      } else {
        await likePost(postId, currentUser.id)
      }
    } catch (error: any) {
      // Revert optimistic update on error
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                isLiked: isCurrentlyLiked,
                likes: isCurrentlyLiked ? post.likes + 1 : post.likes - 1
              }
            : post
        )
      )

      // Handle duplicate key error - means user already liked it
      if (error.code === '23505') {
        // Post is actually liked, so unlike it
        try {
          await unlikePost(postId, currentUser.id)
          // Update UI to show unliked state
          setPosts(prevPosts => 
            prevPosts.map(post => 
              post.id === postId 
                ? { 
                    ...post, 
                    isLiked: false,
                    likes: post.likes - 1
                  }
                : post
            )
          )
        } catch (unlikeError) {
          console.error("Error unliking post:", unlikeError)
          // Reload posts as fallback
          loadPosts()
        }
      } else {
        console.error("Error toggling like:", error)
        // Reload posts as fallback
        loadPosts()
      }
    }
  }

  const handleReply = async (postId: string) => {
    if (!replyText.trim() || !currentUser) return

    try {
      await createReply(postId, replyText, currentUser.id)
      setReplyText("")
      setReplyingTo(null)
      
      // Immediately show replies for this post if not already showing
      if (!showReplies[postId]) {
        setShowReplies(prev => ({
          ...prev,
          [postId]: true
        }))
      }
      
      // Reload replies to show the new one immediately
      loadReplies(postId)
    } catch (error) {
      console.error("Error creating reply:", error)
    }
  }

  const toggleReplies = async (postId: string) => {
    const isCurrentlyShowing = showReplies[postId]
    
    setShowReplies(prev => ({
      ...prev,
      [postId]: !isCurrentlyShowing
    }))

    // Load replies when showing them
    if (!isCurrentlyShowing) {
      loadReplies(postId)
    }
  }

  const handleFollowToggle = async (authorId: string) => {
    if (!currentUser) return

    try {
      const wasFollowing = followingStatus[authorId]
      
      // Optimistic update
      setFollowingStatus(prev => ({
        ...prev,
        [authorId]: !wasFollowing
      }))

      if (wasFollowing) {
        await unfollowUser(currentUser.id, authorId)
      } else {
        await followUser(currentUser.id, authorId)
      }

      // Reload posts to reflect following changes
      loadPosts()
    } catch (error) {
      console.error("Error toggling follow:", error)
      // Revert optimistic update
      setFollowingStatus(prev => ({
        ...prev,
        [authorId]: !prev[authorId]
      }))
    }
  }

  // Show loading until we verify user session
  if (!currentUser) {
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
         
            <Link href="/feed" className="font-medium" style={{ color: "#1c7f8f" }}>
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

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('following')}
              className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                activeTab === 'following'
                  ? 'text-white border-b-2'
                  : 'text-black hover:bg-gray-50'
              }`}
              style={activeTab === 'following' ? { 
                backgroundColor: "#1c7f8f", 
                borderBottomColor: "#1c7f8f" 
              } : {}}
            >
              Following
            </button>
            <button
              onClick={() => setActiveTab('everyone')}
              className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                activeTab === 'everyone'
                  ? 'text-white border-b-2'
                  : 'text-black hover:bg-gray-50'
              }`}
              style={activeTab === 'everyone' ? { 
                backgroundColor: "#1c7f8f", 
                borderBottomColor: "#1c7f8f" 
              } : {}}
            >
              Everyone
            </button>
          </div>
        </div>

        {/* Create Post */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <form onSubmit={handleCreatePost}>
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-black placeholder:opacity-80"
              rows={3}
            />
            
            {/* Image Preview */}
            {imagePreview && (
              <div className="mt-3 relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-w-full h-64 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                >
                  ×
                </button>
              </div>
            )}

            <div className="flex justify-between items-center mt-3">
              <div className="flex items-center space-x-3">
                {/* Image Upload Button */}
                <input
                  type="file"
                  id="post-image"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <label
                  htmlFor="post-image"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-black border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {imageFile ? "Change Image" : "Add Image"}
                </label>
                
                {imageFile && (
                  <span className="text-sm text-black">
                    {imageFile.name}
                  </span>
                )}
              </div>
              
              <button
                type="submit"
                disabled={(!newPost.trim() && !imageFile) || isPosting}
                className="px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#1c7f8f", color: "white" }}
              >
                {isPosting ? "Posting..." : "Post"}
              </button>
            </div>
          </form>
        </div>

        {/* Posts Feed */}
        <div className="space-y-6">
          {(isLoading || isTabLoading) ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto"></div>
              <p className="text-sm text-black mt-2">
                {isTabLoading ? `Loading ${activeTab === 'following' ? 'following' : 'everyone'} posts...` : 'Loading...'}
              </p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8 text-black">
              {activeTab === 'following' ? (
                <>
                  <p className="mb-2">No posts from people you follow yet.</p>
                  <p className="text-sm">Follow some users in the Discover tab to see their posts here!</p>
                </>
              ) : (
                <>
                  <p className="mb-2">No posts yet. Be the first to share something!</p>
                  <p className="text-sm">Welcome to Hyumane - where real humans connect authentically.</p>
                </>
              )}
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    {post.avatar ? (
                      <img src={post.avatar} alt="avatar" className="w-10 h-10 rounded-full mr-3 object-cover" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
                        style={{ backgroundColor: "#1c7f8f" }}
                      >
                        <span className="text-white font-bold">{post.username.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <div>
                      <div className="font-medium flex items-center text-black">
                        @{post.username}
                        <span className="ml-1 text-green-600">✓</span>
                      </div>
                      <div className="text-sm text-black">
                        {new Date(post.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  {/* Follow/Unfollow Button - Only show for other users' posts */}
                  {post.author_id !== currentUser.id && (
                    <button
                      onClick={() => handleFollowToggle(post.author_id)}
                      className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${
                        followingStatus[post.author_id]
                          ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          : "text-white hover:opacity-90"
                      }`}
                      style={!followingStatus[post.author_id] ? { backgroundColor: "#1c7f8f" } : {}}
                    >
                      {followingStatus[post.author_id] ? "Following" : "Follow"}
                    </button>
                  )}
                </div>
                
                {/* Post Content */}
                {post.content && (
                  <p className="text-black mb-4">{post.content}</p>
                )}
                
                {/* Post Image */}
                {post.image_url && (
                  <div className="mb-4">
                    <img
                      src={post.image_url}
                      alt="Post image"
                      className="w-full max-h-96 object-cover rounded-lg"
                    />
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex items-center space-x-6 text-sm text-black border-t pt-3">
                  <button 
                    onClick={() => handleLike(post.id, post.isLiked)}
                    className={`flex items-center space-x-1 transition-colors ${
                      post.isLiked ? "text-red-500" : "hover:text-red-500"
                    }`}
                  >
                    <span>{post.isLiked ? "❤️" : "🤍"}</span>
                    <span>{post.likes}</span>
                  </button>
                  
                  <button 
                    onClick={() => toggleReplies(post.id)}
                    className="flex items-center space-x-1 hover:text-blue-500"
                  >
                    <span>💬</span>
                    <span>{post.replies} {post.replies === 1 ? 'Reply' : 'Replies'}</span>
                  </button>
                  
                  <button 
                    onClick={() => setReplyingTo(replyingTo === post.id ? null : post.id)}
                    className="hover:text-blue-500"
                  >
                    Reply
                  </button>
                </div>

                {/* Reply Input */}
                {replyingTo === post.id && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                      className="w-full p-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                    <div className="flex justify-end space-x-2 mt-2">
                      <button
                        onClick={() => setReplyingTo(null)}
                        className="px-3 py-1 text-sm text-black hover:text-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleReply(post.id)}
                        disabled={!replyText.trim()}
                        className="px-3 py-1 text-sm rounded font-medium transition-colors disabled:opacity-50"
                        style={{ backgroundColor: "#1c7f8f", color: "white" }}
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                )}

                {/* Replies */}
                {showReplies[post.id] && (
                  <div className="mt-4 border-t pt-4 space-y-3">
                    {replies[post.id] && replies[post.id].length > 0 ? (
                      replies[post.id].map((reply) => (
                        <div key={reply.id} className="flex space-x-3">
                          {reply.avatar ? (
                            <img src={reply.avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: "#1c7f8f" }}
                            >
                              <span className="text-white text-xs font-bold">{reply.username.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-sm text-black">@{reply.username}</span>
                              <span className="text-green-600 text-xs">✓</span>
                              <span className="text-xs text-black">
                                {new Date(reply.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-black mt-1">{reply.content}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-black text-sm">
                        {replies[post.id] ? "No replies yet" : "Loading replies..."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
