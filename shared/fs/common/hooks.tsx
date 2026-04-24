import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import {useCurrentUserState} from '@/stores/current-user'
import * as FS from '@/stores/fs'
import {useFSState} from '@/stores/fs'
import {RPCError} from '@/util/errors'
import {
  favoritesResultToTlfs,
  folderToTlf,
  makeEntry,
  makePathItemsFromDirents,
  updatePathItem,
} from './rpc-state'
import {
  useFsErrorActionOrThrow,
  useFsRedbarActions,
  useFsSoftErrorActions,
  useFsSoftErrors,
} from './error-state'
import {
  finishedDownloadWithIntentMobile as finishedDownloadWithIntentInPlatform,
  finishedRegularDownloadMobile as finishedRegularDownloadInPlatform,
} from '@/stores/fs-platform'
import {requestPermissionsToWrite} from '@/util/platform-specific'

const isPathItem = (path: T.FS.Path) => T.FS.getPathLevel(path) > 2 || FS.hasSpecialFileElement(path)

const emptyPathItems = new Map<T.FS.Path, T.FS.PathItem>()

const makeEmptyTlfs = (): T.FS.Tlfs => ({
  additionalTlfs: new Map(),
  loaded: false,
  private: new Map(),
  public: new Map(),
  team: new Map(),
})

const emptyTlfs = makeEmptyTlfs()

type FsDataContextType = {
  downloadInfos: ReadonlyMap<string, T.FS.DownloadInfo>
  loadAdditionalTlf: (tlfPath: T.FS.Path) => void
  loadDownloadInfo: (downloadID: string) => void
  loadFolderChildren: (path: T.FS.Path, initialLoadRecursive: boolean) => void
  loadPathMetadata: (path: T.FS.Path) => void
  loadTlfs: () => void
  pathItems: T.FS.PathItems
  recordDownloadStarted: (downloadID: string, path: T.FS.Path, type: DownloadStartType) => void
  tlfs: T.FS.Tlfs
}

const FsDataContext = React.createContext<FsDataContextType | null>(null)

type DownloadStartType = 'download' | 'share' | 'saveMedia'

const downloadIntentFromStartType = (type: DownloadStartType): T.FS.DownloadIntent | undefined =>
  type === 'share'
    ? T.FS.DownloadIntent.Share
    : type === 'saveMedia'
      ? T.FS.DownloadIntent.CameraRoll
      : undefined

export const FsDataProvider = ({children}: {children: React.ReactNode}) => {
  const username = useCurrentUserState(s => s.username)
  const errorToActionOrThrow = useFsErrorActionOrThrow()
  const {setPathSoftError, setTlfSoftError} = useFsSoftErrorActions()
  const activeDownloadIDs = useFSState(C.useShallow(s => [...s.downloads.state.keys()]))
  const [downloadInfos, setDownloadInfos] = React.useState<ReadonlyMap<string, T.FS.DownloadInfo>>(
    () => new Map()
  )
  const [pathItems, setPathItems] = React.useState<T.FS.PathItems>(() => new Map())
  const [tlfs, setTlfs] = React.useState<T.FS.Tlfs>(makeEmptyTlfs)

  const loadDownloadInfo = (downloadID: string) => {
    const f = async () => {
      try {
        const res = await T.RPCGen.SimpleFSSimpleFSGetDownloadInfoRpcPromise({
          downloadID,
        })
        setDownloadInfos(prevDownloadInfos => {
          const old = prevDownloadInfos.get(downloadID)
          const nextDownloadInfos = new Map(prevDownloadInfos)
          nextDownloadInfos.set(downloadID, {
            filename: res.filename,
            intent: old?.intent,
            isRegularDownload: res.isRegularDownload,
            path: T.FS.stringToPath('/keybase' + res.path.path),
            startTime: res.startTime,
          })
          return nextDownloadInfos
        })
      } catch (error) {
        errorToActionOrThrow(error)
      }
    }
    C.ignorePromise(f())
  }

  const recordDownloadStarted = (downloadID: string, path: T.FS.Path, type: DownloadStartType) => {
    const downloadIntent = downloadIntentFromStartType(type)
    setDownloadInfos(prevDownloadInfos => {
      const old = prevDownloadInfos.get(downloadID)
      const nextDownloadInfos = new Map(prevDownloadInfos)
      nextDownloadInfos.set(downloadID, {
        filename: old?.filename ?? T.FS.getPathName(path),
        intent: downloadIntent ?? old?.intent,
        isRegularDownload: type === 'download',
        path,
        startTime: old?.startTime ?? 0,
      })
      return nextDownloadInfos
    })
  }

  const loadMissingDownloadInfo = React.useEffectEvent((downloadID: string) => {
    if (!downloadInfos.has(downloadID)) {
      loadDownloadInfo(downloadID)
    }
  })
  React.useEffect(() => {
    activeDownloadIDs.forEach(loadMissingDownloadInfo)
  }, [activeDownloadIDs])

  const loadPathMetadata = (path: T.FS.Path) => {
    const f = async () => {
      try {
        const dirent = await T.RPCGen.SimpleFSSimpleFSStatRpcPromise({
          path: FS.pathToRPCPath(path),
          refreshSubscription: false,
        })
        const pathItem = makeEntry(dirent)
        setPathItems(prevPathItems => {
          const nextPathItems = new Map(prevPathItems)
          const oldPathItem = FS.getPathItem(prevPathItems, path)
          nextPathItems.set(path, updatePathItem(oldPathItem, pathItem))
          return nextPathItems
        })
        setPathSoftError(path)
        const tlfPath = FS.getTlfPath(path)
        tlfPath && setTlfSoftError(tlfPath)
      } catch (error) {
        errorToActionOrThrow(error, path)
      }
    }
    C.ignorePromise(f())
  }

  const loadFolderChildren = (rootPath: T.FS.Path, initialLoadRecursive: boolean) => {
    const f = async () => {
      try {
        const opID = FS.makeUUID()
        if (initialLoadRecursive) {
          await T.RPCGen.SimpleFSSimpleFSListRecursiveToDepthRpcPromise({
            depth: 1,
            filter: T.RPCGen.ListFilter.filterSystemHidden,
            opID,
            path: FS.pathToRPCPath(rootPath),
            refreshSubscription: false,
          })
        } else {
          await T.RPCGen.SimpleFSSimpleFSListRpcPromise({
            filter: T.RPCGen.ListFilter.filterSystemHidden,
            opID,
            path: FS.pathToRPCPath(rootPath),
            refreshSubscription: false,
          })
        }

        await T.RPCGen.SimpleFSSimpleFSWaitRpcPromise({opID})
        const result = await T.RPCGen.SimpleFSSimpleFSReadListRpcPromise({opID})
        const entries = result.entries || []

        setPathItems(prevPathItems => {
          const nextPathItems = new Map(prevPathItems)
          const loadedPathItems = makePathItemsFromDirents({
            entries,
            isRecursive: initialLoadRecursive,
            rootPath,
            rootPathItem: FS.getPathItem(prevPathItems, rootPath),
          })
          loadedPathItems.forEach((pathItemFromAction, path) => {
            const oldPathItem = FS.getPathItem(nextPathItems, path)
            const nextPathItem = updatePathItem(oldPathItem, pathItemFromAction)
            if (oldPathItem.type === T.FS.PathType.Folder) {
              oldPathItem.children.forEach(name => {
                if (nextPathItem.type !== T.FS.PathType.Folder || !nextPathItem.children.has(name)) {
                  nextPathItems.delete(T.FS.pathConcat(path, name))
                }
              })
            }
            nextPathItems.set(path, nextPathItem)
          })
          return nextPathItems
        })
      } catch (error) {
        errorToActionOrThrow(error, rootPath)
      }
    }
    C.ignorePromise(f())
  }

  const loadTlfs = () => {
    const f = async () => {
      try {
        const results = await T.RPCGen.SimpleFSSimpleFSListFavoritesRpcPromise()
        setTlfs(prevTlfs => favoritesResultToTlfs(results, username, prevTlfs.additionalTlfs))
      } catch (error) {
        errorToActionOrThrow(error)
      }
    }
    C.ignorePromise(f())
  }

  const loadAdditionalTlf = (tlfPath: T.FS.Path) => {
    const f = async () => {
      if (T.FS.getPathLevel(tlfPath) !== 3) {
        logger.warn('loadAdditionalTlf called on non-TLF path')
        return
      }
      try {
        const result = await T.RPCGen.SimpleFSSimpleFSGetFolderRpcPromise({
          path: FS.pathToRPCPath(tlfPath).kbfs,
        })
        const next = folderToTlf({
          folder: result.folder,
          isFavorite: result.isFavorite,
          isIgnored: result.isIgnored,
          isNew: result.isNew,
          username,
        })
        if (!next) {
          return
        }
        setTlfs(prevTlfs => {
          const additionalTlfs = new Map(prevTlfs.additionalTlfs)
          additionalTlfs.set(tlfPath, next.tlf)
          return {
            ...prevTlfs,
            additionalTlfs,
          }
        })
      } catch (error) {
        if (error instanceof RPCError && error.code === T.RPCGen.StatusCode.scteamcontactsettingsblock) {
          const fields = error.fields as undefined | Array<{key?: string; value?: string}>
          const users = fields?.filter(elem => elem.key === 'usernames')
          const usernames = users?.map(elem => elem.value ?? '') ?? []
          C.Router2.navigateUp()
          C.Router2.navigateAppend({
            name: 'contactRestricted',
            params: {source: 'newFolder', usernames},
          })
        }
        errorToActionOrThrow(error, tlfPath)
      }
    }
    C.ignorePromise(f())
  }

  return (
    <FsDataContext.Provider
      value={{
        downloadInfos,
        loadAdditionalTlf,
        loadDownloadInfo,
        loadFolderChildren,
        loadPathMetadata,
        loadTlfs,
        pathItems,
        recordDownloadStarted,
        tlfs,
      }}
    >
      {children}
    </FsDataContext.Provider>
  )
}

const useFsLoadOnMountAndFocus = ({
  enabled = true,
  load,
  reloadKey,
}: {
  enabled?: boolean
  load: () => void
  reloadKey?: unknown
}) => {
  const connected = useFSState(s => s.kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected)
  const loadOnMountAndFocus = React.useEffectEvent(() => {
    connected && enabled && load()
  })
  const [stableLoadOnMountAndFocus] = React.useState(() => () => {
    loadOnMountAndFocus()
  })
  React.useEffect(() => {
    connected && enabled && loadOnMountAndFocus()
  }, [connected, enabled, reloadKey])
  C.Router2.useSafeFocusEffect(stableLoadOnMountAndFocus)
}

const useFsSubscriptionEffect = ({
  errorPath,
  subscribe,
  subscriptionKey,
}: {
  errorPath?: T.FS.Path
  subscribe: (subscriptionID: string) => Promise<void>
  subscriptionKey: string
}) => {
  const connected = useFSState(s => s.kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected)
  const errorToActionOrThrow = useFsErrorActionOrThrow()
  const onError = React.useEffectEvent((error: unknown) => {
    errorToActionOrThrow(error, errorPath)
  })
  const subscribeEvent = React.useEffectEvent(subscribe)
  React.useEffect(() => {
    if (!connected) {
      return
    }
    const subscriptionID = FS.makeUUID()
    const f = async () => {
      try {
        await subscribeEvent(subscriptionID)
      } catch (error) {
        onError(error)
      }
    }
    C.ignorePromise(f())
    return () => {
      C.ignorePromise(
        T.RPCGen.SimpleFSSimpleFSUnsubscribeRpcPromise({
          clientID: FS.clientID,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
          subscriptionID,
        }).catch(() => {})
      )
    }
  }, [connected, errorPath, subscriptionKey])
}

const useFsPathSubscriptionEffect = (path: T.FS.Path, topic: T.RPCGen.PathSubscriptionTopic) => {
  const pathString = T.FS.pathToString(path)
  useFsSubscriptionEffect({
    errorPath: path,
    subscribe: async subscriptionID => {
      if (T.FS.getPathLevel(path) < 3) {
        return
      }
      try {
        await T.RPCGen.SimpleFSSimpleFSSubscribePathRpcPromise({
          clientID: FS.clientID,
          deduplicateIntervalSecond: 1,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
          kbfsPath: pathString,
          subscriptionID,
          topic,
        })
      } catch (error) {
        if (!(error instanceof RPCError)) {
          throw error
        }
        if (error.code !== T.RPCGen.StatusCode.scteamcontactsettingsblock) {
          throw error
        }
      }
    },
    subscriptionKey: `${pathString}:${topic}`,
  })
}

const useFsNonPathSubscriptionEffect = (topic: T.RPCGen.SubscriptionTopic) => {
  useFsSubscriptionEffect({
    subscribe: async subscriptionID => {
      await T.RPCGen.SimpleFSSimpleFSSubscribeNonPathRpcPromise({
        clientID: FS.clientID,
        deduplicateIntervalSecond: 1,
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
        subscriptionID,
        topic,
      })
    },
    subscriptionKey: String(topic),
  })
}

const useLoadedPathItems = () => {
  const routeData = React.useContext(FsDataContext)
  return routeData?.pathItems ?? emptyPathItems
}

const useLoadedTlfs = () => {
  const routeData = React.useContext(FsDataContext)
  return routeData?.tlfs ?? emptyTlfs
}

export const useFsLoadedPathItems = () => useLoadedPathItems()

export const useFsReloadTlfs = () => {
  const routeData = React.useContext(FsDataContext)
  return () => {
    routeData?.loadTlfs()
  }
}

export const useFsRefreshTlf = (path: T.FS.Path) => {
  const routeData = React.useContext(FsDataContext)
  const tlfs = useLoadedTlfs()
  const tlfPath = FS.getTlfPath(path)
  return () => {
    if (!routeData || !tlfPath) {
      return
    }
    if (FS.getTlfFromPathInFavoritesOnly(tlfs, tlfPath) !== FS.unknownTlf) {
      routeData.loadTlfs()
      return
    }
    routeData.loadAdditionalTlf(tlfPath)
  }
}

export const useFsPathItem = (path: T.FS.Path, options?: {loadOnMount?: boolean}) => {
  const routeData = React.useContext(FsDataContext)
  const pathItems = useLoadedPathItems()
  useFsPathSubscriptionEffect(path, T.RPCGen.PathSubscriptionTopic.stat)
  const pathItem = FS.getPathItem(pathItems, path)
  const loadPathMetadata = routeData?.loadPathMetadata
  const shouldLoad = !!loadPathMetadata && isPathItem(path) && options?.loadOnMount !== false
  useEngineActionListener(
    'keybase.1.NotifyFS.FSSubscriptionNotifyPath',
    action => {
      const {clientID, path: updatedPath, topics} = action.payload.params
      if (
        loadPathMetadata &&
        clientID === FS.clientID &&
        updatedPath === T.FS.pathToString(path) &&
        topics?.includes(T.RPCGen.PathSubscriptionTopic.stat)
      ) {
        loadPathMetadata(path)
      }
    },
    shouldLoad
  )
  useFsLoadOnMountAndFocus({
    enabled: shouldLoad,
    load: () => {
      loadPathMetadata?.(path)
    },
    reloadKey: path,
  })
  return pathItem
}

export const useFsPathMetadata = (path: T.FS.Path, options?: {loadOnMount?: boolean}) =>
  useFsPathItem(path, options)

export const useFsFolderChildren = (
  path: T.FS.Path,
  options?: {
    initialLoadRecursive?: boolean
  }
) => {
  const routeData = React.useContext(FsDataContext)
  const pathItems = useLoadedPathItems()
  useFsPathSubscriptionEffect(path, T.RPCGen.PathSubscriptionTopic.children)
  const pathItem = FS.getPathItem(pathItems, path)
  const loadFolderChildren = routeData?.loadFolderChildren
  const initialLoadRecursive = !!options?.initialLoadRecursive
  const shouldLoad = !!loadFolderChildren && isPathItem(path)
  useEngineActionListener(
    'keybase.1.NotifyFS.FSSubscriptionNotifyPath',
    action => {
      const {clientID, path: updatedPath, topics} = action.payload.params
      if (
        loadFolderChildren &&
        clientID === FS.clientID &&
        updatedPath === T.FS.pathToString(path) &&
        topics?.includes(T.RPCGen.PathSubscriptionTopic.children)
      ) {
        loadFolderChildren(path, initialLoadRecursive)
      }
    },
    shouldLoad
  )
  useFsLoadOnMountAndFocus({
    enabled: shouldLoad,
    load: () => {
      loadFolderChildren?.(path, initialLoadRecursive)
    },
    reloadKey: `${path}:${initialLoadRecursive ? 'recursive' : 'shallow'}`,
  })
  return pathItem
}

export const useFsChildren = (path: T.FS.Path, initialLoadRecursive?: boolean) =>
  useFsFolderChildren(path, {initialLoadRecursive})

export const useFsFolderChildItems = (
  path: T.FS.Path,
  options?: {
    initialLoadRecursive?: boolean
  }
) => {
  const pathItem = useFsFolderChildren(path, options)
  const pathItems = useLoadedPathItems()
  const childPaths =
    pathItem.type === T.FS.PathType.Folder
      ? [...pathItem.children].map(name => T.FS.pathConcat(path, name))
      : []
  const childItems = childPaths.map(childPath => FS.getPathItem(pathItems, childPath))
  return {childItems, childPaths, pathItem}
}

export const useFsTlfs = () => {
  const routeData = React.useContext(FsDataContext)
  useFsNonPathSubscriptionEffect(T.RPCGen.SubscriptionTopic.favorites)
  const tlfs = useLoadedTlfs()
  const loadTlfs = routeData?.loadTlfs
  useEngineActionListener(
    'keybase.1.NotifyFS.FSSubscriptionNotify',
    action => {
      const {clientID, topic} = action.payload.params
      if (clientID === FS.clientID && topic === T.RPCGen.SubscriptionTopic.favorites) {
        loadTlfs?.()
      }
    },
    !!loadTlfs
  )
  useFsLoadOnMountAndFocus({
    enabled: !!loadTlfs,
    load: () => {
      loadTlfs?.()
    },
  })
  return tlfs
}

export const useFsTlf = (path: T.FS.Path, options?: {loadOnMount?: boolean}) => {
  const routeData = React.useContext(FsDataContext)
  const tlfPath = FS.getTlfPath(path)
  const tlfs = useFsTlfs()
  const tlf = FS.getTlfFromPath(tlfs, path)
  const loadAdditionalTlf = routeData?.loadAdditionalTlf
  const active =
    !!loadAdditionalTlf &&
    !!tlfPath &&
    tlfs.loaded &&
    FS.getTlfFromPathInFavoritesOnly(tlfs, tlfPath) === FS.unknownTlf &&
    options?.loadOnMount !== false
  const loadCurrentTlf = React.useEffectEvent(() => {
    active && loadAdditionalTlf(tlfPath)
  })
  const [stableLoadCurrentTlf] = React.useState(() => () => {
    loadCurrentTlf()
  })
  Kb.useInterval(
    () => {
      loadCurrentTlf()
    },
    active ? 10000 : undefined
  )
  React.useEffect(() => {
    loadCurrentTlf()
  }, [active, loadAdditionalTlf, tlfPath, tlfs.loaded])
  C.Router2.useSafeFocusEffect(stableLoadCurrentTlf)
  return tlf
}

export const useFsOnlineStatus = () => {
  useFsNonPathSubscriptionEffect(T.RPCGen.SubscriptionTopic.onlineStatus)
  const getOnlineStatus = useFSState.getState().dispatch.getOnlineStatus
  useFsLoadOnMountAndFocus({
    load: getOnlineStatus,
  })
}

export const useFsPathInfo = (path: T.FS.Path, knownPathInfo = FS.emptyPathInfo): T.FS.PathInfo => {
  const alreadyKnown = knownPathInfo !== FS.emptyPathInfo
  const [pathInfo, setPathInfo] = React.useState<T.FS.PathInfo>(alreadyKnown ? knownPathInfo : FS.emptyPathInfo)
  const pathInfoVersionRef = React.useRef(0)
  React.useEffect(() => {
    pathInfoVersionRef.current += 1
    setPathInfo(alreadyKnown ? knownPathInfo : FS.emptyPathInfo)
  }, [alreadyKnown, knownPathInfo, path])
  useFsLoadOnMountAndFocus({
    enabled: !alreadyKnown,
    load: () => {
      const version = ++pathInfoVersionRef.current
      const f = async () => {
        const nextPathInfo = await T.RPCGen.kbfsMountGetKBFSPathInfoRpcPromise({
          standardPath: T.FS.pathToString(path),
        })
        if (pathInfoVersionRef.current !== version) {
          return
        }
        setPathInfo({
          deeplinkPath: nextPathInfo.deeplinkPath,
          platformAfterMountPath: nextPathInfo.platformAfterMountPath,
        })
      }
      C.ignorePromise(f())
    },
    reloadKey: path,
  })
  return alreadyKnown ? knownPathInfo : pathInfo
}

export const useFsSoftError = (path: T.FS.Path): T.FS.SoftError | undefined => {
  const softErrors = useFsSoftErrors()
  return softErrors ? FS.getSoftError(softErrors, path) : undefined
}

export const useFsDownloadInfo = (downloadID: string): T.FS.DownloadInfo => {
  const routeData = React.useContext(FsDataContext)
  const info = routeData?.downloadInfos.get(downloadID) || FS.emptyDownloadInfo
  useFsLoadOnMountAndFocus({
    enabled: !!downloadID && !!routeData,
    load: () => routeData?.loadDownloadInfo(downloadID),
    reloadKey: downloadID,
  })
  return info
}

export const useFsDownloadIntent = (path: T.FS.Path): T.FS.DownloadIntent | undefined => {
  const routeData = React.useContext(FsDataContext)
  const downloadStates = useFSState(s => s.downloads.state)
  return routeData ? FS.getDownloadIntent(path, routeData.downloadInfos, downloadStates) : undefined
}

export const useFsDownloadStatus = () => {
  useFsNonPathSubscriptionEffect(T.RPCGen.SubscriptionTopic.downloadStatus)
  const {loadDownloadStatus} = useFSState(
    C.useShallow(s => ({
      loadDownloadStatus: s.dispatch.loadDownloadStatus,
    }))
  )
  useFsLoadOnMountAndFocus({
    load: loadDownloadStatus,
  })
}

export const useFsDownload = () => {
  const routeData = React.useContext(FsDataContext)
  return (
    path: T.FS.Path,
    type: DownloadStartType,
    onStarted?: (downloadID: string, downloadIntent?: T.FS.DownloadIntent) => void
  ) => {
    const f = async () => {
      await requestPermissionsToWrite()
      const downloadID = await T.RPCGen.SimpleFSSimpleFSStartDownloadRpcPromise({
        isRegularDownload: type === 'download',
        path: FS.pathToRPCPath(path).kbfs,
      })
      const downloadIntent = downloadIntentFromStartType(type)
      routeData?.recordDownloadStarted(downloadID, path, type)
      onStarted?.(downloadID, downloadIntent)
    }
    C.ignorePromise(f())
  }
}

export const useFsCancelDownload = () => {
  return (downloadID: string) => {
    const f = async () => {
      await T.RPCGen.SimpleFSSimpleFSCancelDownloadRpcPromise({downloadID})
    }
    C.ignorePromise(f())
  }
}

export const useFsDismissDownload = () => {
  return (downloadID: string) => {
    const f = async () => {
      await T.RPCGen.SimpleFSSimpleFSDismissDownloadRpcPromise({downloadID})
    }
    C.ignorePromise(f())
  }
}

export const useFsUpload = () => {
  const errorToActionOrThrow = useFsErrorActionOrThrow()
  return (parentPath: T.FS.Path, localPath: string) => {
    const f = async () => {
      try {
        await T.RPCGen.SimpleFSSimpleFSStartUploadRpcPromise({
          sourceLocalPath: T.FS.getNormalizedLocalPath(localPath),
          targetParentPath: FS.pathToRPCPath(parentPath).kbfs,
        })
      } catch (error) {
        errorToActionOrThrow(error, parentPath)
      }
    }
    C.ignorePromise(f())
  }
}

export const useFsDismissUpload = () => {
  return (uploadID: string) => {
    const f = async () => {
      try {
        await T.RPCGen.SimpleFSSimpleFSDismissUploadRpcPromise({uploadID})
      } catch {}
    }
    C.ignorePromise(f())
  }
}

export const useFsFileContext = (
  path: T.FS.Path
): {
  fileContext: T.FS.FileContext
  onUrlError: React.Dispatch<React.SetStateAction<string>>
  pathItem: T.FS.PathItem
} => {
  const pathItem = useFsPathItem(path)
  const errorToActionOrThrow = useFsErrorActionOrThrow()
  const [fileContext, setFileContext] = React.useState<T.FS.FileContext>(FS.emptyFileContext)
  const fileContextVersionRef = React.useRef(0)
  const [urlError, setUrlError] = React.useState('')
  React.useEffect(() => {
    fileContextVersionRef.current += 1
    if (pathItem.type !== T.FS.PathType.File) {
      setFileContext(FS.emptyFileContext)
    }
  }, [path, pathItem.type])
  useFsLoadOnMountAndFocus({
    enabled: pathItem.type === T.FS.PathType.File,
    load: () => {
      const version = ++fileContextVersionRef.current
      const f = async () => {
        try {
          urlError && logger.info(`urlError: ${urlError}`)
          const res = await T.RPCGen.SimpleFSSimpleFSGetGUIFileContextRpcPromise({
            path: FS.pathToRPCPath(path).kbfs,
          })
          if (fileContextVersionRef.current !== version) {
            return
          }
          setFileContext({
            contentType: res.contentType,
            url: res.url,
            viewType: res.viewType,
          })
        } catch (err) {
          if (fileContextVersionRef.current !== version) {
            return
          }
          errorToActionOrThrow(err)
        }
      }
      C.ignorePromise(f())
    },
    reloadKey: `${path}:${pathItem.type}:${pathItem.lastModifiedTimestamp}:${urlError}`,
  })
  return {
    fileContext,
    onUrlError: setUrlError,
    pathItem,
  }
}

export const useFsWatchDownloadForMobile = C.isMobile
  ? (downloadID: string, downloadIntent?: T.FS.DownloadIntent): boolean => {
      const dlInfo = useFsDownloadInfo(downloadID)
      const {fileContext} = useFsFileContext(dlInfo.path)
      const {redbar} = useFsRedbarActions()
      const errorToActionOrThrow = useFsErrorActionOrThrow()
      const dismissDownload = useFsDismissDownload()

      const dlState = useFSState(s => s.downloads.state.get(downloadID) || FS.emptyDownloadState)
      const finished = dlState !== FS.emptyDownloadState && !FS.downloadIsOngoing(dlState)
      const mimeType = fileContext.contentType

      const [justDoneWithIntent, setJustDoneWithIntent] = React.useState(false)
      const handledIntentKeyRef = React.useRef<string>('')

      React.useEffect(() => {
        setJustDoneWithIntent(false)
      }, [downloadID, downloadIntent])

      React.useEffect(() => {
        if (!downloadID || downloadIntent === undefined || !finished || !mimeType) {
          setJustDoneWithIntent(false)
          return
        }
        const handledIntentKey = `${downloadID}:${downloadIntent}`
        if (handledIntentKeyRef.current === handledIntentKey) {
          return
        }
        const f = async () => {
          if (downloadIntent === T.FS.DownloadIntent.None) {
            await finishedRegularDownloadInPlatform(downloadID, dlState, dlInfo, mimeType)
            handledIntentKeyRef.current = handledIntentKey
            return
          }
          if (dlState.error) {
            handledIntentKeyRef.current = handledIntentKey
            redbar(dlState.error)
            dismissDownload(downloadID)
            return
          }
          try {
            await finishedDownloadWithIntentInPlatform(dlState, downloadIntent, mimeType)
            handledIntentKeyRef.current = handledIntentKey
            dismissDownload(downloadID)
            setJustDoneWithIntent(true)
          } catch (err) {
            errorToActionOrThrow(err)
          }
        }
        C.ignorePromise(f())
      }, [
        dismissDownload,
        dlInfo,
        dlState,
        errorToActionOrThrow,
        finished,
        mimeType,
        downloadID,
        downloadIntent,
        redbar,
      ])
      return justDoneWithIntent
    }
  : () => false

export const useFuseClosedSourceConsent = (disabled: boolean, invert = false) => {
  const [agreed, setAgreed] = React.useState(false)

  const component = C.isDarwin ? (
    <Kb.Checkbox
      disabled={disabled}
      checked={agreed}
      onCheck={(v: boolean) => setAgreed(v)}
      checkboxStyle={invert ? {backgroundColor: Kb.Styles.globalColors.white} : undefined}
      checkboxColor={invert ? Kb.Styles.globalColors.black : undefined}
      labelComponent={
        <Kb.Text
          type="BodySmall"
          style={invert ? {color: Kb.Styles.globalColors.white} : undefined}
          onClick={() => setAgreed(a => !a)}
        >
          {`I understand that a closed-source kernel extension (FUSE for macOS) will be installed.`}
        </Kb.Text>
      }
    />
  ) : undefined

  return {
    canContinue: !C.isDarwin || agreed,
    component,
  }
}
