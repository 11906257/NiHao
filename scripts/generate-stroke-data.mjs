import { readFile, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'

const lessons = JSON.parse(await readFile('src/data/lessons.json', 'utf8'))
const vocabulary = JSON.parse(await readFile('src/data/vocabulary.json', 'utf8'))
const eligibleIds = new Set(lessons.flatMap((lesson) => lesson.wordIds))
const characters = new Set(
  vocabulary.filter((word) => eligibleIds.has(word.id)).flatMap((word) => [...word.hanzi]),
)
const data = Object.fromEntries(
  await Promise.all(
    [...characters]
      .sort()
      .map(async (character) => [
        character,
        JSON.parse(await readFile(path.join('node_modules/hanzi-writer-data', `${character}.json`), 'utf8')),
      ]),
  ),
)
await writeFile('src/data/stroke-order.json', `${JSON.stringify(data)}\n`)
await copyFile('node_modules/hanzi-writer-data/ARPHICPL.TXT', 'src/data/ARPHICPL.TXT')
console.log(`Strichfolgen für ${characters.size} Curriculum-Zeichen gebündelt.`)
