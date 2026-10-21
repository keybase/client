/// <reference types="jest" />
import {
  isRemoteKind,
  isRequestAllowed,
  isSamePage,
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
