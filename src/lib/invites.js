import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  increment,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore'
import { db } from './firebase'

// 🔒 Formato: DSEIN-XXXXX (5 chars alfanuméricos)
export function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'DSEIN-'
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function validateInviteCode(code) {
  const normalizedCode = code.trim().toUpperCase()
  
  if (!normalizedCode.match(/^DSEIN-[A-Z0-9]{5}$/)) {
    return { valid: false, error: 'Formato inválido' }
  }
  
  try {
    const inviteRef = doc(db, 'invites', normalizedCode)
    const snapshot = await getDoc(inviteRef)
    
    if (!snapshot.exists()) {
      return { valid: false, error: 'Convite inválido ou expirado' }
    }
    
    const invite = snapshot.data()
    
    if (invite.status === 'used') {
      return { valid: false, error: 'Este convite já foi usado' }
    }
    
    return { valid: true, invite: { id: snapshot.id, ...invite } }
  } catch (error) {
    console.error('Error validating invite:', error)
    return { valid: false, error: 'Erro ao validar. Tente novamente.' }
  }
}

// 🔧 FIX 3.1: useInvite com transaction para evitar race condition
export async function useInvite(code, userId) {
  const normalizedCode = code.trim().toUpperCase()
  
  try {
    const inviteRef = doc(db, 'invites', normalizedCode)
    
    const result = await runTransaction(db, async (transaction) => {
      const inviteSnap = await transaction.get(inviteRef)
      
      if (!inviteSnap.exists()) {
        throw new Error('Convite inválido ou expirado')
      }
      
      const invite = inviteSnap.data()
      
      // Verifica se já foi usado (dentro da transaction)
      if (invite.status === 'used') {
        throw new Error('Este convite já foi usado')
      }
      
      // Marca como usado atomicamente
      transaction.update(inviteRef, {
        usedBy: userId,
        usedAt: serverTimestamp(),
        status: 'used'
      })
      
      return { createdBy: invite.createdBy }
    })
    
    // Criar atividade fora da transaction (não crítico)
    if (result.createdBy) {
      await createInviteUsedActivity(result.createdBy, userId)
    }
    
    return { success: true, invitedBy: result.createdBy }
  } catch (error) {
    console.error('Error using invite:', error)
    return { success: false, error: error.message || 'Erro ao usar convite.' }
  }
}

async function createInviteUsedActivity(inviterUserId, newUserId) {
  try {
    const activityId = `invite_${newUserId}_${Date.now()}`
    
    await setDoc(doc(db, 'activities', activityId), {
      type: 'invite_used',
      userId: newUserId,
      targetUserId: inviterUserId,
      createdAt: serverTimestamp()
    })
    
    return { success: true }
  } catch (error) {
    console.error('Error creating invite activity:', error)
    return { success: false }
  }
}

// 🔧 FIX 3.2: createInvite com transaction para atomicidade
export async function createInvite(userId) {
  try {
    // Gerar código único primeiro
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
    
    const userRef = doc(db, 'users', userId)
    const inviteRef = doc(db, 'invites', code)
    
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef)
      
      if (!userSnap.exists()) {
        throw new Error('Usuário não encontrado')
      }
      
      const user = userSnap.data()
      
      // -1 = convites infinitos (admin)
      if (user.invitesAvailable !== -1 && user.invitesAvailable <= 0) {
        throw new Error('Você não tem convites disponíveis')
      }
      
      // Criar convite
      transaction.set(inviteRef, {
        code,
        createdBy: userId,
        createdAt: serverTimestamp(),
        usedBy: null,
        usedAt: null,
        status: 'available'
      })
      
      // Decrementar contador (se não for admin)
      if (user.invitesAvailable !== -1) {
        transaction.update(userRef, {
          invitesAvailable: increment(-1)
        })
      }
    })
    
    return { success: true, code }
  } catch (error) {
    console.error('Error creating invite:', error)
    return { success: false, error: error.message || 'Erro ao criar convite.' }
  }
}

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
    console.error('Error getting user invites:', error)
    return []
  }
}

// 🔧 FIX 3.3: getInviteActivities com orderBy + limit no Firestore
export async function getInviteActivities(userId, limitCount = 20) {
  try {
    const q = query(
      collection(db, 'activities'),
      where('targetUserId', '==', userId),
      where('type', '==', 'invite_used'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    )
    
    const snapshot = await getDocs(q)
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('Error getting invite activities:', error)
    return []
  }
}

export async function purgeExpiredInvites(userId) {
  const EXPIRY_HOURS = 12
  const now = Date.now()
  const expiryMs = EXPIRY_HOURS * 60 * 60 * 1000
  
  try {
    const q = query(
      collection(db, 'invites'),
      where('createdBy', '==', userId)
    )
    
    const snapshot = await getDocs(q)
    let deletedCount = 0
    
    for (const docSnap of snapshot.docs) {
      const invite = docSnap.data()
      
      if (invite.status !== 'available') continue
      
      const createdAt = invite.createdAt?.toMillis() || 0
      const age = now - createdAt
      
      if (age > expiryMs) {
        await deleteDoc(doc(db, 'invites', docSnap.id))
        deletedCount++
      }
    }
    
    return { success: true, deleted: deletedCount }
  } catch (error) {
    console.error('Error purging invites:', error)
    return { success: false, error: 'Erro ao limpar convites' }
  }
}