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

// 🔒 ORDEM DOS PARAMS: uploadPost(userId, photoData, caption, filterName)
// Chamado em Home.jsx - NÃO alterar ordem
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

// ⚠️ Firestore 'in' query max 30 items - chunking necessário
export async function getFeedPosts(followingIds, limit = 50) {
  if (!followingIds || followingIds.length === 0) {
    return []
  }

  try {
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

    allPosts.sort((a, b) => b.createdAt - a.createdAt)
    return allPosts.slice(0, limit)
  } catch (error) {
    console.error('Error getting feed posts:', error)
    return []
  }
}

export async function deletePost(postId, storagePath) {
  try {
    await deleteDoc(doc(db, 'posts', postId))
    
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