import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDB, openDB } from 'idb'
import {
  chooseSkill,
  completeLesson,
  createProfile,
  deserializeCard,
  getDueCards,
  HISTORY_LIMIT,
  recordPractice,
  reviewVocabulary,
  serializeCard,
  type Profile,
} from '../src/lib/scheduler'
import { exportBackup, MAX_BACKUP_BYTES, parseBackup, validateProfile } from '../src/lib/backup'
import { closeStorage, DATABASE_NAME, loadProfile, restoreBackup, saveProfile } from '../src/lib/storage'

const now = new Date('2026-09-12T10:00:00.000Z')
const validIds = ['v001', 'v002', 'v003']

function reviewed(rating: 'again' | 'hard' | 'good' | 'easy' = 'good'): Profile {
  return reviewVocabulary(createProfile(now), 'v001', 'meaning', rating, now)
}

describe('FSRS and retrieval selection', () => {
  it('schedules real FSRS outcomes with an earlier correction after a forgotten answer', () => {
    const again = reviewed('again').cards.v001!
    const easy = reviewed('easy').cards.v001!
    expect(Date.parse(again.fsrs.due)).toBeGreaterThan(now.getTime())
    expect(Date.parse(again.fsrs.due)).toBeLessThan(Date.parse(easy.fsrs.due))
    expect(easy.fsrs.stability).toBeGreaterThan(again.fsrs.stability)
    expect(getDueCards(reviewed('again'), new Date(again.fsrs.due))).toHaveLength(1)
    expect(getDueCards(reviewed('again'), new Date(Date.parse(again.fsrs.due) - 1))).toHaveLength(0)
  })

  it('keeps one due card and independent skill evidence across retrieval directions', () => {
    const first = reviewed()
    expect(chooseSkill(first.cards.v001)).toBe('pinyin')
    const second = reviewVocabulary(first, 'v001', 'listening', 'again', new Date('2026-09-13T10:00:00.000Z'))
    expect(Object.keys(second.cards)).toEqual(['v001'])
    expect(second.cards.v001!.fsrs.reps).toBe(2)
    expect(second.cards.v001!.skills.meaning).toMatchObject({ attempts: 1, correct: 1 })
    expect(second.cards.v001!.skills.listening).toMatchObject({ attempts: 1, correct: 0 })
    expect(chooseSkill(second.cards.v001)).toBe('listening')
    expect(chooseSkill(second.cards.v001, ['context', 'production'])).toBe('context')
    expect(first.cards.v001!.fsrs.reps).toBe(1)
  })

  it('round-trips UTC scheduling dates and continues review after JSON restore', () => {
    const profile = reviewed()
    const original = profile.cards.v001!.fsrs
    expect(serializeCard(deserializeCard(original))).toEqual(original)
    const imported = parseBackup(exportBackup(profile, now), validIds)
    const nextDate = new Date(original.due)
    const next = reviewVocabulary(imported, 'v001', 'pinyin', 'good', nextDate)
    expect(next.cards.v001!.fsrs.reps).toBe(2)
    expect(next.cards.v001!.fsrs.last_review).toBe(nextDate.toISOString())
    expect(() => validateProfile(next, validIds)).not.toThrow()
  })

  it('rejects a backwards clock and invalid dates before corrupting scheduler state', () => {
    const profile = reviewed()
    expect(() => reviewVocabulary(profile, 'v001', 'meaning', 'good', new Date(now.getTime() - 1))).toThrow(
      /Gerätezeit/,
    )
    expect(() => reviewVocabulary(profile, 'v002', 'meaning', 'good', new Date(now.getTime() - 1))).toThrow(
      /Gerätezeit/,
    )
    expect(() => getDueCards(profile, new Date('invalid'))).toThrow(/Zeitpunkt/)
    expect(() => reviewVocabulary(profile, '__proto__', 'meaning', 'good', now)).toThrow(/ID/)
  })

  it('bounds raw history while preserving cumulative retrieval counts', () => {
    let profile = reviewed()
    const card = profile.cards.v001!
    profile = {
      ...profile,
      history: Array.from({ length: HISTORY_LIMIT }, () => ({ ...profile.history[0]! })),
      cards: {
        v001: {
          ...card,
          fsrs: { ...card.fsrs, reps: HISTORY_LIMIT },
          skills: {
            ...card.skills,
            meaning: { attempts: HISTORY_LIMIT, correct: HISTORY_LIMIT, lastPracticed: now.toISOString() },
          },
        },
      },
    }
    const next = reviewVocabulary(profile, 'v001', 'context', 'good', new Date('2026-09-13T10:00:00.000Z'))
    expect(next.history).toHaveLength(HISTORY_LIMIT)
    expect(next.cards.v001!.fsrs.reps).toBe(HISTORY_LIMIT + 1)
    expect(next.cards.v001!.skills.meaning.attempts).toBe(HISTORY_LIMIT)
    expect(() => validateProfile(next, validIds)).not.toThrow()
  })
})

describe('complete backup boundary', () => {
  it('preserves settings, lessons, grammar/task practice', () => {
    let profile = completeLesson(reviewed(), 'lesson-01', now)
    profile = recordPractice(profile, 'g001', true, now)
    profile = recordPractice(profile, 't001', false, now)
    profile.settings = { theme: 'dark', audioRate: 0.8 }
    const restored = parseBackup(exportBackup(profile, now), validIds, ['lesson-01'])
    expect(restored).toEqual(profile)
    expect(restored.cards.v001!.fsrs.reps).toBe(1)
  })

  it.each([
    [
      'unknown vocabulary',
      (p: Profile) => {
        p.cards.wrong = { ...p.cards.v001!, vocabularyId: 'wrong' }
      },
    ],
    [
      'invalid date',
      (p: Profile) => {
        p.cards.v001!.fsrs.due = '2026-02-30T10:00:00.000Z'
      },
    ],
    [
      'negative stability',
      (p: Profile) => {
        p.cards.v001!.fsrs.stability = -1
      },
    ],
    [
      'out-of-range difficulty',
      (p: Profile) => {
        p.cards.v001!.fsrs.difficulty = 20
      },
    ],
    [
      'invalid state',
      (p: Profile) => {
        ;(p.cards.v001!.fsrs as { state: number }).state = 9
      },
    ],
    [
      'inconsistent statistics',
      (p: Profile) => {
        p.cards.v001!.skills.meaning.correct = 20
      },
    ],
    [
      'missing skill',
      (p: Profile) => {
        delete (p.cards.v001!.skills as Partial<typeof p.cards.v001.skills>).meaning
      },
    ],
    [
      'unknown review reference',
      (p: Profile) => {
        p.history[0]!.vocabularyId = 'v002'
      },
    ],
    [
      'inconsistent history date',
      (p: Profile) => {
        p.history[0]!.at = '2026-09-20T10:00:00.000Z'
      },
    ],
    [
      'unsupported settings',
      (p: Profile) => {
        p.settings.audioRate = 100
      },
    ],
    [
      'unknown lesson',
      (p: Profile) => {
        p.completedLessons = ['unknown-lesson']
      },
    ],
  ])('rejects %s without treating malformed data as a partial restore', (_name, mutate) => {
    const backup = JSON.parse(exportBackup(reviewed(), now))
    mutate(backup.profile)
    expect(() => parseBackup(JSON.stringify(backup), validIds, ['lesson-01'])).toThrow(/ungültig/)
  })

  it('rejects oversized, foreign and prototype-bearing JSON', () => {
    expect(() => parseBackup('x'.repeat(MAX_BACKUP_BYTES + 1), validIds)).toThrow(/10 MB/)
    expect(() => parseBackup('{', validIds)).toThrow(/JSON/)
    const backup = JSON.parse(exportBackup(reviewed(), now))
    backup.backupSchemaVersion = 100
    expect(() => parseBackup(JSON.stringify(backup), validIds)).toThrow(/Version/)
    expect(() => parseBackup('{"__proto__":{}}', validIds)).toThrow(/Schlüssel/)
  })
})

describe('IndexedDB persistence', () => {
  beforeEach(async () => {
    await closeStorage()
    await deleteDB(DATABASE_NAME)
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await closeStorage()
    await deleteDB(DATABASE_NAME)
  })

  it('survives closing/reopening and applies rapid saves in order', async () => {
    const first = reviewed()
    const second = recordPractice(first, 'g001', false, now)
    await Promise.all([saveProfile(first), saveProfile(second)])
    await closeStorage()
    expect(await loadProfile(validIds)).toEqual(second)
  })

  it('validates before replacement and keeps existing progress after a failed restore', async () => {
    const original = reviewed()
    await saveProfile(original)
    const broken = JSON.parse(exportBackup(original, now))
    broken.profile.cards.v001.fsrs.due = 'broken'
    await expect(restoreBackup(JSON.stringify(broken), validIds)).rejects.toThrow(/ungültig/)
    expect(await loadProfile(validIds)).toEqual(original)
    const next = recordPractice(original, 'g001', true, now)
    await restoreBackup(exportBackup(next, now), validIds)
    expect(await loadProfile(validIds)).toEqual(next)
  })

  it('surfaces corrupted storage without resetting it', async () => {
    await saveProfile(reviewed())
    await closeStorage()
    const raw = await openDB(DATABASE_NAME, 1)
    await raw.put('profile', { corrupted: true }, 'active')
    raw.close()
    await expect(loadProfile(validIds)).rejects.toThrow(/Lernstand/)
    await closeStorage()
    const check = await openDB(DATABASE_NAME, 1)
    expect(await check.get('profile', 'active')).toEqual({ corrupted: true })
    check.close()
  })

  it('surfaces failed transactions and leaves the previous atomic snapshot intact', async () => {
    const original = reviewed()
    await saveProfile(original)
    const failingPut = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    await expect(saveProfile(recordPractice(original, 'g001', true, now))).rejects.toThrow(/quota/i)
    failingPut.mockRestore()
    expect(await loadProfile(validIds)).toEqual(original)
  })
})

it('migrates previous profiles without losing learning progress', () => {
  const profile = reviewed()
  const legacy = { ...profile, settings: { ...profile.settings, dailyNew: 20 }, exams: [{ id: 'old-exam' }] }
  expect(validateProfile(legacy, validIds)).toEqual(profile)
  expect(validateProfile(legacy, validIds)).not.toHaveProperty('exams')
})
