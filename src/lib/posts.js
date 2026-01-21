import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  limit as fsLimit,
  serverTimestamp 
} from 'firebase/firestore'
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from './firebase'

// 🔒 ORDEM DOS PARAMS: uploadPost(userId, photoData, caption, filterName)
export async function uploadPost(userId, photoData, caption, filterName) {
  try {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 11)
    const fileName = `photos/${userId}/${timestamp}_${randomId}.jpg`
    
    const storageRef = ref(storage, fileName)
    await uploadString(storageRef, photoData, 'data_url')
    
    const photoURL = await getDownloadURL(storageRef)
    
    await addDoc(collection(db, 'posts'), {
      userId,
      photoURL,
      storagePath: fileName,
      caption: caption || '',
      filter: filterName,
      createdAt: serverTimestamp()
    })
    
    return { success: true }
  } catch (error) {
    console.error('Upload failed:', error)
    return { success: false, error: error.message }
  }
}

export async function getUserPosts(userId) {
  try {
    const q = query(
      collection(db, 'posts'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    )
    
    const snapshot = await getDocs(q)
    
    return snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toMillis() || Date.now()
      }
    })
  } catch (error) {
    console.error('Error getting posts:', error)
    return []
  }
}

export async function getPost(postId) {
  try {
    const docRef = doc(db, 'posts', postId)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toMillis() || Date.now()
      }
    }
    return null
  } catch (error) {
    console.error('Error getting post:', error)
    return null
  }
}

// 🔧 FIX: Adicionar limit() por chunk para reduzir custos
const POSTS_PER_CHUNK = 20

export async function getFeedPosts(followingIds, totalLimit = 50) {
  if (!followingIds || followingIds.length === 0) {
    return []
  }

  try {
    // Firestore 'in' query max 30 items
    const chunks = []
    for (let i = 0; i < followingIds.length; i += 30) {
      chunks.push(followingIds.slice(i, i + 30))
    }

    let allPosts = []

    for (const chunk of chunks) {
      // 🔧 FIX: Adiciona limit() por chunk
      const q = query(
        collection(db, 'posts'),
        where('userId', 'in', chunk),
        orderBy('createdAt', 'desc'),
        fsLimit(POSTS_PER_CHUNK)
      )
      
      const snapshot = await getDocs(q)
      
      snapshot.forEach(doc => {
        const data = doc.data()
        allPosts.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toMillis() || Date.now()
        })
      })
    }

    // Ordenar todos e cortar
    allPosts.sort((a, b) => b.createdAt - a.createdAt)
    return allPosts.slice(0, totalLimit)
  } catch (error) {
    console.error('Error getting feed posts:', error)
    return []
  }
}

/*
 * 🔧 FIX: Cascade delete com batch
 * Deleta o post E todos os likes associados
 */
export async function deletePost(postId, storagePath) {
  try {
    // 1. Buscar todos os likes do post
    const likesQuery = query(
      collection(db, 'likes'),
      where('postId', '==', postId)
    )
    const likesSnap = await getDocs(likesQuery)
    
    // 2. Deletar likes em paralelo (com limite pra evitar throttling)
    const deletePromises = likesSnap.docs.map(likeDoc => 
      deleteDoc(doc(db, 'likes', likeDoc.id))
    )
    await Promise.all(deletePromises)
    
    // 3. Deletar o post
    await deleteDoc(doc(db, 'posts', postId))
    
    // 4. Deletar imagem do Storage
    if (storagePath) {
      try {
        const storageRef = ref(storage, storagePath)
        await deleteObject(storageRef)
      } catch (e) {
        console.warn('Storage delete failed (may not exist):', e)
      }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting post:', error)
    return { success: false, error: error.message }
  }
}