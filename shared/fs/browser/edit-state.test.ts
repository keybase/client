/// <reference types="jest" />
import * as FS from '@/constants/fs'
import * as T from '@/constants/types'
import {RPCError} from '@/util/errors'
import {getRenameConflictError, getStaleRenameEditIDs, pickNewFolderName} from './edit-state'

const p = (s: string) => T.FS.stringToPath(s)
const parentPath = p('/keybase/private/testuser')

const rename = (originalName: string, over: Partial<T.FS.Edit> = {}): T.FS.Edit => ({
  name: `${originalName}-new`,
  originalName,
  parentPath,
  type: T.FS.EditType.Rename,
  ...over,
})

const newFolder = (name: string, over: Partial<T.FS.Edit> = {}): T.FS.Edit => ({
  name,
  originalName: name,
  parentPath,
  type: T.FS.EditType.NewFolder,
  ...over,
})

const folderWith = (...children: Array<string>): T.FS.PathItem => ({
  ...FS.emptyFolder,
  children: new Set(children),
  progress: T.FS.ProgressType.Loaded,
})

const pathItems = (entries: Array<[T.FS.Path, T.FS.PathItem]>): T.FS.PathItems => new Map(entries)

test('empty edits produce an empty set', () => {
  expect(getStaleRenameEditIDs(new Map(), pathItems([]), parentPath)).toEqual(new Set())
})

test('a rename whose original name still exists in the parent is not stale', () => {
  const edits = new Map([['e1', rename('a.txt')]])
  const stale = getStaleRenameEditIDs(edits, pathItems([[parentPath, folderWith('a.txt', 'b.txt')]]), parentPath)
  expect(stale).toEqual(new Set())
})

test('a rename whose original name is gone from the parent is stale', () => {
  const edits = new Map([['e1', rename('a.txt')]])
  const stale = getStaleRenameEditIDs(edits, pathItems([[parentPath, folderWith('b.txt')]]), parentPath)
  expect(stale).toEqual(new Set(['e1']))
})

// Every mounted fs screen sweeps the one global edit store against its own
// pathItems. On mobile the Files tab root stays mounted under each pushed
// folder, so a screen that never loaded this folder must abstain -- judging it
// stale deleted the edit out from under the screen that owned it.
test('a rename whose parent is not loaded at all is left alone', () => {
  const edits = new Map([['e1', rename('a.txt')]])
  expect(getStaleRenameEditIDs(edits, pathItems([]), parentPath)).toEqual(new Set())
})

test('a rename survives a sweep by a screen that loaded only unrelated folders', () => {
  const edits = new Map([['e1', rename('a.txt')]])
  const otherFolder = p('/keybase/team/keybasefriends')
  const stale = getStaleRenameEditIDs(edits, pathItems([[otherFolder, folderWith('c.txt')]]), parentPath)
  expect(stale).toEqual(new Set())
})

test('a rename whose parent is a file rather than a folder is left alone', () => {
  const edits = new Map([['e1', rename('a.txt')]])
  const stale = getStaleRenameEditIDs(edits, pathItems([[parentPath, FS.emptyFile]]), parentPath)
  expect(stale).toEqual(new Set())
})

test('a pending (not yet loaded) folder that already lists the child is not stale', () => {
  const edits = new Map([['e1', rename('a.txt')]])
  const item: T.FS.PathItem = {...FS.emptyFolder, children: new Set(['a.txt'])}
  expect(getStaleRenameEditIDs(edits, pathItems([[parentPath, item]]), parentPath)).toEqual(new Set())
})

test('a pending folder with an incomplete listing cannot retire the edit', () => {
  // Mid-refresh the listing is empty; that is not proof the file is gone.
  const edits = new Map([['e1', rename('a.txt')]])
  const item: T.FS.PathItem = {...FS.emptyFolder, children: new Set<string>()}
  expect(getStaleRenameEditIDs(edits, pathItems([[parentPath, item]]), parentPath)).toEqual(new Set())
})

test('new-folder edits are never stale, even with no parent loaded', () => {
  const edits = new Map([
    ['e1', newFolder('New Folder')],
    ['e2', newFolder('New Folder (2)', {parentPath: p('/keybase/team/keybasefriends')})],
  ])
  expect(getStaleRenameEditIDs(edits, pathItems([]), parentPath)).toEqual(new Set())
})

test('each screen judges only its own folder, and together they cover both', () => {
  const otherParent = p('/keybase/team/keybasefriends')
  const edits = new Map([
    ['ok', rename('a.txt')],
    ['gone', rename('missing.txt')],
    ['otherOk', rename('c.txt', {parentPath: otherParent})],
    ['otherGone', rename('d.txt', {parentPath: otherParent})],
    ['nf', newFolder('New Folder')],
  ])
  const items = pathItems([
    [parentPath, folderWith('a.txt')],
    [otherParent, folderWith('c.txt')],
  ])
  expect(getStaleRenameEditIDs(edits, items, parentPath)).toEqual(new Set(['gone']))
  expect(getStaleRenameEditIDs(edits, items, otherParent)).toEqual(new Set(['otherGone']))
})

test('child name matching is exact, not case insensitive or prefix based', () => {
  const edits = new Map([
    ['case', rename('A.txt')],
    ['prefix', rename('a')],
  ])
  const stale = getStaleRenameEditIDs(edits, pathItems([[parentPath, folderWith('a.txt')]]), parentPath)
  expect(stale).toEqual(new Set(['case', 'prefix']))
})

test('an empty folder makes every rename under it stale', () => {
  const edits = new Map([
    ['e1', rename('a.txt')],
    ['e2', rename('b.txt')],
  ])
  const stale = getStaleRenameEditIDs(edits, pathItems([[parentPath, folderWith()]]), parentPath)
  expect(stale).toEqual(new Set(['e1', 'e2']))
})

describe('pickNewFolderName', () => {
  const none = new Set<string>()

  test('the first new folder is just "New Folder"', () => {
    expect(pickNewFolderName(none, none)).toBe('New Folder')
    expect(pickNewFolderName(new Set(['a.txt', 'dir']), none)).toBe('New Folder')
  })

  test('an existing child pushes the name to the next number', () => {
    expect(pickNewFolderName(new Set(['New Folder']), none)).toBe('New Folder 2')
    expect(pickNewFolderName(new Set(['New Folder', 'New Folder 2']), none)).toBe('New Folder 3')
  })

  test('a pending edit with the same name counts as taken', () => {
    expect(pickNewFolderName(none, new Set(['New Folder']))).toBe('New Folder 2')
    expect(pickNewFolderName(none, new Set(['New Folder', 'New Folder 2']))).toBe('New Folder 3')
  })

  test('children and pending edits are both consulted, so two clicks never collide', () => {
    expect(pickNewFolderName(new Set(['New Folder']), new Set(['New Folder 2']))).toBe('New Folder 3')
  })

  test('the run of taken names does not have to be contiguous', () => {
    expect(pickNewFolderName(new Set(['New Folder', 'New Folder 3']), none)).toBe('New Folder 2')
  })

  test('matching is exact', () => {
    expect(pickNewFolderName(new Set(['new folder', 'New Folder (2)']), none)).toBe('New Folder')
  })
})

describe('getRenameConflictError', () => {
  const renameEdit = rename('a.txt')
  const rpcError = (code: T.RPCGen.StatusCode, desc = '') => new RPCError(desc, code)

  test('a name-exists failure is recoverable and carries the description', () => {
    expect(
      getRenameConflictError(renameEdit, rpcError(T.RPCGen.StatusCode.scsimplefsnameexists, 'name exists!'))
    ).toBe('name exists!')
  })

  test('a dir-not-empty failure is recoverable too', () => {
    expect(
      getRenameConflictError(renameEdit, rpcError(T.RPCGen.StatusCode.scsimplefsdirnotempty, 'not empty'))
    ).toBe('not empty')
  })

  test('an empty description falls back to a generic message', () => {
    expect(getRenameConflictError(renameEdit, rpcError(T.RPCGen.StatusCode.scsimplefsnameexists))).toBe(
      'name exists'
    )
  })

  test('any other rpc error is not recoverable here', () => {
    expect(
      getRenameConflictError(renameEdit, rpcError(T.RPCGen.StatusCode.scsimplefsnoaccess, 'nope'))
    ).toBeUndefined()
  })

  test('a plain error is not recoverable', () => {
    expect(getRenameConflictError(renameEdit, new Error('boom'))).toBeUndefined()
    expect(
      getRenameConflictError(renameEdit, {code: T.RPCGen.StatusCode.scsimplefsnameexists, desc: 'x'})
    ).toBeUndefined()
  })

  test('a new-folder edit does not get the rename recovery', () => {
    expect(
      getRenameConflictError(
        newFolder('New Folder'),
        rpcError(T.RPCGen.StatusCode.scsimplefsnameexists, 'name exists!')
      )
    ).toBeUndefined()
  })
})

test('a screen only judges the folder it owns, even if it has another loaded', () => {
  // The Files tab root stays mounted under every pushed folder. It has its own
  // pathItems, so letting it vote deleted renames started one screen up.
  const sub = p('/keybase/private/testuser/sub')
  const edits = new Map([['e1', rename('a.txt', {parentPath: sub})]])
  const rootItems = pathItems([[parentPath, folderWith('sub')]])
  expect(getStaleRenameEditIDs(edits, rootItems, parentPath)).toEqual(new Set())
  expect(getStaleRenameEditIDs(edits, rootItems, sub)).toEqual(new Set())
})

test('a stale Loaded listing of someone else\'s folder cannot retire the edit', () => {
  // A recursive listing stamps direct subfolders Loaded with the children they
  // had at that moment, so being Loaded is not proof of ownership.
  const sub = p('/keybase/private/testuser/sub')
  const edits = new Map([['e1', rename('new.txt', {parentPath: sub})]])
  const parentsStaleView = pathItems([[sub, folderWith('old.txt')]])
  expect(getStaleRenameEditIDs(edits, parentsStaleView, parentPath)).toEqual(new Set())
  // the folder's own screen, holding the same listing, still retires it
  expect(getStaleRenameEditIDs(edits, parentsStaleView, sub)).toEqual(new Set(['e1']))
})
