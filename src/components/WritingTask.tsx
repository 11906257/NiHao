import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import type { Vocabulary } from '../data/types'

type Point = { x: number; y: number }

export function WritingTask({ word, onRate }: { word: Vocabulary; onRate: (correct: boolean) => void }) {
  const [revealed, setRevealed] = useState(false)
  const [showStrokes, setShowStrokes] = useState(false)
  const [playingStrokes, setPlayingStrokes] = useState(false)
  const [strokeError, setStrokeError] = useState('')
  const pathsRef = useRef<Point[][]>([])
  const canvas = useRef<HTMLCanvasElement>(null)
  const pointer = useRef<number | null>(null)
  const strokeTarget = useRef<HTMLDivElement>(null)
  const strokePlayer = useRef<{ stop: () => void } | null>(null)
  const animationRun = useRef(0)

  const redraw = useCallback(() => {
    const element = canvas.current
    if (!element) return
    const { width, height } = element.getBoundingClientRect()
    if (!width || !height) return
    const scale = window.devicePixelRatio || 1
    element.width = Math.round(width * scale)
    element.height = Math.round(height * scale)
    const context = element.getContext('2d')
    if (!context) return
    context.setTransform(scale, 0, 0, scale, 0, 0)
    context.clearRect(0, 0, width, height)
    context.strokeStyle = getComputedStyle(document.documentElement).color
    context.lineWidth = 5
    context.lineCap = 'round'
    context.lineJoin = 'round'
    for (const path of pathsRef.current) {
      if (!path.length) continue
      context.beginPath()
      context.moveTo(path[0]!.x * width, path[0]!.y * height)
      for (const point of path.slice(1)) context.lineTo(point.x * width, point.y * height)
      if (path.length === 1) context.lineTo(path[0]!.x * width + 0.1, path[0]!.y * height + 0.1)
      context.stroke()
    }
  }, [])

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const observer = new ResizeObserver(redraw)
    observer.observe(element)
    redraw()
    return () => observer.disconnect()
  }, [revealed, redraw])

  useEffect(
    () => () => {
      animationRun.current++
      strokePlayer.current?.stop()
    },
    [],
  )

  const point = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    }
  }
  const startStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (revealed) return
    pointer.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    const next = [...pathsRef.current, [point(event)]]
    pathsRef.current = next
    redraw()
  }
  const continueStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (revealed) return
    if (pointer.current !== event.pointerId) return
    const next = pathsRef.current.map((path, index) =>
      index === pathsRef.current.length - 1 ? [...path, point(event)] : path,
    )
    pathsRef.current = next
    redraw()
  }
  const clear = () => {
    pathsRef.current = []
    redraw()
  }
  const rate = (correct: boolean) => {
    animationRun.current++
    strokePlayer.current?.stop()
    strokePlayer.current = null
    setPlayingStrokes(false)
    onRate(correct)
  }
  const animateStrokes = async () => {
    if (!strokeTarget.current || playingStrokes) return
    const run = ++animationRun.current
    let player: { stop: () => void; play: (word: string) => Promise<void> } | null = null
    setShowStrokes(true)
    setStrokeError('')
    setPlayingStrokes(true)
    try {
      const { createStrokeOrderPlayer } = await import('../lib/stroke-order')
      if (run !== animationRun.current || !strokeTarget.current) return
      player = createStrokeOrderPlayer(strokeTarget.current)
      strokePlayer.current = player
      await player.play(word.hanzi)
    } catch {
      if (run === animationRun.current) setStrokeError('Die Strichfolge konnte nicht angezeigt werden.')
    } finally {
      player?.stop()
      if (strokePlayer.current === player) strokePlayer.current = null
      if (run === animationRun.current) setPlayingStrokes(false)
    }
  }

  return (
    <section className="card writing-card">
      <div className="writing-prompt">
        <p className="writing-pinyin">{word.pinyin}</p>
        <p>{word.meaning}</p>
      </div>
      <div className={`writing-work ${revealed ? 'revealed' : ''}`}>
        <canvas
          ref={canvas}
          className="writing-canvas"
          role="img"
          aria-label="Deine Zeichnung des chinesischen Wortes"
          onPointerDown={startStroke}
          onPointerMove={continueStroke}
          onPointerUp={() => (pointer.current = null)}
          onPointerCancel={() => (pointer.current = null)}
        />
        {revealed && (
          <div className="writing-answer" aria-label="Lösung">
            <span className="chinese" lang="zh-CN">
              {word.hanzi}
            </span>
          </div>
        )}
      </div>
      {!revealed ? (
        <div className="writing-actions">
          <button className="button secondary" onClick={clear}>
            Zurücksetzen
          </button>
          <button className="button primary" onClick={() => setRevealed(true)}>
            Lösung anzeigen
          </button>
        </div>
      ) : (
        <>
          <div className="rating-buttons">
            <button className="button secondary" onClick={() => rate(false)}>
              Weiter üben
            </button>
            <button className="button primary" onClick={() => rate(true)}>
              Gewusst <ArrowRight size={18} />
            </button>
          </div>
          <button
            className="text-button writing-stroke-button"
            disabled={playingStrokes}
            onClick={() => void animateStrokes()}
          >
            Strichreihenfolge anzeigen
          </button>
          <div
            ref={strokeTarget}
            className={`writing-strokes ${showStrokes ? '' : 'is-hidden'}`}
            aria-label="Strichreihenfolge"
          />
          {strokeError && (
            <p className="small muted" role="status">
              {strokeError}
            </p>
          )}
        </>
      )}
    </section>
  )
}
