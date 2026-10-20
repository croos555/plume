import { invoke } from '@tauri-apps/api/core'

export interface FileData {
  path: string
  content: string
}

export interface Startup {
  files: string[]
  action: string | null
  locale: string
}

export interface DefaultAppStatus {
  isDefault: boolean | null
  method: 'direct' | 'dialog'
}

export const api = {
  windowReady: () => invoke<Startup>('window_ready'),
  readFile: (path: string) => invoke<FileData>('read_file', { path }),
  writeFile: (path: string, content: string) => invoke<void>('write_file', { path, content }),
  exportFile: (path: string, content: string) => invoke<void>('export_file', { path, content }),
  pathExists: (path: string) => invoke<boolean>('path_exists', { path }),
  openWindow: (path?: string) => invoke<void>('open_window', { path: path ?? null }),
  print: () => invoke<void>('print_page'),
  cancelQuit: () => invoke<void>('cancel_quit'),
  mdDefaultStatus: () => invoke<DefaultAppStatus>('md_default_status'),
  makeMdDefault: () => invoke<void>('make_md_default'),
  copyImage: (source: string, docPath: string) => invoke<string>('copy_image', { source, docPath }),
  saveImage: (docPath: string, name: string, data: string) => invoke<string>('save_image', { docPath, name, data })
}

export const isMac = navigator.userAgent.includes('Mac')
export const isWindows = navigator.userAgent.includes('Windows')
export const modKey = isMac ? '⌘' : 'Ctrl+'

export function errorMessage(e: unknown): string {
  return typeof e === 'string' ? e : e instanceof Error ? e.message : String(e)
}
