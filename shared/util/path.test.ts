/// <reference types="jest" />
import type * as PathModuleTypes from './path'
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

  test('a root-level file has the root as its dirname', () => {
    expect(dirname('/photo.png')).toBe('/')
    expect(dirname('/')).toBe('/')
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

// pathSep is read at module load, so the windows branch only runs against a
// freshly required copy of the module with a mocked platform
describe('on windows', () => {
  type PathModule = typeof PathModuleTypes
  let winPath: PathModule

  beforeAll(() => {
    jest.resetModules()
    jest.doMock('@/constants/platform', () => ({pathSep: '\\'}))
    winPath = require('./path') as PathModule
  })

  afterAll(() => {
    jest.dontMock('@/constants/platform')
    jest.resetModules()
  })

  test('joins and collapses backslashes', () => {
    expect(winPath.join('C:', 'tmp', 'file.txt')).toBe('C:\\tmp\\file.txt')
    expect(winPath.join('C:\\tmp\\', '\\file.txt')).toBe('C:\\tmp\\file.txt')
    expect(winPath.join('a', '', 'b')).toBe('a\\b')
  })

  test('leaves regex metacharacters in the segments alone', () => {
    expect(winPath.join('a+', '+b')).toBe('a+\\+b')
    expect(winPath.join('a++b', 'c')).toBe('a++b\\c')
  })

  test('splits the other path helpers on backslashes', () => {
    expect(winPath.dirname('C:\\tmp\\photo.png')).toBe('C:\\tmp')
    expect(winPath.dirname('\\photo.png')).toBe('\\')
    expect(winPath.extname('C:\\v1.2\\README')).toBe('')
    expect(winPath.basename('C:\\tmp\\photo.png', '.png')).toBe('photo')
  })
})
