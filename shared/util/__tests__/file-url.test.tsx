import {localFileScheme, normalizeFilePathURL} from '../file-url'

describe('normalizeFilePathURL', () => {
  afterEach(() => {
    global.__HOT__ = false
  })

  describe('packaged (file:// urls)', () => {
    it('encodes an absolute posix path', () => {
      expect(normalizeFilePathURL('/tmp/my clip.mp4')).toBe('file:///tmp/my%20clip.mp4')
      expect(normalizeFilePathURL('/tmp/a#b.png')).toBe('file:///tmp/a%23b.png')
    })

    it('makes a windows path absolute', () => {
      expect(normalizeFilePathURL('C:\\Users\\me\\clip.mp4')).toBe('file:///C:/Users/me/clip.mp4')
    })

    it('encodes a file:// url that needs it and leaves a clean one alone', () => {
      expect(normalizeFilePathURL('file:///tmp/my clip.mp4')).toBe('file:///tmp/my%20clip.mp4')
      expect(normalizeFilePathURL('file:///tmp/clip.mp4')).toBe('file:///tmp/clip.mp4')
    })

    it('passes through anything that is not a local path', () => {
      expect(normalizeFilePathURL('https://keybase.io/a.png')).toBe('https://keybase.io/a.png')
      expect(normalizeFilePathURL('relative/a.png')).toBe('relative/a.png')
    })
  })

  describe('hot dev (custom scheme)', () => {
    beforeEach(() => {
      global.__HOT__ = true
    })

    it('rewrites an absolute path onto the local file scheme', () => {
      expect(normalizeFilePathURL('/tmp/my clip.mp4')).toBe(`${localFileScheme}://local/tmp/my%20clip.mp4`)
    })

    it('keeps the path separators as separators', () => {
      expect(normalizeFilePathURL('/tmp/sub dir/a.png')).toBe(`${localFileScheme}://local/tmp/sub%20dir/a.png`)
    })

    it('rewrites a file:// url without double-encoding what was already encoded', () => {
      // decodeURI would leave the reserved %23 alone and re-encode it to %2523
      expect(normalizeFilePathURL('file:///tmp/a%23b.png')).toBe(`${localFileScheme}://local/tmp/a%23b.png`)
      expect(normalizeFilePathURL('file:///tmp/my%20clip.mp4')).toBe(
        `${localFileScheme}://local/tmp/my%20clip.mp4`
      )
    })

    it('survives a filename holding a literal percent', () => {
      // both decoders throw on a malformed escape, so the raw segment has to win
      expect(normalizeFilePathURL('file:///tmp/50%.png')).toBe(`${localFileScheme}://local/tmp/50%25.png`)
    })

    it('still passes through a remote url', () => {
      expect(normalizeFilePathURL('https://keybase.io/a.png')).toBe('https://keybase.io/a.png')
    })
  })
})
