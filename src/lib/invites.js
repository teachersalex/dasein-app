import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  increment,
  serverTimestamp 
} from 'firebase/firestore'
import { db } from '../lib/firebase'

// Gera código DSEIN-XXXXX
export function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'DSEIN-'
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Valida código de convite
export async function validateInviteCode(code) {
  const normalizedCode = code.trim().toUpperCase()
  
  if (!normalizedCode.match(/^DSEIN-[A-Z0-9]{5}$/)) {
    return { valid: false, error: 'Formato inválido' }
  }
  
  try {
    const inviteRef = doc(db, 'invites', normalizedCode)
    const snapshot = await getDoc(inviteRef)
    
    if (!snapshot.exists()) {
      return { valid: false, error: 'Convite não encontrado' }
    }
    
    const invite = snapshot.data()
    
    if (invite.status === 'used') {
      return { valid: false, error: 'Este convite já foi usado' }
    }
    
    return { valid: true, invite: { id: snapshot.id, ...invite } }
  } catch (error) {
    return { valid: false, error: 'Erro ao validar. Tente novamente.' }
  }
}

// Marca convite como usado
export async function useInvite(code, userId) {
  const normalizedCode = code.trim().toUpperCase()
  
  try {
    const inviteRef = doc(db, 'invites', normalizedCode)
    await updateDoc(inviteRef, {
      usedBy: userId,
      usedAt: serverTimestamp(),
      status: 'used'
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Erro ao usar convite.' }
  }
}

// Cria novo convite
export async function createInvite(userId) {
  try {
    // Checa se usuário pode criar convites
    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)
    
    if (!userSnap.exists()) {
      return { success: false, error: 'Usuário não encontrado' }
    }
    
    const user = userSnap.data()
    
    if (user.invitesAvailable !== -1 && user.invitesAvailable <= 0) {
      return { success: false, error: 'Você não tem convites disponíveis' }
    }
    
    // Gera código único
    let code
    let attempts = 0
    
    while (attempts < 5) {
      code = generateInviteCode()
      const codeRef = doc(db, 'invites', code)
      const existing = await getDoc(codeRef)
      
      if (!existing.exists()) break
      attempts++
    }
    
    if (attempts >= 5) {
      return { success: false, error: 'Erro ao gerar código. Tente novamente.' }
    }
    
    // Cria o convite
    const inviteRef = doc(db, 'invites', code)
    await setDoc(inviteRef, {
      code,
      createdBy: userId,
      createdAt: serverTimestamp(),
      usedBy: null,
      usedAt: null,
      status: 'available'
    })
    
    // Decrementa convites disponíveis
    if (user.invitesAvailable !== -1) {
      await updateDoc(userRef, {
        invitesAvailable: increment(-1)
      })
    }
    
    return { success: true, code }
  } catch (error) {
    return { success: false, error: 'Erro ao criar convite.' }
  }
}

// Lista convites do usuário
export async function getUserInvites(userId) {
  try {
    const q = query(
      collection(db, 'invites'),
      where('createdBy', '==', userId),
      orderBy('createdAt', 'desc')
    )
    
    const snapshot = await getDocs(q)
    const invites = []
    
    snapshot.forEach(doc => {
      invites.push({ id: doc.id, ...doc.data() })
    })
    
    return invites
  } catch (error) {
    return []
  }
}
