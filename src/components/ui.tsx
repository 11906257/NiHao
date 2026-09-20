import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Volume2, X, LoaderCircle } from 'lucide-react'
import { getAudioCapability, speakChinese } from '../lib/audio'
export function useAudio() {
  const [cap, setCap] = useState(getAudioCapability)
  useEffect(() => {
    const update = () => setCap(getAudioCapability())
    window.speechSynthesis?.addEventListener('voiceschanged', update)
    update()
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', update)
  }, [])
  return cap
}
export function AudioButton({ text, label }: { text: string; label?: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  return (
    <span className="audio-wrap">
      <button
        className={`button ${label ? 'secondary' : 'icon-button'}`}
        title={label ?? 'Auf Chinesisch anhören'}
        aria-label={label ?? 'Auf Chinesisch anhören'}
        disabled={busy}
        onClick={async () => {
          setError('')
          setBusy(true)
          try {
            await speakChinese(text)
          } catch (e) {
            setError((e as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? <LoaderCircle size={20} className="spin" /> : <Volume2 size={20} />} {label}
      </button>
      {error && (
        <span className="audio-error" role="alert">
          {error}
          <button className="text-button" onClick={() => setError('')}>
            Schließen
          </button>
        </span>
      )}
    </span>
  )
}
export function Modal({
  title,
  children,
  onClose,
  className = '',
}: {
  title: string
  children: ReactNode
  onClose: () => void
  className?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
    const el = dialog.current
    return () => el?.close()
  }, [])
  return (
    <dialog
      ref={dialog}
      className={`modal ${className}`}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === dialog.current) onClose()
      }}
    >
      <div className="modal-top">
        <h3>{title}</h3>
        <button className="icon-button" onClick={onClose} aria-label="Schließen">
          <X />
        </button>
      </div>
      {children}
    </dialog>
  )
}
export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  return (
    <div className="progress-block">
      {label && (
        <div className="progress-label">
          <span>{label}</span>
          <span>
            {value} / {max}
          </span>
        </div>
      )}
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label ?? 'Fortschritt'}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <span style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} />
      </div>
    </div>
  )
}
export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <h2>{title}</h2>
      {children}
    </div>
  )
}

export function ToggleGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="toggle-group" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function ExampleTranslation({ example }: { example: { zh: string; pinyin: string; de: string } }) {
  return (
    <div className="translation-box">
      <section className="translation-chinese" aria-label="Chinesischer Beispielsatz">
        <div className="translation-heading">
          <span>Chinesisch</span>
          <AudioButton text={example.zh} />
        </div>
        <p className="chinese" lang="zh-CN">
          {example.zh}
        </p>
        <p className="pinyin" lang="zh-Latn">
          {example.pinyin}
        </p>
      </section>
      <section className="translation-german" aria-label="Deutsche Übersetzung">
        <div className="translation-heading">
          <span>Deutsch</span>
        </div>
        <p lang="de">{example.de}</p>
      </section>
    </div>
  )
}

export function LookupDetail({
  title,
  hanzi,
  pinyin,
  meaning,
  note,
  onClose,
  action,
  children,
}: {
  title: string
  hanzi: string
  pinyin: string
  meaning: string
  note?: string
  onClose: () => void
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <DetailOverlay
      title={title}
      onClose={onClose}
      note={note}
      heading={
        <>
          <span className="chinese detail-hanzi" lang="zh-CN">
            {hanzi}
          </span>
          <span className="intro-pinyin">{pinyin}</span>
          <h3>{meaning}</h3>
        </>
      }
      actions={
        <>
          <AudioButton text={hanzi} label="Anhören" />
          {action}
        </>
      }
    >
      {children}
    </DetailOverlay>
  )
}

export function DetailOverlay({
  title,
  heading,
  actions,
  note,
  onClose,
  children,
}: {
  title: string
  heading: ReactNode
  actions: ReactNode
  note?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Modal title={title} onClose={onClose} className="lookup-modal">
      <div className="lookup-detail">
        <header className="lookup-heading">
          {heading}
          <div className="lookup-actions">{actions}</div>
        </header>
        {note && <p className="note">{note}</p>}
        <div className="lookup-content">{children}</div>
      </div>
    </Modal>
  )
}
