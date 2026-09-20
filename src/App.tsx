import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CircleCheck,
  ChevronRight,
  Upload,
  TextCursorInput,
  Headphones,
  LoaderCircle,
  MessageCircle,
  Search,
  HardDriveDownload,
  X,
} from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import {
  vocabulary,
  lessons,
  grammar,
  hanzi,
  tasks,
  wordById,
  grammarById,
  lessonById,
  taskById,
  orderedWordIds,
  validIds,
  validLessonIds,
  validPracticeIds,
} from './data/curriculum'
import type { Vocabulary, Hanzi, Grammar } from './data/types'
import {
  chooseSkill,
  completeLesson,
  getReviewPlan,
  recordPractice,
  reviewVocabulary,
  type Profile,
  type ReviewRating,
  type Skill,
} from './lib/scheduler'
import { loadProfile, restoreBackup, saveProfile } from './lib/storage'
import { backupIsOverdue, readLastExport, rememberExport } from './lib/backupReminder'
import { downloadBackup, MAX_BACKUP_BYTES, parseBackup } from './lib/backup'
import { taskExercise, wordExercise, type Exercise } from './lib/exercises'
import {
  AudioButton,
  ExampleTranslation,
  LookupDetail,
  DetailOverlay,
  Empty,
  Modal,
  ToggleGroup,
  ProgressBar,
  useAudio,
} from './components/ui'
import { ExerciseRunner } from './components/ExerciseRunner'
import { PageHeading, MainNavigation } from './components/Navigation'
import { WordCard, LessonCard, LessonProgress } from './components/CurriculumCards'
import { LearningSession } from './components/LearningSession'
import { AUDIO_RATES, normalizeAudioRate, setAudioRate, stopAudio } from './lib/audio'
const skillLabels: Record<Skill, string> = {
  meaning: 'Bedeutung abrufen',
  production: 'Aktiv formulieren',
  pinyin: 'Pinyin & Aussprache',
  listening: 'Hörverständnis',
  context: 'Im Satz verstehen',
}
type Session =
  | { kind: 'learn'; ids: string[]; grammarIds: string[]; title: string; lessonId: string }
  | { kind: 'practice'; exercises: Exercise[]; title: string }
function hashRoute() {
  return window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'today'
}
const searchText = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
const formatDate = (s: string) =>
  new Date(s).toLocaleDateString('de-AT', { day: 'numeric', month: 'short', year: 'numeric' })
export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null),
    [loadError, setLoadError] = useState(''),
    [saveError, setSaveError] = useState(''),
    [saving, setSaving] = useState(false),
    [route, setRoute] = useState(hashRoute),
    [session, setSession] = useState<Session | null>(null),
    [more, setMore] = useState(false),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [selectedWord, setSelectedWord] = useState<Vocabulary | null>(null),
    [selectedHanzi, setSelectedHanzi] = useState<Hanzi | null>(null),
    [selectedGrammar, setSelectedGrammar] = useState<Grammar | null>(null),
    [pendingImport, setPendingImport] = useState<{ json: string; profile: Profile } | null>(null),
    [notice, setNotice] = useState(''),
    [lastExport, setLastExport] = useState<string | null>(readLastExport)
  const pRef = useRef<Profile | null>(null)
  pRef.current = profile
  const writes = useRef(0)
  const writeSequence = useRef(0)
  const audio = useAudio()
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration>()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      setSwRegistration(registration)
    },
    onRegisterError(error) {
      setNotice(`Offline-Speicherung konnte noch nicht vorbereitet werden: ${error.message}`)
    },
  })
  // Activate updates automatically only after learning and pending saves are finished.
  useEffect(() => {
    if (needRefresh && profile && !session && !saving && !saveError && !pendingImport) {
      void updateServiceWorker(true)
    }
  }, [needRefresh, profile, session, saving, saveError, pendingImport, updateServiceWorker])
  useEffect(() => {
    if (!swRegistration) return
    const check = () => {
      if (navigator.onLine && document.visibilityState === 'visible')
        void swRegistration.update().catch(() => {})
    }
    const interval = window.setInterval(check, 5 * 60 * 1000)
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('online', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [swRegistration])
  const load = useCallback(async () => {
    setLoadError('')
    try {
      const loaded = await loadProfile(validIds, validLessonIds, validPracticeIds)
      setAudioRate(loaded.settings.audioRate)
      setProfile(loaded)
    } catch (e) {
      setLoadError((e as Error).message)
    }
  }, [])
  useEffect(() => {
    void load()
    const hash = () => {
      setRoute(hashRoute())
      setSession(null)
      stopAudio()
      setSelectedWord(null)
      setSelectedHanzi(null)
      setSelectedGrammar(null)
      setSearch('')
      setFilter('all')
      setMore(false)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', hash)
    return () => {
      window.removeEventListener('hashchange', hash)
    }
  }, [load])
  useEffect(() => {
    const theme = profile?.settings.theme ?? 'system'
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme === 'system' ? 'light dark' : theme
  }, [profile?.settings.theme])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saving || saveError) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saving, saveError])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 8000)
    return () => clearTimeout(timer)
  }, [notice])
  const commit = (next: Profile) => {
    setAudioRate(next.settings.audioRate)
    next = { ...next, updatedAt: new Date().toISOString() }
    pRef.current = next
    setProfile(next)
    writes.current++
    const sequence = ++writeSequence.current
    setSaving(true)
    void saveProfile(next)
      .then(() => {
        if (sequence === writeSequence.current) setSaveError('')
      })
      .catch((e) => {
        if (sequence === writeSequence.current) setSaveError((e as Error).message)
      })
      .finally(() => {
        writes.current--
        setSaving(writes.current > 0)
      })
  }
  const navigate = (id: string) => {
    setSession(null)
    stopAudio()
    setMore(false)
    window.location.hash = `/${id}`
    if (hashRoute() === id) setRoute(id)
  }
  const result = (e: Exercise, r: ReviewRating) => {
    const current = pRef.current
    if (!current) return
    const next = e.vocabularyId
      ? reviewVocabulary(current, e.vocabularyId, e.skill, r)
      : recordPractice(current, e.practiceId ?? e.id, r !== 'again')
    commit(next)
  }
  const startPractice = (exercises: Exercise[], title: string) => {
    if (exercises.some((e) => e.audio) && !audio.available) {
      setNotice(audio.message)
      return
    }
    setSelectedWord(null)
    setSelectedHanzi(null)
    setSelectedGrammar(null)
    setSession({ kind: 'practice', exercises, title })
    window.scrollTo(0, 0)
  }
  const reviewSkills: Skill[] = audio.available
    ? ['meaning', 'pinyin', 'listening', 'context', 'production']
    : ['meaning', 'pinyin', 'context', 'production']
  const beginReview = (ids: string[]) => {
    if (!profile) return
    startPractice(
      ids.map((id) => wordExercise(wordById[id], chooseSkill(profile.cards[id], reviewSkills), vocabulary)),
      'Wiederholen',
    )
  }
  const exportLearningBackup = () => {
    if (!profile) return
    downloadBackup(profile)
    const at = new Date().toISOString()
    setLastExport(at)
    try {
      rememberExport(at)
    } catch {
      setNotice('Die Sicherung wurde exportiert, aber das Exportdatum konnte nicht gespeichert werden.')
    }
  }
  const importFile = async (file?: File) => {
    if (!file) return
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Die Datei ist größer als 10 MB.')
      const json = await file.text()
      const parsed = parseBackup(json, validIds, validLessonIds, validPracticeIds)
      setPendingImport({ json, profile: parsed })
    } catch (e) {
      setNotice((e as Error).message)
    }
  }
  const backupImport = (
    <label className="button secondary file-button">
      <HardDriveDownload size={18} /> Sicherung importieren
      <input
        type="file"
        accept="application/json,.json"
        aria-label="Sicherung importieren"
        onChange={(e) => {
          void importFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </label>
  )
  const confirmImport = pendingImport && (
    <Modal title="Lernstand ersetzen?" onClose={() => setPendingImport(null)}>
      <p>
        Die geprüfte Sicherung enthält {Object.keys(pendingImport.profile.cards).length} begonnene Wörter.
      </p>
      <p>
        <strong>Dein vorhandener Lernstand wird vollständig überschrieben.</strong> Exportiere ihn vorher,
        wenn du ihn behalten möchtest.
      </p>
      <div className="actions">
        <button className="button secondary" onClick={() => setPendingImport(null)}>
          Abbrechen
        </button>
        <button
          className="button primary"
          onClick={async () => {
            try {
              const restored = await restoreBackup(
                pendingImport.json,
                validIds,
                validLessonIds,
                validPracticeIds,
              )
              setAudioRate(restored.settings.audioRate)
              setProfile(restored)
              setLoadError('')
              setSaveError('')
              setSession(null)
              setPendingImport(null)
              setNotice('Sicherung wurde vollständig wiederhergestellt.')
            } catch (e) {
              setNotice((e as Error).message)
            }
          }}
        >
          Lernstand ersetzen
        </button>
      </div>
    </Modal>
  )
  if (!profile)
    return (
      <div className="boot-screen">
        <img className="brand-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="你好" />
        {loadError ? (
          <>
            <h1>Lernstand nicht geladen.</h1>
            <p role="alert">{loadError}</p>
            <p>
              Vorhandene Daten wurden nicht verändert. Versuche es erneut oder stelle eine Sicherung wieder
              her.
            </p>
            <button className="button primary" onClick={() => void load()}>
              Erneut versuchen
            </button>
            {backupImport}
          </>
        ) : (
          <>
            <LoaderCircle className="spin" />
            <p>Wird geladen …</p>
          </>
        )}
        {confirmImport}
        {notice && <p role="alert">{notice}</p>}
      </div>
    )
  const page = route.split('/')[0]
  const plan = getReviewPlan(profile)
  const learned = Object.keys(profile.cards).length
  const nextLesson = lessons.find((l) => !profile.completedLessons.includes(l.id)) ?? lessons[0]
  const doneSession = () => {
    if (session?.kind === 'learn' && session.lessonId && pRef.current)
      commit(completeLesson(pRef.current, session.lessonId))
  }
  const beginLesson = (id: string) => {
    const lesson = lessonById[id]
    if (lesson)
      setSession({
        kind: 'learn',
        ids: lesson.wordIds,
        grammarIds: lesson.grammarIds,
        title: lesson.title,
        lessonId: id,
      })
  }
  const searchInput = (placeholder: string) => (
    <div className="search-field">
      <Search size={19} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {search && (
        <button className="icon-button" aria-label="Suche löschen" onClick={() => setSearch('')}>
          <X size={17} />
        </button>
      )}
    </div>
  )
  const closeSession = () => {
    setSession(null)
    stopAudio()
  }
  let content
  if (session)
    content =
      session.kind === 'learn' ? (
        <LearningSession {...session} onResult={result} onComplete={doneSession} onClose={closeSession} />
      ) : (
        <ExerciseRunner
          exercises={session.exercises}
          title={session.title}
          onResult={result}
          onComplete={() => {}}
          onClose={closeSession}
        />
      )
  else if (page === 'today')
    content = (
      <>
        <PageHeading page="today" onMenu={() => setMore(true)} menuOpen={more} />
        {(learned > 0 || Object.keys(profile.practice).length > 0) && backupIsOverdue(lastExport) && (
          <div className="note row-between" role="status">
            <span>
              {lastExport
                ? 'Dein letzter Export ist über einen Monat her. Sichere deinen Lernstand.'
                : 'Sichere deinen Lernstand. Du hast noch kein Backup exportiert.'}
            </span>
            <button className="button secondary" onClick={exportLearningBackup}>
              <Upload size={18} /> Jetzt sichern
            </button>
          </div>
        )}
        <div className="today-grid">
          <section className="today-focus">
            <div className="focus-body">
              <div>
                <h2>
                  {plan.dueIds.length
                    ? 'Wiederholen'
                    : profile.completedLessons.length < lessons.length
                      ? 'Nächste Lektion'
                      : 'Alle Lektionen bearbeitet.'}
                </h2>
                <p>
                  {plan.dueIds.length
                    ? `${plan.dueIds.length} Wörter sind fällig.`
                    : profile.completedLessons.length < lessons.length
                      ? nextLesson.title
                      : 'Wiederhole gelernte Inhalte oder vertiefe einzelne Fähigkeiten im Training.'}
                </p>
              </div>
              <div className="focus-hanzi" lang="zh-CN" aria-hidden="true">
                {plan.dueIds.length ? '温习' : '你好'}
                <span>{plan.dueIds.length ? 'wēnxí' : 'nǐ hǎo'}</span>
              </div>
            </div>
            <div className="focus-footer">
              <button
                className="button primary"
                onClick={() =>
                  plan.dueIds.length
                    ? beginReview(plan.dueIds.slice(0, 20))
                    : profile.completedLessons.length < lessons.length
                      ? beginLesson(nextLesson.id)
                      : navigate('learn')
                }
              >
                {plan.dueIds.length
                  ? 'Wiederholung starten'
                  : profile.completedLessons.length < lessons.length
                    ? 'Nächste Lektion starten'
                    : 'Lernpfad öffnen'}{' '}
                <ArrowRight size={18} />
              </button>
              <span>
                {plan.dueIds.length ? `${Math.min(plan.dueIds.length, 20)} Wörter in dieser Einheit` : null}
              </span>
            </div>
          </section>
        </div>
        <div className="today-stats">
          <button
            className="card lesson-progress status-link"
            onClick={() => navigate('review')}
            aria-label="Wiederholen öffnen"
          >
            <span className="status-title">
              <span className="eyebrow">Wiederholen</span>
              <ChevronRight size={20} />
            </span>
            <strong className="metric">{plan.dueIds.length}</strong>
            <p>Wörter jetzt fällig</p>
          </button>
          <LessonProgress completed={profile.completedLessons.length} onOpen={() => navigate('learn')} />
        </div>
        {plan.weakIds.length > 0 && (
          <div className="note row-between">
            <span>{plan.weakIds.length} Wörter zum Nachüben.</span>
            <button className="text-button" onClick={() => beginReview(plan.weakIds)}>
              Gezielt üben <ArrowRight size={16} />
            </button>
          </div>
        )}
      </>
    )
  else if (page === 'learn') {
    const lesson = lessonById[route.split('/')[1]]
    content = lesson ? (
      <>
        <button className="text-button back-link" onClick={() => navigate('learn')}>
          ← Zum Lernpfad
        </button>
        <PageHeading page="learn" onMenu={() => setMore(true)} menuOpen={more} />
        <div className="lesson-heading">
          <h2>{lesson.title}</h2>
          <p>{lesson.description}</p>
        </div>
        <div className="lesson-start">
          <button className="button primary" onClick={() => beginLesson(lesson.id)}>
            Lektion starten <ArrowRight size={18} />
          </button>
        </div>
        <div className="section-heading">
          <h2>Wörter</h2>
        </div>
        <div className="word-card-grid">
          {lesson.wordIds.map((id) => (
            <WordCard
              key={id}
              word={wordById[id]}
              onClick={() => setSelectedWord(wordById[id])}
              begun={!!profile.cards[id]}
            />
          ))}
        </div>
        {lesson.grammarIds.length > 0 && (
          <>
            <div className="section-heading">
              <h2>Grammatik</h2>
            </div>
            <div className="stack">
              {lesson.grammarIds.map((id) => (
                <button
                  key={id}
                  className="card content-row"
                  onClick={() => setSelectedGrammar(grammarById[id])}
                >
                  <TextCursorInput size={21} />
                  <span>
                    <strong>{grammarById[id].title}</strong>
                    <span className="muted">{grammarById[id].pattern}</span>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
          </>
        )}
        {lesson.taskIds.length > 0 && (
          <>
            <div className="section-heading">
              <h2>Im Alltag anwenden</h2>
            </div>
            <div className="stack">
              {lesson.taskIds
                .map((id) => taskById[id])
                .map((t) => (
                  <button
                    className="card content-row"
                    key={t.id}
                    onClick={() => startPractice([taskExercise(t)], t.title)}
                  >
                    <MessageCircle size={21} />
                    <span>
                      <strong>{t.title}</strong>
                      <span className="muted">{t.description}</span>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                ))}
            </div>
          </>
        )}
      </>
    ) : (
      <>
        <PageHeading page="learn" onMenu={() => setMore(true)} menuOpen={more} />
        <div className="path-summary card">
          <CircleCheck size={25} />
          <span>
            <strong>
              {profile.completedLessons.length} von {lessons.length}
            </strong>{' '}
            Lektionen bearbeitet
          </span>
          <ProgressBar value={profile.completedLessons.length} max={lessons.length} />
        </div>
        <div className="lesson-list">
          {lessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              profile={profile}
              recommended={!profile.completedLessons.includes(lesson.id) && lesson.id === nextLesson.id}
              onOpen={() => navigate(`learn/${lesson.id}`)}
            />
          ))}
        </div>
      </>
    )
  } else if (page === 'review') {
    const due = plan.dueIds.map((id) => profile.cards[id])
    content = (
      <>
        <PageHeading page="review" onMenu={() => setMore(true)} menuOpen={more} />
        {due.length ? (
          <div className="card review-start">
            <div className="review-count">{due.length}</div>
            <div>
              <h2>Wörter fällig</h2>
              <button className="button primary" onClick={() => beginReview(plan.dueIds.slice(0, 20))}>
                Bis zu 20 Wörter wiederholen <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ) : (
          <Empty
            title={learned ? 'Keine Wörter fällig' : 'Noch keine Wörter gelernt'}
            icon={<CircleCheck size={36} />}
          >
            <button className="button primary" onClick={() => navigate(learned ? 'training' : 'learn')}>
              {learned ? 'Zum Training' : 'Zum Lernpfad'} <ArrowRight size={18} />
            </button>
          </Empty>
        )}
        {learned > 0 && (
          <div className="section-heading">
            <h2>{due.length ? 'Fällige Wörter' : 'Kommende Wiederholungen'}</h2>
          </div>
        )}
        <div className="stack">
          {(due.length
            ? due
            : Object.values(profile.cards).sort((a, b) => a.fsrs.due.localeCompare(b.fsrs.due))
          )
            .slice(0, 20)
            .map((card) => (
              <button
                className="card content-row"
                key={card.vocabularyId}
                onClick={() => setSelectedWord(wordById[card.vocabularyId])}
              >
                <span className="chinese list-hanzi" lang="zh-CN">
                  {wordById[card.vocabularyId].hanzi}
                </span>
                <span>
                  <strong>{wordById[card.vocabularyId].meaning}</strong>
                  <span className="muted">{skillLabels[chooseSkill(card, reviewSkills)]}</span>
                </span>
                <span className="small muted">
                  {Date.parse(card.fsrs.due) <= Date.now() ? 'Jetzt fällig' : formatDate(card.fsrs.due)}
                </span>
              </button>
            ))}
        </div>
      </>
    )
  } else if (page === 'words') {
    const filtered = vocabulary.filter(
      (w) =>
        searchText(`${w.hanzi} ${w.pinyin} ${w.meaning}`).includes(searchText(search)) &&
        (filter === 'all' || (filter === 'begun' ? !!profile.cards[w.id] : !profile.cards[w.id])),
    )
    content = (
      <>
        <PageHeading page="words" onMenu={() => setMore(true)} menuOpen={more} />
        <div className="filter-bar">
          {searchInput('Wort, Pinyin oder Bedeutung suchen')}
          <ToggleGroup
            label="Wortschatz filtern"
            value={filter}
            options={[
              { value: 'all', label: 'Alle' },
              { value: 'begun', label: 'Begonnen' },
              { value: 'new', label: 'Neu' },
            ]}
            onChange={setFilter}
          />
        </div>
        <p className="small muted">{filtered.length} Wörter</p>
        <div className="word-card-grid">
          {filtered.map((w) => (
            <WordCard key={w.id} word={w} onClick={() => setSelectedWord(w)} begun={!!profile.cards[w.id]} />
          ))}
        </div>
        {!filtered.length && <Empty title="Keine Wörter gefunden." />}
      </>
    )
  } else if (page === 'hanzi') {
    const filtered = hanzi.filter((h) =>
      searchText(`${h.char} ${h.pinyin} ${h.meaning}`).includes(searchText(search)),
    )
    content = (
      <>
        <PageHeading page="hanzi" onMenu={() => setMore(true)} menuOpen={more} />
        <div className="filter-bar">{searchInput('Zeichen, Pinyin oder Bedeutung suchen')}</div>
        <p className="small muted">{filtered.length} Zeichen</p>
        <div className="hanzi-grid">
          {filtered.map((h) => (
            <button key={h.id} className="hanzi-tile" onClick={() => setSelectedHanzi(h)}>
              <span className="chinese" lang="zh-CN">
                {h.char}
              </span>
              <span className="pinyin">{h.pinyin}</span>
              {h.wordIds.some((id) => !!profile.cards[id]) && (
                <CircleCheck className="hanzi-check" size={18} aria-label="Zugehöriges Wort begonnen" />
              )}
            </button>
          ))}
        </div>
        {!filtered.length && <Empty title="Keine Zeichen gefunden." />}
      </>
    )
  } else if (page === 'grammar') {
    const filtered = grammar.filter((g) => searchText(`${g.title} ${g.pattern}`).includes(searchText(search)))
    content = (
      <>
        <PageHeading page="grammar" onMenu={() => setMore(true)} menuOpen={more} />
        <div className="filter-bar">{searchInput('Grammatik suchen')}</div>
        <p className="small muted">{filtered.length} Grammatikthemen</p>
        <div className="grammar-grid">
          {filtered.map((g) => (
            <button className="card grammar-card" key={g.id} onClick={() => setSelectedGrammar(g)}>
              <span className="eyebrow">
                Lektion {Number(g.lessonId.slice(1))} {profile.practice[g.id]?.attempts > 0 && '· Geübt'}
              </span>
              <h3>{g.title}</h3>
              <p className="pattern small-pattern">{g.pattern}</p>
              <p>{g.explanation}</p>
              <span className="text-button">
                Ansehen <ArrowRight size={16} />
              </span>
            </button>
          ))}
        </div>
        {!filtered.length && <Empty title="Keine Grammatikthemen gefunden." />}
      </>
    )
  } else if (page === 'training') {
    const baseWords = orderedWordIds.filter((id) => !!profile.cards[id]).map((id) => wordById[id])
    const pool = baseWords.length ? baseWords : lessons[0].wordIds.map((id) => wordById[id])
    content = (
      <>
        <PageHeading page="training" onMenu={() => setMore(true)} menuOpen={more} />
        <div className="training-grid">
          {(['listening', 'context', 'production', 'pinyin'] as Skill[]).map((skill) => (
            <button
              className="card training-card"
              key={skill}
              disabled={skill === 'listening' && !audio.available}
              onClick={() =>
                startPractice(
                  [...pool]
                    .sort(
                      (a, b) =>
                        (profile.cards[a.id]?.skills[skill].attempts ?? 0) -
                        (profile.cards[b.id]?.skills[skill].attempts ?? 0),
                    )
                    .slice(0, 10)
                    .map((w) => wordExercise(w, skill, vocabulary)),
                  skillLabels[skill],
                )
              }
            >
              {skill === 'listening' ? (
                <Headphones />
              ) : skill === 'context' ? (
                <BookOpen />
              ) : skill === 'production' ? (
                <MessageCircle />
              ) : (
                <Headphones />
              )}
              <h3>{skillLabels[skill]}</h3>
              <p>
                {skill === 'listening'
                  ? 'Hören → Bedeutung'
                  : skill === 'context'
                    ? 'Bedeutung im Satz erkennen'
                    : skill === 'production'
                      ? 'Deutsch → Chinesisch'
                      : 'Hanzi → Pinyin'}
              </p>
              <span className="text-button">
                {skill === 'listening' && !audio.available
                  ? 'Lokale Mandarin-Stimme benötigt'
                  : 'Training starten'}{' '}
                <ArrowRight size={16} />
              </span>
            </button>
          ))}
        </div>
        {!audio.available && <p className="note">{audio.message}</p>}
        <div className="section-heading">
          <h2>Kommunikative Aufgaben</h2>
          <span>{tasks.length} Teilkompetenzen</span>
        </div>
        {searchInput('Situation oder Kompetenz suchen')}
        <div className="task-list">
          {tasks
            .filter((t) => searchText(`${t.title} ${t.description}`).includes(searchText(search)))
            .map((t) => (
              <button
                className="card content-row"
                key={t.id}
                onClick={() => startPractice([taskExercise(t)], t.title)}
              >
                <MessageCircle size={20} />
                <span>
                  <strong>{t.title}</strong>
                  <span className="muted">{t.description}</span>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
        </div>
      </>
    )
  } else if (page === 'settings')
    content = (
      <>
        <PageHeading page="settings" onMenu={() => setMore(true)} menuOpen={more} />
        <div className="settings-stack">
          <section className="card settings-section">
            <h2>Darstellung</h2>
            <div className="setting-row">
              <span>
                <strong>Farbschema</strong>
              </span>
              <ToggleGroup<Profile['settings']['theme']>
                label="Darstellung"
                value={profile.settings.theme}
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Hell' },
                  { value: 'dark', label: 'Dunkel' },
                ]}
                onChange={(theme) => commit({ ...profile, settings: { ...profile.settings, theme } })}
              />
            </div>
          </section>
          <section className="card settings-section">
            <h2>Audio</h2>
            {!audio.available && <p>{audio.message}</p>}
            <div className="setting-row">
              <span>
                <strong>Sprechtempo</strong>
              </span>
              <ToggleGroup
                label="Sprechtempo"
                value={normalizeAudioRate(profile.settings.audioRate)}
                options={[
                  { value: AUDIO_RATES.slow, label: 'Langsam' },
                  { value: AUDIO_RATES.normal, label: 'Normal' },
                  { value: AUDIO_RATES.fast, label: 'Schnell' },
                ]}
                onChange={(audioRate) => commit({ ...profile, settings: { ...profile.settings, audioRate } })}
              />
            </div>
            <AudioButton text="你好！我在学习汉语。" label="Stimme ausprobieren" />
          </section>
          <section className="card settings-section">
            <h2>Sicherung</h2>
            <div className="actions">
              <button className="button primary" onClick={() => exportLearningBackup()}>
                <Upload size={18} /> Lernstand exportieren
              </button>
              {backupImport}
            </div>
            {lastExport && (
              <p className="small muted last-export">Letzter Export: {formatDate(lastExport)}</p>
            )}
          </section>
          <section className="card settings-section">
            <h2>Curriculum</h2>
            <p>HSK 3.0 · Level 1</p>
          </section>
        </div>
      </>
    )
  else
    content = (
      <Empty title="Diese Ansicht gibt es nicht.">
        <p>Dein Lernstand ist weiterhin vorhanden.</p>
        <button className="button primary" onClick={() => navigate('today')}>
          Zur Startseite
        </button>
      </Empty>
    )
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate('today')} aria-label="Nǐ Hǎo Startseite">
          <img className="brand-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <span>
            <strong>Nǐ Hǎo</strong>
          </span>
        </button>
        <MainNavigation page={page} dueCount={plan.dueIds.length} onNavigate={navigate} />
      </aside>
      <div className="main-layout">
        <main id="main" className={session ? 'session-main' : ''}>
          {saveError && (
            <div role="alert" className="error-banner">
              <p>{saveError} Änderungen bleiben vorerst nur im Arbeitsspeicher.</p>
              <button className="button secondary" onClick={() => commit(profile)}>
                Erneut speichern
              </button>
              <button className="button secondary" onClick={() => exportLearningBackup()}>
                Sicherung herunterladen
              </button>
            </div>
          )}
          {session && (
            <div className="session-navigation">
              <PageHeading page={page} onMenu={() => setMore(true)} menuOpen={more} />
            </div>
          )}
          {content}
        </main>
      </div>
      {more && (
        <Modal title="Nǐ Hǎo" className="navigation-drawer" onClose={() => setMore(false)}>
          <MainNavigation page={page} dueCount={plan.dueIds.length} onNavigate={navigate} mobile />
        </Modal>
      )}
      {selectedWord && (
        <LookupDetail
          title="Wortschatz"
          hanzi={selectedWord.hanzi}
          pinyin={selectedWord.pinyin}
          meaning={selectedWord.meaning}
          note={selectedWord.note}
          onClose={() => setSelectedWord(null)}
          action={
            <button
              className="button secondary"
              onClick={() => {
                navigate(`learn/${selectedWord.lessonId}`)
                setSelectedWord(null)
              }}
            >
              Zur Lektion
            </button>
          }
        >
          <ExampleTranslation example={selectedWord.example} />
          {profile.cards[selectedWord.id] && (
            <div className="word-skills">
              {Object.entries(profile.cards[selectedWord.id].skills).map(([skill, s]) => (
                <span key={skill}>
                  {skillLabels[skill as Skill]}
                  <strong>{s.attempts ? `${s.correct}/${s.attempts}` : 'noch offen'}</strong>
                </span>
              ))}
            </div>
          )}
        </LookupDetail>
      )}
      {selectedHanzi && (
        <LookupDetail
          title="Hanzi"
          hanzi={selectedHanzi.char}
          pinyin={selectedHanzi.pinyin}
          meaning={selectedHanzi.meaning}
          onClose={() => setSelectedHanzi(null)}
        >
          <section className="lookup-related">
            <span className="eyebrow">In diesen Wörtern</span>
            <div className="character-words">
              {selectedHanzi.wordIds.map((id) => (
                <button
                  key={id}
                  onClick={() => {
                    setSelectedWord(wordById[id])
                    setSelectedHanzi(null)
                  }}
                >
                  <span className="chinese" lang="zh-CN">
                    {wordById[id].hanzi}
                  </span>
                  <span>{wordById[id].meaning}</span>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
          </section>
        </LookupDetail>
      )}
      {selectedGrammar && (
        <DetailOverlay
          title="Grammatik"
          onClose={() => setSelectedGrammar(null)}
          heading={
            <>
              <h3>{selectedGrammar.title}</h3>
              <p className="pattern">{selectedGrammar.pattern}</p>
            </>
          }
          note={selectedGrammar.explanation}
          actions={
            <button
              className="button secondary"
              onClick={() => {
                navigate(`learn/${selectedGrammar.lessonId}`)
                setSelectedGrammar(null)
              }}
            >
              Zur Lektion
            </button>
          }
        >
          <ExampleTranslation example={selectedGrammar.example} />
        </DetailOverlay>
      )}
      {confirmImport}
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button className="icon-button" onClick={() => setNotice('')} aria-label="Meldung schließen">
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
