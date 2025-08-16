"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { getChats, getMessages, sendMessage, getUserProfile, createOrGetChat } from "@/lib/supabase-actions"
import { supabase } from "@/lib/supabase"

interface Chat {
  id: string
  name: string
  lastMessage: string
  timestamp: string
}

interface Message {
  id: string
  content: string
  sender: string
  timestamp: string
  sender_id: string
  isOwn: boolean
}

interface CurrentUser {
  id: string
  username: string
  bio: string
  interests: string
  isVerified: boolean
  avatar_url: string | null
}

function ChatPageContent() {
  const [chats, setChats] = useState<Chat[]>([])
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    checkUserSession()
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadChats()
    }
  }, [currentUser])

  useEffect(() => {
    // Check if there's a chatId in the URL parameters
    const chatId = searchParams.get('chatId')
    if (chatId && !selectedChat) {
      setSelectedChat(chatId)
    }
  }, [searchParams, selectedChat])

  useEffect(() => {
    if (selectedChat && currentUser) {
      loadMessages(selectedChat)
    }
  }, [selectedChat, currentUser])

  // Real-time subscription for messages in the current chat
  useEffect(() => {
    if (!selectedChat || !currentUser) return

    const messageSubscription = supabase
      .channel(`messages:${selectedChat}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${selectedChat}`
        },
        async (payload) => {
          console.log('New message received:', payload.new)
          
          // Get sender's profile info
          const { data: profile } = await supabase
            .from("profiles")
            .select("username")
            .eq("verified_user_id", payload.new.sender_id)
            .single()

          const newMessage: Message = {
            id: payload.new.id,
            content: payload.new.content,
            sender: profile?.username || "Anonymous",
            sender_id: payload.new.sender_id,
            timestamp: new Date(payload.new.created_at).toLocaleTimeString(),
            isOwn: payload.new.sender_id === currentUser.id
          }

          // Add new message to the messages array
          setMessages(prevMessages => [...prevMessages, newMessage])
        }
      )
      .subscribe()

    return () => {
      messageSubscription.unsubscribe()
    }
  }, [selectedChat, currentUser])

  // Real-time subscription for chat updates (last message changes)
  useEffect(() => {
    if (!currentUser) return

    const chatSubscription = supabase
      .channel('chats:updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chats'
        },
        (payload) => {
          console.log('Chat updated:', payload.new)
          // Refresh chat list when any chat gets updated
          loadChats()
        }
      )
      .subscribe()

    return () => {
      chatSubscription.unsubscribe()
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
    } finally {
      setIsLoading(false)
    }
  }

  const loadChats = async () => {
    if (!currentUser) return
    
    try {
      const fetchedChats = await getChats(currentUser.id)
      setChats(fetchedChats)
    } catch (error) {
      console.error("Error loading chats:", error)
    }
  }

  const loadMessages = async (chatId: string) => {
    try {
      const fetchedMessages = await getMessages(chatId)
      // Mark messages as own based on current user ID
      const messagesWithOwnership = fetchedMessages.map(msg => ({
        ...msg,
        isOwn: msg.sender_id === currentUser?.id
      }))
      setMessages(messagesWithOwnership)
    } catch (error) {
      console.error("Error loading messages:", error)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedChat || !currentUser) return

    const messageText = newMessage.trim()
    setNewMessage("") // Clear input immediately for better UX

    try {
      await sendMessage(selectedChat, messageText, currentUser.id)
      // Note: We don't need to manually refresh messages anymore!
      // The real-time subscription will automatically add the new message
      
      // We also don't need to refresh chats manually
      // The chat update subscription will handle that too
    } catch (error) {
      console.error("Error sending message:", error)
      // Restore message text if sending failed
      setNewMessage(messageText)
    }
  }

  if (isLoading || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#fff6c9" }}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#fff6c9" }}>
      {/* Navigation */}
      <nav className="bg-white shadow-sm px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold" style={{ color: "#1c7f8f" }}>
            Hyumane
          </Link>
          <div className="flex items-center space-x-4">
          
            <Link href="/feed" className="font-medium text-gray-600 hover:text-gray-900">
              Feed
            </Link>
            <Link href="/chat" className="font-medium" style={{ color: "#1c7f8f" }}>
              Chat
            </Link>
            <Link href="/discover" className="font-medium text-gray-600 hover:text-gray-900">
              Discover
            </Link>
            <Link href="/profile" className="font-medium text-gray-600 hover:text-gray-900">
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

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ height: "600px" }}>
          <div className="flex h-full">
            {/* Chat List */}
            <div className="w-1/3 border-r border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Messages</h2>
              </div>
              <div className="overflow-y-auto h-full">
                {chats.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <p className="mb-2">No conversations yet</p>
                    <p className="text-sm">Start chatting with people you follow!</p>
                  </div>
                ) : (
                  chats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => setSelectedChat(chat.id)}
                      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                        selectedChat === chat.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="flex items-center">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
                          style={{ backgroundColor: "#1c7f8f" }}
                        >
                          <span className="text-white font-bold">{chat.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{chat.name}</div>
                          <div className="text-sm text-gray-500 truncate">{chat.lastMessage}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 flex flex-col">
              {selectedChat ? (
                <>
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="font-semibold">{chats.find((c) => c.id === selectedChat)?.name}</h3>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500 mt-8">
                        <p>No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div key={message.id} className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-xs px-4 py-2 rounded-lg ${
                              message.isOwn ? "text-white" : "bg-gray-100 text-gray-800"
                            }`}
                            style={message.isOwn ? { backgroundColor: "#1c7f8f" } : {}}
                          >
                            <p>{message.content}</p>
                            <p className={`text-xs mt-1 ${message.isOwn ? "text-blue-100" : "text-gray-500"}`}>
                              {message.timestamp}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                        style={{ backgroundColor: "#1c7f8f", color: "white" }}
                      >
                        Send
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <p className="mb-2">Select a chat to start messaging</p>
                    <p className="text-sm">Messages appear instantly with real-time updates</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#fff6c9" }}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  )
}
