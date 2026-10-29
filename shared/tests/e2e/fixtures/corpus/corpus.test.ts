import * as fs from 'fs'
import * as path from 'path'
import {CORPUS, CORPUS_DIR, TEXT_CORPUS} from './corpus'

const head = (file: string, n: number) => {
  const fd = fs.openSync(file, 'r')
  try {
    const buf = Buffer.alloc(n)
    const got = fs.readSync(fd, buf, 0, n, 0)
    return buf.subarray(0, got)
  } finally {
    fs.closeSync(fd)
  }
}

// An ISO base media file (mp4, mov, m4a, heic) starts with its `ftyp` box: size, 'ftyp', major brand.
const ftypBrand = (b: Buffer) => (b.subarray(4, 8).toString('latin1') === 'ftyp' ? b.subarray(8, 12).toString('latin1') : undefined)

const magic: Record<string, (b: Buffer, name: string) => boolean> = {
  audio: b => ftypBrand(b) !== undefined,
  binary: b => b.length > 0,
  image: (b, name) => {
    if (name.endsWith('.png')) return b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    if (name.endsWith('.jpg')) return b[0] === 0xff && b[1] === 0xd8
    if (name.endsWith('.heic')) return ['heic', 'mif1'].includes(ftypBrand(b) ?? '')
    if (name.endsWith('.gif')) return b.subarray(0, 6).toString('latin1') === 'GIF89a'
    return false
  },
  pdf: b => b.subarray(0, 4).toString('latin1') === '%PDF',
  text: () => true,
  video: b => ftypBrand(b) !== undefined,
  zip: b => b.subarray(0, 2).toString('latin1') === 'PK',
}

test('every corpus file exists and starts with the bytes of its kind', () => {
  expect(CORPUS.length).toBeGreaterThan(0)
  for (const c of CORPUS) {
    expect({exists: fs.existsSync(c.file), name: c.name}).toEqual({exists: true, name: c.name})
    expect(path.basename(c.file)).toBe(c.name)
    expect({kind: c.kind, matches: magic[c.kind]?.(head(c.file, 16), c.name), name: c.name}).toEqual({kind: c.kind, matches: true, name: c.name})
  }
})

test('the corpus holds each kind the brief names', () => {
  const names = CORPUS.map(c => c.name).sort()
  expect(names).toEqual(
    [
      'e2e c ünïcode.txt',
      'e2e-c-empty.txt',
      'e2e-c-large.png',
      'e2e-c.bin',
      'e2e-c.gif',
      'e2e-c.heic',
      'e2e-c.jpg',
      'e2e-c.m4a',
      'e2e-c.mov',
      'e2e-c.mp4',
      'e2e-c.pdf',
      'e2e-c.png',
      'e2e-c.txt',
      'e2e-c.zip',
    ].sort()
  )
})

test('the empty file is empty', () => {
  const empty = CORPUS.find(c => c.name === 'e2e-c-empty.txt')
  expect(empty && fs.statSync(empty.file).size).toBe(0)
})

test('the large image is 4000x3000 and under 2MB', () => {
  const large = CORPUS.find(c => c.name === 'e2e-c-large.png')
  if (!large) throw new Error('e2e-c-large.png is not in CORPUS')
  const ihdr = head(large.file, 24)
  expect({h: ihdr.readUInt32BE(20), w: ihdr.readUInt32BE(16)}).toEqual({h: 3000, w: 4000})
  expect(fs.statSync(large.file).size).toBeLessThan(2 * 1024 * 1024)
})

test('the checked-in corpus is under 5MB', () => {
  const total = fs.readdirSync(CORPUS_DIR).reduce((n, f) => n + fs.statSync(path.join(CORPUS_DIR, f)).size, 0)
  expect(total).toBeLessThan(5 * 1024 * 1024)
})

test('the text corpus has each sample the flows paste', () => {
  expect(TEXT_CORPUS.long.length).toBe(4000)
  expect(TEXT_CORPUS.link).toContain('https://keybase.io/docs')
  expect(TEXT_CORPUS.codeBlock).toMatch(/^```[\s\S]*```$/)
  expect(TEXT_CORPUS.rtl).toMatch(/[֐-ۿ]/)
  expect(TEXT_CORPUS.emoji).toMatch(/\p{Extended_Pictographic}/u)
  expect(TEXT_CORPUS.markdown).toMatch(/\*[^*]+\*/)
})
