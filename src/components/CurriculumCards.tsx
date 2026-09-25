import { ChevronRight, CircleCheck } from 'lucide-react'
import { wordById } from '../data/curriculum'
import type { Vocabulary, Lesson } from '../data/types'
import type { Profile } from '../lib/scheduler'
export function WordCard({
  word,
  onClick,
  known,
}: {
  word: Vocabulary
  onClick: () => void
  known: boolean
}) {
  return (
    <button className="card word-card" onClick={onClick}>
      <div>
        <span className="chinese" lang="zh-CN">
          {word.hanzi}
        </span>
        {known && <CircleCheck className="status-check" size={18} aria-label="Bekannt" />}
      </div>
      <span className="pinyin">{word.pinyin}</span>
      <strong>{word.meaning}</strong>
    </button>
  )
}

export function LessonCard({
  lesson,
  profile,
  recommended = false,
  onOpen,
}: {
  lesson: Lesson
  profile: Profile
  recommended?: boolean
  onOpen: () => void
}) {
  const completed = profile.completedLessons.includes(lesson.id)
  return (
    <button className={`lesson-row card ${recommended ? 'recommended' : ''}`} onClick={onOpen}>
      <div className={`lesson-number ${completed ? 'completed' : ''}`}>{lesson.id.replace('l', '')}</div>
      <div className="lesson-card-body">
        <h3>
          {lesson.title}
          {completed && <CircleCheck className="status-check" size={18} aria-label="Abgeschlossen" />}
        </h3>
        <p>{lesson.description}</p>
        {(lesson.wordIds.length > 0 || lesson.grammarIds.length > 0) && (
          <span className="small muted">
            {[
              lesson.wordIds.length > 0 && `${lesson.wordIds.length} Wörter`,
              lesson.grammarIds.length > 0 &&
                `${lesson.grammarIds.length} ${lesson.grammarIds.length === 1 ? 'Grammatikthema' : 'Grammatikthemen'}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
        <div className="word-preview" lang="zh-CN">
          {lesson.wordIds.map((id) => (
            <span key={id}>{wordById[id].hanzi}</span>
          ))}
        </div>
      </div>
      <ChevronRight className="disclosure-chevron" size={20} aria-hidden="true" />
    </button>
  )
}
