import { 
  doc, 
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  increment,
  serverTimestamp 
} from 'firebase/firestore'
import { db } from './firebase'

// ==========================================
// FOLLOW / UNFOLLOW
// ==========================================

export async function followUser(currentUserId, targetUserId) {
  if (currentUserId === targetUserId) {
    return { success: false, error: 'Você não pode seguir a si mesmo' }
  }

  try {
    const followId = `${currentUserId}_${targetUserId}`
    const followRef = doc(db, 'follows', followId)
    
    // Check if already following
    const existing = await getDoc(followRef)
    if (existing.exists()) {
      return { success: false, error: 'Você já segue este usuário' }
    }

    // Create follow document
    await setDoc(followRef, {
      followerId: currentUserId,
      followingId: targetUserId,
      createdAt: serverTimestamp()
    })

    // Update counters
    const currentUserRef = doc(db, 'users', currentUserId)
    const targetUserRef = doc(db, 'users', targetUserId)

    await updateDoc(currentUserRef, {
      followingCount: increment(1)
    })

    await updateDoc(targetUserRef, {
      followersCount: increment(1)
    })

    return { success: true }
  } catch (error) {
    console.error('Error following user:', error)
    return { success: false, error: 'Erro ao seguir usuário' }
  }
}

export async function unfollowUser(currentUserId, targetUserId) {
  try {
    const followId = `${currentUserId}_${targetUserId}`
    const followRef = doc(db, 'follows', followId)

    // Check if following
    const existing = await getDoc(followRef)
    if (!existing.exists()) {
      return { success: false, error: 'Você não segue este usuário' }
    }

    // Delete follow document
    await deleteDoc(followRef)

    // Update counters
    const currentUserRef = doc(db, 'users', currentUserId)
    const targetUserRef = doc(db, 'users', targetUserId)

    await updateDoc(currentUserRef, {
      followingCount: increment(-1)
    })

    await updateDoc(targetUserRef, {
      followersCount: increment(-1)
    })

    return { success: true }
  } catch (error) {
    console.error('Error unfollowing user:', error)
    return { success: false, error: 'Erro ao deixar de seguir' }
  }
}

// ==========================================
// CHECK FOLLOW STATUS
// ==========================================

export async function isFollowing(currentUserId, targetUserId) {
  try {
    const followId = `${currentUserId}_${targetUserId}`
    const followRef = doc(db, 'follows', followId)
    const snapshot = await getDoc(followRef)
    return snapshot.exists()
  } catch (error) {
    console.error('Error checking follow status:', error)
    return false
  }
}

// ==========================================
// GET FOLLOWERS / FOLLOWING
// ==========================================

export async function getFollowers(userId) {
  try {
    const q = query(
      collection(db, 'follows'),
      where('followingId', '==', userId)
    )
    
    const snapshot = await getDocs(q)
    const followerIds = []
    
    snapshot.forEach(doc => {
      followerIds.push(doc.data().followerId)
    })

    // Get profiles
    const profiles = await Promise.all(
      followerIds.map(id => getUserProfileById(id))
    )

    return profiles.filter(Boolean)
  } catch (error) {
    console.error('Error getting followers:', error)
    return []
  }
}

export async function getFollowing(userId) {
  try {
    const q = query(
      collection(db, 'follows'),
      where('followerId', '==', userId)
    )
    
    const snapshot = await getDocs(q)
    const followingIds = []
    
    snapshot.forEach(doc => {
      followingIds.push(doc.data().followingId)
    })

    // Get profiles
    const profiles = await Promise.all(
      followingIds.map(id => getUserProfileById(id))
    )

    return profiles.filter(Boolean)
  } catch (error) {
    console.error('Error getting following:', error)
    return []
  }
}

// Helper to get profile by ID
async function getUserProfileById(uid) {
  try {
    const docRef = doc(db, 'users', uid)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() }
    }
    return null
  } catch (error) {
    return null
  }
}

// ==========================================
// GET PROFILE BY USERNAME
// ==========================================

export async function getUserByUsername(username) {
  try {
    const q = query(
      collection(db, 'users'),
      where('username', '==', username.toLowerCase())
    )
    
    const snapshot = await getDocs(q)
    
    if (snapshot.empty) {
      return null
    }

    const doc = snapshot.docs[0]
    return { id: doc.id, ...doc.data() }
  } catch (error) {
    console.error('Error getting user by username:', error)
    return null
  }
}
