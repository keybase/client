// The files and texts flows attach, drop and paste. The files are made by make-corpus.mts and
// checked in; rerun it after changing it. Paths resolve from shared/, where every runner starts.
import {randomBytes} from 'crypto'
import * as fs from 'fs'
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

const bigFileBytes = 50 * 1024 * 1024

// A 50MB file of random bytes (nothing a transfer could compress away) for upload-size flows, made
// once per run under /tmp/kb-e2e and never checked in.
export const bigFile = async (runId: string): Promise<string> => {
  if (!/^[0-9a-z]+$/.test(runId)) throw new Error(`bigFile: not a run id: ${runId}`)
  const file = `/tmp/kb-e2e/big-${runId}.bin`
  const st = fs.statSync(file, {throwIfNoEntry: false})
  if (st?.size === bigFileBytes) return file
  await fs.promises.mkdir(path.dirname(file), {recursive: true})
  const tmp = `${file}.tmp-${process.pid}`
  const fh = await fs.promises.open(tmp, 'w')
  try {
    const chunkBytes = 1024 * 1024
    for (let n = 0; n < bigFileBytes; n += chunkBytes) await fh.write(randomBytes(chunkBytes))
  } finally {
    await fh.close()
  }
  await fs.promises.rename(tmp, file)
  return file
}
