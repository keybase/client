/// <reference types="jest" />
import {
  isBrowserURL,
  isExternalURLAllowed,
  isRemoteKind,
  isRequestAllowed,
  isSamePage,
  isSubframeURLAllowed,
  isUploadTempPath,
  pageKey,
  parseDokanUninstallCommand,
} from './bridge-rules.desktop'

describe('isSamePage', () => {
  const prodMain = 'file:///Applications/Keybase.app/Contents/Resources/app/desktop/dist/desktop/renderer/main.html'
  const winMain = 'file:///C:/Users/testuser/AppData/Local/Keybase/Gui/resources/app/desktop/dist/desktop/renderer/main.html'
  const hotMain = 'http://localhost:4000/desktop/renderer/main.html'
  const same = (url: unknown, page: string) => isSamePage(url, pageKey(page))

  test('matches the same document whatever the query or hash', () => {
    expect(same(prodMain, prodMain)).toBe(true)
    expect(same(`${prodMain}?x=1#/chat`, prodMain)).toBe(true)
    expect(same(`${hotMain}?component=menubar`, hotMain)).toBe(true)
  })

  test('matches Windows paths that differ only in case', () => {
    expect(same(winMain.replace('/Users/', '/users/'), winMain)).toBe(true)
  })

  test('rejects other documents, hosts, ports and schemes', () => {
    expect(same(prodMain.replace('main.html', 'remote.html'), prodMain)).toBe(false)
    expect(same('file:///tmp/desktop/dist/desktop/renderer/main.html', prodMain)).toBe(false)
    expect(same('http://localhost:4001/desktop/renderer/main.html', hotMain)).toBe(false)
    expect(same('http://127.0.0.1:4000/desktop/renderer/main.html', hotMain)).toBe(false)
    expect(same('https://localhost:4000/desktop/renderer/main.html', hotMain)).toBe(false)
  })

  test('a page key that failed to parse matches nothing', () => {
    expect(pageKey('not a url')).toBeUndefined()
    expect(isSamePage('not a url', undefined)).toBe(false)
    expect(isSamePage(undefined, undefined)).toBe(false)
  })

  test('rejects what is not a URL', () => {
    expect(same('', prodMain)).toBe(false)
    expect(same('not a url', prodMain)).toBe(false)
    expect(same(undefined, prodMain)).toBe(false)
  })
})

describe('isRequestAllowed', () => {
  const remoteKinds = ['menubar', 'pinentry', 'tracker', 'unlock-folders'] as const
  const action = (a: string) => ({action: a})
  const channel = (c: string) => ({channel: c})
  const forward = (f: string, payload?: unknown) => ({forward: f, payload})

  test('the main window may make every call', () => {
    for (const c of ['engineSend', 'engineRestartLink', 'engineDropLink', 'KBmenu', 'KBdispatchAction']) {
      expect(isRequestAllowed('main', channel(c))).toBe(true)
    }
    for (const a of ['uninstallDokan', 'makeRenderer', 'openPathInFinder']) {
      expect(isRequestAllowed('main', action(a))).toBe(true)
    }
    for (const f of ['remote:stop', 'remote:dumpLogs', 'common:resetStore', 'remote:link', 'anything']) {
      expect(isRequestAllowed('main', forward(f))).toBe(true)
    }
  })

  test('every remote window may load, read its props, and show and close itself', () => {
    for (const kind of remoteKinds) {
      expect(isRequestAllowed(kind, channel('KBsetupPreloadKB2'))).toBe(true)
      for (const a of ['getRemoteProps', 'showInactive', 'closeWindow']) {
        expect(isRequestAllowed(kind, action(a))).toBe(true)
      }
    }
  })

  test('remote windows get only the extra calls their component makes', () => {
    expect(isRequestAllowed('menubar', action('openURL'))).toBe(true)
    expect(isRequestAllowed('menubar', action('hideWindow'))).toBe(true)
    expect(isRequestAllowed('menubar', action('ctlQuit'))).toBe(true)
    expect(isRequestAllowed('tracker', action('openURL'))).toBe(true)
    expect(isRequestAllowed('tracker', action('ctlQuit'))).toBe(false)
    expect(isRequestAllowed('pinentry', action('openURL'))).toBe(false)
    expect(isRequestAllowed('unlock-folders', action('openURL'))).toBe(false)
  })

  test('channels and actions are separate lists', () => {
    for (const kind of remoteKinds) {
      expect(isRequestAllowed(kind, action('KBdispatchAction'))).toBe(false)
      expect(isRequestAllowed(kind, action('KBsetupPreloadKB2'))).toBe(false)
      expect(isRequestAllowed(kind, channel('getRemoteProps'))).toBe(false)
      expect(isRequestAllowed(kind, channel('closeWindow'))).toBe(false)
    }
    expect(isRequestAllowed('menubar', channel('openURL'))).toBe(false)
  })

  test('remote windows may not use the engine, the tray or the broad bridge calls', () => {
    for (const kind of remoteKinds) {
      for (const c of ['engineSend', 'engineRestartLink', 'engineDropLink', 'KBmenu', 'KBkeybase', 'not-a-channel']) {
        expect(isRequestAllowed(kind, channel(c))).toBe(false)
      }
      for (const a of [
        'uninstallDokan',
        'installCachedDokan',
        'makeRenderer',
        'rendererNewProps',
        'openPathInFinder',
        'darwinCopyToChatTempUploadFile',
        'exitApp',
        'not-an-action',
      ]) {
        expect(isRequestAllowed(kind, action(a))).toBe(false)
      }
    }
  })

  test('each remote window may relay the remote actions its component dispatches', () => {
    const forwards = {
      menubar: [
        'remote:dumpLogs',
        'remote:openChatFromWidget',
        'remote:openFilesFromWidget',
        'remote:openPathInSystemFileManager',
        'remote:showMain',
        'remote:stop',
        'remote:switchTab',
        'remote:updateNow',
      ],
      pinentry: ['remote:pinentryOnCancel', 'remote:pinentryOnSubmit'],
      tracker: [
        'remote:previewConversation',
        'remote:showMain',
        'remote:trackerChangeFollow',
        'remote:trackerCloseTracker',
        'remote:trackerIgnore',
        'remote:trackerLoad',
      ],
      'unlock-folders': ['remote:closeUnlockFolders', 'remote:unlockFoldersSubmitPaperKey'],
    }
    const all = new Set(Object.values(forwards).flat())
    for (const kind of remoteKinds) {
      for (const f of all) {
        const payload = f === 'remote:openPathInSystemFileManager' ? {path: '/keybase'} : undefined
        expect(isRequestAllowed(kind, forward(f, payload))).toBe((forwards[kind] as Array<string>).includes(f))
      }
    }
  })

  test('the menubar may only open the KBFS mount', () => {
    const open = 'remote:openPathInSystemFileManager'
    expect(isRequestAllowed('menubar', forward(open, {path: '/keybase'}))).toBe(true)
    for (const payload of [{path: '/Users/testuser'}, {path: '/keybase/../etc'}, {}, undefined, 'x']) {
      expect(isRequestAllowed('menubar', forward(open, payload))).toBe(false)
    }
    expect(isRequestAllowed('main', forward(open, {path: '/Users/testuser'}))).toBe(true)
  })

  test('remote windows may not relay other remote actions', () => {
    expect(isRequestAllowed('pinentry', forward('remote:stop'))).toBe(false)
    expect(isRequestAllowed('pinentry', forward('remote:dumpLogs'))).toBe(false)
    for (const kind of remoteKinds) {
      for (const f of ['common:resetStore', 'remote:link', 'remote:saltpackFileOpen', 'remote:installerRan', '']) {
        expect(isRequestAllowed(kind, forward(f))).toBe(false)
      }
      expect(isRequestAllowed(kind, channel('KBdispatchAction'))).toBe(false)
      expect(isRequestAllowed(kind, action('remote:showMain'))).toBe(false)
    }
  })

  test('only the known remote components are remote windows', () => {
    expect(isRemoteKind('menubar')).toBe(true)
    expect(isRemoteKind('unlock-folders')).toBe(true)
    expect(isRemoteKind('main')).toBe(false)
    expect(isRemoteKind('toString')).toBe(false)
    expect(isRemoteKind('')).toBe(false)
  })
})

describe('external links', () => {
  test('opens http(s) and mailto links', () => {
    expect(isExternalURLAllowed('https://keybase.io/docs', 'linux')).toBe(true)
    expect(isExternalURLAllowed('http://example.com', 'win32')).toBe(true)
    expect(isExternalURLAllowed('mailto:testuser@example.com', 'darwin')).toBe(true)
  })

  test('opens System Settings links on macOS only', () => {
    const url = 'x-apple.systempreferences:com.apple.preference.security?General'
    expect(isExternalURLAllowed(url, 'darwin')).toBe(true)
    expect(isExternalURLAllowed(url, 'win32')).toBe(false)
    expect(isExternalURLAllowed(url, 'linux')).toBe(false)
  })

  test('opens nothing else', () => {
    for (const url of [
      'file:///etc/passwd',
      'smb://host/share',
      'ms-settings:privacy',
      'keybase://chat/testuser',
      'data:text/html,hi',
      'C:\\Windows\\notepad.exe',
      '/Applications/Calculator.app',
      '',
      undefined,
      42,
    ]) {
      expect(isExternalURLAllowed(url, 'darwin')).toBe(false)
    }
  })

  test('"Open in browser" takes http(s) only', () => {
    expect(isBrowserURL('https://keybase.io')).toBe(true)
    expect(isBrowserURL('HTTP://KEYBASE.IO')).toBe(true)
    expect(isBrowserURL('mailto:testuser@example.com')).toBe(false)
    expect(isBrowserURL('file:///tmp')).toBe(false)
    expect(isBrowserURL('nope')).toBe(false)
  })
})

describe('isSubframeURLAllowed', () => {
  test('allows the local preview servers and the PDF viewer', () => {
    expect(isSubframeURLAllowed('http://127.0.0.1:52345/files/x.pdf?token=abc')).toBe(true)
    expect(isSubframeURLAllowed('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html')).toBe(true)
    expect(isSubframeURLAllowed('about:blank')).toBe(true)
  })

  test('blocks everything else', () => {
    expect(isSubframeURLAllowed('https://127.0.0.1:52345/x')).toBe(false)
    expect(isSubframeURLAllowed('http://localhost:52345/x')).toBe(false)
    expect(isSubframeURLAllowed('http://127.0.0.1.example.com/x')).toBe(false)
    expect(isSubframeURLAllowed('https://example.com')).toBe(false)
    expect(isSubframeURLAllowed('file:///tmp/x.html')).toBe(false)
    expect(isSubframeURLAllowed('chrome-extension://abcdefghijklmnopabcdefghijklmnop/index.html')).toBe(false)
    expect(isSubframeURLAllowed('about:srcdoc')).toBe(false)
    expect(isSubframeURLAllowed('')).toBe(false)
  })
})

describe('parseDokanUninstallCommand', () => {
  const programData = 'C:\\ProgramData'
  const exe = 'C:\\ProgramData\\Package Cache\\{4f0a2fbe-7a7b-4bd3-a1b0-4c3c1d3a0e0c}\\DokanSetup_redist.exe'

  test('splits the quoted uninstaller path from its switches', () => {
    expect(parseDokanUninstallCommand(`"${exe}" /uninstall`, programData)).toEqual({args: ['/uninstall'], file: exe})
    expect(parseDokanUninstallCommand(`"${exe}"  /uninstall /quiet`, programData)).toEqual({
      args: ['/uninstall', '/quiet'],
      file: exe,
    })
    expect(parseDokanUninstallCommand(`"${exe}"`, programData)).toEqual({args: [], file: exe})
  })

  test('matches the location ignoring case, and other DokanSetup names', () => {
    const plain = 'c:\\programdata\\package cache\\{x}\\DokanSetup.exe'
    expect(parseDokanUninstallCommand(`"${plain}" -uninstall`, programData)).toEqual({args: ['-uninstall'], file: plain})
  })

  test('rejects other executables and locations', () => {
    for (const command of [
      '"C:\\ProgramData\\Package Cache\\{x}\\setup.exe" /uninstall',
      '"C:\\Windows\\System32\\cmd.exe" /c whoami',
      '"C:\\Users\\testuser\\Downloads\\DokanSetup.exe" /uninstall',
      '"C:\\ProgramData\\Package Cache\\..\\DokanSetup.exe" /uninstall',
      '"C:\\ProgramData\\Package Cache\\{x}\\..\\..\\DokanSetup.exe" /uninstall',
      '"\\\\server\\share\\Package Cache\\DokanSetup.exe" /uninstall',
      '"Package Cache\\DokanSetup.exe" /uninstall',
      'C:\\ProgramData\\Package Cache\\{x}\\DokanSetup.exe /uninstall',
    ]) {
      expect(parseDokanUninstallCommand(command, programData)).toBeUndefined()
    }
  })

  test('rejects anything but plain switches after the path', () => {
    for (const rest of [' /uninstall & calc.exe', ' /log C:\\x.txt', ' "/uninstall"', '/uninstall', ' /uninstall | x']) {
      expect(parseDokanUninstallCommand(`"${exe}"${rest}`, programData)).toBeUndefined()
    }
  })

  test('rejects missing input', () => {
    expect(parseDokanUninstallCommand('', programData)).toBeUndefined()
    expect(parseDokanUninstallCommand(`"${exe}`, programData)).toBeUndefined()
    expect(parseDokanUninstallCommand(`"${exe}" /uninstall`, undefined)).toBeUndefined()
    expect(parseDokanUninstallCommand(undefined, programData)).toBeUndefined()
  })
})

describe('isUploadTempPath', () => {
  const cacheRoot = '/Users/testuser/Library/Caches/Keybase/'

  test('chat copies go into uploadtemps/<outboxID>/<name>', () => {
    expect(isUploadTempPath(`${cacheRoot}uploadtemps_v1/abc123/photo.jpg`, cacheRoot, 'chat')).toBe(true)
    expect(isUploadTempPath(`${cacheRoot}uploadtemps/abc123/photo.jpg`, cacheRoot, 'chat')).toBe(true)
    expect(isUploadTempPath(`${cacheRoot}uploadtemps_v1/photo.jpg`, cacheRoot, 'chat')).toBe(false)
    expect(isUploadTempPath(`${cacheRoot}uploads-x/abc/photo.jpg`, cacheRoot, 'chat')).toBe(false)
    expect(isUploadTempPath(`${cacheRoot}uploadtemps_v1/abc/../../photo.jpg`, cacheRoot, 'chat')).toBe(false)
  })

  test('KBFS copies go into uploads-<random>/<name>', () => {
    expect(isUploadTempPath(`${cacheRoot}uploads-123456/folder`, cacheRoot, 'kbfs')).toBe(true)
    expect(isUploadTempPath(`${cacheRoot}uploads-123456`, cacheRoot, 'kbfs')).toBe(false)
    expect(isUploadTempPath(`${cacheRoot}uploads-123456/..`, cacheRoot, 'kbfs')).toBe(false)
    expect(isUploadTempPath(`${cacheRoot}uploads-/x`, cacheRoot, 'kbfs')).toBe(false)
    expect(isUploadTempPath(`${cacheRoot}uploadtemps_v1/abc/x`, cacheRoot, 'kbfs')).toBe(false)
  })

  test('takes a real cache root with or without a trailing slash', () => {
    const real = '/private/var/folders/ab/testuser/Caches/Keybase'
    expect(isUploadTempPath(`${real}/uploads-123456/folder`, real, 'kbfs')).toBe(true)
    expect(isUploadTempPath(`${real}/uploads-123456/folder`, `${real}/`, 'kbfs')).toBe(true)
    expect(isUploadTempPath(`/var/folders/ab/testuser/Caches/Keybase/uploads-123456/folder`, real, 'kbfs')).toBe(false)
  })

  test('nothing outside the cache root', () => {
    expect(isUploadTempPath('/Users/testuser/Library/LaunchAgents/uploads-1/x.plist', cacheRoot, 'kbfs')).toBe(false)
    expect(isUploadTempPath('/Users/testuser/Library/Caches/KeybaseDevel/uploads-1/x', cacheRoot, 'kbfs')).toBe(false)
    expect(isUploadTempPath('uploads-1/x', cacheRoot, 'kbfs')).toBe(false)
    expect(isUploadTempPath(`${cacheRoot}uploads-1/x`, '', 'kbfs')).toBe(false)
  })
})
