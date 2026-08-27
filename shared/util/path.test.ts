/// <reference types="jest" />
import {
  basename,
  dirname,
  extname,
  isPathSaltpack,
  isPathSaltpackEncrypted,
  isPathSaltpackSigned,
  join,
} from './path'

describe('join', () => {
  test('joins segments with a single separator', () => {
    expect(join('a', 'b', 'c')).toBe('a/b/c')
    expect(join('/tmp', 'file.txt')).toBe('/tmp/file.txt')
  })

  test('collapses runs of separators created by the join', () => {
    expect(join('a/', '/b')).toBe('a/b')
    expect(join('/tmp//', '//x')).toBe('/tmp/x')
  })

  test('an empty segment does not leave a doubled separator', () => {
    expect(join('a', '', 'b')).toBe('a/b')
  })

  test('collapses a leading double separator too', () => {
    expect(join('//server', 'share')).toBe('/server/share')
  })
})

describe('extname', () => {
  test('returns the extension including the dot', () => {
    expect(extname('/tmp/photo.png')).toBe('.png')
    expect(extname('photo.tar.gz')).toBe('.gz')
  })

  test('returns an empty string when there is no dot in the last segment', () => {
    expect(extname('/tmp/photo')).toBe('')
    expect(extname('')).toBe('')
  })

  test('ignores dots in parent directories', () => {
    expect(extname('/tmp/v1.2/README')).toBe('')
  })

  test('treats a dotfile as all extension', () => {
    expect(extname('/home/testuser/.bashrc')).toBe('.bashrc')
  })

  test('keeps a trailing dot', () => {
    expect(extname('/tmp/weird.')).toBe('.')
  })
})

describe('basename', () => {
  test('strips a matching extension', () => {
    expect(basename('/tmp/photo.png', '.png')).toBe('photo')
  })

  test('leaves the name alone when the extension does not match', () => {
    expect(basename('/tmp/photo.png', '.jpg')).toBe('photo.png')
  })

  test('works on a bare name', () => {
    expect(basename('photo.png', '.png')).toBe('photo')
  })

  test('an empty extension is a no-op', () => {
    expect(basename('/tmp/photo.png', '')).toBe('photo.png')
  })

  test('a trailing separator yields an empty last segment', () => {
    expect(basename('/tmp/dir/', '.png')).toBe('')
  })
})

describe('dirname', () => {
  test('drops the last segment', () => {
    expect(dirname('/tmp/sub/photo.png')).toBe('/tmp/sub')
    expect(dirname('/tmp/photo.png')).toBe('/tmp')
  })

  test('returns an empty string for a bare name', () => {
    expect(dirname('photo.png')).toBe('')
  })

  test('a root-level file has an empty dirname', () => {
    expect(dirname('/photo.png')).toBe('')
  })
})

describe('saltpack predicates', () => {
  test('recognizes encrypted and signed saltpack files', () => {
    expect(isPathSaltpackEncrypted('/tmp/a.encrypted.saltpack')).toBe(true)
    expect(isPathSaltpackSigned('/tmp/a.signed.saltpack')).toBe(true)
    expect(isPathSaltpack('/tmp/a.encrypted.saltpack')).toBe(true)
    expect(isPathSaltpack('/tmp/a.signed.saltpack')).toBe(true)
  })

  test('a bare .saltpack file is neither', () => {
    expect(isPathSaltpackEncrypted('/tmp/a.saltpack')).toBe(false)
    expect(isPathSaltpackSigned('/tmp/a.saltpack')).toBe(false)
    expect(isPathSaltpack('/tmp/a.saltpack')).toBe(false)
  })

  test('the suffix has to be at the end', () => {
    expect(isPathSaltpack('/tmp/a.encrypted.saltpack.txt')).toBe(false)
  })
})
