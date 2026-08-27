/// <reference types="jest" />
import * as FS from '@/constants/fs'
import * as RowTypes from './types'
import * as T from '@/constants/types'
import type {BrowserEditSession} from '../edit-state'
import {filterRowItems, getNormalRowItems} from './rows-container'

const p = (s: string) => T.FS.stringToPath(s)

const tlf = (name: string, over: Partial<T.FS.Tlf> = {}): T.FS.Tlf => ({
  ...FS.unknownTlf,
  name,
  ...over,
})

const makeTlfs = (over: Partial<T.FS.Tlfs> = {}): T.FS.Tlfs => ({
  additionalTlfs: new Map(),
  loaded: true,
  private: new Map(),
  public: new Map(),
  team: new Map(),
  ...over,
})

const file = (name: string, lastModifiedTimestamp = 0): T.FS.PathItem => ({
  ...FS.emptyFile,
  lastModifiedTimestamp,
  name,
})

const folder = (name: string, lastModifiedTimestamp = 0): T.FS.PathItem => ({
  ...FS.emptyFolder,
  lastModifiedTimestamp,
  name,
  progress: T.FS.ProgressType.Loaded,
})

const loadedFolder = {...FS.emptyFolder, progress: T.FS.ProgressType.Loaded} as T.FS.PathItem

const editSession = (editID: string, edit: T.FS.Edit): BrowserEditSession => ({
  commitEdit: () => {},
  discardEdit: () => {},
  edit,
  editID,
  isSubmitting: false,
  setEditName: () => {},
})

const args = (over: Partial<Parameters<typeof getNormalRowItems>[0]>) => ({
  childItems: [],
  childPaths: [],
  editSessions: new Map<T.FS.EditID, BrowserEditSession>(),
  path: p('/keybase/private/testuser'),
  pathItem: loadedFolder,
  sortSetting: T.FS.SortSetting.NameAsc,
  tlfs: makeTlfs(),
  username: 'testuser',
  ...over,
})

const names = (items: ReadonlyArray<RowTypes.NamedRowItem>) => items.map(i => i.name)
const kinds = (items: ReadonlyArray<RowTypes.NamedRowItem>) => items.map(i => i.rowType)

describe('getNormalRowItems path levels', () => {
  test('an empty path (level 0) yields nothing', () => {
    expect(getNormalRowItems(args({path: p('')}))).toEqual([])
  })

  test('/keybase (level 1) yields nothing', () => {
    expect(getNormalRowItems(args({path: p('/keybase')}))).toEqual([])
  })
})

describe('getNormalRowItems tlf level', () => {
  test('an uninitialized private list yields three folder placeholders', () => {
    const rows = getNormalRowItems(args({path: p('/keybase/private'), tlfs: makeTlfs()}))
    expect(rows).toHaveLength(3)
    expect(kinds(rows)).toEqual([
      RowTypes.RowType.Placeholder,
      RowTypes.RowType.Placeholder,
      RowTypes.RowType.Placeholder,
    ])
    expect(rows.map(r => r.key)).toEqual(['placeholder:1', 'placeholder:2', 'placeholder:3'])
    expect(rows.every(r => r.type === T.FS.PathType.Folder)).toBe(true)
  })

  test('the placeholder check keys off private even when browsing another tlf type', () => {
    const rows = getNormalRowItems(
      args({
        path: p('/keybase/team'),
        tlfs: makeTlfs({team: new Map([['keybasefriends', tlf('keybasefriends')]])}),
      })
    )
    expect(kinds(rows)).toEqual([
      RowTypes.RowType.Placeholder,
      RowTypes.RowType.Placeholder,
      RowTypes.RowType.Placeholder,
    ])
  })

  test('tlf rows are built from the list matching the path visibility', () => {
    const tlfs = makeTlfs({
      private: new Map([['testuser', tlf('testuser', {isNew: true, tlfMtime: 5})]]),
      public: new Map([['testuser-mac', tlf('testuser-mac', {tlfMtime: 7})]]),
    })
    const rows = getNormalRowItems(args({path: p('/keybase/public'), tlfs}))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      disabled: false,
      isNew: false,
      key: 'tlf:testuser-mac',
      name: 'testuser-mac',
      rowType: RowTypes.RowType.Tlf,
      tlfMtime: 7,
      tlfType: T.FS.TlfType.Public,
      type: T.FS.PathType.Folder,
    })
  })

  test('ignored tlfs are dropped', () => {
    const tlfs = makeTlfs({
      private: new Map([
        ['testuser', tlf('testuser')],
        ['testuser,testuser-mac', tlf('testuser,testuser-mac', {isIgnored: true})],
      ]),
    })
    expect(names(getNormalRowItems(args({path: p('/keybase/private'), tlfs})))).toEqual(['testuser'])
  })

  test('your own tlf sorts first in a non-team tlf list', () => {
    const tlfs = makeTlfs({
      private: new Map([
        ['aaa,testuser', tlf('aaa,testuser')],
        ['testuser', tlf('testuser')],
        ['zzz,testuser', tlf('zzz,testuser')],
      ]),
    })
    expect(names(getNormalRowItems(args({path: p('/keybase/private'), tlfs})))).toEqual([
      'testuser',
      'aaa,testuser',
      'zzz,testuser',
    ])
  })

  test('sortSetting is honored for tlf rows', () => {
    const tlfs = makeTlfs({
      private: new Map([
        ['testuser', tlf('testuser')],
        ['aaa,testuser', tlf('aaa,testuser')],
        ['zzz,testuser', tlf('zzz,testuser')],
      ]),
    })
    expect(
      names(
        getNormalRowItems(
          args({path: p('/keybase/private'), sortSetting: T.FS.SortSetting.NameDesc, tlfs})
        )
      )
    ).toEqual(['testuser', 'zzz,testuser', 'aaa,testuser'])
  })

  test('in the destination picker, public tlfs that are not yours are disabled', () => {
    const tlfs = makeTlfs({
      private: new Map([['testuser', tlf('testuser')]]),
      public: new Map([
        ['testuser', tlf('testuser')],
        ['testuser-mac', tlf('testuser-mac')],
      ]),
    })
    const rows = getNormalRowItems(
      args({inDestinationPicker: true, path: p('/keybase/public'), tlfs})
    ) as Array<RowTypes.TlfRowItem>
    expect(rows.map(r => [r.name, r.disabled])).toEqual([
      ['testuser', false],
      ['testuser-mac', true],
    ])
  })

  test('outside the destination picker nothing is disabled', () => {
    const tlfs = makeTlfs({
      private: new Map([['testuser', tlf('testuser')]]),
      public: new Map([['testuser-mac', tlf('testuser-mac')]]),
    })
    const rows = getNormalRowItems(args({path: p('/keybase/public'), tlfs})) as Array<RowTypes.TlfRowItem>
    expect(rows.map(r => r.disabled)).toEqual([false])
  })
})

describe('getNormalRowItems in-tlf level', () => {
  test('a non-folder path item yields three file placeholders', () => {
    const rows = getNormalRowItems(
      args({path: p('/keybase/private/testuser/a.txt'), pathItem: file('a.txt')})
    )
    expect(kinds(rows)).toEqual([
      RowTypes.RowType.Placeholder,
      RowTypes.RowType.Placeholder,
      RowTypes.RowType.Placeholder,
    ])
    expect(rows.every(r => r.type === T.FS.PathType.File)).toBe(true)
  })

  test('a folder still loading yields file placeholders even with child items', () => {
    const rows = getNormalRowItems(
      args({
        childItems: [file('a.txt')],
        childPaths: [p('/keybase/private/testuser/a.txt')],
        pathItem: FS.emptyFolder as T.FS.PathItem,
      })
    )
    expect(kinds(rows)).toEqual([
      RowTypes.RowType.Placeholder,
      RowTypes.RowType.Placeholder,
      RowTypes.RowType.Placeholder,
    ])
  })

  test('an empty loaded folder yields no rows', () => {
    expect(getNormalRowItems(args({}))).toEqual([])
  })

  test('still rows carry name, path, key, type and mtime, sorted folders first', () => {
    const rows = getNormalRowItems(
      args({
        childItems: [file('b.txt', 20), folder('sub', 30), file('a.txt', 10)],
        childPaths: [
          p('/keybase/private/testuser/b.txt'),
          p('/keybase/private/testuser/sub'),
          p('/keybase/private/testuser/a.txt'),
        ],
      })
    )
    expect(names(rows)).toEqual(['sub', 'a.txt', 'b.txt'])
    expect(rows[0]).toMatchObject({
      key: 'still:sub',
      lastModifiedTimestamp: 30,
      path: '/keybase/private/testuser/sub',
      rowType: RowTypes.RowType.Still,
      type: T.FS.PathType.Folder,
    })
  })

  test('child items with no matching path are skipped', () => {
    const rows = getNormalRowItems(
      args({
        childItems: [file('a.txt'), file('b.txt'), file('c.txt')],
        childPaths: [p('/keybase/private/testuser/a.txt')],
      })
    )
    expect(names(rows)).toEqual(['a.txt'])
  })

  test('new-folder edits for this parent become their own rows, sorted with the rest', () => {
    const edit: T.FS.Edit = {
      name: 'New Folder',
      originalName: 'New Folder',
      parentPath: p('/keybase/private/testuser'),
      type: T.FS.EditType.NewFolder,
    }
    const rows = getNormalRowItems(
      args({
        childItems: [file('a.txt'), folder('zzz')],
        childPaths: [p('/keybase/private/testuser/a.txt'), p('/keybase/private/testuser/zzz')],
        editSessions: new Map([['edit1', editSession('edit1', edit)]]),
      })
    )
    expect(names(rows)).toEqual(['New Folder', 'zzz', 'a.txt'])
    expect(rows[0]).toMatchObject({key: 'edit:edit1', rowType: RowTypes.RowType.NewFolder})
  })

  test('edits for a different parent path are ignored', () => {
    const edit: T.FS.Edit = {
      name: 'New Folder',
      originalName: 'New Folder',
      parentPath: p('/keybase/private/testuser-mac'),
      type: T.FS.EditType.NewFolder,
    }
    const rows = getNormalRowItems(args({editSessions: new Map([['edit1', editSession('edit1', edit)]])}))
    expect(rows).toEqual([])
  })

  test('a rename edit attaches its session to the matching still row only', () => {
    const edit: T.FS.Edit = {
      name: 'renamed.txt',
      originalName: 'a.txt',
      parentPath: p('/keybase/private/testuser'),
      type: T.FS.EditType.Rename,
    }
    const session = editSession('edit1', edit)
    const rows = getNormalRowItems(
      args({
        childItems: [file('a.txt'), file('b.txt')],
        childPaths: [p('/keybase/private/testuser/a.txt'), p('/keybase/private/testuser/b.txt')],
        editSessions: new Map([['edit1', session]]),
      })
    ) as Array<RowTypes.StillRowItem>
    expect(names(rows)).toEqual(['a.txt', 'b.txt'])
    expect(rows[0]?.editSession).toBe(session)
    expect(rows[1]?.editSession).toBeUndefined()
    // the row keeps its still identity, keyed by the current name
    expect(rows[0]).toMatchObject({key: 'still:a.txt', rowType: RowTypes.RowType.Still})
  })

  test('a rename edit with no matching child adds no row', () => {
    const edit: T.FS.Edit = {
      name: 'renamed.txt',
      originalName: 'gone.txt',
      parentPath: p('/keybase/private/testuser'),
      type: T.FS.EditType.Rename,
    }
    const rows = getNormalRowItems(
      args({
        childItems: [file('a.txt')],
        childPaths: [p('/keybase/private/testuser/a.txt')],
        editSessions: new Map([['edit1', editSession('edit1', edit)]]),
      })
    ) as Array<RowTypes.StillRowItem>
    expect(names(rows)).toEqual(['a.txt'])
    expect(rows[0]?.editSession).toBeUndefined()
  })

  test('deeper in-tlf paths take the same branch', () => {
    const rows = getNormalRowItems(
      args({
        childItems: [file('deep.txt')],
        childPaths: [p('/keybase/private/testuser/a/b/deep.txt')],
        path: p('/keybase/private/testuser/a/b'),
      })
    )
    expect(names(rows)).toEqual(['deep.txt'])
  })
})

describe('filterRowItems', () => {
  const still = (name: string): RowTypes.StillRowItem => ({
    key: `still:${name}`,
    lastModifiedTimestamp: 0,
    name,
    path: p(`/keybase/private/testuser/${name}`),
    rowType: RowTypes.RowType.Still,
    type: T.FS.PathType.File,
  })
  const tlfRow = (name: string): RowTypes.TlfRowItem => ({
    disabled: false,
    isNew: false,
    key: `tlf:${name}`,
    name,
    rowType: RowTypes.RowType.Tlf,
    tlfMtime: 0,
    tlfType: T.FS.TlfType.Private,
    type: T.FS.PathType.Folder,
  })
  const tlfTypeRow = (name: T.FS.TlfType): RowTypes.TlfTypeRowItem => ({
    key: `tlfType:${name}`,
    name,
    rowType: RowTypes.RowType.TlfType,
    type: T.FS.PathType.Folder,
  })
  const placeholder: RowTypes.PlaceholderRowItem = {
    key: 'placeholder:1',
    name: '1',
    rowType: RowTypes.RowType.Placeholder,
    type: T.FS.PathType.File,
  }

  test('an undefined filter returns the same array instance', () => {
    const rows = [still('a.txt')]
    expect(filterRowItems(rows)).toBe(rows)
  })

  test('an empty filter string returns the same array instance', () => {
    const rows = [still('a.txt')]
    expect(filterRowItems(rows, '')).toBe(rows)
  })

  test('filtering is case insensitive on both sides and matches substrings', () => {
    const rows = [still('Alpha.txt'), still('beta.txt'), still('gamma.txt')]
    expect(names(filterRowItems(rows, 'AL'))).toEqual(['Alpha.txt'])
    expect(names(filterRowItems(rows, 'a.'))).toEqual(['Alpha.txt', 'beta.txt', 'gamma.txt'])
  })

  test('still, tlf and tlfType rows are filterable', () => {
    const rows = [still('alpha.txt'), tlfRow('alpha'), tlfTypeRow(T.FS.TlfType.Private)]
    expect(filterRowItems(rows, 'zzz')).toEqual([])
    expect(names(filterRowItems(rows, 'alpha'))).toEqual(['alpha.txt', 'alpha'])
    expect(names(filterRowItems(rows, 'priv'))).toEqual([T.FS.TlfType.Private])
  })

  test('non-filterable rows survive any filter', () => {
    const rows = [placeholder, still('alpha.txt')]
    expect(filterRowItems(rows, 'zzz')).toEqual([placeholder])
  })

  test('order is preserved and no match yields an empty array', () => {
    const rows = [still('b.txt'), still('a.txt'), still('c.txt')]
    expect(names(filterRowItems(rows, '.txt'))).toEqual(['b.txt', 'a.txt', 'c.txt'])
    expect(filterRowItems(rows, 'nope')).toEqual([])
  })

  test('an empty row list stays empty', () => {
    expect(filterRowItems([], 'anything')).toEqual([])
  })
})
