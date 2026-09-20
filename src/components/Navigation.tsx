import {
  ArrowLeft,
  BookOpen,
  Dumbbell,
  TextCursorInput,
  Library,
  RefreshCw,
  Settings,
  Languages,
} from 'lucide-react'

const pages = {
  learn: { label: 'Lektionen', icon: BookOpen },
  review: { label: 'Wiederholen', icon: RefreshCw },
  words: { label: 'Wortschatz', icon: Library },
  hanzi: { label: 'Zeichen', icon: Languages },
  grammar: { label: 'Grammatik', icon: TextCursorInput },
  training: { label: 'Training', icon: Dumbbell },
  settings: { label: 'Einstellungen', icon: Settings },
}

export function PageHeading({ page, onBack }: { page: string; onBack: () => void }) {
  const entry = pages[page as keyof typeof pages]
  return (
    <header className="subpage-heading">
      <button className="icon-button page-back" onClick={onBack} aria-label="Nǐ Hǎo">
        <ArrowLeft size={24} />
      </button>
      {entry && (
        <div className="page-heading simple-heading">
          <entry.icon size={32} />
          <h1>{entry.label}</h1>
        </div>
      )}
    </header>
  )
}

export function HomeTiles({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <section className="home-links">
      <h2>Lernen &amp; Nachschlagen</h2>
      <div className="home-tile-grid">
        {(['words', 'hanzi', 'grammar', 'training'] as const).map((id) => {
          const entry = pages[id]
          return (
            <button key={id} className="card home-tile" onClick={() => onNavigate(id)}>
              <entry.icon size={28} />
              <span>{entry.label}</span>
            </button>
          )
        })}
      </div>
      <button className="text-button settings-link" onClick={() => onNavigate('settings')}>
        <Settings size={24} />
        <span>Einstellungen</span>
      </button>
    </section>
  )
}

export function ProgressCard({
  label,
  value,
  max,
  onOpen,
}: {
  label: string
  value: number
  max: number
  onOpen: () => void
}) {
  const circumference = 2 * Math.PI * 42
  return (
    <button className="card progress-card" onClick={onOpen} aria-label={`${label} öffnen`}>
      <div className="progress-ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="ring-track" cx="50" cy="50" r="42" />
          <circle
            className="ring-value"
            cx="50"
            cy="50"
            r="42"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - Math.min(1, value / max))}
          />
        </svg>
        <span>
          <strong>{value}</strong> / {max}
        </span>
      </div>
      <span>{label}</span>
    </button>
  )
}
