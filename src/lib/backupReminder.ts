const LAST_EXPORT_KEY = 'hanzi:last-export-at'

export function readLastExport(): string | null {
  try {
    const value = localStorage.getItem(LAST_EXPORT_KEY)
    return value && Number.isFinite(Date.parse(value)) ? value : null
  } catch {
    return null
  }
}

export function rememberExport(at: string): void {
  localStorage.setItem(LAST_EXPORT_KEY, at)
}

export function backupIsOverdue(lastExport: string | null, now = new Date()): boolean {
  if (!lastExport) return true
  const due = new Date(lastExport)
  const day = due.getDate()
  due.setDate(1)
  due.setMonth(due.getMonth() + 1)
  const lastDay = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate()
  due.setDate(Math.min(day, lastDay))
  return now.getTime() > due.getTime()
}
