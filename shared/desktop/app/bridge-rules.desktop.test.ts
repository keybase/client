/// <reference types="jest" />
import {
  isBrowserURL,
  isExternalURLAllowed,
  isRemoteKind,
  isRequestAllowed,
  isSamePage,
  isUploadTempPath,
  parseDokanUninstallCommand,
} from './bridge-rules.desktop'

describe('isSamePage', () => {
  const prodMain = 'file:///Applications/Keybase.app/Contents/Resources/app/desktop/dist/desktop/renderer/main.html'
  const winMain = 'file:///C:/Users/testuser/AppData/Local/Keybase/Gui/resources/app/desktop/dist/desktop/renderer/main.html'
  const hotMain = 'http://localhost:4000/desktop/renderer/main.html'

  test('matches the same document whatever the query or hash', () => {
    expect(isSamePage(prodMain, prodMain)).toBe(true)
    expect(isSamePage(`${prodMain}?x=1#/chat`, prodMain)).toBe(true)
    expect(isSamePage(`${hotMain}?component=menubar`, hotMain)).toBe(true)
  })

  test('matches Windows paths that differ only in case', () => {
    expect(isSamePage(winMain.replace('/Users/', '/users/'), winMain)).toBe(true)
  })

  test('rejects other documents, hosts, ports and schemes', () => {
    expect(isSamePage(prodMain.replace('main.html', 'remote.html'), prodMain)).toBe(false)
    expect(isSamePage('file:///tmp/desktop/dist/desktop/renderer/main.html', prodMain)).toBe(false)
    expect(isSamePage('http://localhost:4001/desktop/renderer/main.html', hotMain)).toBe(false)
    expect(isSamePage('http://127.0.0.1:4000/desktop/renderer/main.html', hotMain)).toBe(false)
    expect(isSamePage('https://localhost:4000/desktop/renderer/main.html', hotMain)).toBe(false)
  })

  test('rejects what is not a URL', () => {
    expect(isSamePage('', prodMain)).toBe(false)
    expect(isSamePage('not a url', prodMain)).toBe(false)
    expect(isSamePage(undefined, prodMain)).toBe(false)
  })
})

describe('isRequestAllowed', () => {
  test('the main window may make every call', () => {
    for (const r of ['engineSend', 'engineRestartLink', 'engineDropLink', 'KBmenu', 'uninstallDokan', 'makeRenderer']) {
      expect(isRequestAllowed('main', r)).toBe(true)
    }
  })

  test('every remote window may load, read its props, show and close itself, and dispatch', () => {
    for (const kind of ['menubar', 'pinentry', 'tracker', 'unlock-folders'] as const) {
      for (const r of ['KBsetupPreloadKB2', 'KBdispatchAction', 'getRemoteProps', 'showInactive', 'closeWindow']) {
        expect(isRequestAllowed(kind, r)).toBe(true)
      }
    }
  })

  test('remote windows get only the extra calls their component makes', () => {
    expect(isRequestAllowed('menubar', 'openURL')).toBe(true)
    expect(isRequestAllowed('menubar', 'hideWindow')).toBe(true)
    expect(isRequestAllowed('menubar', 'ctlQuit')).toBe(true)
    expect(isRequestAllowed('tracker', 'openURL')).toBe(true)
    expect(isRequestAllowed('tracker', 'ctlQuit')).toBe(false)
    expect(isRequestAllowed('pinentry', 'openURL')).toBe(false)
    expect(isRequestAllowed('unlock-folders', 'openURL')).toBe(false)
  })

  test('remote windows may not use the engine, the tray or the broad bridge calls', () => {
    for (const kind of ['menubar', 'pinentry', 'tracker', 'unlock-folders'] as const) {
      for (const r of [
        'engineSend',
        'engineRestartLink',
        'engineDropLink',
        'KBmenu',
        'uninstallDokan',
        'installCachedDokan',
        'makeRenderer',
        'rendererNewProps',
        'openPathInFinder',
        'darwinCopyToChatTempUploadFile',
        'exitApp',
        'not-an-action',
      ]) {
        expect(isRequestAllowed(kind, r)).toBe(false)
      }
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

  test('nothing outside the cache root', () => {
    expect(isUploadTempPath('/Users/testuser/Library/LaunchAgents/uploads-1/x.plist', cacheRoot, 'kbfs')).toBe(false)
    expect(isUploadTempPath('/Users/testuser/Library/Caches/KeybaseDevel/uploads-1/x', cacheRoot, 'kbfs')).toBe(false)
    expect(isUploadTempPath('uploads-1/x', cacheRoot, 'kbfs')).toBe(false)
    expect(isUploadTempPath(`${cacheRoot}uploads-1/x`, '', 'kbfs')).toBe(false)
  })
})
