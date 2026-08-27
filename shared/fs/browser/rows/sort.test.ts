/// <reference types="jest" />
import * as T from '@/constants/types'
import * as RowTypes from './types'
import type {BrowserEditSession} from '../edit-state'
import {sortRowItems, type SortableRowItem} from './sort'

const fakeEditSession = {} as BrowserEditSession

const still = (
  name: string,
  lastModifiedTimestamp: number,
  type: T.FS.PathType = T.FS.PathType.File
): RowTypes.StillRowItem => ({
  key: `still:${name}`,
  lastModifiedTimestamp,
  name,
  path: T.FS.stringToPath(`/keybase/private/testuser/${name}`),
  rowType: RowTypes.RowType.Still,
  type,
})

const tlf = (name: string, tlfMtime: number, isNew = false): RowTypes.TlfRowItem => ({
  disabled: false,
  isNew,
  key: `tlf:${name}`,
  name,
  rowType: RowTypes.RowType.Tlf,
  tlfMtime,
  tlfType: T.FS.TlfType.Private,
  type: T.FS.PathType.Folder,
})

const newFolder = (name: string): RowTypes.NewFolderRowItem => ({
  editSession: fakeEditSession,
  key: `edit:${name}`,
  name,
  rowType: RowTypes.RowType.NewFolder,
  type: T.FS.PathType.Folder,
})

const names = (items: ReadonlyArray<SortableRowItem>) => items.map(i => i.name)

test('NameAsc puts folders before files and sorts each group by name', () => {
  const items: Array<SortableRowItem> = [
    still('zebra', 1, T.FS.PathType.Folder),
    still('beta.txt', 1),
    still('alpha.txt', 1),
    still('apple', 1, T.FS.PathType.Folder),
  ]
  expect(names(sortRowItems(items, T.FS.SortSetting.NameAsc, ''))).toEqual([
    'apple',
    'zebra',
    'alpha.txt',
    'beta.txt',
  ])
})

test('NameDesc reverses the whole name comparison, files first', () => {
  const items: Array<SortableRowItem> = [
    still('apple', 1, T.FS.PathType.Folder),
    still('alpha.txt', 1),
    still('beta.txt', 1),
  ]
  expect(names(sortRowItems(items, T.FS.SortSetting.NameDesc, ''))).toEqual([
    'beta.txt',
    'alpha.txt',
    'apple',
  ])
})

test('TimeAsc means most recent first, TimeDesc means oldest first', () => {
  const make = (): Array<SortableRowItem> => [still('old', 100), still('new', 300), still('mid', 200)]
  expect(names(sortRowItems(make(), T.FS.SortSetting.TimeAsc, ''))).toEqual(['new', 'mid', 'old'])
  expect(names(sortRowItems(make(), T.FS.SortSetting.TimeDesc, ''))).toEqual(['old', 'mid', 'new'])
})

test('time sort ignores type: a file can sort above a folder', () => {
  const items: Array<SortableRowItem> = [
    still('folder', 100, T.FS.PathType.Folder),
    still('file.txt', 300),
  ]
  expect(names(sortRowItems(items, T.FS.SortSetting.TimeAsc, ''))).toEqual(['file.txt', 'folder'])
})

test('a newly created folder row always sorts first, whatever the setting', () => {
  const make = (): Array<SortableRowItem> => [
    still('aaa', 500, T.FS.PathType.Folder),
    newFolder('New Folder'),
    still('zzz', 100),
  ]
  for (const setting of [
    T.FS.SortSetting.NameAsc,
    T.FS.SortSetting.NameDesc,
    T.FS.SortSetting.TimeAsc,
    T.FS.SortSetting.TimeDesc,
  ]) {
    expect(names(sortRowItems(make(), setting, 'testuser'))[0]).toBe('New Folder')
  }
})

test('your own tlf sorts first, then new tlfs, then the sort setting', () => {
  const items: Array<SortableRowItem> = [
    tlf('aaa', 100),
    tlf('other', 100, true),
    tlf('testuser', 100),
    tlf('bbb', 100),
  ]
  expect(names(sortRowItems(items, T.FS.SortSetting.NameAsc, 'testuser'))).toEqual([
    'testuser',
    'other',
    'aaa',
    'bbb',
  ])
})

test('with no logged in user the own-tlf rule is skipped', () => {
  const items: Array<SortableRowItem> = [tlf('testuser', 100), tlf('aaa', 100)]
  expect(names(sortRowItems(items, T.FS.SortSetting.NameAsc, ''))).toEqual(['aaa', 'testuser'])
})

test('the own-tlf and isNew rules survive a descending setting', () => {
  const items: Array<SortableRowItem> = [tlf('aaa', 100), tlf('zzz', 100, true), tlf('testuser', 100)]
  expect(names(sortRowItems(items, T.FS.SortSetting.NameDesc, 'testuser'))).toEqual([
    'testuser',
    'zzz',
    'aaa',
  ])
})

test('sortRowItems sorts in place and returns the same array', () => {
  const items: Array<SortableRowItem> = [still('b', 1), still('a', 1)]
  const result = sortRowItems(items, T.FS.SortSetting.NameAsc, '')
  expect(result).toBe(items)
  expect(names(items)).toEqual(['a', 'b'])
})
