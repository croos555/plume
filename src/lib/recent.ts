// Recently opened documents, most recent first, shared by every window.

const KEY = 'plume.recent'
const MAX = 12

export function getRecent(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list.filter((p) => typeof p === 'string') : []
  } catch {
    return []
  }
}

function save(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    // ignore
  }
}

export function addRecent(path: string) {
  save([path, ...getRecent().filter((p) => p !== path)])
}

export function removeRecent(path: string) {
  save(getRecent().filter((p) => p !== path))
}
