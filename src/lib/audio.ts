export const AUDIO_RATES = { slow: 0.1, normal: 0.9, fast: 1.2 } as const

export function normalizeAudioRate(rate: number): number {
  return rate < AUDIO_RATES.normal ? AUDIO_RATES.slow : rate > AUDIO_RATES.normal ? AUDIO_RATES.fast : AUDIO_RATES.normal
}

export interface AudioCapability {
  supported: boolean
  available: boolean
  voiceName: string | null
  message: string
}

let currentRate: number = AUDIO_RATES.normal
export function setAudioRate(rate: number): void {
  currentRate = normalizeAudioRate(rate)
  stopAudio()
}

function synthesis(): SpeechSynthesis | undefined {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined
}

function chineseVoice(): SpeechSynthesisVoice | undefined {
  return synthesis()?.getVoices()
    .filter(voice => voice.localService && /^(zh([-_](CN|Hans|SG)([-_]CN)?)?|cmn([-_]CN)?)$/i.test(voice.lang))
    .sort((a, b) => Number(/CN|Hans/i.test(b.lang)) - Number(/CN|Hans/i.test(a.lang)))[0]
}

export function getAudioCapability(): AudioCapability {
  const engine = synthesis()
  const voice = chineseVoice()
  return {
    supported: !!engine,
    available: !!voice,
    voiceName: voice?.name ?? null,
    message: voice
      ? `Lokale Mandarin-Stimme: ${voice.name}`
      : 'Keine lokale Mandarin-Stimme verfügbar. Auf dem iPhone unter Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen eine chinesische Stimme laden. Lesen und Lernen bleiben verfügbar.',
  }
}

let finishCurrent: (() => void) | undefined
let requestId = 0

export function stopAudio(): void {
  requestId += 1
  synthesis()?.cancel()
  finishCurrent?.()
  finishCurrent = undefined
}

function loadVoices(engine: SpeechSynthesis): Promise<void> {
  if (engine.getVoices().length) return Promise.resolve()
  return new Promise(resolve => {
    const finish = () => {
      clearTimeout(timeout)
      engine.removeEventListener('voiceschanged', finish)
      resolve()
    }
    const timeout = setTimeout(finish, 1200)
    engine.addEventListener('voiceschanged', finish)
  })
}

export async function speakChinese(text: string): Promise<void> {
  if (!text.trim()) return
  stopAudio()
  const currentRequest = requestId
  const rate = currentRate
  const engine = synthesis()
  if (!engine) throw new Error(getAudioCapability().message)
  await loadVoices(engine)
  if (currentRequest !== requestId) return
  const voice = chineseVoice()
  // No network-backed/default voice: offline behavior must remain explicit.
  if (!voice) throw new Error(getAudioCapability().message)
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    utterance.lang = 'zh-CN'
    utterance.rate = rate
    utterance.pitch = 1
    const timeout = setTimeout(() => {
      finishCurrent = undefined
      engine.cancel()
      reject(new Error('Die Systemstimme antwortet nicht. Bitte die Audiotaste erneut antippen.'))
    }, Math.max(15000, text.length * 1800 * Math.max(1, 0.9 / rate)))
    const finish = () => { clearTimeout(timeout); finishCurrent = undefined; resolve() }
    finishCurrent = finish
    utterance.onend = finish
    utterance.onerror = event => {
      clearTimeout(timeout)
      finishCurrent = undefined
      if (event.error === 'canceled' || event.error === 'interrupted') resolve()
      else reject(new Error(`Audio konnte nicht abgespielt werden (${event.error}).`))
    }
    engine.resume()
    engine.speak(utterance)
  })
}

