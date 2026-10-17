/// <reference types="jest" />
import {fitsInTextMessage, sharedTextFileName, textMessageMaxBytes, writeSharedTextFile} from './shared-text-file'

type MockEntry = {kind: 'dir' | 'file'; uri: string; content?: string}
const mockWritten = new Array<MockEntry>()
const mockDeleted = new Array<string>()
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
  }
  class File {
    uri: string
    constructor(...parts: Array<unknown>) {
      this.uri = join(parts)
    }
    async write(content: string) {
      await Promise.resolve()
      mockWritten.push({content, kind: 'file', uri: this.uri})
    }
  }
  return {Directory, File, Paths: {cache: new Directory('file:///data/cache')}}
})

beforeEach(() => {
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
  ['   ', 'shared-text.txt'],
  ['...', 'shared-text.txt'],
  ['', 'shared-text.txt'],
  ['one two three four five six. seven', 'one two three four five six.txt'],
  ['.hidden file', 'hidden file.txt'],
  ['a\u0000b\u0085c', 'a_b_c.txt'],
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
