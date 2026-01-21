import { 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  limit,
  serverTimestamp 
} from 'firebase/firestore'
import { db } from './firebase'

// ⚠️ CRITICAL - composite key evita duplicatas
// Formato: {userId}_{postId}
function getLikeId(userId, postId) {
  return `${userId}_${postId}`
}

// Curtir post
export async function likePost(userId, postId, postOwnerId) {
  try {
    const likeId = getLikeId(userId, postId)
    
    // 🔒 STRUCTURE - bate com Security Rules
    await setDoc(doc(db, 'likes', likeId), {
      userId,          // quem curtiu
      postId,          // post curtido
      postOwnerId,     // dono do post (pra aba atividades)
      createdAt: serverTimestamp()
    })
    
    return { success: true }
  } catch (error) {
    console.error('Error liking post:', error)
    return { success: false, error }
  }
}

// Descurtir post
export async function unlikePost(userId, postId) {
  try {
    const likeId = getLikeId(userId, postId)
    await deleteDoc(doc(db, 'likes', likeId))
    return { success: true }
  } catch (error) {
    console.error('Error unliking post:', error)
    return { success: false, error }
  }
}

// Checar se usuário curtiu post
export async function hasLiked(userId, postId) {
  try {
    const likeId = getLikeId(userId, postId)
    const likeDoc = await getDoc(doc(db, 'likes', likeId))
    return likeDoc.exists()
  } catch (error) {
    console.error('Error checking like:', error)
    return false
  }
}

// Buscar likes de um post
export async function getPostLikes(postId) {
  try {
    const q = query(
      collection(db, 'likes'),
      where('postId', '==', postId)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('Error getting likes:', error)
    return []
  }
}

// 🔧 FIX: orderBy + limit no Firestore (não em memória)
export async function getReceivedLikes(userId, limitCount = 20) {
  try {
    const q = query(
      collection(db, 'likes'),
      where('postOwnerId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    )
    const snapshot = await getDocs(q)
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('Error getting received likes:', error)
    return []
  }
}