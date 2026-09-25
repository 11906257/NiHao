export interface Example {
  id: string
  zh: string
  pinyin: string
  de: string
}
export interface Vocabulary {
  id: string
  sourceIndex: number
  hanzi: string
  pinyin: string
  meaning: string
  accepted?: string[]
  examples?: Array<Pick<Example, 'zh' | 'pinyin' | 'de'>>
  note?: string
  lessonId: string
  example: Example
}
export interface Lesson {
  id: string
  title: string
  description: string
  wordIds: string[]
  grammarIds: string[]
  topicIds: string[]
}
export interface Grammar {
  id: string
  sourceLabel: string
  title: string
  explanation: string
  pattern: string
  example: Example
  exercise: { id: string; prompt: string; answer: string; options: string[]; explanation: string }
  lessonId: string
}
export interface Hanzi {
  id: string
  char: string
  pinyin: string
  meaning: string
  wordIds: string[]
}
