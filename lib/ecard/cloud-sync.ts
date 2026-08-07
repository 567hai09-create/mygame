// ======================================================================
// CLOUD SYNC — mirrors the local PlayerProfile (localStorage) into
// Firestore at profiles/{uid} so it survives across devices/browsers.
// Local storage stays the source of truth for instant reads/writes;
// this module only pulls-on-login and pushes-on-change.
// ======================================================================

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/config'
import type { PlayerProfile } from './profile'

const COLLECTION = 'profiles'

/** Fetch the cloud copy of a profile, or null if none exists yet / no Firebase. */
export async function pullCloudProfile(uid: string): Promise<PlayerProfile | null> {
  const db = getFirebaseDb()
  if (!db) return null
  const snap = await getDoc(doc(db, COLLECTION, uid))
  if (!snap.exists()) return null
  const { updatedAt: _updatedAt, ...profile } = snap.data() as PlayerProfile & { updatedAt?: unknown }
  return profile as PlayerProfile
}

/** Upsert the local profile into Firestore. No-op (silently) with no Firebase configured. */
export async function pushCloudProfile(uid: string, profile: PlayerProfile): Promise<void> {
  const db = getFirebaseDb()
  if (!db) return
  await setDoc(doc(db, COLLECTION, uid), { ...profile, updatedAt: serverTimestamp() }, { merge: true })
}

/**
 * Merge a freshly-pulled cloud profile into the current local one.
 * Never lets progress regress: winnings / wins / forfeits take the max of
 * the two, so signing in on a second device can't erase what either side
 * already earned.
 */
export function mergeProfiles(local: PlayerProfile, cloud: PlayerProfile): PlayerProfile {
  const totalAccumulatedWinnings = Math.max(local.totalAccumulatedWinnings, cloud.totalAccumulatedWinnings)
  return {
    ...local,
    // Prefer whichever side actually has a custom (unlocked) name set.
    playerName: local.customNameUnlocked ? local.playerName : cloud.customNameUnlocked ? cloud.playerName : local.playerName,
    totalAccumulatedWinnings,
    wins: Math.max(local.wins, cloud.wins),
    forfeits: Math.max(local.forfeits, cloud.forfeits),
    customNameUnlocked: local.customNameUnlocked || cloud.customNameUnlocked,
    currentTitleId: cloud.totalAccumulatedWinnings > local.totalAccumulatedWinnings ? cloud.currentTitleId : local.currentTitleId,
  }
}
