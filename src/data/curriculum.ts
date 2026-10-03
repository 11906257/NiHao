import vocabularyData from './vocabulary.json'
import lessonsData from './lessons.json'
import grammarData from './grammar.json'
import hanziData from './hanzi.json'
import type { Vocabulary, Lesson, Grammar, Hanzi } from './types'
import { normalizePinyinBase } from '../lib/exercises'
const sourceVocabulary = vocabularyData as Vocabulary[]
const readings = new Map(
  sourceVocabulary.map((word) => [word.id, word.pinyin.split('/').map(normalizePinyinBase)]),
)
const lessonOrder = new Map(lessonsData.map((lesson, index) => [lesson.id, index]))
export const grammar = [...(grammarData as Grammar[])].sort(
  (a, b) => (lessonOrder.get(a.lessonId) ?? Infinity) - (lessonOrder.get(b.lessonId) ?? Infinity),
)
export const hanzi = hanziData as Hanzi[]
const sourceExamples = [
  ...sourceVocabulary.flatMap((word) => [
    { example: word.example, lessonId: word.lessonId, ownerId: word.id },
    ...(word.examples ?? []).map((example) => ({ example, lessonId: word.lessonId, ownerId: word.id })),
  ]),
  ...grammar.map((point) => ({ example: point.example, lessonId: point.lessonId, ownerId: point.id })),
].map((entry) => ({ ...entry, pinyinBase: normalizePinyinBase(entry.example.pinyin) }))
export const vocabulary: Vocabulary[] = sourceVocabulary.map((word) => {
  const compounds = sourceVocabulary.filter(
    (other) => other.hanzi.length > word.hanzi.length && other.hanzi.includes(word.hanzi),
  )
  const examples = [...(word.examples ?? [])]
  const knownSentences = new Set([word.example.zh, ...examples.map((example) => example.zh)])
  const candidates = sourceExamples
    .filter(
      ({ example, lessonId, ownerId, pinyinBase }) =>
        ownerId !== word.id &&
        lessonOrder.get(lessonId)! <= lessonOrder.get(word.lessonId)! &&
        !knownSentences.has(example.zh) &&
        example.zh.includes(word.hanzi) &&
        readings.get(word.id)!.some((reading) => pinyinBase.includes(reading)) &&
        !compounds.some(
          (other) =>
            example.zh.includes(other.hanzi) &&
            readings.get(other.id)!.some((reading) => pinyinBase.includes(reading)),
        ),
    )
    .sort((a, b) => Number(a.lessonId === word.lessonId) - Number(b.lessonId === word.lessonId))
  for (const { example } of candidates) {
    if (examples.length >= 2) break
    if (knownSentences.has(example.zh)) continue
    examples.push({ zh: example.zh, pinyin: example.pinyin, de: example.de })
    knownSentences.add(example.zh)
  }
  return examples.length ? { ...word, examples } : word
})
export const lessons = lessonsData as Lesson[]
export const wordById = Object.fromEntries(vocabulary.map((w) => [w.id, w]))
export const lessonById = Object.fromEntries(lessons.map((lesson) => [lesson.id, lesson]))
export const grammarById = Object.fromEntries(grammar.map((g) => [g.id, g]))
export const orderedWordIds = lessons.flatMap((l) => l.wordIds)
export const validIds = vocabulary.map((w) => w.id)
export const validLessonIds = lessons.map((l) => l.id)

export const validPracticeIds = grammar.map((g) => g.id)
