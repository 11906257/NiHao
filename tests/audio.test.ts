import { afterEach, expect, it, vi } from 'vitest'
import { AUDIO_RATES, setAudioRate, speakChinese, stopAudio } from '../src/lib/audio'
afterEach(() => {
  stopAudio()
  setAudioRate(AUDIO_RATES.normal)
  vi.unstubAllGlobals()
})
it('uses the global tempo for every playback and applies changes immediately', async () => {
  const rates: number[] = []
  vi.stubGlobal('window', {
    speechSynthesis: {
      getVoices: () => [{ lang: 'zh-CN', localService: true, name: 'Mandarin' }],
      cancel: () => {},
      resume: () => {},
      speak: (u: { rate: number; onend: () => void }) => {
        rates.push(u.rate)
        u.onend()
      },
    },
  })
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      constructor(public text: string) {}
    },
  )
  for (const rate of [AUDIO_RATES.slow, AUDIO_RATES.normal, AUDIO_RATES.fast]) {
    setAudioRate(rate)
    await speakChinese('你好')
    await speakChinese('我在学习汉语。')
  }
  expect(rates).toEqual([0.1, 0.1, 0.9, 0.9, 1.2, 1.2])
})

it('does not interrupt speech when saving an unchanged tempo', async () => {
  const cancel = vi.fn()
  let utterance: { onend: () => void } | undefined
  vi.stubGlobal('window', {
    speechSynthesis: {
      getVoices: () => [{ lang: 'zh-CN', localService: true }],
      cancel,
      resume: () => {},
      speak: (u: { onend: () => void }) => {
        utterance = u
      },
    },
  })
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      constructor(public text: string) {}
    },
  )
  const playing = speakChinese('你好')
  await Promise.resolve()
  cancel.mockClear()
  setAudioRate(AUDIO_RATES.normal)
  expect(cancel).not.toHaveBeenCalled()
  utterance!.onend()
  await playing
})
it('ignores late completion events from a cancelled utterance', async () => {
  const utterances: { onend: () => void }[] = []
  vi.stubGlobal('window', {
    speechSynthesis: {
      getVoices: () => [{ lang: 'zh-CN', localService: true }],
      cancel: () => {},
      resume: () => {},
      speak: (u: { onend: () => void }) => utterances.push(u),
    },
  })
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      constructor(public text: string) {}
    },
  )
  const first = speakChinese('你')
  await Promise.resolve()
  const second = speakChinese('好')
  await Promise.resolve()
  utterances[0].onend()
  stopAudio()
  await Promise.all([first, second])
})
