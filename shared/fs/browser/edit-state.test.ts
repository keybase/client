/// <reference types="jest" />
import * as FS from '@/constants/fs'
import * as T from '@/constants/types'
import {getStaleRenameEditIDs} from './edit-state'

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
