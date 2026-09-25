import { flushSync } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Lightbulb, Feather, Mountain, CircleCheck, X } from 'lucide-react'
import { PINYIN_VOWELS, checkAnswer, type Exercise } from '../lib/exercises'
import type { ReviewRating } from '../lib/scheduler'
import { AudioButton, ProgressBar } from './ui'
import { stopAudio } from '../lib/audio'
export function ExerciseRunner({
  exercises,
  title,
  onResult,
  onComplete,
  onClose,
}: {
  exercises: Exercise[]
  title: string
  onResult: (e: Exercise, r: ReviewRating) => void
  onComplete: () => void
  onClose: () => void
}) {
  const [queue, setQueue] = useState(exercises),
    [index, setIndex] = useState(0),
    [answer, setAnswer] = useState(''),
    [checked, setChecked] = useState(false),
    [correct, setCorrect] = useState(false),
    [hint, setHint] = useState(false),
    [selectedVowel, setSelectedVowel] = useState<string | null>(null),
    [done, setDone] = useState(false),
    [score, setScore] = useState(0),
    [error, setError] = useState('')
  const repeated = useRef(new Set<string>())
  const advancing = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const e = queue[index]
  useEffect(() => () => stopAudio(), [])
  useEffect(() => {
    window.scrollTo(0, 0)
    setAnswer('')
    setChecked(false)
    setCorrect(false)
    setHint(false)
    setSelectedVowel(null)
    setError('')
    advancing.current = false
  }, [index])
  const submit = () => {
    if (checked || !answer.trim()) return
    setCorrect(checkAnswer(e, answer))
    setChecked(true)
  }
  const finish = (rating: ReviewRating) => {
    if (advancing.current) return
    advancing.current = true
    setError('')
    try {
      onResult(e, rating)
    } catch (err) {
      setError((err as Error).message)
      advancing.current = false
      return
    }
    if (rating !== 'again') setScore((n) => n + 1)
    let length = queue.length
    if (rating === 'again' && !repeated.current.has(e.id)) {
      repeated.current.add(e.id)
      const next = [...queue]
      next.splice(Math.min(index + 3, next.length), 0, e)
      setQueue(next)
      length++
    }
    if (index + 1 >= length) {
      setDone(true)
      onComplete()
    } else setIndex(index + 1)
  }
  if (!e || done)
    return (
      <div className="session-done">
        <div className="done-mark">
          <CircleCheck size={36} />
        </div>
        <h1>Lerneinheit beendet</h1>
        <p>
          Du hast {queue.length} Aufgaben bearbeitet. {score} Antworten konntest du abrufen.
        </p>
        <button className="button primary" onClick={onClose}>
          Zur Übersicht <ArrowRight size={18} />
        </button>
      </div>
    )
  return (
    <div className="study-shell">
      <div className="study-top">
        <span>{title}</span>
        <button className="icon-button close-button" onClick={onClose} aria-label="Lerneinheit verlassen">
          <X />
        </button>
      </div>
      <ProgressBar value={index + 1} max={queue.length} label="Aufgabe" />
      <div className="exercise-card" key={`${index}-${e.id}`}>
        <span className="eyebrow">
          {e.skill === 'listening'
            ? 'Hörverständnis'
            : e.skill === 'production'
              ? 'Aktiv formulieren'
              : e.skill === 'pinyin'
                ? 'Pinyin & Aussprache'
                : e.skill === 'context'
                  ? 'Im Satz verstehen'
                  : 'Bedeutung abrufen'}
        </span>
        <h1 className="exercise-prompt">{e.prompt}</h1>
        {e.zh && (
          <p className={`chinese exercise-zh ${e.zh.length > 12 ? 'sentence' : ''}`} lang="zh-CN">
            {e.zh}
          </p>
        )}
        {e.audio && (
          <div className="listen-area">
            <AudioButton text={e.audio} label="Anhören" />
          </div>
        )}
        {e.pinyin && !checked && (
          <div className="hint">
            <button className="text-button" onClick={() => setHint(true)}>
              {!hint && <Lightbulb size={16} />} {hint ? e.pinyin : 'Pinyin als Hilfe'}
            </button>
          </div>
        )}
        {e.kind === 'choice' ? (
          <div className="choices">
            {e.options?.map((option, i) => (
              <button
                key={i}
                className={`choice ${answer === option ? 'selected' : ''} ${checked && option === e.answer ? 'correct' : ''}`}
                disabled={checked}
                onClick={() => setAnswer(option)}
              >
                <span className="choice-letter">{String.fromCharCode(65 + i)}</span>
                <span>{option}</span>
                {checked && option === e.answer && <CircleCheck size={18} />}
              </button>
            ))}
          </div>
        ) : (
          <form
            onSubmit={(ev) => {
              ev.preventDefault()
              submit()
            }}
          >
            <input
              id="answer-input"
              ref={input}
              aria-label="Antwort"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={answer}
              onChange={(ev) => setAnswer(ev.target.value)}
              disabled={checked}
              placeholder={
                e.skill === 'pinyin'
                  ? 'Pinyin mit Tönen'
                  : e.skill === 'production'
                    ? 'Chinesisch oder Pinyin'
                    : 'Antwort auf Deutsch'
              }
            />
            {(e.skill === 'pinyin' || e.skill === 'production') && !checked && (
              <div className="pinyin-keyboard" aria-label="Pinyin-Zeichen">
                {selectedVowel === null ? (
                  <div className="pinyin-row" role="group" aria-label="Selbstlaute">
                    {(['a', 'e', 'i', 'o', 'u'] as const).map((vowel) => (
                      <button
                        key={vowel}
                        type="button"
                        className="pinyin-vowel"
                        onClick={() => setSelectedVowel(vowel)}
                      >
                        {vowel}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="pinyin-tone-rows" role="group" aria-label={`Töne für ${selectedVowel}`}>
                    {(selectedVowel === 'u' ? ['u', 'ü'] : [selectedVowel]).map((base) => (
                      <div className="pinyin-row" key={base}>
                        {base === (selectedVowel === 'u' ? 'u' : selectedVowel) && (
                          <button
                            type="button"
                            className="icon-button close-button"
                            aria-label="Selbstlaute anzeigen"
                            onClick={() => setSelectedVowel(null)}
                          >
                            <X size={20} />
                          </button>
                        )}
                        {selectedVowel === 'u' && base === 'ü' && (
                          <span className="pinyin-spacer" aria-hidden="true" />
                        )}
                        {PINYIN_VOWELS[base as keyof typeof PINYIN_VOWELS].map((c, tone) => (
                          <button
                            key={c}
                            type="button"
                            aria-label={`${c}: Ton ${tone + 1}`}
                            onClick={() => {
                              const start = input.current?.selectionStart ?? answer.length
                              const end = input.current?.selectionEnd ?? start
                              flushSync(() => setAnswer(answer.slice(0, start) + c + answer.slice(end)))
                              setSelectedVowel(null)
                              input.current?.focus()
                              input.current?.setSelectionRange(start + 1, start + 1)
                            }}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>
        )}
        {!checked ? (
          <div className="exercise-actions">
            <button className="button primary" disabled={!answer.trim()} onClick={submit}>
              Antwort prüfen <ArrowRight size={18} />
            </button>
            <button
              className="text-button"
              onClick={() => {
                setChecked(true)
                setCorrect(false)
              }}
            >
              Ich weiß es noch nicht
            </button>
          </div>
        ) : (
          <div className={`feedback ${correct ? 'success' : 'learning'}`} role="status">
            <h2>{correct ? 'Richtig erinnert.' : 'Hier ist die Lösung.'}</h2>
            <p className="feedback-solution">{e.explanation}</p>
            <div className={`rating-buttons ${correct ? 'rating-choice' : ''}`}>
              {correct ? (
                <>
                  <div className="rating-alternatives">
                    <button className="button secondary" onClick={() => finish('hard')}>
                      <Mountain size={18} /> Mit Mühe
                    </button>
                    {!hint && (
                      <button className="button secondary" onClick={() => finish('easy')}>
                        <Feather size={18} /> Leicht
                      </button>
                    )}
                  </div>
                  <button
                    className="button primary rating-known"
                    onClick={() => finish(hint ? 'hard' : 'good')}
                  >
                    <CircleCheck size={26} /> Gewusst
                  </button>
                </>
              ) : (
                <>
                  <button className="button secondary" onClick={() => finish('good')}>
                    Gewusst
                  </button>
                  <button className="button primary" onClick={() => finish('again')}>
                    Weiter üben <ArrowRight size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
