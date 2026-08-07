// ======================================================================
// FIREBASE CONFIG LAYER — env-var driven, safe with zero keys present.
// Nothing here throws if NEXT_PUBLIC_FIREBASE_* vars are missing; the app
// just runs in local-only (no cloud sync) mode until they're set.
// See .env.local.example + docs/HUONG_DAN_FIREBASE.md for setup.
// ======================================================================

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

/** True once the minimum required keys are present. */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)

let appInstance: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null

function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null
  if (typeof window === 'undefined') return null // never init on the server
  if (!appInstance) {
    appInstance = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig)
  }
  return appInstance
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp()
  if (!app) return null
  if (!authInstance) authInstance = getAuth(app)
  return authInstance
}

export function getFirebaseDb(): Firestore | null {
  const app = getFirebaseApp()
  if (!app) return null
  if (!dbInstance) dbInstance = getFirestore(app)
  return dbInstance
}
