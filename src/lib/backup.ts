import { HISTORY_LIMIT, REVIEW_RATINGS, SKILLS, type Profile, type Skill } from './scheduler'

export const BACKUP_SCHEMA_VERSION = 1
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024
type Dict = Record<string, unknown>

function fail(message: string): never {
  throw new Error(`Die Sicherung ist ungültig: ${message}`)
}

function object(value: unknown, name: string): Dict {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} fehlt oder ist beschädigt.`)
  if (Object.keys(value).some(key => ['__proto__', 'constructor', 'prototype'].includes(key))) {
    fail(`${name} enthält einen unzulässigen Schlüssel.`)
  }
  return value as Dict
}

function keys(value: Dict, allowed: readonly string[], required = allowed) {
  if (Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(value, key))) {
    fail('Das Datenschema ist unvollständig oder wird von dieser App nicht unterstützt.')
  }
}

function number(value: unknown, name: string, minimum = 0, maximum = 1_000_000, integer = false): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
    fail(`${name} liegt außerhalb des gültigen Bereichs.`)
  }
}

function count(value: unknown, name: string, maximum = 1_000_000): asserts value is number {
  number(value, name, 0, maximum, true)
}

function date(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    fail(`${name} ist kein gültiger UTC-Zeitpunkt.`)
  }
}

function id(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value)
      || ['__proto__', 'constructor', 'prototype'].includes(value)) fail('Eine Inhalts-ID ist ungültig.')
}

function array(value: unknown, name: string, maximum: number): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length > maximum) fail(`${name} fehlt oder ist zu groß.`)
}

/** Validates both file imports and IndexedDB reads before data reaches FSRS. */
export function validateProfile(
  input: unknown,
  validIds?: Iterable<string>,
  validLessonIds?: Iterable<string>,
  validPracticeIds?: Iterable<string>,
): Profile {
  const profile = { ...object(input, 'Lernprofil') }
  // Read old local profiles/backups without retaining the retired exam history.
  if (profile.schemaVersion === 1) delete profile.exams
  keys(profile, ['schemaVersion', 'cards', 'settings', 'history', 'practice', 'completedLessons', 'updatedAt'])
  if (profile.schemaVersion !== 1) fail('Diese Schema-Version wird nicht unterstützt.')
  date(profile.updatedAt, 'Änderungsdatum')
  const known = validIds ? new Set(validIds) : undefined
  const knownLessons = validLessonIds ? new Set(validLessonIds) : undefined
  const knownPractice = validPracticeIds ? new Set(validPracticeIds) : undefined
  const cards = object(profile.cards, 'Karten')
  if (Object.keys(cards).length > (known?.size ?? 10000)) fail('Zu viele Karten.')
  for (const [key, rawCard] of Object.entries(cards)) {
    id(key)
    if (known && !known.has(key)) fail(`Die Vokabel ${key} gehört nicht zum Curriculum.`)
    const card = object(rawCard, 'Karte')
    keys(card, ['vocabularyId', 'fsrs', 'skills', 'introducedAt'])
    if (card.vocabularyId !== key) fail('Karten-ID und Vokabel-ID stimmen nicht überein.')
    date(card.introducedAt, 'Einführungsdatum')
    const fsrs = object(card.fsrs, 'Wiederholungszustand')
    const fsrsKeys = ['due', 'stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'learning_steps', 'reps', 'lapses', 'state']
    keys(fsrs, [...fsrsKeys, 'last_review'], fsrsKeys)
    date(fsrs.due, 'Fälligkeit')
    number(fsrs.stability, 'Stabilität', 0, 1_000_000)
    number(fsrs.difficulty, 'Schwierigkeit', 0, 10)
    count(fsrs.elapsed_days, 'Vergangene Tage')
    count(fsrs.scheduled_days, 'Wiederholungsintervall', 36500)
    count(fsrs.learning_steps, 'Lernschritt', 1000)
    count(fsrs.reps, 'Wiederholungen')
    count(fsrs.lapses, 'Fehler', fsrs.reps)
    count(fsrs.state, 'Kartenstatus', 3)
    if (fsrs.last_review !== undefined) {
      date(fsrs.last_review, 'Letzte Wiederholung')
      if (fsrs.last_review < card.introducedAt || fsrs.due < fsrs.last_review) fail('Die Kartenzeitpunkte widersprechen sich.')
    }
    if (fsrs.reps > 0 && (fsrs.last_review === undefined || fsrs.stability <= 0 || fsrs.difficulty < 1 || fsrs.state === 0)) {
      fail('Der Wiederholungszustand ist widersprüchlich.')
    }
    if (fsrs.reps === 0 && fsrs.state !== 0) fail('Eine ungeübte Karte besitzt bereits einen Lernstatus.')
    const skills = object(card.skills, 'Fähigkeiten')
    keys(skills, SKILLS)
    let attempts = 0
    let latestPractice = ''
    for (const skill of SKILLS) {
      const stats = object(skills[skill], 'Fähigkeitsstatistik')
      keys(stats, ['attempts', 'correct', 'lastPracticed'])
      count(stats.attempts, 'Versuche')
      count(stats.correct, 'Richtige Antworten', stats.attempts)
      attempts += stats.attempts
      if (stats.attempts === 0 && stats.lastPracticed !== null) fail('Ungeübte Fähigkeit mit Übungsdatum.')
      if (stats.attempts > 0) {
        date(stats.lastPracticed, 'Letzte Übung')
        if (stats.lastPracticed < card.introducedAt || (fsrs.last_review && stats.lastPracticed > fsrs.last_review)) {
          fail('Die Übungszeitpunkte widersprechen sich.')
        }
        if (stats.lastPracticed > latestPractice) latestPractice = stats.lastPracticed
      }
    }
    if (attempts !== fsrs.reps) fail('Wiederholungszahl und Fähigkeitsstatistik stimmen nicht überein.')
    if (fsrs.reps > 0 && latestPractice !== fsrs.last_review) fail('Das letzte Übungsdatum stimmt nicht mit dem Wiederholungszustand überein.')
  }
  const settings = { ...object(profile.settings, 'Einstellungen') }
  // Compatibility with profiles created before lesson-only learning.
  delete settings.dailyNew
  profile.settings = settings
  keys(settings, ['theme', 'audioRate'])
  if (!['light', 'dark', 'system'].includes(settings.theme as string)) fail('Unbekanntes Farbschema.')
  number(settings.audioRate, 'Sprechtempo', 0.1, 1.2)
  const practice = { ...object(profile.practice, 'Weitere Übungen') }
  // Migration only: retired lookup/tone exercises must not block existing profiles.
  for (const key of Object.keys(practice)) {
    const hanziId = /^h(\d{3})$/.exec(key)
    if ((hanziId && Number(hanziId[1]) >= 1 && Number(hanziId[1]) <= 246) || /^tone-[1-5]$/.test(key)) delete practice[key]
  }
  profile.practice = practice
  if (Object.keys(practice).length > 10000) fail('Zu viele Übungen.')
  for (const [exerciseId, rawStats] of Object.entries(practice)) {
    id(exerciseId)
    if (knownPractice && !knownPractice.has(exerciseId)) fail(`Unbekannte Übung: ${exerciseId}.`)
    const stats = object(rawStats, 'Übungsstatistik')
    keys(stats, ['attempts', 'correct', 'lastPracticed'])
    count(stats.attempts, 'Versuche')
    count(stats.correct, 'Richtige Antworten', stats.attempts)
    if (stats.attempts === 0 && stats.lastPracticed !== null) fail('Ungeübte Aufgabe mit Übungsdatum.')
    if (stats.attempts > 0) date(stats.lastPracticed, 'Übungsdatum')
  }
  array(profile.history, 'Wiederholungshistorie', HISTORY_LIMIT)
  let previousAt = ''
  const historyCounts = new Map<string, { attempts: number; correct: number }>()
  for (const rawEvent of profile.history) {
    const event = object(rawEvent, 'Wiederholung')
    keys(event, ['vocabularyId', 'skill', 'rating', 'at'])
    id(event.vocabularyId)
    if (!Object.hasOwn(cards, event.vocabularyId)) fail('Eine Wiederholung verweist auf eine unbekannte Karte.')
    if (!SKILLS.includes(event.skill as Skill) || !REVIEW_RATINGS.includes(event.rating as (typeof REVIEW_RATINGS)[number])) {
      fail('Unbekannte Fähigkeit oder Bewertung.')
    }
    date(event.at, 'Übungsdatum')
    if (event.at < previousAt) fail('Die Wiederholungshistorie ist nicht chronologisch.')
    const card = cards[event.vocabularyId] as unknown as Profile['cards'][string]
    if (event.at < card.introducedAt || !card.fsrs.last_review || event.at > card.fsrs.last_review) {
      fail('Ein Datum der Wiederholungshistorie widerspricht dem Kartenstatus.')
    }
    const key = `${event.vocabularyId}/${event.skill}`
    const counts = historyCounts.get(key) ?? { attempts: 0, correct: 0 }
    counts.attempts += 1
    counts.correct += event.rating === 'again' ? 0 : 1
    const stats = card.skills[event.skill as Skill]
    if (counts.attempts > stats.attempts || counts.correct > stats.correct
      || counts.attempts - counts.correct > stats.attempts - stats.correct) {
      fail('Die Wiederholungshistorie widerspricht der Fähigkeitsstatistik.')
    }
    historyCounts.set(key, counts)
    previousAt = event.at
  }
  array(profile.completedLessons, 'Abgeschlossene Lektionen', 10000)
  const lessonSet = new Set<string>()
  for (const lesson of profile.completedLessons) {
    id(lesson)
    if (lessonSet.has(lesson) || (knownLessons && !knownLessons.has(lesson))) fail('Unbekannte oder doppelte Lektion.')
    lessonSet.add(lesson)
  }
  return structuredClone(profile) as unknown as Profile
}

export function exportBackup(profile: Profile, now = new Date()): string {
  const valid = validateProfile(profile)
  return JSON.stringify({
    application: 'hsk-level-one',
    backupSchemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    profile: valid,
  }, null, 2)
}

export function parseBackup(json: string, validIds: Iterable<string>, validLessonIds?: Iterable<string>, validPracticeIds?: Iterable<string>): Profile {
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) fail('Die Datei ist größer als 10 MB.')
  let value: unknown
  try { value = JSON.parse(json) } catch { fail('Die Datei enthält kein lesbares JSON.') }
  const backup = object(value, 'Sicherungsdatei')
  keys(backup, ['application', 'backupSchemaVersion', 'exportedAt', 'profile'])
  if (backup.application !== 'hsk-level-one' || backup.backupSchemaVersion !== BACKUP_SCHEMA_VERSION) {
    fail('Die Datei stammt nicht aus dieser App oder hat eine unbekannte Version.')
  }
  date(backup.exportedAt, 'Exportdatum')
  return validateProfile(backup.profile, validIds, validLessonIds, validPracticeIds)
}

export function downloadBackup(profile: Profile): void {
  const now = new Date()
  const blob = new Blob([exportBackup(profile, now)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `hsk-lernstand-${now.toISOString().slice(0, 10)}.json`
  document.body.append(link)
  link.click()
  link.remove()
  // Do not revoke immediately: Safari may still be reading the URL.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
