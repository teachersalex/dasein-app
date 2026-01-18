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
  serverTimestamp 
} from 'firebase/firestore'
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from './firebase'

// Upload de post
export async function uploadPost(userId, photoData, caption, filterName) {
  try {
    // Upload para Storage
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 11)
    const fileName = `photos/${userId}/${timestamp}_${randomId}.jpg`
    
    const storageRef = ref(storage, fileName)
    await uploadString(storageRef, photoData, 'data_url')
    
    const photoURL = await getDownloadURL(storageRef)
    
    // Salva no Firestore
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

// Busca posts de um usuário
export async function getUserPosts(userId) {
  try {
    const q = query(
      collection(db, 'posts'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    )
    
    const snapshot = await getDocs(q)
    const posts = []
    
    snapshot.forEach(doc => {
      const data = doc.data()
      posts.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toMillis() || Date.now()
      })
    })
    
    return posts
  } catch (error) {
    console.error('Error getting posts:', error)
    return []
  }
}

// Busca post por ID
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

// Busca posts do feed (de quem o usuário segue)
export async function getFeedPosts(followingIds, limit = 50) {
  if (!followingIds || followingIds.length === 0) {
    return []
  }

  try {
    // Firestore 'in' query supports max 30 items
    const chunks = []
    for (let i = 0; i < followingIds.length; i += 30) {
      chunks.push(followingIds.slice(i, i + 30))
    }

    let allPosts = []

    for (const chunk of chunks) {
      const q = query(
        collection(db, 'posts'),
        where('userId', 'in', chunk),
        orderBy('createdAt', 'desc')
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

    // Sort by date and limit
    allPosts.sort((a, b) => b.createdAt - a.createdAt)
    return allPosts.slice(0, limit)
  } catch (error) {
    console.error('Error getting feed posts:', error)
    return []
  }
}

// Deletar post
export async function deletePost(postId, storagePath) {
  try {
    // Deleta do Firestore
    await deleteDoc(doc(db, 'posts', postId))
    
    // Tenta deletar do Storage (pode falhar se path não existir)
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