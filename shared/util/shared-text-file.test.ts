/// <reference types="jest" />
import {
  fitsInTextMessage,
  purgeStaleSharedTextFiles,
  sharedTextFileName,
  sharedTextFitsAfter,
  sharedTextForBatch,
  textMessageMaxBytes,
  writeSharedTextFile,
} from './shared-text-file'
import logger from '@/logger'

type MockEntry = {kind: 'dir' | 'file'; uri: string; content?: string}
const mockWritten = new Array<MockEntry>()
const mockDeleted = new Array<string>()
let mockWriteFails = false
// the folders already in <cache>/shared-text, by name
let mockListing: Array<string> | undefined
jest.mock('expo-file-system', () => {
  const join = (parts: Array<unknown>) =>
    parts
      .map((p, i) => {
        const s = typeof p === 'string' ? p : (p as {uri: string}).uri
        return i === 0 ? s.replace(/\/$/, '') : encodeURIComponent(s)
      })
      .join('/')
  class Directory {
    uri: string
    constructor(...parts: Array<unknown>) {
      this.uri = join(parts) + '/'
    }
    create() {
      mockWritten.push({kind: 'dir', uri: this.uri})
    }
    delete() {
      mockDeleted.push(this.uri)
    }
    get name() {
      return decodeURIComponent(this.uri.replace(/\/$/, '').split('/').pop() ?? '')
    }
    get exists() {
      return mockListing !== undefined
    }
    list() {
      return (mockListing ?? []).map(n => new Directory(this, n))
    }
  }
  class File {
    uri: string
    constructor(...parts: Array<unknown>) {
      this.uri = join(parts)
    }
    async write(content: string) {
      await Promise.resolve()
      if (mockWriteFails) throw new Error('disk full')
      mockWritten.push({content, kind: 'file', uri: this.uri})
    }
  }
  return {Directory, File, Paths: {cache: new Directory('file:///data/cache')}}
})

beforeEach(() => {
  mockListing = undefined
  mockWriteFails = false
  mockWritten.length = 0
  mockDeleted.length = 0
})

test.each([
  ['Hello there, this is the long text I shared', 'Hello there, this is the long.txt'],
  ['see example.com now', 'see example.com now.txt'],
  ['  \n\tfirst line\nsecond line', 'first line second line.txt'],
  ['x'.repeat(300), 'x'.repeat(40) + '.txt'],
  ['supercalifragilisticexpialidocious and then some more words', 'supercalifragilisticexpialidocious and.txt'],
  ['a/b: c', 'a_b_ c.txt'],
  ['a\\b', 'a_b.txt'],
  ['   ', 'shared-text.txt'],
  ['...', 'shared-text.txt'],
  ['', 'shared-text.txt'],
  ['one two three four five six. seven', 'one two three four five six.txt'],
  ['.hidden file', 'hidden file.txt'],
  ['a\u0000b\u0085c', 'a_b_c.txt'],
  ['clip\u202emp4.exe', 'clip_mp4.exe.txt'],
  ['a\u202ab\u2066c\u2069d\u200ee\u200ff\u061cg', 'a_b_c_d_e_f_g.txt'],
  ['family \u{1F468}\u200d\u{1F469}\u200d\u{1F467}', 'family \u{1F468}\u200d\u{1F469}\u200d\u{1F467}.txt'],
  ['\u0645\u06cc\u200c\u062e\u0648\u0627\u0647\u0645', '\u0645\u06cc\u200c\u062e\u0648\u0627\u0647\u0645.txt'],
  ['\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F} trip', '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F} trip.txt'],
])('a shared text is named after its first words: %j', (text, name) => {
  expect(sharedTextFileName(text)).toBe(name)
})

test('a long first word keeps its whole characters within the cap', () => {
  const name = sharedTextFileName('😀'.repeat(100))
  expect(name).toBe('😀'.repeat(40) + '.txt')
})

test('a text message fits up to the limit in UTF-8 bytes, as the service measures it', () => {
  expect(fitsInTextMessage('a'.repeat(textMessageMaxBytes))).toBe(true)
  expect(fitsInTextMessage('a'.repeat(textMessageMaxBytes + 1))).toBe(false)
  // 3 bytes each, so a third of the limit in characters is already at it
  expect(fitsInTextMessage('写'.repeat(3333))).toBe(true)
  expect(fitsInTextMessage('写'.repeat(3334))).toBe(false)
  // 4 bytes, 2 UTF-16 units each
  expect(fitsInTextMessage('😀'.repeat(2500))).toBe(true)
  expect(fitsInTextMessage('😀'.repeat(2500) + 'a')).toBe(false)
})

test('the text is written to its own folder in the cache under its name, and removed with it', async () => {
  const text = 'a note: with #hash and spaces'
  const first = await writeSharedTextFile(text)
  const second = await writeSharedTextFile(text)

  expect(first.path).toMatch(/^\/data\/cache\/shared-text\/[^/]+\/a note_ with #hash and spaces\.txt$/)
  expect(second.path).not.toBe(first.path)
  expect(mockWritten.filter(w => w.kind === 'file').map(w => w.content)).toEqual([text, text])

  first.remove()
  expect(mockDeleted).toHaveLength(1)
  expect(first.path.startsWith(decodeURIComponent(mockDeleted[0]!.replace('file://', '')))).toBe(true)
})

test('shared text fits after a draft when both, joined by a newline, are within the limit', () => {
  const draft = 'd'.repeat(100)
  expect(sharedTextFitsAfter(draft, 's'.repeat(textMessageMaxBytes - 101))).toBe(true)
  expect(sharedTextFitsAfter(draft, 's'.repeat(textMessageMaxBytes - 100))).toBe(false)
  // a draft ending in a newline gets no second one
  expect(sharedTextFitsAfter(`${draft}\n`, 's'.repeat(textMessageMaxBytes - 101))).toBe(true)
  expect(sharedTextFitsAfter('', 's'.repeat(textMessageMaxBytes))).toBe(true)
})

test('a batch keeps text that fits as text, and writes text that does not as a .txt', async () => {
  const draft = 'd'.repeat(100)
  expect(await sharedTextForBatch(draft, undefined)).toEqual({text: undefined})
  const fits = 's'.repeat(textMessageMaxBytes - 101)
  expect(await sharedTextForBatch(draft, fits)).toEqual({text: fits})
  expect(mockWritten).toEqual([])

  const over = 's'.repeat(textMessageMaxBytes - 100)
  const batched = await sharedTextForBatch(draft, over)
  expect(batched.text).toBeUndefined()
  expect(batched.path).toMatch(/^\/data\/cache\/shared-text\/[^/]+\/s+\.txt$/)
  expect(mockWritten.filter(w => w.kind === 'file').map(w => w.content)).toEqual([over])
})

test('a batch keeps text it cannot write as text, for the composer', async () => {
  jest.spyOn(logger, 'warn').mockImplementation(() => {})
  mockWriteFails = true
  const over = 's'.repeat(textMessageMaxBytes + 1)
  expect(await sharedTextForBatch('', over)).toEqual({text: over})
})

describe('purging old shared text', () => {
  const now = 1_800_000_000_000
  const hour = 60 * 60 * 1000

  test('removes folders more than a day old, and keeps newer ones, whose uploads may not have read them', () => {
    mockListing = [`${now - 25 * hour}-abc-1`, `${now - 23 * hour}-abc-2`, `${now}-abc-3`]
    purgeStaleSharedTextFiles(now)
    expect(mockDeleted).toEqual([`file:///data/cache/shared-text/${now - 25 * hour}-abc-1/`])
  })

  test('a folder whose name carries no time is removed', () => {
    mockListing = ['stray']
    purgeStaleSharedTextFiles(now)
    expect(mockDeleted).toEqual(['file:///data/cache/shared-text/stray/'])
  })

  test('with no folder yet there is nothing to do', () => {
    purgeStaleSharedTextFiles(now)
    expect(mockDeleted).toEqual([])
  })

  test('a written file lives in a folder named for when it was made', async () => {
    const before = Date.now()
    const {path} = await writeSharedTextFile('hello')
    const made = Number(path.split('/')[4]?.split('-')[0])
    expect(made).toBeGreaterThanOrEqual(before)
    expect(made).toBeLessThanOrEqual(Date.now())
  })
})
