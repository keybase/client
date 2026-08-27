/// <reference types="jest" />
import * as FS from '@/constants/fs'
import * as T from '@/constants/types'
import {
  favoritesResultToTlfs,
  folderToTlf,
  makeEntry,
  makePathItemsFromDirents,
  rpcPathToPath,
  updatePathItem,
} from './rpc-state'

const p = (s: string) => T.FS.stringToPath(s)

const kbfsPath = (path: string): T.RPCGen.Path => ({
  PathType: T.RPCGen.PathType.kbfs,
  kbfs: {identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui, path},
})

const dirent = (over: Partial<T.RPCGen.Dirent> = {}): T.RPCGen.Dirent => ({
  direntType: T.RPCGen.DirentType.file,
  lastWriterUnverified: {uid: 'uid', username: 'testuser'},
  name: 'a.txt',
  prefetchProgress: {bytesFetched: 0, bytesTotal: 0, endEstimate: 0, start: 0},
  prefetchStatus: T.RPCGen.PrefetchStatus.notStarted,
  size: 10,
  symlinkTarget: '',
  time: 1234,
  writable: true,
  ...over,
})

const folder = (over: Partial<T.RPCGen.Folder> = {}): T.RPCGen.Folder => ({
  created: false,
  folderType: T.RPCGen.FolderType.private,
  name: 'testuser',
  private: true,
  ...over,
})

test('rpcPathToPath prefixes /keybase', () => {
  expect(rpcPathToPath({identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui, path: '/private/testuser'})).toBe(
    '/keybase/private/testuser'
  )
})

describe('folderToTlf', () => {
  test('private and public tlf names are reordered to put you first', () => {
    const result = folderToTlf({
      folder: folder({mtime: 99, name: 'other,testuser'}),
      isFavorite: true,
      isIgnored: false,
      isNew: true,
      username: 'testuser',
    })
    expect(result).toMatchObject({tlfName: 'testuser,other', tlfType: T.FS.TlfType.Private})
    expect(result?.tlf).toMatchObject({
      isFavorite: true,
      isIgnored: false,
      isNew: true,
      name: 'testuser,other',
      tlfMtime: 99,
    })
  })

  test('team tlf names are left alone and carry the team id', () => {
    const result = folderToTlf({
      folder: folder({folderType: T.RPCGen.FolderType.team, name: 'keybase', team_id: 'tid'}),
      isFavorite: true,
      isIgnored: false,
      isNew: false,
      username: 'testuser',
    })
    expect(result?.tlfType).toBe(T.FS.TlfType.Team)
    expect(result?.tlf).toMatchObject({name: 'keybase', teamId: 'tid'})
  })

  test('unknown folder types are dropped', () => {
    expect(
      folderToTlf({
        folder: folder({folderType: T.RPCGen.FolderType.unknown}),
        isFavorite: true,
        isIgnored: false,
        isNew: false,
        username: 'testuser',
      })
    ).toBeUndefined()
  })

  test('reset members become resetParticipants', () => {
    const result = folderToTlf({
      folder: folder({reset_members: [{uid: 'uid2', username: 'testuser-mac'}]}),
      isFavorite: true,
      isIgnored: false,
      isNew: false,
      username: 'testuser',
    })
    expect(result?.tlf.resetParticipants).toEqual(['testuser-mac'])
  })

  test('sync config partial paths are expanded to full kbfs paths', () => {
    const result = folderToTlf({
      folder: folder({
        name: 'testuser',
        syncConfig: {mode: T.RPCGen.FolderSyncMode.partial, paths: ['dir/a.txt']},
      }),
      isFavorite: true,
      isIgnored: false,
      isNew: false,
      username: 'testuser',
    })
    expect(result?.tlf.syncConfig).toEqual({
      enabledPaths: ['/keybase/private/testuser/dir/a.txt'],
      mode: T.FS.TlfSyncMode.Partial,
    })
  })

  test('sync config enabled and disabled modes', () => {
    const withMode = (mode: T.RPCGen.FolderSyncMode) =>
      folderToTlf({
        folder: folder({syncConfig: {mode}}),
        isFavorite: true,
        isIgnored: false,
        isNew: false,
        username: 'testuser',
      })?.tlf.syncConfig
    expect(withMode(T.RPCGen.FolderSyncMode.enabled)).toEqual({mode: T.FS.TlfSyncMode.Enabled})
    expect(withMode(T.RPCGen.FolderSyncMode.disabled)).toEqual({mode: T.FS.TlfSyncMode.Disabled})
    // no sync config at all
    expect(
      folderToTlf({
        folder: folder(),
        isFavorite: true,
        isIgnored: false,
        isNew: false,
        username: 'testuser',
      })?.tlf.syncConfig
    ).toEqual({mode: T.FS.TlfSyncMode.Disabled})
  })

  test('normal view conflict state keeps only kbfs local views', () => {
    const result = folderToTlf({
      folder: folder({
        conflictState: {
          conflictStateType: T.RPCGen.ConflictStateType.normalview,
          normalview: {
            localViews: [kbfsPath('/private/testuser (conflicted)'), {PathType: T.RPCGen.PathType.local, local: '/tmp/x'}],
            resolvingConflict: true,
            stuckInConflict: true,
          },
        },
      }),
      isFavorite: true,
      isIgnored: false,
      isNew: false,
      username: 'testuser',
    })
    expect(result?.tlf.conflictState).toEqual({
      localViewTlfPaths: ['/keybase/private/testuser (conflicted)'],
      resolvingConflict: true,
      stuckInConflict: true,
      type: T.FS.ConflictStateType.NormalView,
    })
  })

  test('manual resolving local view conflict state', () => {
    const result = folderToTlf({
      folder: folder({
        conflictState: {
          conflictStateType: T.RPCGen.ConflictStateType.manualresolvinglocalview,
          manualresolvinglocalview: {normalView: kbfsPath('/private/testuser')},
        },
      }),
      isFavorite: true,
      isIgnored: false,
      isNew: false,
      username: 'testuser',
    })
    expect(result?.tlf.conflictState).toEqual({
      normalViewTlfPath: '/keybase/private/testuser',
      type: T.FS.ConflictStateType.ManualResolvingLocalView,
    })
  })
})

test('favoritesResultToTlfs buckets by type and flags favorite/ignored/new', () => {
  const tlfs = favoritesResultToTlfs(
    {
      favoriteFolders: [folder({name: 'other,testuser'})],
      ignoredFolders: [folder({folderType: T.RPCGen.FolderType.public, name: 'ignored'})],
      newFolders: [folder({folderType: T.RPCGen.FolderType.team, name: 'keybase'})],
    },
    'testuser',
    new Map([[p('/keybase/private/extra'), FS.unknownTlf]])
  )

  expect(tlfs.loaded).toBe(true)
  expect([...tlfs.private.keys()]).toEqual(['testuser,other'])
  expect(tlfs.private.get('testuser,other')).toMatchObject({isFavorite: true, isIgnored: false, isNew: false})
  expect(tlfs.public.get('ignored')).toMatchObject({isFavorite: false, isIgnored: true, isNew: false})
  expect(tlfs.team.get('keybase')).toMatchObject({isFavorite: true, isIgnored: false, isNew: true})
  expect(tlfs.additionalTlfs.size).toBe(1)
})

test('favoritesResultToTlfs tolerates a completely empty result', () => {
  const tlfs = favoritesResultToTlfs({}, 'testuser')
  expect(tlfs.private.size).toBe(0)
  expect(tlfs.public.size).toBe(0)
  expect(tlfs.team.size).toBe(0)
  expect(tlfs.additionalTlfs.size).toBe(0)
  expect(tlfs.loaded).toBe(true)
})

describe('makeEntry', () => {
  test('a folder without children is pending, with children is loaded', () => {
    const d = dirent({direntType: T.RPCGen.DirentType.dir, name: 'dir'})
    expect(makeEntry(d)).toMatchObject({
      children: new Set(),
      progress: T.FS.ProgressType.Pending,
      type: T.FS.PathType.Folder,
    })
    expect(makeEntry(d, new Set(['a.txt']))).toMatchObject({
      children: new Set(['a.txt']),
      progress: T.FS.ProgressType.Loaded,
    })
  })

  test('files, execs and symlinks map to their path types', () => {
    expect(makeEntry(dirent()).type).toBe(T.FS.PathType.File)
    expect(makeEntry(dirent({direntType: T.RPCGen.DirentType.exec})).type).toBe(T.FS.PathType.File)
    expect(makeEntry(dirent({direntType: T.RPCGen.DirentType.sym})).type).toBe(T.FS.PathType.Symlink)
    expect(makeEntry(dirent({direntType: -1 as T.RPCGen.DirentType}))).toBe(FS.unknownPathItem)
  })

  test('metadata uses the last path element as the name', () => {
    expect(makeEntry(dirent({name: 'dir/a.txt'}))).toMatchObject({
      lastModifiedTimestamp: 1234,
      lastWriter: 'testuser',
      name: 'a.txt',
      size: 10,
      writable: true,
    })
  })

  test('prefetch status maps through all three states', () => {
    expect(makeEntry(dirent()).prefetchStatus).toBe(FS.prefetchNotStarted)
    expect(makeEntry(dirent({prefetchStatus: T.RPCGen.PrefetchStatus.complete})).prefetchStatus).toBe(
      FS.prefetchComplete
    )
    expect(
      makeEntry(
        dirent({
          prefetchProgress: {bytesFetched: 5, bytesTotal: 10, endEstimate: 20, start: 1},
          prefetchStatus: T.RPCGen.PrefetchStatus.inProgress,
        })
      ).prefetchStatus
    ).toEqual({
      bytesFetched: 5,
      bytesTotal: 10,
      endEstimate: 20,
      startTime: 1,
      state: T.FS.PrefetchState.InProgress,
    })
  })
})

describe('updatePathItem', () => {
  test('a pending folder does not wipe already loaded children', () => {
    const old: T.FS.PathItem = {
      ...FS.emptyFolder,
      children: new Set(['a.txt']),
      progress: T.FS.ProgressType.Loaded,
    }
    const next: T.FS.PathItem = {...FS.emptyFolder, name: 'dir', progress: T.FS.ProgressType.Pending}
    expect(updatePathItem(old, next)).toMatchObject({
      children: new Set(['a.txt']),
      name: 'dir',
      progress: T.FS.ProgressType.Loaded,
    })
  })

  test('anything else just replaces', () => {
    const next: T.FS.PathItem = {...FS.emptyFolder, progress: T.FS.ProgressType.Loaded}
    expect(updatePathItem(FS.emptyFolder, next)).toBe(next)
    expect(updatePathItem(FS.emptyFile, FS.emptyFile)).toBe(FS.emptyFile)
  })
})

describe('makePathItemsFromDirents', () => {
  const rootPath = p('/keybase/private/testuser')

  test('builds the root folder plus every entry, wiring up nested children', () => {
    const items = makePathItemsFromDirents({
      entries: [
        dirent({name: 'a.txt'}),
        dirent({direntType: T.RPCGen.DirentType.dir, name: 'dir'}),
        dirent({name: 'dir/b.txt'}),
      ],
      isRecursive: true,
      rootPath,
      rootPathItem: FS.emptyFolder,
    })

    expect([...items.keys()].sort()).toEqual([
      '/keybase/private/testuser',
      '/keybase/private/testuser/a.txt',
      '/keybase/private/testuser/dir',
      '/keybase/private/testuser/dir/b.txt',
    ])
    expect(items.get(rootPath)).toMatchObject({
      children: new Set(['a.txt', 'dir']),
      progress: T.FS.ProgressType.Loaded,
    })
    expect(items.get(p('/keybase/private/testuser/dir'))).toMatchObject({
      children: new Set(['b.txt']),
      progress: T.FS.ProgressType.Loaded,
    })
  })

  test('a non-recursive listing leaves child folders pending', () => {
    const items = makePathItemsFromDirents({
      entries: [dirent({direntType: T.RPCGen.DirentType.dir, name: 'dir'})],
      isRecursive: false,
      rootPath,
      rootPathItem: FS.emptyFolder,
    })
    expect(items.get(p('/keybase/private/testuser/dir'))).toMatchObject({
      progress: T.FS.ProgressType.Pending,
    })
  })

  test('a tlf-list level root is not injected into the map', () => {
    const items = makePathItemsFromDirents({
      entries: [dirent({direntType: T.RPCGen.DirentType.dir, name: 'testuser'})],
      isRecursive: false,
      rootPath: p('/keybase/private'),
      rootPathItem: FS.emptyFolder,
    })
    expect(items.has(p('/keybase/private'))).toBe(false)
    expect(items.has(p('/keybase/private/testuser'))).toBe(true)
  })

  test('listing a file path returns nothing rather than a bogus folder', () => {
    const items = makePathItemsFromDirents({
      entries: [dirent({name: 'a.txt'})],
      isRecursive: false,
      rootPath: p('/keybase/private/testuser/a.txt'),
      rootPathItem: FS.unknownPathItem,
    })
    expect(items.size).toBe(0)
  })

  test('a known file root is not turned into a folder', () => {
    const items = makePathItemsFromDirents({
      entries: [dirent({name: 'other.txt'})],
      isRecursive: false,
      rootPath: p('/keybase/private/testuser/a.txt'),
      rootPathItem: FS.emptyFile,
    })
    expect(items.has(p('/keybase/private/testuser/a.txt'))).toBe(false)
    expect(items.has(p('/keybase/private/testuser/a.txt/other.txt'))).toBe(true)
  })
})
