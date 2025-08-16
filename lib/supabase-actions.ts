import { supabase } from "./supabase"

export async function uploadAvatar(file: File, verified_user_id: string) {
  const fileExt = file.name.split('.').pop();
  const filePath = `${verified_user_id}.${fileExt}`;

  const { error } = await supabase.storage.from('avatars').upload(filePath, file, {
    upsert: true,
    cacheControl: '3600',
  });

  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return data.publicUrl as string;
}

export async function uploadPostImage(file: File, userId: string) {
  const fileExt = file.name.split('.').pop();
  const timestamp = Date.now();
  const filePath = `${userId}/${timestamp}.${fileExt}`;

  const { error } = await supabase.storage.from('post-images').upload(filePath, file, {
    cacheControl: '3600',
  });

  if (error) throw error;

  const { data } = supabase.storage.from('post-images').getPublicUrl(filePath);
  return data.publicUrl as string;
}

export async function createProfile(profileData: {
  username: string;
  bio: string;
  interests: string;
  verifiedUserId: string;
  isVerified?: boolean
  verificationDate?: string
  avatarUrl?: string;
}) {
  const { data, error } = await supabase.from('profiles').insert([
    {
      username: profileData.username,
      bio: profileData.bio,
      interests: profileData.interests,
      verified_user_id: profileData.verifiedUserId,
      is_verified: true,
      avatar_url: profileData.avatarUrl || null,
      verification_date: profileData.verificationDate,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, profileData: {
  username?: string;
  bio?: string;
  interests?: string;
  avatarUrl?: string;
}) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      username: profileData.username,
      bio: profileData.bio,
      interests: profileData.interests,
      avatar_url: profileData.avatarUrl,
    })
    .eq('verified_user_id', userId);

  if (error) throw error;
  return data;
}

export async function getPosts(currentUserId?: string, followingOnly: boolean = true) {
  let postsQuery = supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  // If user is provided and followingOnly is true, check if they follow anyone
  if (currentUserId && followingOnly) {
    const { data: followedUsers, error: followError } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUserId);

    if (!followError && followedUsers && followedUsers.length > 0) {
      // User follows someone, so show only posts from followed users and themselves
      const followedUserIds = followedUsers.map(f => f.following_id);
      followedUserIds.push(currentUserId); // Include user's own posts
      
      postsQuery = postsQuery.in('author_id', followedUserIds);
    }
  }

  const { data: posts, error: postsError } = await postsQuery;

  if (postsError) {
    console.error("Error fetching posts:", postsError)
    return []
  }

  // Then get profile data and like counts for each post
  const transformedPosts = []
  
  for (const post of posts || []) {
    // Get profile for this post's author
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("verified_user_id", post.author_id)
      .single()

    // Get like count for this post
    const { count: likeCount } = await supabase
      .from("likes")
      .select("*", { count: 'exact' })
      .eq("post_id", post.id)

    // Check if current user liked this post
    let isLiked = false
    if (currentUserId) {
      const { data: userLike } = await supabase
        .from("likes")
        .select("id")
        .eq("post_id", post.id)
        .eq("user_id", currentUserId)
        .maybeSingle()
      isLiked = !!userLike
    }

    // Get reply count for this post
    const { count: replyCount } = await supabase
      .from("replies")
      .select("*", { count: 'exact' })
      .eq("post_id", post.id)

    transformedPosts.push({
      id: post.id,
      content: post.content,
      username: profile?.username || "anonymous",
      avatar: profile?.avatar_url || null,
      author_id: post.author_id,
      created_at: post.created_at,
      likes: likeCount || 0,
      isLiked: isLiked,
      replies: replyCount || 0,
      image_url: post.image_url || null,
    })
  }
  
  return transformedPosts;
}

export async function createPost(content: string, userId: string, imageUrl?: string) {
  if ((!content.trim() && !imageUrl) || !userId) {
    throw new Error('Content or image and user ID are required')
  }

  const { data, error } = await supabase.from("posts").insert([
    {
      content: content.trim(),
      author_id: userId,
      created_at: new Date().toISOString(),
      likes: 0,
      image_url: imageUrl || null,
    },
  ])

  if (error) {
    console.error("Error creating post:", error)
    throw error
  }
  return data
}

export async function likePost(postId: string, userId: string) {
  const { data, error } = await supabase.from("likes").insert([
    {
      post_id: postId,
      user_id: userId,
      created_at: new Date().toISOString(),
    },
  ])

  if (error) throw error
  return data
}

export async function unlikePost(postId: string, userId: string) {
  const { data, error } = await supabase
    .from("likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId)

  if (error) throw error
  return data
}

export async function createReply(postId: string, content: string, userId: string) {
  if (!content.trim() || !userId || !postId) {
    throw new Error('Post ID, content, and user ID are required')
  }

  const { data, error } = await supabase.from("replies").insert([
    {
      post_id: postId,
      content: content.trim(),
      author_id: userId,
      created_at: new Date().toISOString(),
    },
  ])

  if (error) {
    console.error("Error creating reply:", error)
    throw error
  }
  return data
}

export async function getReplies(postId: string) {
  const { data: replies, error } = await supabase
    .from("replies")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching replies:", error)
    return []
  }

  // Get profile data for each reply
  const transformedReplies = []
  
  for (const reply of replies || []) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("verified_user_id", reply.author_id)
      .single()

    transformedReplies.push({
      id: reply.id,
      content: reply.content,
      username: profile?.username || "anonymous",
      avatar: profile?.avatar_url || null,
      author_id: reply.author_id,
      created_at: reply.created_at,
    })
  }
  
  return transformedReplies;
}

export async function followUser(followerId: string, followingId: string) {
  const { data, error } = await supabase.from("follows").insert([
    {
      follower_id: followerId,
      following_id: followingId,
      created_at: new Date().toISOString(),
    },
  ])

  if (error) throw error
  return data
}

export async function unfollowUser(followerId: string, followingId: string) {
  const { data, error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId)

  if (error) throw error
  return data
}

export async function isFollowing(followerId: string, followingId: string) {
  const { data, error } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle()

  if (error) {
    console.error("Error checking follow status:", error)
    return false
  }
  
  return !!data
}

export async function getFollowStats(userId: string) {
  const [followersResult, followingResult] = await Promise.all([
    supabase
      .from("follows")
      .select("id", { count: 'exact' })
      .eq("following_id", userId),
    supabase
      .from("follows")
      .select("id", { count: 'exact' })
      .eq("follower_id", userId)
  ]);

  return {
    followers: followersResult.count || 0,
    following: followingResult.count || 0
  };
}

export async function getChats(userId: string) {
  const { data, error } = await supabase
    .from("chats")
    .select(`
      id,
      last_message,
      updated_at,
      participant1_id,
      participant2_id
    `)
    .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("Error fetching chats:", error)
    return []
  }

  // For each chat, get the other participant's profile info
  const chatsWithUserInfo = []
  for (const chat of data || []) {
    const otherParticipantId = chat.participant1_id === userId ? chat.participant2_id : chat.participant1_id
    
    // Get the other participant's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("verified_user_id", otherParticipantId)
      .single()

    if (!profileError && profile) {
      chatsWithUserInfo.push({
        id: chat.id,
        name: profile.username,
        lastMessage: chat.last_message || "No messages yet",
        timestamp: new Date(chat.updated_at).toLocaleDateString(),
      })
    }
  }

  return chatsWithUserInfo
}

export async function getMessages(chatId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select(`
      id,
      content,
      created_at,
      sender_id
    `)
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching messages:", error)
    return []
  }

  // For each message, get the sender's username
  const messagesWithSenderInfo = []
  for (const message of data || []) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username")
      .eq("verified_user_id", message.sender_id)
      .single()

    messagesWithSenderInfo.push({
      id: message.id,
      content: message.content,
      sender: profile?.username || "Anonymous",
      sender_id: message.sender_id,
      timestamp: new Date(message.created_at).toLocaleTimeString(),
      isOwn: false, // This will be set by the calling component
    })
  }

  return messagesWithSenderInfo
}

export async function sendMessage(chatId: string, content: string, senderId: string) {
  if (!chatId || !content.trim() || !senderId) {
    throw new Error('Chat ID, content, and sender ID are required')
  }

  const { data, error } = await supabase.from("messages").insert([
    {
      chat_id: chatId,
      content: content.trim(),
      sender_id: senderId,
      created_at: new Date().toISOString(),
    },
  ])

  if (error) {
    console.error("Error sending message:", error)
    throw error
  }
  return data
}

export async function createOrGetChat(userId1: string, userId2: string) {
  const { data, error } = await supabase.rpc('get_or_create_chat', {
    user1_id: userId1,
    user2_id: userId2
  })

  if (error) {
    console.error("Error creating/getting chat:", error)
    throw error
  }

  return data // Returns the chat ID
}

export async function getUserProfile(verifiedUserId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("verified_user_id", verifiedUserId)
    .maybeSingle()

  if (error) {
    console.error("Error fetching user profile:", error)
    return null
  }

  return data
}

export async function getAllUsers(currentUserId?: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("verified_user_id, username, bio, avatar_url, is_verified")
    .neq("verified_user_id", currentUserId || "")
    .order("username", { ascending: true })

  if (error) {
    console.error("Error fetching users:", error)
    return []
  }

  return data || []
}
