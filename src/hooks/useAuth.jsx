import { createContext, useContext, useState, useEffect } from 'react'
import { 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth'
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const AuthContext = createContext(null)

/*
 * AuthProvider — Gerenciamento de autenticação e perfil
 * 
 * Expõe:
 * - user: Firebase Auth user
 * - profile: Firestore profile (pode ser null mesmo com user)
 * - loading: estado de carregamento inicial
 * - Funções de auth e profile
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      
      if (firebaseUser) {
        const userProfile = await getUserProfile(firebaseUser.uid)
        setProfile(userProfile)
      } else {
        setProfile(null)
      }
      
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value = {
    user,
    profile,
    loading,
    setProfile,
    loginWithEmail,
    signupWithEmail,
    logout: () => signOut(auth),
    getUserProfile,
    createUserProfile,
    updateUserProfile,
    isUsernameTaken
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}

// === Auth Functions ===

async function loginWithEmail(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password)
    return { success: true, user: result.user }
  } catch (error) {
    return { success: false, error: getErrorMessage(error.code) }
  }
}

async function signupWithEmail(email, password) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    return { success: true, user: result.user }
  } catch (error) {
    return { success: false, error: getErrorMessage(error.code) }
  }
}

// === Profile Functions ===

async function getUserProfile(uid) {
  try {
    const docRef = doc(db, 'users', uid)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() }
    }
    return null
  } catch (error) {
    console.error('Erro ao buscar perfil:', error)
    return null
  }
}

/*
 * createUserProfile — Cria perfil inicial do usuário
 * 
 * Campos:
 * - invitesAvailable: 2 (padrão) ou -1 (admin, infinito)
 * - invitedBy: uid de quem convidou
 */
async function createUserProfile(uid, data) {
  try {
    const userRef = doc(db, 'users', uid)
    await setDoc(userRef, {
      displayName: data.displayName,
      username: data.username.toLowerCase(),
      email: data.email,
      photoURL: data.photoURL || null,
      status: data.status || null,
      profession: data.profession || null,
      location: data.location || null,
      role: 'user',
      invitesAvailable: 2,
      invitedBy: data.invitedBy || null,
      followersCount: 0,
      followingCount: 0,
      createdAt: serverTimestamp()
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function updateUserProfile(uid, data) {
  try {
    const userRef = doc(db, 'users', uid)
    await updateDoc(userRef, data)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function isUsernameTaken(username) {
  try {
    const q = query(
      collection(db, 'users'),
      where('username', '==', username.toLowerCase())
    )
    const snapshot = await getDocs(q)
    return !snapshot.empty
  } catch (error) {
    // Em caso de erro, assume que está em uso (seguro)
    return true
  }
}

// === Error Messages ===

function getErrorMessage(code) {
  const messages = {
    'auth/email-already-in-use': 'Este email já está em uso.',
    'auth/invalid-email': 'Email inválido.',
    'auth/weak-password': 'Senha muito fraca. Use pelo menos 6 caracteres.',
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
    'auth/network-request-failed': 'Erro de conexão.',
    'auth/invalid-credential': 'Email ou senha incorretos.'
  }
  return messages[code] || 'Erro ao autenticar. Tente novamente.'
}