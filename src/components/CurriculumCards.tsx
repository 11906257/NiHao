import { ChevronRight, CircleCheck } from 'lucide-react'
import { lessons, wordById } from '../data/curriculum'
import type { Vocabulary, Lesson } from '../data/types'
import type { Profile } from '../lib/scheduler'
import { ProgressBar } from './ui'
export function WordCard({
  word,
  onClick,
  begun,
}: {
  word: Vocabulary
  onClick: () => void
  begun: boolean
}) {
  return (
    <button className="card word-card" onClick={onClick}>
      <div>
        <span className="chinese" lang="zh-CN">
          {word.hanzi}
        </span>
        {begun && <CircleCheck className="word-begun" size={20} aria-label="Begonnen" />}
      </div>
      <span className="pinyin">{word.pinyin}</span>
      <strong>{word.meaning}</strong>
    </button>
  )
}

export function LessonProgress({ completed, onOpen }: { completed: number; onOpen: () => void }) {
  const content = (
    <>
      <span className="status-title">
        <span className="eyebrow">Lernpfad</span>
        <ChevronRight size={20} />
      </span>
      <strong className="metric">
        {completed}
        <small> / {lessons.length}</small>
      </strong>
      <p>Lektionen bearbeitet</p>
      <ProgressBar value={completed} max={lessons.length} />
    </>
  )
  return (
    <button className="card lesson-progress status-link" onClick={onOpen} aria-label="Lernpfad öffnen">
      {content}
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
      <div className={`lesson-number ${completed ? 'completed' : ''}`}>
        {completed ? <CircleCheck size={24} /> : lesson.id.replace('l', '')}
      </div>
      <div className="lesson-card-body">
        <h3>
          {lesson.title}
          {recommended && <span className="pill">Als Nächstes</span>}
        </h3>
        <p>{lesson.description}</p>
        <span className="small muted">
          {lesson.wordIds.length} Wörter · {lesson.grammarIds.length}{' '}
          {lesson.grammarIds.length === 1 ? 'Grammatikthema' : 'Grammatikthemen'}
        </span>
        <div className="word-preview" lang="zh-CN">
          {lesson.wordIds.map((id) => (
            <span key={id}>{wordById[id].hanzi}</span>
          ))}
        </div>
      </div>
      <ChevronRight size={20} />
    </button>
  )
}
