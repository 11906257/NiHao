import { describe, it, expect } from 'vitest'
import {
  normalizePinyin,
  checkAnswer,
  wordExercise,
  grammarExercise,
  taskExercise,
} from '../src/lib/exercises'
import { vocabulary, grammar, tasks } from '../src/data/curriculum'
describe('Aktives Erinnern', () => {
  it('akzeptiert Tonziffern, aber nicht falsche Töne', () => {
    expect(normalizePinyin('ni3 hao3')).toBe(normalizePinyin('nǐ hǎo'))
    expect(normalizePinyin('lü4')).toBe('lǜ')
    expect(normalizePinyin('nu:3')).toBe('nǚ')
    expect(normalizePinyin('shui3')).toBe('shuǐ')
    expect(normalizePinyin('nǐ')).not.toBe(normalizePinyin('ní'))
  })
  it('akzeptiert synonyme Pflichtwörter bei produktivem Abruf', () => {
    const w = vocabulary.find((w) => w.hanzi === '哪里')!
    expect(checkAnswer(wordExercise(w, 'production', vocabulary), '哪儿')).toBe(true)
  })
  it('akzeptiert kontextlose Homophone bei reinen Hörwörtern', () => {
    const w = vocabulary.find((w) => w.hanzi === '他')!
    const e = wordExercise(w, 'listening', vocabulary)
    expect(checkAnswer(e, 'sie')).toBe(true)
    expect(checkAnswer(e, 'es')).toBe(true)
  })
  it('erzeugt keine doppelten Optionen und nicht immer A als Grammatiklösung', () => {
    for (const w of vocabulary) {
      const e = wordExercise(w, 'context', vocabulary)
      expect(new Set(e.options).size).toBe(e.options!.length)
    }
    expect(
      new Set(
        grammar.map((g) => {
          const e = grammarExercise(g)
          return e.options!.indexOf(e.answer)
        }),
      ).size,
    ).toBeGreaterThan(1)
  })
  it('macht jede kommunikative Teilkompetenz übbar', () => {
    for (const t of tasks) expect(taskExercise(t).practiceId).toBe(t.id)
  })
})
import { createProfile, recordPractice } from '../src/lib/scheduler'
import { exportBackup, parseBackup } from '../src/lib/backup'
import { validIds, validLessonIds, validPracticeIds } from '../src/data/curriculum'
it('übernimmt keine fremden Übungsreferenzen in eine Sicherung', () => {
  const p = recordPractice(createProfile(), 'not-in-curriculum', true)
  expect(() => parseBackup(exportBackup(p), validIds, validLessonIds, validPracticeIds)).toThrow(
    'Unbekannte Übung',
  )
})

it('akzeptiert neutrale Töne, kombinierte Unicode-Zeichen und alle ü-Tonzeichen', () => {
  expect(normalizePinyin('ma5')).toBe(normalizePinyin('ma'))
  expect(normalizePinyin('ni3hao3')).toBe(normalizePinyin('nǐ hǎo'))
  expect(normalizePinyin('nǚ'.normalize('NFD'))).toBe(normalizePinyin('nv3'))
  for (const [index, mark] of [...'ǖǘǚǜ'].entries())
    expect(normalizePinyin(`lü${index + 1}`)).toBe(`l${mark}`)
  expect(normalizePinyin('lu4')).not.toBe(normalizePinyin('lü4'))
})
it('prüft deutsche Bedeutungen mit begrenzten Schreibvarianten statt Selbstkorrektur', () => {
  const e = wordExercise(
    vocabulary.find((w) => w.hanzi === '早饭')!,
    'meaning',
    vocabulary,
  )
  for (const answer of ['Frühstück', 'das Frühstück', 'Fruehstueck!'])
    expect(checkAnswer(e, answer)).toBe(true)
  for (const answer of ['Abendessen', 'kein Frühstück', 'Mittagessen'])
    expect(checkAnswer(e, answer)).toBe(false)
})
it('entfernt alte Zeichen- und Tonübungen ohne andere Fortschritte zu verlieren', () => {
  let p = recordPractice(createProfile(), 'h001', true)
  p = recordPractice(p, 'tone-2', true)
  p = recordPractice(p, grammar[0].id, true)
  const restored = parseBackup(exportBackup(p), validIds, validLessonIds, validPracticeIds)
  expect(Object.keys(restored.practice)).toEqual([grammar[0].id])
  expect(p.practice).toHaveProperty('h001')
})
it('ordnet Grammatik stabil nach dem Lernpfad', () => {
  const numbers = grammar.map((g) => Number(g.lessonId.slice(1)))
  expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
})
