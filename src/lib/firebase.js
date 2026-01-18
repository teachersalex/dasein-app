import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Projeto: dasein-b052d
const firebaseConfig = {
  apiKey: "AIzaSyDH2dEaf-rjULqaBdJLA2K97ORYn4uxcU8",
  authDomain: "dasein-b052d.firebaseapp.com",
  projectId: "dasein-b052d",
  storageBucket: "dasein-b052d.firebasestorage.app",
  messagingSenderId: "438461969448",
  appId: "1:438461969448:web:e72eeeb2263901b486711d"
}

const app = initializeApp(firebaseConfig)

// 🔒 NÃO RENOMEAR - todo o app importa esses nomes
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app