import { AUDIO_RATES } from './audio'
import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs'

export const SKILLS = ['meaning', 'pinyin', 'listening', 'context', 'production'] as const
export type Skill = (typeof SKILLS)[number]
export const REVIEW_RATINGS = ['again', 'hard', 'good', 'easy'] as const
export type ReviewRating = (typeof REVIEW_RATINGS)[number]
export const HISTORY_LIMIT = 5000

export interface SkillStats {
  attempts: number
  correct: number
  lastPracticed: string | null
}

export type SerializedCard = Omit<Card, 'due' | 'last_review'> & {
  due: string
  last_review?: string
}

export interface LearningCard {
  vocabularyId: string
  fsrs: SerializedCard
  skills: Record<Skill, SkillStats>
  introducedAt: string
}

export interface ReviewEvent {
  vocabularyId: string
  skill: Skill
  rating: ReviewRating
  at: string
}

export interface Profile {
  schemaVersion: 1
  cards: Record<string, LearningCard>
  settings: {
    dailyNew: number
    theme: 'light' | 'dark' | 'system'
    audioRate: number
  }
  history: ReviewEvent[]
  practice: Record<string, SkillStats>
  completedLessons: string[]
  updatedAt: string
}

// FSRS owns the intervals, including short-term scheduling. Skill statistics
// determine the next retrieval direction, not five independent due queues.
const scheduler = fsrs({
  request_retention: 0.9,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: [],
  relearning_steps: [],
})
const grades = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
} as const

export function toISO(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new Error('Ungültiger Zeitpunkt.')
  return date.toISOString()
}

export function serializeCard(card: Card): SerializedCard {
  const { due, last_review, ...numbers } = card
  return {
    ...numbers,
    due: toISO(due),
    ...(last_review ? { last_review: toISO(last_review) } : {}),
  }
}

export function deserializeCard(card: SerializedCard): Card {
  const { due, last_review, ...numbers } = card
  return {
    ...numbers,
    due: new Date(due),
    ...(last_review ? { last_review: new Date(last_review) } : {}),
  }
}

export function createProfile(now = new Date()): Profile {
  return {
    schemaVersion: 1,
    cards: {},
    settings: { dailyNew: 20, theme: 'system', audioRate: AUDIO_RATES.normal },
    history: [],
    practice: {},
    completedLessons: [],
    updatedAt: toISO(now),
  }
}

export function createLearningCard(vocabularyId: string, now = new Date()): LearningCard {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(vocabularyId) ||
      ['__proto__', 'constructor', 'prototype'].includes(vocabularyId)) {
    throw new Error('Ungültige Vokabel-ID.')
  }
  return {
    vocabularyId,
    introducedAt: toISO(now),
    fsrs: serializeCard(createEmptyCard(now)),
    skills: Object.fromEntries(SKILLS.map(skill => [skill, {
      attempts: 0, correct: 0, lastPracticed: null,
    }])) as Record<Skill, SkillStats>,
  }
}

export function reviewVocabulary(
  profile: Profile,
  vocabularyId: string,
  skill: Skill,
  rating: ReviewRating,
  now = new Date(),
): Profile {
  const at = toISO(now)
  if (!SKILLS.includes(skill) || !REVIEW_RATINGS.includes(rating)) {
    throw new Error('Ungültige Übung oder Bewertung.')
  }
  const current = Object.hasOwn(profile.cards, vocabularyId)
    ? profile.cards[vocabularyId]!
    : createLearningCard(vocabularyId, now)
  if ((current.fsrs.last_review && now.getTime() < Date.parse(current.fsrs.last_review))
    || (profile.history.at(-1)?.at ?? '') > at) {
    throw new Error('Die Gerätezeit liegt vor der letzten Wiederholung. Bitte Datum und Uhrzeit prüfen.')
  }
  const { card } = scheduler.next(deserializeCard(current.fsrs), now, grades[rating])
  const previous = current.skills[skill]
  return {
    ...profile,
    cards: {
      ...profile.cards,
      [vocabularyId]: {
        ...current,
        fsrs: serializeCard(card),
        skills: {
          ...current.skills,
          [skill]: {
            attempts: previous.attempts + 1,
            correct: previous.correct + (rating === 'again' ? 0 : 1),
            lastPracticed: at,
          },
        },
      },
    },
    history: [...profile.history, { vocabularyId, skill, rating, at }].slice(-HISTORY_LIMIT),
    updatedAt: at,
  }
}

export function getDueCards(profile: Profile, now = new Date()): LearningCard[] {
  toISO(now)
  return Object.values(profile.cards)
    .filter(card => Date.parse(card.fsrs.due) <= now.getTime())
    .sort((a, b) => Date.parse(a.fsrs.due) - Date.parse(b.fsrs.due) || a.vocabularyId.localeCompare(b.vocabularyId))
}

/** Smoothed recall rate is only a task-selection heuristic, not a proficiency score. */
function skillPriority(stats: SkillStats): number {
  return (stats.correct + 1) / (stats.attempts + 2)
}

export function chooseSkill(card?: LearningCard, availableSkills: readonly Skill[] = SKILLS): Skill {
  const available = SKILLS.filter(skill => availableSkills.includes(skill))
  if (!available.length) throw new Error('Für diese Vokabel ist keine Übung verfügbar.')
  if (!card) return available[0]!
  return available.sort((a, b) => {
    const left = card.skills[a]
    const right = card.skills[b]
    return skillPriority(left) - skillPriority(right)
      || left.attempts - right.attempts
      || (left.lastPracticed ?? '').localeCompare(right.lastPracticed ?? '')
  })[0]!
}

function localDay(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function getTodayPlan(profile: Profile, orderedIds: readonly string[], now = new Date()) {
  const dueIds = getDueCards(profile, now).map(card => card.vocabularyId)
  const today = localDay(now)
  const introducedToday = Object.values(profile.cards)
    .filter(card => localDay(new Date(card.introducedAt)) === today).length
  // A transparent workload guard, not a claim about an empirically optimal limit.
  const dailyTarget = dueIds.length >= 30 ? 0
    : dueIds.length >= 15 ? Math.floor(profile.settings.dailyNew / 2)
    : profile.settings.dailyNew
  const newAllowance = Math.max(0, dailyTarget - introducedToday)
  const newIds = [...new Set(orderedIds)]
    .filter(id => !Object.hasOwn(profile.cards, id)).slice(0, newAllowance)
  const dueSet = new Set(dueIds)
  const weakIds = Object.values(profile.cards)
    .filter(card => !dueSet.has(card.vocabularyId)
      && card.fsrs.last_review && localDay(new Date(card.fsrs.last_review)) !== today
      && SKILLS.some(skill => card.skills[skill].attempts > card.skills[skill].correct))
    .sort((a, b) => skillPriority(a.skills[chooseSkill(a)]) - skillPriority(b.skills[chooseSkill(b)]))
    .slice(0, 5).map(card => card.vocabularyId)
  return { dueIds, newIds, weakIds, newAllowance }
}

export function getSkillSummary(profile: Profile): Record<Skill, SkillStats> {
  return Object.fromEntries(SKILLS.map(skill => {
    const stats = Object.values(profile.cards).map(card => card.skills[skill])
    return [skill, {
      attempts: stats.reduce((sum, item) => sum + item.attempts, 0),
      correct: stats.reduce((sum, item) => sum + item.correct, 0),
      lastPracticed: stats.map(item => item.lastPracticed).filter((date): date is string => date !== null).sort().at(-1) ?? null,
    }]
  })) as Record<Skill, SkillStats>
}

export function completeLesson(profile: Profile, lessonId: string, now = new Date()): Profile {
  return {
    ...profile,
    completedLessons: [...new Set([...profile.completedLessons, lessonId])],
    updatedAt: toISO(now),
  }
}


export function recordPractice(profile: Profile, exerciseId: string, correct: boolean, now = new Date()): Profile {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(exerciseId)
    || ['__proto__', 'constructor', 'prototype'].includes(exerciseId)) throw new Error('Ungültige Übungs-ID.')
  const at = toISO(now)
  const previous = profile.practice[exerciseId] ?? { attempts: 0, correct: 0, lastPracticed: null }
  if (previous.lastPracticed && previous.lastPracticed > at) throw new Error('Bitte Datum und Uhrzeit des Geräts prüfen.')
  return {
    ...profile,
    practice: {
      ...profile.practice,
      [exerciseId]: { attempts: previous.attempts + 1, correct: previous.correct + (correct ? 1 : 0), lastPracticed: at },
    },
    updatedAt: at,
  }
}
