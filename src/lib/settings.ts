import { useSyncExternalStore } from 'react'
import type { Lang } from './i18n'

// Preferences of this computer, shared by every window (localStorage + the storage event).

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  lang: 'system' | Lang
  textSize: number
  readingFont: 'serif' | 'sans'
  autosave: boolean
  spellcheck: boolean
  openInEdit: boolean
  smartPaste: boolean
  /** The "open .md files with Plume" question was answered */
  defaultAppAsked: boolean
  showPreview: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  lang: 'system',
  textSize: 17,
  readingFont: 'serif',
  autosave: false,
  spellcheck: true,
  openInEdit: false,
  smartPaste: true,
  defaultAppAsked: false,
  showPreview: true
}

const KEY = 'plume.settings'
let current: Settings = load()
const listeners = new Set<() => void>()

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function emit() {
  for (const l of listeners) l()
}

window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    current = load()
    emit()
  }
})

export function getSettings(): Settings {
  return current
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // storage full or unavailable: keep the change for this window only
  }
  emit()
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current
  )
}
