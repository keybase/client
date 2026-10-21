import path from 'path'
import {
  localFilePathFromURL,
  mimeTypeForPath,
  parseByteRange,
  requestedRange,
  resolveAppFilePath,
} from './app-protocol.desktop'

describe('resolveAppFilePath', () => {
  describe('posix', () => {
    const root = '/Applications/Keybase.app/Contents/Resources/app.asar'
    const resolve = (url: string) => resolveAppFilePath(root, url, path.posix)

    it('maps a page or asset to its file under the root', () => {
      expect(resolve('kbapp://app/desktop/dist/desktop/renderer/main.html')).toBe(
        `${root}/desktop/dist/desktop/renderer/main.html`
      )
      expect(resolve('kbapp://app/images/icons/icon-file-24.png')).toBe(`${root}/images/icons/icon-file-24.png`)
    })

    it('decodes escapes', () => {
      expect(resolve('kbapp://app/images/a%20b.png')).toBe(`${root}/images/a b.png`)
    })

    it('ignores query and hash', () => {
      expect(resolve('kbapp://app/desktop/dist/desktop/remote/remote.html?component=menubar#x')).toBe(
        `${root}/desktop/dist/desktop/remote/remote.html`
      )
    })

    it('keeps url dot segments inside the root', () => {
      expect(resolve('kbapp://app/../secret')).toBe(`${root}/secret`)
      expect(resolve('kbapp://app/%2e%2e/secret')).toBe(`${root}/secret`)
      expect(resolve('kbapp://app/%2Fetc%2Fpasswd')).toBe(`${root}/etc/passwd`)
    })

    it('rejects escaped separators that leave the root', () => {
      expect(resolve('kbapp://app/..%2Fsecret')).toBeUndefined()
      expect(resolve('kbapp://app/images/..%2F..%2F..%2Fetc/passwd')).toBeUndefined()
      expect(resolve('kbapp://app/x/..%2F..')).toBeUndefined()
    })

    it('rejects a sibling whose name starts with the root', () => {
      expect(resolveAppFilePath('/opt/keybase/app', 'kbapp://app/..%2Fapp2/x', path.posix)).toBeUndefined()
    })

    it('keeps names that merely start with dots', () => {
      expect(resolve('kbapp://app/images/..hidden.png')).toBe(`${root}/images/..hidden.png`)
    })

    it('rejects the root itself', () => {
      expect(resolve('kbapp://app/')).toBeUndefined()
      expect(resolve('kbapp://app')).toBeUndefined()
    })

    it('rejects other hosts and schemes', () => {
      expect(resolve('kbapp://other/images/a.png')).toBeUndefined()
      expect(resolve('kbfile://app/images/a.png')).toBeUndefined()
      expect(resolve('file:///etc/passwd')).toBeUndefined()
    })

    it('rejects malformed escapes and nul bytes', () => {
      expect(resolve('kbapp://app/images/50%.png')).toBeUndefined()
      expect(resolve('kbapp://app/images/a%00.png')).toBeUndefined()
      expect(resolve('not a url')).toBeUndefined()
    })
  })

  describe('windows', () => {
    const root = 'C:\\Users\\testuser\\AppData\\Local\\Keybase\\Gui\\resources\\app.asar'
    const resolve = (url: string) => resolveAppFilePath(root, url, path.win32)

    it('maps a page to its file under the root', () => {
      expect(resolve('kbapp://app/desktop/dist/desktop/renderer/main.html')).toBe(
        `${root}\\desktop\\dist\\desktop\\renderer\\main.html`
      )
    })

    it('rejects backslash and drive escapes out of the root', () => {
      expect(resolve('kbapp://app/..%5C..%5Csecret')).toBeUndefined()
      expect(resolve('kbapp://app/images%5C..%5C..%5C..%5Csecret')).toBeUndefined()
      expect(resolve('kbapp://app/D:/secret')).toBeUndefined()
      expect(resolve('kbapp://app/C:/Windows/win.ini')).toBeUndefined()
    })

    it('keeps a leading escaped separator inside the root', () => {
      expect(resolve('kbapp://app/%5C%5Cserver%5Cshare%5Cx')).toBe(`${root}\\server\\share\\x`)
    })
  })
})

describe('localFilePathFromURL', () => {
  const host = 'k0123456789abcdef0123456789abcdef.kfedcba9876543210fedcba9876543210'
  const posix = (url: string) => localFilePathFromURL(url, host, 'darwin')
  const win = (url: string) => localFilePathFromURL(url, host, 'win32')

  it('reads posix paths', () => {
    expect(posix(`kbfile://${host}/tmp/my%20clip.mp4`)).toBe('/tmp/my clip.mp4')
    expect(posix(`kbfile://${host}/tmp/a%23b.png`)).toBe('/tmp/a#b.png')
  })

  it('serves only URLs carrying this launch\'s host', () => {
    expect(posix('kbfile://local/tmp/a.png')).toBeUndefined()
    expect(posix(`kbfile://${host.slice(0, -1)}1/tmp/a.png`)).toBeUndefined()
    expect(posix(`kbfile://${host}x/tmp/a.png`)).toBeUndefined()
    expect(posix(`kbfile://${host}:1/tmp/a.png`)).toBeUndefined()
    expect(posix('kbfile:///tmp/a.png')).toBeUndefined()
  })

  it('rejects other schemes and malformed escapes', () => {
    expect(posix(`kbapp://${host}/tmp/a.png`)).toBeUndefined()
    expect(posix(`kbfile://${host}/tmp/50%.png`)).toBeUndefined()
    expect(posix(`kbfile://${host}/tmp/a%00.png`)).toBeUndefined()
  })

  it('reads drive-absolute windows paths', () => {
    expect(win(`kbfile://${host}/C:/Users/testuser/clip.mp4`)).toBe('C:\\Users\\testuser\\clip.mp4')
    expect(win(`kbfile://${host}/d:/a%20b/c.png`)).toBe('d:\\a b\\c.png')
  })

  it('rejects windows shares, device paths, streams, devices and relative paths', () => {
    for (const p of [
      '//server/share/x.png',
      '/%5C%5Cserver%5Cshare%5Cx.png',
      '/%5C%5C%3F%5CC:%5Cx.png',
      '/%5C%5C.%5CC:%5Cx.png',
      '/%5C%5C.%5CPhysicalDrive0',
      '/C:/x.png:stream',
      '/C:/folder/CON',
      '/C:/folder/nul.txt',
      '/C:/folder/com1.png',
      '/C:/folder/LPT9. ',
      '/C:/folder/CON .txt',
      '/C:/folder/NUL  .png',
      '/C:/folder/aux. .x',
      '/C:/folder/com1 . .tar.gz',
      '/C:x.png',
      '/C:',
      '/x.png',
      '/Users/testuser/x.png',
    ]) {
      expect(win(`kbfile://${host}${p}`)).toBeUndefined()
    }
  })

  it('keeps a windows path inside its drive', () => {
    expect(win(`kbfile://${host}/C:/a%5C..%5C..%5C..%5Cx.png`)).toBe('C:\\x.png')
    expect(win(`kbfile://${host}/C:/console.png`)).toBe('C:\\console.png')
    expect(win(`kbfile://${host}/C:/my con.txt`)).toBe('C:\\my con.txt')
    expect(win(`kbfile://${host}/C:/.nul`)).toBe('C:\\.nul')
  })
})

describe('parseByteRange', () => {
  it('reads open, closed and suffix ranges', () => {
    expect(parseByteRange('bytes=0-', 1000)).toEqual({end: 999, start: 0})
    expect(parseByteRange('bytes=100-199', 1000)).toEqual({end: 199, start: 100})
    expect(parseByteRange('bytes=900-5000', 1000)).toEqual({end: 999, start: 900})
    expect(parseByteRange('bytes=-100', 1000)).toEqual({end: 999, start: 900})
    expect(parseByteRange('bytes=-5000', 1000)).toEqual({end: 999, start: 0})
  })

  it('serves the whole file for no, malformed or multiple ranges', () => {
    expect(parseByteRange(null, 1000)).toBeUndefined()
    expect(parseByteRange('bytes=-', 1000)).toBeUndefined()
    expect(parseByteRange('bytes=5-2', 1000)).toBeUndefined()
    expect(parseByteRange('bytes=0-1,5-6', 1000)).toBeUndefined()
    expect(parseByteRange('items=0-1', 1000)).toBeUndefined()
  })

  it('rejects ranges past the end', () => {
    expect(parseByteRange('bytes=1000-', 1000)).toBe('unsatisfiable')
    expect(parseByteRange('bytes=0-', 0)).toBe('unsatisfiable')
  })
})

describe('requestedRange', () => {
  const lastModified = 'Wed, 21 Oct 2026 07:28:00 GMT'

  it('serves the range when there is no If-Range or it matches', () => {
    expect(requestedRange('bytes=0-9', null, lastModified, 100)).toEqual({end: 9, start: 0})
    expect(requestedRange('bytes=0-9', lastModified, lastModified, 100)).toEqual({end: 9, start: 0})
    expect(requestedRange('bytes=200-', lastModified, lastModified, 100)).toBe('unsatisfiable')
  })

  it('serves the whole file when If-Range does not match', () => {
    expect(requestedRange('bytes=0-9', 'Tue, 20 Oct 2026 07:28:00 GMT', lastModified, 100)).toBeUndefined()
    expect(requestedRange('bytes=0-9', '"etag"', lastModified, 100)).toBeUndefined()
    expect(requestedRange('bytes=200-', '', lastModified, 100)).toBeUndefined()
  })

  it('serves the whole file without a Range', () => {
    expect(requestedRange(null, lastModified, lastModified, 100)).toBeUndefined()
  })
})

describe('mimeTypeForPath', () => {
  it('types the media the renderer loads', () => {
    expect(mimeTypeForPath('/tmp/a.PNG')).toBe('image/png')
    expect(mimeTypeForPath('/tmp/a.jpeg')).toBe('image/jpeg')
    expect(mimeTypeForPath('/tmp/a.svg')).toBe('image/svg+xml')
    expect(mimeTypeForPath('/tmp/a.b.mp4')).toBe('video/mp4')
    expect(mimeTypeForPath('C:\\Users\\testuser\\clip.mov')).toBe('video/quicktime')
    expect(mimeTypeForPath('/tmp/a.opus')).toBe('audio/opus')
  })

  it('leaves everything else untyped', () => {
    expect(mimeTypeForPath('/tmp/a.html')).toBeUndefined()
    expect(mimeTypeForPath('/tmp/a')).toBeUndefined()
    expect(mimeTypeForPath('/tmp/png')).toBeUndefined()
    expect(mimeTypeForPath('/tmp/a.png/')).toBeUndefined()
    expect(mimeTypeForPath('/tmp/a.constructor')).toBeUndefined()
    expect(mimeTypeForPath('/tmp/a.toString')).toBeUndefined()
  })
})
