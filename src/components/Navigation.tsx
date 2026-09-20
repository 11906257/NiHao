import { BookOpen, Dumbbell, TextCursorInput, Library, Menu, RefreshCw, Settings2, Sun } from 'lucide-react'
const routes = [
  { id: 'today', label: 'Heute', icon: Sun },
  { id: 'learn', label: 'Lernpfad', icon: BookOpen },
  { id: 'review', label: 'Wiederholen', icon: RefreshCw },
  { id: 'words', label: 'Wortschatz', icon: Library },
  { id: 'hanzi', label: 'Hanzi', icon: HanziIcon },
  { id: 'grammar', label: 'Grammatik', icon: TextCursorInput },
  { id: 'training', label: 'Training', icon: Dumbbell },
  { id: 'settings', label: 'Einstellungen', icon: Settings2 },
]
function HanziIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v3M4 9V6h16v3M8 10h8l-4 4v6l-3-1M4 15h16" />
      </g>
    </svg>
  )
}

export function PageHeading({
  page,
  onMenu,
  menuOpen,
}: {
  page: string
  onMenu: () => void
  menuOpen: boolean
}) {
  const route = routes.find((route) => route.id === page) ?? routes[0]
  return (
    <div className="page-heading simple-heading">
      <button
        className="icon-button heading-menu"
        aria-label="Menü öffnen"
        aria-expanded={menuOpen}
        onClick={onMenu}
      >
        <Menu size={24} />
      </button>
      <route.icon size={38} />
      <h1>{route.label}</h1>
    </div>
  )
}

export function MainNavigation({
  page,
  dueCount,
  onNavigate,
  mobile = false,
}: {
  page: string
  dueCount: number
  onNavigate: (id: string) => void
  mobile?: boolean
}) {
  return (
    <nav aria-label={mobile ? 'Mobile Navigation' : 'Hauptnavigation'}>
      {routes.map((route, index) => (
        <button
          className={`nav-link ${page === route.id ? 'active' : ''} ${index === 3 || index === 7 ? 'nav-divider' : ''}`}
          key={route.id}
          onClick={() => onNavigate(route.id)}
          aria-current={page === route.id ? 'page' : undefined}
        >
          <route.icon size={20} />
          <span>{route.label}</span>
          {route.id === 'review' && dueCount > 0 && <span className="nav-count">{dueCount}</span>}
        </button>
      ))}
    </nav>
  )
}
