import * as FS from '@/constants/fs'
import * as T from '@/constants/types'
import {tlfToPreferredOrder} from '@/util/kbfs'

const tlfSyncEnabled = {
  mode: T.FS.TlfSyncMode.Enabled,
} satisfies T.FS.TlfSyncEnabled

const tlfSyncDisabled = {
  mode: T.FS.TlfSyncMode.Disabled,
} satisfies T.FS.TlfSyncDisabled

const makeTlfSyncPartial = ({
  enabledPaths,
}: {
  enabledPaths?: T.FS.TlfSyncPartial['enabledPaths']
}): T.FS.TlfSyncPartial => ({
  enabledPaths: [...(enabledPaths || [])],
  mode: T.FS.TlfSyncMode.Partial,
})

const makeConflictStateNormalView = ({
  localViewTlfPaths,
  resolvingConflict,
  stuckInConflict,
}: Partial<T.FS.ConflictStateNormalView>): T.FS.ConflictStateNormalView => ({
  localViewTlfPaths: [...(localViewTlfPaths || [])],
  resolvingConflict: resolvingConflict || false,
  stuckInConflict: stuckInConflict || false,
  type: T.FS.ConflictStateType.NormalView,
})

const tlfNormalViewWithNoConflict = makeConflictStateNormalView({})

const makeConflictStateManualResolvingLocalView = ({
  normalViewTlfPath,
}: Partial<T.FS.ConflictStateManualResolvingLocalView>): T.FS.ConflictStateManualResolvingLocalView => ({
  normalViewTlfPath: normalViewTlfPath || FS.defaultPath,
  type: T.FS.ConflictStateType.ManualResolvingLocalView,
})

const makeTlf = (p: Partial<T.FS.Tlf>): T.FS.Tlf => {
  const {conflictState, isFavorite, isIgnored, isNew, name, resetParticipants, syncConfig, teamId, tlfMtime} =
    p
  return {
    conflictState: conflictState || tlfNormalViewWithNoConflict,
    isFavorite: isFavorite || false,
    isIgnored: isIgnored || false,
    isNew: isNew || false,
    name: name || '',
    resetParticipants: [...(resetParticipants || [])],
    syncConfig: syncConfig || tlfSyncDisabled,
    teamId: teamId || '',
    tlfMtime: tlfMtime || 0,
  }
}

const rpcFolderTypeToTlfType = (rpcFolderType: T.RPCGen.FolderType) => {
  switch (rpcFolderType) {
    case T.RPCGen.FolderType.private:
      return T.FS.TlfType.Private
    case T.RPCGen.FolderType.public:
      return T.FS.TlfType.Public
    case T.RPCGen.FolderType.team:
      return T.FS.TlfType.Team
    default:
      return null
  }
}

const rpcPathToPath = (rpcPath: T.RPCGen.KBFSPath) => T.FS.pathConcat(FS.defaultPath, rpcPath.path)

const rpcConflictStateToConflictState = (rpcConflictState?: T.RPCGen.ConflictState): T.FS.ConflictState => {
  if (rpcConflictState) {
    if (rpcConflictState.conflictStateType === T.RPCGen.ConflictStateType.normalview) {
      const nv = rpcConflictState.normalview
      return makeConflictStateNormalView({
        localViewTlfPaths: (nv.localViews || []).reduce<Array<T.FS.Path>>((arr, p) => {
          p.PathType === T.RPCGen.PathType.kbfs && arr.push(rpcPathToPath(p.kbfs))
          return arr
        }, []),
        resolvingConflict: nv.resolvingConflict,
        stuckInConflict: nv.stuckInConflict,
      })
    }
    const nv = rpcConflictState.manualresolvinglocalview.normalView
    return makeConflictStateManualResolvingLocalView({
      normalViewTlfPath: nv.PathType === T.RPCGen.PathType.kbfs ? rpcPathToPath(nv.kbfs) : FS.defaultPath,
    })
  }
  return tlfNormalViewWithNoConflict
}

const getSyncConfigFromRPC = (
  tlfName: string,
  tlfType: T.FS.TlfType,
  config?: T.RPCGen.FolderSyncConfig
): T.FS.TlfSyncConfig => {
  if (!config) {
    return tlfSyncDisabled
  }
  switch (config.mode) {
    case T.RPCGen.FolderSyncMode.disabled:
      return tlfSyncDisabled
    case T.RPCGen.FolderSyncMode.enabled:
      return tlfSyncEnabled
    case T.RPCGen.FolderSyncMode.partial:
      return makeTlfSyncPartial({
        enabledPaths: config.paths
          ? config.paths.map(str => T.FS.getPathFromRelative(tlfName, tlfType, str))
          : [],
      })
    default:
      return tlfSyncDisabled
  }
}

export const folderToTlf = ({
  folder,
  isFavorite,
  isIgnored,
  isNew,
  username,
}: {
  folder: T.RPCGen.Folder
  isFavorite: boolean
  isIgnored: boolean
  isNew: boolean
  username: string
}): {tlf: T.FS.Tlf; tlfName: string; tlfType: T.FS.TlfType} | undefined => {
  const tlfType = rpcFolderTypeToTlfType(folder.folderType)
  if (!tlfType) {
    return undefined
  }
  const tlfName =
    tlfType === T.FS.TlfType.Private || tlfType === T.FS.TlfType.Public
      ? tlfToPreferredOrder(folder.name, username)
      : folder.name
  return {
    tlf: makeTlf({
      conflictState: rpcConflictStateToConflictState(folder.conflictState || undefined),
      isFavorite,
      isIgnored,
      isNew,
      name: tlfName,
      resetParticipants: (folder.reset_members || []).map(({username}) => username),
      syncConfig: getSyncConfigFromRPC(tlfName, tlfType, folder.syncConfig || undefined),
      teamId: folder.team_id || '',
      tlfMtime: folder.mtime || 0,
    }),
    tlfName,
    tlfType,
  }
}

export const favoritesResultToTlfs = (
  results: T.RPCGen.FavoritesResult,
  username: string,
  additionalTlfs?: ReadonlyMap<T.FS.Path, T.FS.Tlf>
): T.FS.Tlfs => {
  const payload = {
    private: new Map<string, T.FS.Tlf>(),
    public: new Map<string, T.FS.Tlf>(),
    team: new Map<string, T.FS.Tlf>(),
  } as const
  const folders = [
    ...(results.favoriteFolders
      ? [{folders: results.favoriteFolders, isFavorite: true, isIgnored: false, isNew: false}]
      : []),
    ...(results.ignoredFolders
      ? [{folders: results.ignoredFolders, isFavorite: false, isIgnored: true, isNew: false}]
      : []),
    ...(results.newFolders ? [{folders: results.newFolders, isFavorite: true, isIgnored: false, isNew: true}] : []),
  ]

  folders.forEach(({folders, isFavorite, isIgnored, isNew}) =>
    folders.forEach(folder => {
      const next = folderToTlf({folder, isFavorite, isIgnored, isNew, username})
      if (!next) {
        return
      }
      payload[next.tlfType].set(next.tlfName, next.tlf)
    })
  )

  return {
    additionalTlfs: new Map(additionalTlfs),
    loaded: true,
    private: payload.private,
    public: payload.public,
    team: payload.team,
  }
}

const direntToMetadata = (d: T.RPCGen.Dirent) => ({
  lastModifiedTimestamp: d.time,
  lastWriter: d.lastWriterUnverified.username,
  name: d.name.split('/').pop(),
  prefetchStatus: (() => {
    switch (d.prefetchStatus) {
      case T.RPCGen.PrefetchStatus.notStarted:
        return FS.prefetchNotStarted
      case T.RPCGen.PrefetchStatus.inProgress:
        return {
          bytesFetched: d.prefetchProgress.bytesFetched,
          bytesTotal: d.prefetchProgress.bytesTotal,
          endEstimate: d.prefetchProgress.endEstimate,
          startTime: d.prefetchProgress.start,
          state: T.FS.PrefetchState.InProgress,
        } satisfies T.FS.PrefetchInProgress
      case T.RPCGen.PrefetchStatus.complete:
        return FS.prefetchComplete
      default:
        return FS.prefetchNotStarted
    }
  })(),
  size: d.size,
  writable: d.writable,
})

export const makeEntry = (d: T.RPCGen.Dirent, children?: Set<string>): T.FS.PathItem => {
  switch (d.direntType) {
    case T.RPCGen.DirentType.dir:
      return {
        ...FS.emptyFolder,
        ...direntToMetadata(d),
        children: new Set(children || []),
        progress: children ? T.FS.ProgressType.Loaded : T.FS.ProgressType.Pending,
      }
    case T.RPCGen.DirentType.sym:
      return {
        ...FS.emptySymlink,
        ...direntToMetadata(d),
      }
    case T.RPCGen.DirentType.file:
    case T.RPCGen.DirentType.exec:
      return {
        ...FS.emptyFile,
        ...direntToMetadata(d),
      }
    default:
      return FS.unknownPathItem
  }
}

export const updatePathItem = (
  oldPathItem: T.Immutable<T.FS.PathItem>,
  newPathItemFromAction: T.Immutable<T.FS.PathItem>
): T.Immutable<T.FS.PathItem> => {
  if (
    oldPathItem.type === T.FS.PathType.Folder &&
    newPathItemFromAction.type === T.FS.PathType.Folder &&
    oldPathItem.progress === T.FS.ProgressType.Loaded &&
    newPathItemFromAction.progress === T.FS.ProgressType.Pending
  ) {
    return {
      ...newPathItemFromAction,
      children: oldPathItem.children,
      progress: T.FS.ProgressType.Loaded,
    }
  }
  return newPathItemFromAction
}

export const makePathItemsFromDirents = ({
  entries,
  isRecursive,
  rootPath,
  rootPathItem,
}: {
  entries: ReadonlyArray<T.RPCGen.Dirent>
  isRecursive: boolean
  rootPath: T.FS.Path
  rootPathItem: T.FS.PathItem
}) => {
  const childMap = entries.reduce((m, d) => {
    const [parent, child] = d.name.split('/')
    if (child) {
      const fullParent = T.FS.pathConcat(rootPath, parent ?? '')
      let children = m.get(fullParent)
      if (!children) {
        children = new Set<string>()
        m.set(fullParent, children)
      }
      children.add(child)
    } else {
      let children = m.get(rootPath)
      if (!children) {
        children = new Set<string>()
        m.set(rootPath, children)
      }
      children.add(d.name)
    }
    return m
  }, new Map<T.FS.Path, Set<string>>())

  const direntToPathAndPathItem = (d: T.RPCGen.Dirent) => {
    const path = T.FS.pathConcat(rootPath, d.name)
    const entry = makeEntry(d, childMap.get(path))
    if (entry.type === T.FS.PathType.Folder && isRecursive && !d.name.includes('/')) {
      return [
        path,
        {
          ...entry,
          progress: T.FS.ProgressType.Loaded,
        },
      ] as const
    }
    return [path, entry] as const
  }

  const rootFolder: T.FS.FolderPathItem = {
    ...(rootPathItem.type === T.FS.PathType.Folder
      ? rootPathItem
      : {...FS.emptyFolder, name: T.FS.getPathName(rootPath)}),
    children: new Set(childMap.get(rootPath)),
    progress: T.FS.ProgressType.Loaded,
  }

  return new Map<T.FS.Path, T.FS.PathItem>([
    ...(T.FS.getPathLevel(rootPath) > 2 ? [[rootPath, rootFolder] as const] : []),
    ...entries.map(direntToPathAndPathItem),
  ])
}
