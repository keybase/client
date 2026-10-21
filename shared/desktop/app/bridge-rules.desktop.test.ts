/// <reference types="jest" />
import fs from 'fs'
import path from 'path'
import * as RemoteGen from '@/constants/remote-actions'
import * as RPCTypes from '@/constants/rpc/rpc-gen'
import {
  isBrowserURL,
  isExternalURLAllowed,
  isRemoteKind,
  isRequestAllowed,
  isSamePage,
  isSubframeURLAllowed,
  isUploadTempPath,
  localServerResponseHeaders,
  localServerSandboxPolicy,
  pageKey,
  parseDokanUninstallCommand,
  remoteForwards,
  requestLogName,
  parseNotificationRequest,
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
  // the payloads the remote windows send for the forwards whose payload is pinned
  const sent: {[type: string]: unknown} = {
    'remote:dumpLogs': {reason: 'quitting through menu'},
    'remote:openPathInSystemFileManager': {path: '/keybase'},
    'remote:stop': {exitCode: RPCTypes.ExitCode.ok},
    'remote:trackerChangeFollow': {follow: true, guiID: 'g'},
  }

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
        'showNotification',
        'clearNotificationGroup',
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
        expect(isRequestAllowed(kind, forward(f, sent[f]))).toBe((forwards[kind] as Array<string>).includes(f))
      }
    }
  })

  test('pinned forwards carry only the payload the window sends', () => {
    const refused: {[type: string]: Array<unknown>} = {
      'remote:dumpLogs': [{reason: 'other'}, {}, undefined],
      'remote:openPathInSystemFileManager': [
        {path: '/Users/testuser'},
        {path: '/keybase/../etc'},
        {},
        undefined,
        'x',
        Object.create({path: '/keybase'}),
      ],
      'remote:stop': [{exitCode: RPCTypes.ExitCode.notok}, {exitCode: RPCTypes.ExitCode.restart}, {}, undefined],
      'remote:trackerChangeFollow': [{follow: false, guiID: 'g'}, {follow: 'true', guiID: 'g'}, {guiID: 'g'}],
    }
    const kindOf = (f: string) => (f === 'remote:trackerChangeFollow' ? 'tracker' : 'menubar')
    for (const [f, payloads] of Object.entries(refused)) {
      expect(isRequestAllowed(kindOf(f), forward(f, sent[f]))).toBe(true)
      for (const payload of payloads) {
        expect(isRequestAllowed(kindOf(f), forward(f, payload))).toBe(false)
        expect(isRequestAllowed('main', forward(f, payload))).toBe(true)
      }
    }
  })

  test('remote windows may not relay other remote actions', () => {
    expect(isRequestAllowed('pinentry', forward('remote:stop'))).toBe(false)
    expect(isRequestAllowed('pinentry', forward('remote:dumpLogs'))).toBe(false)
    for (const kind of remoteKinds) {
      for (const f of [
        'common:resetStore',
        'remote:link',
        'remote:saltpackFileOpen',
        'remote:installerRan',
        '',
        'constructor',
        '__proto__',
        'toString',
      ]) {
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
    expect(isSubframeURLAllowed('http://127.0.0.1:52345/files/private/testuser/a%20b.pdf?token=abc')).toBe(true)
    expect(isSubframeURLAllowed('http://127.0.0.1:52346/at?key=abc&prev=false&noanim=false&isemoji=false')).toBe(true)
    expect(isSubframeURLAllowed('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html')).toBe(true)
    expect(isSubframeURLAllowed('about:blank')).toBe(true)
  })

  test('blocks everything else', () => {
    expect(isSubframeURLAllowed('https://127.0.0.1:52345/x')).toBe(false)
    expect(isSubframeURLAllowed('http://127.0.0.1:52345/x')).toBe(false)
    expect(isSubframeURLAllowed('http://127.0.0.1:52345/av?typ=user&name=testuser')).toBe(false)
    expect(isSubframeURLAllowed('http://127.0.0.1:52345/map?lat=1&lon=2')).toBe(false)
    expect(isSubframeURLAllowed('http://127.0.0.1:52345/at/x')).toBe(false)
    expect(isSubframeURLAllowed('http://127.0.0.1:52345/attach?key=abc')).toBe(false)
    expect(isSubframeURLAllowed('http://127.0.0.1:52345/files')).toBe(false)
    expect(isSubframeURLAllowed('http://127.0.0.1:52345/filesx/a.pdf')).toBe(false)
    expect(isSubframeURLAllowed('http://127.0.0.1:52345/')).toBe(false)
    expect(isSubframeURLAllowed('http://localhost:52345/x')).toBe(false)
    expect(isSubframeURLAllowed('http://127.0.0.1.example.com/x')).toBe(false)
    expect(isSubframeURLAllowed('https://example.com')).toBe(false)
    expect(isSubframeURLAllowed('file:///tmp/x.html')).toBe(false)
    expect(isSubframeURLAllowed('chrome-extension://abcdefghijklmnopabcdefghijklmnop/index.html')).toBe(false)
    expect(isSubframeURLAllowed('about:srcdoc')).toBe(false)
    expect(isSubframeURLAllowed('')).toBe(false)
  })
})

describe('localServerResponseHeaders', () => {
  const origin = 'kbapp://app'
  const sandbox = localServerSandboxPolicy
  const kbfsText = 'http://127.0.0.1:52345/files/private/testuser/a.txt?token=abc&viewTypeInvariance=1'
  const chatPDF = 'http://127.0.0.1:52346/at?key=abc&prev=false'

  test('lets the page origin read KBFS files, and nothing else', () => {
    const kbfs = localServerResponseHeaders(kbfsText, {'Content-Type': ['text/plain; charset=utf-8']}, origin)
    expect(kbfs['Access-Control-Allow-Origin']).toEqual([origin])
    const chat = localServerResponseHeaders(chatPDF, {'Content-Type': ['image/png']}, origin)
    expect(Object.keys(chat).some(k => k.toLowerCase() === 'access-control-allow-origin')).toBe(false)
    expect(localServerResponseHeaders('http://127.0.0.1:52345/filesx/a', {}, origin)).not.toHaveProperty(
      'Access-Control-Allow-Origin'
    )
  })

  test('sandboxes everything but PDFs', () => {
    const csp = (contentType?: Array<string>) =>
      localServerResponseHeaders(chatPDF, contentType ? {'Content-Type': contentType} : {}, origin)[
        'Content-Security-Policy'
      ]
    expect(csp(['application/pdf'])).toBeUndefined()
    expect(csp(['Application/PDF; charset=binary'])).toBeUndefined()
    expect(csp(['image/png'])).toEqual([sandbox])
    expect(csp(['video/mp4'])).toEqual([sandbox])
    expect(csp(['text/html'])).toEqual([sandbox])
    expect(csp(['application/pdf', 'text/html'])).toEqual([sandbox])
    expect(csp([])).toEqual([sandbox])
    expect(csp()).toEqual([sandbox])
  })

  test('replaces headers whatever their case, without duplicating them', () => {
    const headers = localServerResponseHeaders(
      kbfsText,
      {
        'access-control-allow-origin': ['*'],
        'content-security-policy': ["default-src 'self'", sandbox],
        'content-type': ['TEXT/plain'],
        'x-content-type-options': ['NOSNIFF', 'other'],
        'X-Other': ['1'],
      },
      origin
    )
    expect(headers).toEqual({
      'Access-Control-Allow-Origin': [origin],
      'Content-Security-Policy': ["default-src 'self'", sandbox],
      'X-Other': ['1'],
      'content-type': ['TEXT/plain'],
      'x-content-type-options': ['NOSNIFF', 'other'],
    })
  })

  test('reads a PDF content type in any case', () => {
    expect(localServerResponseHeaders(chatPDF, {'content-type': ['application/pdf']}, origin)).toEqual({
      'content-type': ['application/pdf'],
    })
  })

  test('leaves other hosts alone and does not change the input', () => {
    const input = {'Content-Type': ['text/html']}
    expect(localServerResponseHeaders('http://localhost:4000/x', input, origin)).toEqual(input)
    expect(localServerResponseHeaders('https://127.0.0.1:1/x', input, origin)).toEqual(input)
    localServerResponseHeaders(chatPDF, input, origin)
    expect(input).toEqual({'Content-Type': ['text/html']})
    expect(localServerResponseHeaders(chatPDF, undefined, origin)).toEqual({
      'Content-Security-Policy': [sandbox],
    })
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

describe('requestLogName', () => {
  test('names only the channels, actions and remote actions the app defines', () => {
    expect(requestLogName({channel: 'KBmenu'})).toBe('channel:KBmenu')
    expect(requestLogName({action: 'openURL'})).toBe('action:openURL')
    expect(requestLogName({forward: 'remote:stop'})).toBe('forward:remote:stop')
    for (const name of ['made-up', 'toString', '__proto__', 'x'.repeat(200)]) {
      expect(requestLogName({channel: name})).toBe('channel:unknown')
      expect(requestLogName({action: name})).toBe('action:unknown')
      expect(requestLogName({forward: name})).toBe('forward:unknown')
    }
  })
})

// The remote windows' allowlists must match what their components dispatch. These are the files
// each remote window's component dispatches from (the sources that call R.remoteDispatch).
describe('remote window forwards match their dispatch sites', () => {
  const root = path.join(__dirname, '../..')
  const dispatchSites = {
    menubar: ['menubar/index.desktop.tsx', 'menubar/out-of-date.tsx'],
    pinentry: ['pinentry/main2.desktop.tsx'],
    tracker: ['tracker/main2.desktop.tsx'],
    'unlock-folders': ['unlock-folders/main2.desktop.tsx'],
  } as const
  const source = (files: ReadonlyArray<string>) =>
    files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n')
  const creators = RemoteGen as unknown as {[name: string]: unknown}
  // RemoteGen.createFoo builds the action whose type is RemoteGen.foo
  const dispatched = (src: string) =>
    new Set(
      [...src.matchAll(/RemoteGen\.(create\w+)\(/g)].map(([, name = '']) => {
        const create = creators[name]
        expect(typeof create).toBe('function')
        const {type} = (create as (p: unknown) => {type: string})(undefined)
        expect(type).toBe(creators[name.charAt(6).toLowerCase() + name.slice(7)])
        return type
      })
    )

  test('every remote window file that dispatches is listed', () => {
    const listed = new Set<string>(Object.values(dispatchSites).flat())
    for (const dir of new Set([...listed].map(f => path.dirname(f)))) {
      for (const f of fs.readdirSync(path.join(root, dir))) {
        const rel = `${dir}/${f}`
        if ((f.endsWith('.tsx') || f.endsWith('.ts')) && !f.includes('.test.') && source([rel]).includes('R.remoteDispatch(')) {
          expect(listed.has(rel)).toBe(true)
        }
      }
    }
  })

  test('each allowlist is exactly the set its window dispatches', () => {
    for (const [kind, files] of Object.entries(dispatchSites)) {
      const want = [...dispatched(source(files))].sort()
      expect(want.length).toBeGreaterThan(0)
      expect([...remoteForwards(kind as keyof typeof dispatchSites)].sort()).toEqual(want)
    }
  })

  test('the pinned payloads are the literals the windows send', () => {
    const menubar = source(dispatchSites.menubar)
    const tracker = source(dispatchSites.tracker)
    const literal = (src: string, re: RegExp) => [...src.matchAll(re)].map(([, v]) => v)
    const paths = literal(menubar, /createOpenPathInSystemFileManager\(\{path: '([^']*)'\}\)/g)
    expect(paths.length).toBeGreaterThan(0)
    for (const p of paths) {
      expect(isRequestAllowed('menubar', {forward: RemoteGen.openPathInSystemFileManager, payload: {path: p}})).toBe(true)
    }
    const reasons = literal(menubar, /createDumpLogs\(\{reason: '([^']*)'\}\)/g)
    expect(reasons.length).toBeGreaterThan(0)
    for (const reason of reasons) {
      expect(isRequestAllowed('menubar', {forward: RemoteGen.dumpLogs, payload: {reason}})).toBe(true)
    }
    const exitCodes = literal(menubar, /createStop\(\{exitCode: ([^}]*)\}\)/g)
    expect(exitCodes).toEqual(['T.RPCGen.ExitCode.ok'])
    const follows = literal(tracker, /createTrackerChangeFollow\(\{follow: ([^,}]*)/g)
    expect(follows.length).toBeGreaterThan(0)
    expect(new Set(follows)).toEqual(new Set(['true']))
    expect(isRequestAllowed('tracker', {forward: RemoteGen.trackerChangeFollow, payload: {follow: true, guiID: 'g'}})).toBe(true)
  })
})

describe('parseNotificationRequest', () => {
  const chat = {
    body: 'hello',
    groupId: 'chat:abc',
    groupTitle: 'testuser',
    hasReply: true,
    id: 'n1',
    silent: false,
    title: 'testuser',
  }

  test('keeps a well formed notification', () => {
    expect(parseNotificationRequest(chat)).toEqual(chat)
    const plain = {body: '', hasReply: false, id: 'n2', silent: true, title: 'Sync Error'}
    expect(parseNotificationRequest(plain)).toEqual(plain)
  })

  test('drops keys it does not know', () => {
    expect(parseNotificationRequest({...chat, icon: '/tmp/x.png', toastXml: '<toast/>'})).toEqual(chat)
  })

  test('rejects missing or mistyped fields', () => {
    expect(parseNotificationRequest(undefined)).toBeUndefined()
    expect(parseNotificationRequest('hello')).toBeUndefined()
    expect(parseNotificationRequest({...chat, id: ''})).toBeUndefined()
    expect(parseNotificationRequest({...chat, id: 7})).toBeUndefined()
    expect(parseNotificationRequest({...chat, title: undefined})).toBeUndefined()
    expect(parseNotificationRequest({...chat, body: undefined})).toBeUndefined()
    expect(parseNotificationRequest({...chat, hasReply: 'yes'})).toBeUndefined()
    expect(parseNotificationRequest({...chat, silent: undefined})).toBeUndefined()
    expect(parseNotificationRequest({...chat, groupId: ''})).toBeUndefined()
    expect(parseNotificationRequest({...chat, groupTitle: 3})).toBeUndefined()
    expect(parseNotificationRequest({...chat, body: 'x'.repeat(5001)})).toBeUndefined()
  })
})
