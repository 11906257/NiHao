import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Lesson, Vocabulary, Grammar } from '../../src/data/types'
const vocabulary = JSON.parse(readFileSync('src/data/vocabulary.json', 'utf8')) as Vocabulary[]
const lessons = JSON.parse(readFileSync('src/data/lessons.json', 'utf8')) as Lesson[]
const grammar = JSON.parse(readFileSync('src/data/grammar.json', 'utf8')) as Grammar[]
const wordById = Object.fromEntries(vocabulary.map((w) => [w.id, w]))
import { createProfile, reviewVocabulary } from '../../src/lib/scheduler'
import { exportBackup } from '../../src/lib/backup'
import { wordExercise, grammarExercise } from '../../src/lib/exercises'
async function appReady(page: Page) {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Nǐ Hǎo', exact: true })).toBeVisible()
}
async function route(page: Page, hash: string) {
  await page.evaluate((h) => {
    window.location.hash = h
  }, `/${hash}`)
}
async function savedSetting(page: Page, key: string, value: number) {
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          new Promise<unknown>((resolve, reject) => {
            const request = indexedDB.open('hsk-level-one-learning')
            request.onerror = () => reject(request.error)
            request.onsuccess = () => {
              const db = request.result
              const read = db.transaction('profile').objectStore('profile').get('active')
              read.onsuccess = () => {
                resolve(read.result?.settings[key])
                db.close()
              }
              read.onerror = () => {
                reject(read.error)
                db.close()
              }
            }
          }),
        key,
      ),
    )
    .toBe(value)
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}
async function fakeLocalVoice(page: Page) {
  await page.addInitScript(() => {
    const voice = {
      voiceURI: 'test-mandarin',
      name: 'Test Mandarin (lokal)',
      lang: 'zh-CN',
      localService: true,
      default: true,
    }
    const speech = {
      getVoices: () => [voice],
      addEventListener: () => {},
      removeEventListener: () => {},
      cancel: () => {},
      resume: () => {},
      speak: (u: { rate: number; onend?: () => void }) => {
        document.body.dataset.lastAudioRate = String(u.rate)
        setTimeout(() => u.onend?.(), 5)
      },
    }
    Object.defineProperty(window, 'speechSynthesis', { value: speech, configurable: true })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: class {
        lang = ''
        rate = 1
        pitch = 1
        voice = null
        onend = null
        onerror = null
        constructor(public text: string) {}
      },
      configurable: true,
    })
  })
}
test('mobile Lektionen, Abruf, Speicherung und Backup', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await appReady(page)
  await noOverflow(page)
  await page.screenshot({ path: `work/screens/today-${test.info().project.name}.png`, fullPage: true })
  await page.getByRole('button', { name: 'Nächste Lektion starten', exact: true }).click()
  await expect(page).toHaveURL(/#\/learn\/l01$/)
  await page.getByRole('button', { name: 'Lektion starten', exact: true }).click()
  const lesson = lessons[0]
  const gs = grammar.filter((g) => g.lessonId === lesson.id)
  for (let i = 0; i < lesson.wordIds.length + gs.length; i++)
    await page
      .getByRole('button', {
        name: i === lesson.wordIds.length + gs.length - 1 ? 'Jetzt aktiv erinnern' : 'Weiter',
        exact: true,
      })
      .click()
  await page.screenshot({ path: `work/screens/exercise-${test.info().project.name}.png`, fullPage: true })
  const exercises = [
    ...lesson.wordIds.map((id) => wordExercise(wordById[id], 'meaning', vocabulary)),
    ...gs.map(grammarExercise),
    ...lesson.wordIds.map((id, i) =>
      wordExercise(wordById[id], i % 2 ? 'context' : 'production', vocabulary),
    ),
  ]
  for (const e of exercises) {
    await expect(page.getByRole('heading', { name: e.prompt, exact: true })).toBeVisible()
    if (e.kind === 'choice')
      await page
        .getByRole('button', { name: new RegExp(e.answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
        .first()
        .click()
    else await page.getByLabel('Deine Antwort auf').fill(e.answer)
    await page.getByRole('button', { name: 'Antwort prüfen', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Richtig erinnert.' })).toBeVisible()
    await page.getByRole('button', { name: 'Gewusst', exact: false }).click()
  }
  await expect(page.getByRole('heading', { name: 'Lerneinheit beendet' })).toBeVisible()
  await page.getByRole('button', { name: 'Zur Übersicht' }).click()
  await route(page, 'today')
  await expect(page.getByText('1 / 49', { exact: false })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Nǐ Hǎo', exact: true })).toBeVisible()
  await route(page, 'settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Lernstand exportieren', exact: true }).click()
  const download = await downloadPromise
  const backupPath = await download.path()
  expect(backupPath).toBeTruthy()
  await page.getByLabel('Sicherung importieren', { exact: true }).setInputFiles(backupPath!)
  await expect(page.getByRole('heading', { name: 'Lernstand ersetzen?' })).toBeVisible()
  await page.getByRole('button', { name: 'Lernstand ersetzen', exact: true }).click()
  await expect(page.getByText('Sicherung wurde vollständig wiederhergestellt.')).toBeVisible()
  await noOverflow(page)
  expect(errors).toEqual([])
})
test('GitHub-Pages-Unterpfad, PWA, Reload und echte Offline-Nutzung', async ({
  page,
  context,
  browserName,
}) => {
  // WebKit's emulated offline flag can reject before service-worker dispatch.
  // Stop a dedicated no-store server instead: the cache is the only remaining source.
  const mime: Record<string, string> = {
    html: 'text/html',
    js: 'text/javascript',
    css: 'text/css',
    webmanifest: 'application/manifest+json',
    png: 'image/png',
    svg: 'image/svg+xml',
    woff2: 'font/woff2',
  }
  const server = createServer(async (req, res) => {
    try {
      const path = (req.url ?? '').split('?')[0].replace(/^\/NiHao\//, '') || 'index.html'
      if (path.includes('..')) throw new Error('bad path')
      const data = await readFile(resolve('dist', path))
      res.writeHead(200, {
        'Content-Type': mime[path.split('.').pop()!] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/NiHao/`
  try {
    await page.goto(origin)
    await expect(page.getByRole('heading', { name: 'Nǐ Hǎo', exact: true })).toBeVisible()
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    const manifest = await page.request.get(new URL('manifest.webmanifest', origin).href)
    expect(manifest.ok()).toBe(true)
    const data = await manifest.json()
    expect(data.scope).toBe('/NiHao/')
    expect(data.start_url).toBe('/NiHao/')
    expect(data.display).toBe('standalone')
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    if (browserName === 'chromium') await context.setOffline(true)
    expect(
      await page.evaluate(async () => {
        try {
          await fetch('/network-check-never-cached')
          return false
        } catch {
          return true
        }
      }),
    ).toBe(true)
    await route(page, 'words')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Wortschatz' })).toBeVisible()
    expect(
      await page.evaluate(async () => {
        const fonts = await Promise.all([
          document.fonts.load('600 24px Manrope', 'Wortschatz'),
          document.fonts.load('400 16px Inter', 'Wörter nǐ hǎo'),
          document.fonts.load('400 20px "Noto Sans SC"', '你是老师吗？'),
          document.fonts.load('400 64px "Ma Shan Zheng"', '你好'),
        ])
        return fonts.every((faces) => faces.length > 0 && faces.every((face) => face.status === 'loaded'))
      }),
    ).toBe(true)
    await page.getByPlaceholder('Wort, Pinyin oder Bedeutung suchen').fill('你好')
    await page.locator('.word-card').click()
    await expect(page.locator('dialog').getByText('nǐ hǎo', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Zur Lektion', exact: true }).click()
    await page.getByRole('button', { name: 'Lektion starten', exact: true }).click()
    await expect(page.getByText('Neue Wörter', { exact: true })).toBeVisible()
    await noOverflow(page)
  } finally {
    if (server.listening) {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }
})
test('Navigation, kleine Breite, Dark Mode und fehlerhafter Import', async ({ page }) => {
  await appReady(page)
  await page.getByRole('button', { name: 'Grammatik', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Grammatik' })).toBeVisible()
  await page.locator('.grammar-card').first().click()
  await expect(page.getByRole('button', { name: 'Jetzt anwenden' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Schließen', exact: true }).click()
  await noOverflow(page)
  page.on('dialog', (d) => d.accept())
  await route(page, 'today')
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click()
  await page
    .getByRole('group', { name: 'Darstellung', exact: true })
    .getByRole('button', { name: 'Dunkel', exact: true })
    .click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByLabel('Sicherung importieren', { exact: true }).setInputFiles({
    name: 'kaputt.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"broken":true}'),
  })
  await expect(page.getByText(/Die Sicherung ist ungültig/)).toBeVisible()
  await page.setViewportSize({ width: 320, height: 740 })
  await noOverflow(page)
  await route(page, 'today')
  await noOverflow(page)
  await page.getByRole('button', { name: 'Meldung schließen' }).click()
  await page.screenshot({ path: `work/screens/mobile-dark-${test.info().project.name}.png`, fullPage: true })
})

test('globales Audiotempo auf Wortschatz, Zeichen, Grammatik, Training und Lektionen', async ({ page }) => {
  await fakeLocalVoice(page)
  await appReady(page)
  page.on('dialog', (d) => d.accept())
  const play = async () => {
    await page.locator('.audio-wrap button').first().click()
    await expect(page.locator('body')).toHaveAttribute('data-last-audio-rate', '0.1')
  }
  await route(page, 'settings')
  await page
    .getByRole('group', { name: 'Sprechtempo', exact: true })
    .getByRole('button', { name: 'Langsam', exact: true })
    .click()
  await savedSetting(page, 'audioRate', 0.1)
  await page.reload()
  await play()
  for (const [routeName, selector] of [
    ['words', '.word-card'],
    ['hanzi', '.hanzi-tile'],
    ['grammar', '.grammar-card'],
  ]) {
    await route(page, routeName)
    await page.locator(selector).first().click()
    await play()
    await page.getByRole('button', { name: 'Schließen', exact: true }).click()
  }
  await route(page, 'training')
  await page.locator('.training-card').first().click()
  await play()
  await route(page, 'today')
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click()
  await route(page, 'learn/l01')
  await page.getByRole('button', { name: 'Lektion starten', exact: true }).click()
  await play()
  await page.getByRole('button', { name: 'Lerneinheit schließen', exact: true }).click()
  await route(page, 'settings')
  await page
    .getByRole('group', { name: 'Sprechtempo', exact: true })
    .getByRole('button', { name: 'Schnell', exact: true })
    .click()
  await page.locator('.audio-wrap button').first().click()
  await expect(page.locator('body')).toHaveAttribute('data-last-audio-rate', '1.2')
  await route(page, 'words')
  await page.locator('.word-card').first().click()
  await page.locator('.audio-wrap button').first().click()
  await expect(page.locator('body')).toHaveAttribute('data-last-audio-rate', '1.2')
  await expect(page.getByRole('button', { name: 'Dieses Wort üben', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Schließen', exact: true }).click()
  await route(page, 'settings')
  const old = new Date(Date.now() - 90 * 86400000)
  let profile = createProfile(old)
  profile = reviewVocabulary(profile, 'v001', 'meaning', 'good', old)
  profile = reviewVocabulary(profile, 'v001', 'pinyin', 'good', new Date(old.getTime() + 60000))
  profile.settings.audioRate = 0.1
  await page.getByLabel('Sicherung importieren', { exact: true }).setInputFiles({
    name: 'learning.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exportBackup(profile)),
  })
  await page.getByRole('button', { name: 'Lernstand ersetzen', exact: true }).click()
  await route(page, 'review')
  await page.getByRole('button', { name: 'Bis zu 20 Wörter wiederholen', exact: false }).click()
  await play()
})

test('Startseiten-Kacheln, Kreisfortschritt und Zurücknavigation', async ({ page }) => {
  await appReady(page)
  await expect(page.locator('.home-tile-grid button')).toHaveCount(6)
  await expect(page.locator('.progress-ring')).toHaveCount(2)
  await expect(page.getByRole('heading', { name: 'Heute', exact: true })).toBeVisible()
  for (const title of ['Wortschatz', 'Zeichen', 'Grammatik', 'Training', 'Wiederholen', 'Einstellungen']) {
    await page.getByRole('button', { name: title, exact: true }).click()
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Nǐ Hǎo', exact: true }).click()
  }
  await page.setViewportSize({ width: 320, height: 740 })
  await noOverflow(page)
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click()
  await noOverflow(page)
})

test('Nachschlagen, Karten-Navigation und Layout auf allen Seiten', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await appReady(page)
  await page.getByRole('button', { name: 'Bekannte Wörter öffnen', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Wortschatz', exact: true })).toBeVisible()
  await route(page, 'today')
  await page.getByRole('button', { name: 'Lektionen öffnen', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Lektionen', exact: true })).toBeVisible()
  await expect(page.locator('.lesson-row.recommended')).not.toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  )
  await route(page, 'grammar')
  const ordered = [...grammar].sort((a, b) => Number(a.lessonId.slice(1)) - Number(b.lessonId.slice(1)))
  await expect(page.locator('.grammar-card h3').first()).toHaveText(ordered[0].title)
  for (const [name, selector] of [
    ['hanzi', '.hanzi-tile'],
    ['grammar', '.grammar-card'],
  ]) {
    await route(page, name)
    await page.locator(selector).first().click()
    await expect(page.getByRole('dialog').getByRole('button', { name: /üben|anwenden/ })).toHaveCount(0)
    await expect(page.getByRole('dialog')).not.toContainText('Lehrplan:')
    await noOverflow(page)
    await page.getByRole('button', { name: 'Schließen', exact: true }).click()
  }
  for (const theme of ['Hell', 'Dunkel']) {
    await route(page, 'settings')
    await page
      .getByRole('group', { name: 'Darstellung', exact: true })
      .getByRole('button', { name: theme, exact: true })
      .click()
    for (const width of [390, 320, 1280]) {
      await page.setViewportSize({ width, height: 844 })
      for (const name of ['today', 'learn', 'review', 'words', 'hanzi', 'grammar', 'training', 'settings']) {
        await route(page, name)
        await expect(page.locator('main h1').first()).toBeVisible()
        await page.evaluate(() => document.fonts.ready)
        await expect(page.locator('main h1').first()).toHaveCSS(
          'font-family',
          name === 'today' ? /Ma Shan Zheng/ : /Manrope/,
        )
        await expect(page.locator('body')).toHaveCSS('font-family', /Inter/)
        await noOverflow(page)
      }
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await route(page, 'today')
    await page.screenshot({
      path: `work/screens/revised-today-${theme}-${test.info().project.name}.png`,
      fullPage: true,
    })
  }
  expect(errors).toEqual([])
})

test('Pinyin-Tasten, automatische Prüfung, Bewertung und direktes Verlassen', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', async (d) => {
    errors.push(`Unerwarteter Dialog: ${d.message()}`)
    await d.dismiss()
  })
  await appReady(page)
  await route(page, 'training')
  await page.getByRole('button', { name: /Pinyin & Aussprache/ }).click()
  await page.setViewportSize({ width: 320, height: 740 })
  await expect(page.locator('.pinyin-group')).toHaveCount(6)
  await noOverflow(page)
  const input = page.getByLabel('Pinyin mit Tonzeichen oder Tonziffern')
  await input.fill('ni')
  await input.selectText()
  await page.getByRole('button', { name: 'ǖ: Ton 1', exact: true }).click()
  await expect(input).toHaveValue('ǖ')
  const prompt = await page.locator('.exercise-zh').innerText()
  const word = vocabulary.find((w) => w.hanzi === prompt)!
  await input.fill(word.pinyin)
  await page.getByRole('button', { name: 'Antwort prüfen', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Richtig erinnert.' })).toBeVisible()
  await noOverflow(page)
  const known = await page.getByRole('button', { name: 'Gewusst', exact: true }).boundingBox()
  const hard = await page.getByRole('button', { name: 'Mit Mühe', exact: true }).boundingBox()
  const easy = await page.getByRole('button', { name: 'Leicht', exact: true }).boundingBox()
  expect(known!.x).toBeGreaterThan(hard!.x)
  expect(known!.height).toBe(104)
  expect(easy!.y).toBeGreaterThan(hard!.y)
  await page.screenshot({
    path: `work/screens/revised-ratings-${test.info().project.name}.png`,
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Gewusst', exact: true }).click()
  await page.getByRole('button', { name: 'Lerneinheit verlassen', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible()
  await route(page, 'words')
  await expect(page.locator('.word-known')).toHaveCount(0)
  await route(page, 'learn/l01')
  await page.getByRole('button', { name: 'Lektion starten', exact: true }).click()
  for (let i = 0; i < lessons[0].wordIds.length + grammar.filter((g) => g.lessonId === 'l01').length; i++)
    await page
      .getByRole('button', {
        name:
          i === lessons[0].wordIds.length + grammar.filter((g) => g.lessonId === 'l01').length - 1
            ? 'Jetzt aktiv erinnern'
            : 'Weiter',
        exact: true,
      })
      .click()
  await page.getByLabel('Deine Antwort auf Deutsch').fill('falsche Antwort')
  await page.getByRole('button', { name: 'Antwort prüfen', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Meine Antwort stimmt sinngemäß' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Hier ist die Lösung.' })).toBeVisible()
  expect(errors).toEqual([])
})

test('einheitliche Kartenbreite und Abstand nach dem Lektionen-Fortschritt', async ({ page }) => {
  await appReady(page)
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await route(page, 'learn')
    const summary = page.locator('.path-summary')
    await expect(summary).toBeVisible()
    const summaryBox = (await summary.boundingBox())!
    const listBox = (await page.locator('.lesson-list').boundingBox())!
    expect(Math.abs(listBox.y - summaryBox.y - summaryBox.height - 24)).toBeLessThan(1)
    await route(page, 'settings')
    const cards = page.locator('.settings-section')
    await expect(cards.first()).toBeVisible()
    for (const card of await cards.all()) {
      expect(Math.abs((await card.boundingBox())!.width - summaryBox.width)).toBeLessThan(1)
    }
  }
})

test('Bekannt-Filter, Zeichen-Detail und Hero-Höhe', async ({ page }) => {
  await appReady(page)
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    const info = await page.locator('.focus-body').boundingBox()
    const action = await page.locator('.focus-footer .button').boundingBox()
    expect(Math.abs(info!.height - action!.height)).toBeLessThan(1)
    await noOverflow(page)
  }
  for (const card of await page.locator('.progress-card').all()) {
    await card.hover()
    const colors = await card.evaluate((el) => ({
      track: getComputedStyle(el.querySelector('.ring-track')!).stroke,
      background: getComputedStyle(el).backgroundColor,
    }))
    expect(colors.track).not.toBe(colors.background)
  }
  await page.getByRole('button', { name: 'Bekannte Wörter öffnen', exact: true }).click()
  await page.getByRole('button', { name: 'Bekannt', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Keine Wörter gefunden.', exact: true })).toBeVisible()
  await route(page, 'hanzi')
  await page.locator('.hanzi-tile').first().click()
  await expect(page.locator('.lookup-heading h3')).toHaveCount(0)
  await expect(page.getByText('In diesen Wörtern', { exact: true })).toBeVisible()
})
