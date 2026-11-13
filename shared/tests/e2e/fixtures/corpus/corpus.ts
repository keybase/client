// The files and texts flows attach, drop and paste. The files are made by make-corpus.mts and
// checked in; rerun it after changing it. Paths resolve from shared/, where every runner starts.
// Changing a photo or video means erasing the iOS simulator: its library keeps the old copy beside
// the new (ios-appium gate/device.ts ensurePhotoCorpus adds by content).
import * as path from 'path'

export const CORPUS_DIR = path.resolve('tests/e2e/fixtures/corpus')

export type CorpusKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'zip' | 'binary'

const entry = (name: string, kind: CorpusKind) => ({file: path.join(CORPUS_DIR, name), kind, name})

export const CORPUS: ReadonlyArray<{file: string; kind: CorpusKind; name: string}> = [
  entry('e2e-c.png', 'image'),
  entry('e2e-c.jpg', 'image'),
  entry('e2e-c.heic', 'image'),
  entry('e2e-c.gif', 'image'),
  entry('e2e-c-large.png', 'image'),
  entry('e2e-c.mp4', 'video'),
  entry('e2e-c.mov', 'video'),
  entry('e2e-c.m4a', 'audio'),
  entry('e2e-c.pdf', 'pdf'),
  entry('e2e-c.txt', 'text'),
  entry('e2e-c.zip', 'zip'),
  entry('e2e-c.bin', 'binary'),
  entry('e2e c ünïcode.txt', 'text'),
  entry('e2e-c-empty.txt', 'text'),
]

// The corpus entry named `name`; a name the corpus lacks throws.
export const corpusEntry = (name: string) => {
  const found = CORPUS.find(c => c.name === name)
  if (!found) throw new Error(`the corpus has no ${name}`)
  return found
}

const longText = (() => {
  const unit = 'e2e long message text. '
  return unit.repeat(Math.ceil(4000 / unit.length)).slice(0, 4000)
})()

export const TEXT_CORPUS = {
  codeBlock: '```\nconst e2e = {corpus: true}\nconsole.log(e2e)\n```',
  emoji: 'e2e emoji 🎉👍🏽🧪 :+1:',
  link: 'e2e link https://keybase.io/docs',
  long: longText,
  markdown: 'e2e *bold* _italic_ ~strike~ `code`\n> quoted\n* item one\n* item two',
  rtl: 'e2e rtl שלום עולם مرحبا بالعالم',
} as const
