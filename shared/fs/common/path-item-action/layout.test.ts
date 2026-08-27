/// <reference types="jest" />
import * as FS from '@/constants/fs'
import * as T from '@/constants/types'
import {getRootLayout, getShareLayout, hasShare} from './layout'

type MutableGlobals = {isIOS: boolean; isMobile: boolean}
const g = globalThis as unknown as MutableGlobals

const p = (s: string) => T.FS.stringToPath(s)
const me = 'testuser'

const file = (over: Partial<T.FS.FilePathItem> = {}): T.FS.PathItem => ({
  ...FS.emptyFile,
  writable: true,
  ...over,
})
const folder = (over: Partial<T.FS.FolderPathItem> = {}): T.FS.PathItem => ({
  ...FS.emptyFolder,
  writable: true,
  ...over,
})

const imageContext: T.FS.FileContext = {
  contentType: 'image/png',
  url: 'u',
  viewType: T.RPCGen.GUIViewType.image,
}

afterEach(() => {
  g.isMobile = false
  g.isIOS = false
})

const enabled = (layout: Record<string, boolean>) =>
  Object.keys(layout)
    .filter(k => layout[k])
    .sort()

test('the root path has no actions at all', () => {
  expect(enabled(getRootLayout('screen', FS.defaultPath, folder(), FS.emptyFileContext, me))).toEqual([])
})

test('a tlf list only offers the system file manager on desktop', () => {
  expect(enabled(getRootLayout('screen', p('/keybase/private'), folder(), FS.emptyFileContext, me))).toEqual(
    ['showInSystemFileManager']
  )
  g.isMobile = true
  expect(enabled(getRootLayout('screen', p('/keybase/private'), folder(), FS.emptyFileContext, me))).toEqual(
    []
  )
})

test('your own private tlf cannot be ignored, but a shared one can', () => {
  const own = getRootLayout('row', p('/keybase/private/testuser'), folder(), FS.emptyFileContext, me)
  expect(own.ignoreTlf).toBe(false)
  expect(own.archive).toBe(true)

  const shared = getRootLayout(
    'row',
    p('/keybase/private/testuser,testuser-mac'),
    folder(),
    FS.emptyFileContext,
    me
  )
  expect(shared.ignoreTlf).toBe(true)

  // a reader on your own name still counts as shared
  const withReader = getRootLayout(
    'row',
    p('/keybase/private/testuser#testuser-mac'),
    folder(),
    FS.emptyFileContext,
    me
  )
  expect(withReader.ignoreTlf).toBe(true)

  // team tlfs are always ignorable
  expect(
    getRootLayout('row', p('/keybase/team/keybase'), folder(), FS.emptyFileContext, me).ignoreTlf
  ).toBe(true)

  // logged out: isMyOwn is false, so ignore is offered
  expect(
    getRootLayout('row', p('/keybase/private/testuser'), folder(), FS.emptyFileContext, '').ignoreTlf
  ).toBe(true)
})

test('tlf-level chat and new folder only show up in screen mode', () => {
  const row = getRootLayout('row', p('/keybase/team/keybase'), folder(), FS.emptyFileContext, me)
  expect(row.newFolder).toBe(false)
  expect(row.openChatTeam).toBe(false)

  const screen = getRootLayout('screen', p('/keybase/team/keybase'), folder(), FS.emptyFileContext, me)
  expect(screen.newFolder).toBe(true)
  expect(screen.openChatTeam).toBe(true)
  expect(screen.openChatNonTeam).toBe(false)

  const group = getRootLayout('screen', p('/keybase/private/testuser'), folder(), FS.emptyFileContext, me)
  expect(group.openChatNonTeam).toBe(true)
  expect(group.openChatTeam).toBe(false)

  // not writable: no new folder
  expect(
    getRootLayout(
      'screen',
      p('/keybase/team/keybase'),
      folder({writable: false}),
      FS.emptyFileContext,
      me
    ).newFolder
  ).toBe(false)
})

test('a writable file inside a tlf offers the full desktop row menu', () => {
  expect(
    enabled(
      getRootLayout('row', p('/keybase/private/testuser/a.txt'), file(), FS.emptyFileContext, me)
    )
  ).toEqual([
    'archive',
    'delete',
    'download',
    'moveOrCopy',
    'rename',
    'sendAttachmentToChat',
    'showInSystemFileManager',
  ])
})

test('rename is row-only and delete follows writability', () => {
  const path = p('/keybase/private/testuser/a.txt')
  expect(getRootLayout('screen', path, file(), FS.emptyFileContext, me).rename).toBe(false)
  const readOnly = getRootLayout('row', path, file({writable: false}), FS.emptyFileContext, me)
  expect(readOnly.rename).toBe(false)
  expect(readOnly.delete).toBe(false)
  expect(readOnly.moveOrCopy).toBe(true)
})

test('folders inside a tlf get no download and no chat attachment', () => {
  const layout = getRootLayout(
    'row',
    p('/keybase/private/testuser/dir'),
    folder(),
    FS.emptyFileContext,
    me
  )
  expect(layout.download).toBe(false)
  expect(layout.sendAttachmentToChat).toBe(false)
  expect(layout.delete).toBe(true)
})

test('iOS drops download', () => {
  g.isMobile = true
  g.isIOS = true
  expect(
    getRootLayout('row', p('/keybase/private/testuser/a.txt'), file(), FS.emptyFileContext, me).download
  ).toBe(false)
})

test('mobile consolidates the two share actions into one Share entry', () => {
  g.isMobile = true
  const path = p('/keybase/private/testuser/a.txt')
  const root = getRootLayout('row', path, file(), FS.emptyFileContext, me)
  expect(root.share).toBe(true)
  expect(root.sendAttachmentToChat).toBe(false)
  expect(root.sendToOtherApp).toBe(false)

  // the share submenu still lists both, and nothing else
  expect(enabled(getShareLayout('row', path, file(), FS.emptyFileContext, me))).toEqual([
    'sendAttachmentToChat',
    'sendToOtherApp',
  ])
})

test('desktop has a single share action, so it is not consolidated', () => {
  const path = p('/keybase/private/testuser/a.txt')
  const root = getRootLayout('row', path, file(), FS.emptyFileContext, me)
  expect(root.share).toBe(false)
  expect(root.sendAttachmentToChat).toBe(true)
  expect(root.sendToOtherApp).toBe(false)
})

test('hasShare is true for files and false for folders and tlfs', () => {
  expect(hasShare('row', p('/keybase/private/testuser/a.txt'), file(), FS.emptyFileContext)).toBe(true)
  expect(hasShare('row', p('/keybase/private/testuser/dir'), folder(), FS.emptyFileContext)).toBe(false)
  expect(hasShare('row', p('/keybase/private/testuser'), folder(), FS.emptyFileContext)).toBe(false)
})

test('saveMedia only on mobile for media files with a loaded context', () => {
  const path = p('/keybase/private/testuser/a.png')
  expect(getRootLayout('row', path, file(), imageContext, me).saveMedia).toBe(false)
  g.isMobile = true
  expect(getRootLayout('row', path, file(), imageContext, me).saveMedia).toBe(true)
  expect(getRootLayout('row', path, file(), FS.emptyFileContext, me).saveMedia).toBe(false)
})
