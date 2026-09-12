import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { createProfile, type Profile } from './scheduler'
import { parseBackup, validateProfile } from './backup'

export const DATABASE_NAME = 'hsk-level-one-learning'

interface LearningDatabase extends DBSchema {
  profile: { key: string; value: Profile }
}

let database: Promise<IDBPDatabase<LearningDatabase>> | undefined
let pendingWrite: Promise<void> = Promise.resolve()

function storageError(error: unknown): Error {
  const reason = error instanceof Error ? error.message : String(error)
  return new Error(`Der lokale Lernstand konnte nicht gespeichert oder geladen werden. ${reason}`, { cause: error })
}

function getDatabase(): Promise<IDBPDatabase<LearningDatabase>> {
  if (!database) {
    database = openDB<LearningDatabase>(DATABASE_NAME, 1, {
      upgrade(db) { db.createObjectStore('profile') },
      blocking() {
        void database?.then(db => db.close())
        database = undefined
      },
      terminated() { database = undefined },
    }).catch(error => {
      database = undefined
      throw error
    })
  }
  return database
}

export async function loadProfile(validIds?: Iterable<string>, validLessonIds?: Iterable<string>, validPracticeIds?: Iterable<string>): Promise<Profile> {
  try {
    await pendingWrite
    const db = await getDatabase()
    const saved = await db.get('profile', 'active')
    return saved === undefined ? createProfile() : validateProfile(saved, validIds, validLessonIds, validPracticeIds)
  } catch (error) {
    // Never silently replace unreadable existing progress with an empty profile.
    throw storageError(error)
  }
}

export function saveProfile(profile: Profile): Promise<void> {
  // Capture this version now. UI updates can continue while the transaction runs.
  let snapshot: Profile
  try { snapshot = validateProfile(profile) } catch (error) { return Promise.reject(storageError(error)) }
  const write = pendingWrite.then(async () => {
    const db = await getDatabase()
    const transaction = db.transaction('profile', 'readwrite')
    await transaction.store.put(snapshot, 'active')
    await transaction.done
  }).catch(error => { throw storageError(error) })
  // Preserve call order and permit retries, but return the rejection to the UI.
  pendingWrite = write.catch(() => undefined)
  return write
}

/** Call only after the UI has warned that the current profile will be replaced. */
export async function restoreBackup(json: string, validIds: Iterable<string>, validLessonIds?: Iterable<string>, validPracticeIds?: Iterable<string>): Promise<Profile> {
  const profile = parseBackup(json, validIds, validLessonIds, validPracticeIds)
  await saveProfile(profile)
  return profile
}

export async function resetProfile(): Promise<Profile> {
  const profile = createProfile()
  await saveProfile(profile)
  return profile
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

/** Closes the connection, for clean app/test lifecycles; does not erase data. */
export async function closeStorage(): Promise<void> {
  await pendingWrite
  const connection = database
  database = undefined
  if (connection) (await connection).close()
}
