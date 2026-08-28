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
  expect(getStaleRenameEditIDs(new Map(), pathItems([]))).toEqual(new Set())
})

test('a rename whose original name still exists in the parent is not stale', () => {
  const edits = new Map([['e1', rename('a.txt')]])
  const stale = getStaleRenameEditIDs(edits, pathItems([[parentPath, folderWith('a.txt', 'b.txt')]]))
  expect(stale).toEqual(new Set())
})

test('a rename whose original name is gone from the parent is stale', () => {
  const edits = new Map([['e1', rename('a.txt')]])
  const stale = getStaleRenameEditIDs(edits, pathItems([[parentPath, folderWith('b.txt')]]))
  expect(stale).toEqual(new Set(['e1']))
})

test('a rename whose parent is not loaded at all is stale', () => {
  const edits = new Map([['e1', rename('a.txt')]])
  expect(getStaleRenameEditIDs(edits, pathItems([]))).toEqual(new Set(['e1']))
})

test('a rename whose parent is a file rather than a folder is stale', () => {
  const edits = new Map([['e1', rename('a.txt')]])
  const stale = getStaleRenameEditIDs(edits, pathItems([[parentPath, FS.emptyFile]]))
  expect(stale).toEqual(new Set(['e1']))
})

test('a pending (not yet loaded) folder that already lists the child is not stale', () => {
  // Only type and children membership are consulted; progress is not.
  const edits = new Map([['e1', rename('a.txt')]])
  const item: T.FS.PathItem = {...FS.emptyFolder, children: new Set(['a.txt'])}
  expect(getStaleRenameEditIDs(edits, pathItems([[parentPath, item]]))).toEqual(new Set())
})

test('new-folder edits are never stale, even with no parent loaded', () => {
  const edits = new Map([
    ['e1', newFolder('New Folder')],
    ['e2', newFolder('New Folder (2)', {parentPath: p('/keybase/team/keybasefriends')})],
  ])
  expect(getStaleRenameEditIDs(edits, pathItems([]))).toEqual(new Set())
})

test('the check is per-edit and uses each edit own parent path', () => {
  const otherParent = p('/keybase/team/keybasefriends')
  const edits = new Map([
    ['ok', rename('a.txt')],
    ['gone', rename('missing.txt')],
    ['otherOk', rename('c.txt', {parentPath: otherParent})],
    ['otherGone', rename('d.txt', {parentPath: otherParent})],
    ['nf', newFolder('New Folder')],
  ])
  const stale = getStaleRenameEditIDs(
    edits,
    pathItems([
      [parentPath, folderWith('a.txt')],
      [otherParent, folderWith('c.txt')],
    ])
  )
  expect(stale).toEqual(new Set(['gone', 'otherGone']))
})

test('child name matching is exact, not case insensitive or prefix based', () => {
  const edits = new Map([
    ['case', rename('A.txt')],
    ['prefix', rename('a')],
  ])
  const stale = getStaleRenameEditIDs(edits, pathItems([[parentPath, folderWith('a.txt')]]))
  expect(stale).toEqual(new Set(['case', 'prefix']))
})

test('an empty folder makes every rename under it stale', () => {
  const edits = new Map([
    ['e1', rename('a.txt')],
    ['e2', rename('b.txt')],
  ])
  const stale = getStaleRenameEditIDs(edits, pathItems([[parentPath, folderWith()]]))
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
