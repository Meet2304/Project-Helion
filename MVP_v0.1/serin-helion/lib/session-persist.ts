import type { SessionPersistData } from "@/lib/demo-store"

const DB_NAME = "serin_helion"
const DB_VERSION = 1
const STORE_NAME = "session"

interface SerinSessionData {
  sessionId: string
  sessionData: SessionPersistData
  savedAt: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "sessionId" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveSession(sessionData: SessionPersistData): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const record: SerinSessionData = {
      sessionId: sessionData.sessionId,
      sessionData,
      savedAt: new Date().toISOString(),
    }
    const request = store.put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    db.close()
  })
}

export async function loadSession(sessionId: string): Promise<SessionPersistData | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(sessionId)
    request.onsuccess = () => {
      const record = request.result as SerinSessionData | undefined
      resolve(record ? record.sessionData : null)
    }
    request.onerror = () => reject(request.error)
    db.close()
  })
}

export async function loadAnySession(): Promise<SessionPersistData | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => {
      const records = request.result as SerinSessionData[]
      if (records.length === 0) {
        resolve(null)
        return
      }
      const latest = records.sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      )[0]
      resolve(latest.sessionData)
    }
    request.onerror = () => reject(request.error)
    db.close()
  })
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(sessionId)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    db.close()
  })
}