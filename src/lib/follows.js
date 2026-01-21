import { 
  doc, 
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  increment,
  serverTimestamp,
  runTransaction,
  documentId
} from 'firebase/firestore'
import { db } from './firebase'

// 🔒 Composite key pattern - garante unicidade e lookup O(1)
// followId = `${currentUserId}_${targetUserId}`

// 🔧 FIX: follow/unfollow com transaction para contadores consistentes
export async function followUser(currentUserId, targetUserId) {
  if (currentUserId === targetUserId) {
    return { success: false, error: 'Você não pode seguir a si mesmo' }
  }

  try {
    const followId = `${currentUserId}_${targetUserId}`
    const followRef = doc(db, 'follows', followId)
    const currentUserRef = doc(db, 'users', currentUserId)
    const targetUserRef = doc(db, 'users', targetUserId)

    await runTransaction(db, async (transaction) => {
      const followSnap = await transaction.get(followRef)
      
      if (followSnap.exists()) {
        throw new Error('Você já segue este usuário')
      }

      // Criar follow
      transaction.set(followRef, {
        followerId: currentUserId,
        followingId: targetUserId,
        createdAt: serverTimestamp()
      })

      // Atualizar contadores atomicamente
      transaction.update(currentUserRef, {
        followingCount: increment(1)
      })

      transaction.update(targetUserRef, {
        followersCount: increment(1)
      })
    })

    return { success: true }
  } catch (error) {
    console.error('Error following user:', error)
    return { success: false, error: error.message || 'Erro ao seguir usuário' }
  }
}

export async function unfollowUser(currentUserId, targetUserId) {
  try {
    const followId = `${currentUserId}_${targetUserId}`
    const followRef = doc(db, 'follows', followId)
    const currentUserRef = doc(db, 'users', currentUserId)
    const targetUserRef = doc(db, 'users', targetUserId)

    await runTransaction(db, async (transaction) => {
      const followSnap = await transaction.get(followRef)
      
      if (!followSnap.exists()) {
        throw new Error('Você não segue este usuário')
      }

      // Deletar follow
      transaction.delete(followRef)

      // Atualizar contadores atomicamente
      transaction.update(currentUserRef, {
        followingCount: increment(-1)
      })

      transaction.update(targetUserRef, {
        followersCount: increment(-1)
      })
    })

    return { success: true }
  } catch (error) {
    console.error('Error unfollowing user:', error)
    return { success: false, error: error.message || 'Erro ao deixar de seguir' }
  }
}

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

// 🔧 FIX: Buscar perfis em lote (não N+1)
async function getProfilesByIds(ids) {
  if (!ids || ids.length === 0) return []
  
  const profiles = []
  
  // Firestore 'in' query max 30 items
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30)
    
    const q = query(
      collection(db, 'users'),
      where(documentId(), 'in', chunk)
    )
    
    const snapshot = await getDocs(q)
    snapshot.forEach(doc => {
      profiles.push({ id: doc.id, ...doc.data() })
    })
  }
  
  return profiles
}

export async function getFollowers(userId) {
  try {
    const q = query(
      collection(db, 'follows'),
      where('followingId', '==', userId)
    )
    
    const snapshot = await getDocs(q)
    const followerIds = snapshot.docs.map(doc => doc.data().followerId)

    // 🔧 FIX: Busca em lote, não N+1
    return await getProfilesByIds(followerIds)
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
    const followingIds = snapshot.docs.map(doc => doc.data().followingId)

    // 🔧 FIX: Busca em lote, não N+1
    return await getProfilesByIds(followingIds)
  } catch (error) {
    console.error('Error getting following:', error)
    return []
  }
}

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

// 🔍 Busca por username - para Descoberta
export async function searchUsers(searchTerm, maxResults = 20) {
  if (!searchTerm || searchTerm.length < 1) {
    return []
  }

  try {
    const term = searchTerm.toLowerCase().trim()
    
    const q = query(
      collection(db, 'users'),
      where('username', '>=', term),
      where('username', '<=', term + '\uf8ff'),
      limit(maxResults)
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('Error searching users:', error)
    return []
  }
}