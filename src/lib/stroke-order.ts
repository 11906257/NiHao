import HanziWriter from 'hanzi-writer'
import strokeData from '../data/stroke-order.json'

const data = strokeData as Record<string, { strokes: string[]; medians: number[][][] }>

export function createLoopingStrokeOrder(target: HTMLElement, word: string, size: number) {
  const styles = getComputedStyle(document.documentElement)
  target.replaceChildren()
  const writers = Array.from(word, (character) => {
    if (!data[character]) throw new Error(`Keine Strichfolge für ${character}.`)
    const slot = document.createElement('span')
    target.append(slot)
    return HanziWriter.create(slot, character, {
      width: size,
      height: size,
      padding: size * 0.08,
      showCharacter: false,
      strokeAnimationSpeed: 2,
      delayBetweenStrokes: 220,
      strokeColor: styles.color,
      outlineColor: styles.getPropertyValue('--muted').trim(),
      charDataLoader: (char) => data[char]!,
    })
  })
  let stopped = false
  let timeout: ReturnType<typeof setTimeout> | undefined
  let finishPause: (() => void) | undefined
  return {
    async play() {
      while (!stopped) {
        for (const writer of writers) {
          if (stopped) return
          await writer.animateCharacter()
        }
        if (stopped) return
        await new Promise<void>((resolve) => {
          finishPause = resolve
          timeout = setTimeout(resolve, 900)
        })
      }
    },
    stop() {
      stopped = true
      clearTimeout(timeout)
      finishPause?.()
      writers.forEach((writer) => writer.pauseAnimation())
      target.replaceChildren()
    },
  }
}
