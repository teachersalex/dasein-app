import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUserPosts, getFeedPosts, getPost, uploadPost, deletePost } from '../lib/posts'
import { getFollowers, getFollowing, getUserByUsername, followUser, unfollowUser, isFollowing } from '../lib/follows'

// ==========================================
// FEED
// ==========================================

export function useFeed(userId) {
  return useQuery({
    queryKey: ['feed', userId],
    queryFn: async () => {
      const following = await getFollowing(userId)
      
      if (following.length === 0) {
        return { posts: [], profiles: {}, empty: true }
      }

      const profilesMap = {}
      following.forEach(p => {
        profilesMap[p.id] = p
      })

      const followingIds = following.map(p => p.id)
      const posts = await getFeedPosts(followingIds)
      
      return { posts, profiles: profilesMap, empty: posts.length === 0 }
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2  // 2 min
  })
}

// ==========================================
// POSTS
// ==========================================

export function useUserPosts(userId) {
  return useQuery({
    queryKey: ['posts', userId],
    queryFn: () => getUserPosts(userId),
    enabled: !!userId
  })
}

export function usePost(postId) {
  return useQuery({
    queryKey: ['post', postId],
    queryFn: () => getPost(postId),
    enabled: !!postId
  })
}

export function useCreatePost() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ userId, photoData, caption, filter }) => 
      uploadPost(userId, photoData, caption, filter),
    
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['posts', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    }
  })
}

export function useDeletePost() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ postId, storagePath }) => deletePost(postId, storagePath),
    
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    }
  })
}

// ==========================================
// PROFILE
// ==========================================

export function useProfileByUsername(username) {
  return useQuery({
    queryKey: ['profile', username],
    queryFn: () => getUserByUsername(username),
    enabled: !!username
  })
}

// ==========================================
// FOLLOWERS / FOLLOWING
// ==========================================

export function useFollowers(userId) {
  return useQuery({
    queryKey: ['followers', userId],
    queryFn: () => getFollowers(userId),
    enabled: !!userId
  })
}

export function useFollowing(userId) {
  return useQuery({
    queryKey: ['following', userId],
    queryFn: () => getFollowing(userId),
    enabled: !!userId
  })
}

export function useIsFollowing(currentUserId, targetUserId) {
  return useQuery({
    queryKey: ['isFollowing', currentUserId, targetUserId],
    queryFn: () => isFollowing(currentUserId, targetUserId),
    enabled: !!currentUserId && !!targetUserId && currentUserId !== targetUserId
  })
}

export function useFollow() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ currentUserId, targetUserId }) => 
      followUser(currentUserId, targetUserId),
    
    onSuccess: (_, { currentUserId, targetUserId }) => {
      queryClient.invalidateQueries({ queryKey: ['following', currentUserId] })
      queryClient.invalidateQueries({ queryKey: ['followers', targetUserId] })
      queryClient.invalidateQueries({ queryKey: ['isFollowing', currentUserId, targetUserId] })
      queryClient.invalidateQueries({ queryKey: ['feed', currentUserId] })
    }
  })
}

export function useUnfollow() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ currentUserId, targetUserId }) => 
      unfollowUser(currentUserId, targetUserId),
    
    onSuccess: (_, { currentUserId, targetUserId }) => {
      queryClient.invalidateQueries({ queryKey: ['following', currentUserId] })
      queryClient.invalidateQueries({ queryKey: ['followers', targetUserId] })
      queryClient.invalidateQueries({ queryKey: ['isFollowing', currentUserId, targetUserId] })
      queryClient.invalidateQueries({ queryKey: ['feed', currentUserId] })
    }
  })
}