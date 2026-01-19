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
  
  // 🔒 Regex do formato - mudar quebra convites existentes
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

// 🔒 useInvite(code, userId) - chamado após auth no Auth.jsx
export async function useInvite(code, userId) {
  const normalizedCode = code.trim().toUpperCase()
  
  try {
    const inviteRef = doc(db, 'invites', normalizedCode)
    const inviteSnap = await getDoc(inviteRef)
    
    if (!inviteSnap.exists()) {
      return { success: false, error: 'Convite não encontrado' }
    }
    
    const invite = inviteSnap.data()
    
    // Atualizar convite como usado
    await updateDoc(inviteRef, {
      usedBy: userId,
      usedAt: serverTimestamp(),
      status: 'used'
    })
    
    // 🔔 Criar atividade para quem convidou
    if (invite.createdBy) {
      await createInviteUsedActivity(invite.createdBy, userId)
    }
    
    return { success: true, invitedBy: invite.createdBy }
  } catch (error) {
    return { success: false, error: 'Erro ao usar convite.' }
  }
}

// 🔔 Notificar criador do convite que alguém entrou
async function createInviteUsedActivity(inviterUserId, newUserId) {
  try {
    const activityId = `invite_${newUserId}_${Date.now()}`
    
    await setDoc(doc(db, 'activities', activityId), {
      type: 'invite_used',
      userId: newUserId,           // quem entrou
      targetUserId: inviterUserId, // quem convidou (recebe a notificação)
      createdAt: serverTimestamp()
    })
    
    return { success: true }
  } catch (error) {
    console.error('Error creating invite activity:', error)
    return { success: false }
  }
}

export async function createInvite(userId) {
  try {
    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)
    
    if (!userSnap.exists()) {
      return { success: false, error: 'Usuário não encontrado' }
    }
    
    const user = userSnap.data()
    
    // -1 = convites infinitos (admin)
    if (user.invitesAvailable !== -1 && user.invitesAvailable <= 0) {
      return { success: false, error: 'Você não tem convites disponíveis' }
    }
    
    // Retry loop para código único
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
    
    const inviteRef = doc(db, 'invites', code)
    await setDoc(inviteRef, {
      code,
      createdBy: userId,
      createdAt: serverTimestamp(),
      usedBy: null,
      usedAt: null,
      status: 'available'
    })
    
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

// 🔍 Buscar atividades de convite para um usuário
export async function getInviteActivities(userId, limitCount = 20) {
  try {
    const q = query(
      collection(db, 'activities'),
      where('targetUserId', '==', userId),
      where('type', '==', 'invite_used')
    )
    
    const snapshot = await getDocs(q)
    
    const activities = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
      .slice(0, limitCount)
    
    return activities
  } catch (error) {
    console.error('Error getting invite activities:', error)
    return []
  }
}