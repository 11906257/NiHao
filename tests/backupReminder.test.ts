import { expect, it } from 'vitest'
import { backupIsOverdue } from '../src/lib/backupReminder'

it('reminds only after a calendar month and resets after export', () => {
  expect(backupIsOverdue('2026-01-31T12:00:00', new Date('2026-02-28T12:00:00'))).toBe(false)
  expect(backupIsOverdue('2026-01-31T12:00:00', new Date('2026-02-28T12:00:01'))).toBe(true)
  expect(backupIsOverdue('2026-02-28T12:00:01', new Date('2026-02-28T12:00:02'))).toBe(false)
  expect(backupIsOverdue(null, new Date('2026-02-02T12:00:00'))).toBe(true)
})
