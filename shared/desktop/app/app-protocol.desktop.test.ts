import path from 'path'
import {localFilePathFromURL, resolveAppFilePath} from './app-protocol.desktop'

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
  it('reads posix paths', () => {
    expect(localFilePathFromURL('kbfile://local/tmp/my%20clip.mp4')).toBe('/tmp/my clip.mp4')
    expect(localFilePathFromURL('kbfile://local/tmp/a%23b.png')).toBe('/tmp/a#b.png')
  })

  it('drops the leading slash before a windows drive', () => {
    expect(localFilePathFromURL('kbfile://local/C:/Users/testuser/clip.mp4')).toBe('C:/Users/testuser/clip.mp4')
  })

  it('rejects other hosts, schemes and malformed escapes', () => {
    expect(localFilePathFromURL('kbfile://other/tmp/a.png')).toBeUndefined()
    expect(localFilePathFromURL('kbapp://local/tmp/a.png')).toBeUndefined()
    expect(localFilePathFromURL('kbfile://local/tmp/50%.png')).toBeUndefined()
  })
})
