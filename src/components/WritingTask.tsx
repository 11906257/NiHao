import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import type { Vocabulary } from '../data/types'
import { AnimatedHanzi } from './ui'

type Point = { x: number; y: number }

export function WritingTask({ word, onRate }: { word: Vocabulary; onRate: (correct: boolean) => void }) {
  const [revealed, setRevealed] = useState(false)
  const pathsRef = useRef<Point[][]>([])
  const canvas = useRef<HTMLCanvasElement>(null)
  const pointer = useRef<number | null>(null)

  const redraw = useCallback(() => {
    const element = canvas.current
    if (!element) return
    const { width, height } = element.getBoundingClientRect()
    if (!width || !height) return
    const scale = window.devicePixelRatio || 1
    const pixelWidth = Math.round(width * scale)
    const pixelHeight = Math.round(height * scale)
    if (element.width !== pixelWidth) element.width = pixelWidth
    if (element.height !== pixelHeight) element.height = pixelHeight
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

  const point = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    }
  }
  const startStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (revealed || pointer.current !== null || event.button !== 0) return
    pointer.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    pathsRef.current.push([point(event)])
    redraw()
  }
  const continueStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (revealed || pointer.current !== event.pointerId) return
    pathsRef.current.at(-1)!.push(point(event))
    redraw()
  }
  const endStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (pointer.current === event.pointerId) pointer.current = null
  }
  const clear = () => {
    pointer.current = null
    pathsRef.current = []
    redraw()
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
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onLostPointerCapture={endStroke}
        />
        {revealed && (
          <div className="writing-answer" aria-label="Lösung">
            <span className="chinese" style={{ fontSize: `calc(84cqi / ${Array.from(word.hanzi).length})` }}>
              <AnimatedHanzi text={word.hanzi} />
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
        <div className="rating-buttons">
          <button className="button secondary" onClick={() => onRate(false)}>
            Weiter üben
          </button>
          <button className="button primary" onClick={() => onRate(true)}>
            Gewusst <ArrowRight size={18} />
          </button>
        </div>
      )}
    </section>
  )
}
