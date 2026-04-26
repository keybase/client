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
import isEqual from 'lodash/isEqual'
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

type FsSubscription = {
  count: number
  subscribed: boolean
  subscriptionID: string
  unsubscribeTimer?: ReturnType<typeof setTimeout>
}

type FsSubscriptionManager = {
  subscriptions: Map<string, FsSubscription>
}

type FsDataContextType = {
  downloadInfos: ReadonlyMap<string, T.FS.DownloadInfo>
  loadAdditionalTlf: (tlfPath: T.FS.Path) => void
  loadDownloadInfo: (downloadID: string) => void
  loadFolderChildren: (path: T.FS.Path, initialLoadRecursive: boolean) => void
  loadPathMetadata: (path: T.FS.Path) => void
  loadTlfs: () => void
  pathItems: T.FS.PathItems
  recordDownloadStarted: (downloadID: string, path: T.FS.Path, type: DownloadStartType) => void
  subscriptionManager: FsSubscriptionManager
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

type FsSharedData = {
  downloadInfos: ReadonlyMap<string, T.FS.DownloadInfo>
  pathItems: T.FS.PathItems
  tlfs: T.FS.Tlfs
}

const makeEmptyFsSharedData = (): FsSharedData => ({
  downloadInfos: new Map(),
  pathItems: new Map(),
  tlfs: makeEmptyTlfs(),
})

let fsSharedData = makeEmptyFsSharedData()
const fsSharedDataListeners = new Set<() => void>()
const sharedSubscriptionManager: FsSubscriptionManager = {subscriptions: new Map()}
const seenDownloadIDs = new Set<string>()
const loadingDownloadInfos = new Set<string>()
const loadingPathMetadata = new Set<T.FS.Path>()
const loadingFolderChildren = new Set<string>()
const loadingAdditionalTlfs = new Set<T.FS.Path>()
let fsSharedDataUsername = ''
let loadTlfsInProgress = false

const unsubscribeFsSubscription = (subscriptionID: string) => {
  C.ignorePromise(
    T.RPCGen.SimpleFSSimpleFSUnsubscribeRpcPromise({
      clientID: FS.clientID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
      subscriptionID,
    }).catch(() => {})
  )
}

const resetFsSubscriptionManager = (manager: FsSubscriptionManager) => {
  manager.subscriptions.forEach(subscription => {
    if (subscription.unsubscribeTimer) {
      clearTimeout(subscription.unsubscribeTimer)
      delete subscription.unsubscribeTimer
    }
    if (subscription.subscribed) {
      unsubscribeFsSubscription(subscription.subscriptionID)
    }
  })
  manager.subscriptions.clear()
}

const subscribeFsSharedData = (listener: () => void) => {
  fsSharedDataListeners.add(listener)
  return () => {
    fsSharedDataListeners.delete(listener)
  }
}

const getFsSharedDataSnapshot = () => fsSharedData

const setFsSharedData = (updater: (prevData: FsSharedData) => FsSharedData) => {
  const nextData = updater(fsSharedData)
  if (nextData === fsSharedData) {
    return
  }
  fsSharedData = nextData
  fsSharedDataListeners.forEach(listener => listener())
}

const setDownloadInfos = (
  updater: (
    prevDownloadInfos: ReadonlyMap<string, T.FS.DownloadInfo>
  ) => ReadonlyMap<string, T.FS.DownloadInfo>
) => {
  setFsSharedData(prevData => {
    const downloadInfos = updater(prevData.downloadInfos)
    return downloadInfos === prevData.downloadInfos ? prevData : {...prevData, downloadInfos}
  })
}

const setPathItems = (updater: (prevPathItems: T.FS.PathItems) => T.FS.PathItems) => {
  setFsSharedData(prevData => {
    const pathItems = updater(prevData.pathItems)
    return pathItems === prevData.pathItems ? prevData : {...prevData, pathItems}
  })
}

const setTlfs = (updater: (prevTlfs: T.FS.Tlfs) => T.FS.Tlfs) => {
  setFsSharedData(prevData => {
    const tlfs = updater(prevData.tlfs)
    return tlfs === prevData.tlfs ? prevData : {...prevData, tlfs}
  })
}

const resetFsSharedData = () => {
  fsSharedData = makeEmptyFsSharedData()
  resetFsSubscriptionManager(sharedSubscriptionManager)
  seenDownloadIDs.clear()
  loadingDownloadInfos.clear()
  loadingPathMetadata.clear()
  loadingFolderChildren.clear()
  loadingAdditionalTlfs.clear()
  loadTlfsInProgress = false
  fsSharedDataListeners.forEach(listener => listener())
}

export const FsDataProvider = ({children}: {children: React.ReactNode}) => {
  const username = useCurrentUserState(s => s.username)
  const errorToActionOrThrow = useFsErrorActionOrThrow()
  const {setPathSoftError, setTlfSoftError} = useFsSoftErrorActions()
  const activeDownloadIDs = useFSState(C.useShallow(s => [...s.downloads.state.keys()]))
  const {downloadInfos, pathItems, tlfs} = React.useSyncExternalStore(
    subscribeFsSharedData,
    getFsSharedDataSnapshot,
    getFsSharedDataSnapshot
  )
  const subscriptionManager = sharedSubscriptionManager

  React.useLayoutEffect(() => {
    if (!fsSharedDataUsername) {
      fsSharedDataUsername = username
      return
    }
    if (fsSharedDataUsername === username) {
      return
    }
    fsSharedDataUsername = username
    resetFsSharedData()
  }, [username])

  const loadDownloadInfo = (downloadID: string) => {
    if (loadingDownloadInfos.has(downloadID)) {
      return
    }
    loadingDownloadInfos.add(downloadID)
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
      } finally {
        loadingDownloadInfos.delete(downloadID)
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
    const activeDownloadIDSet = new Set(activeDownloadIDs)
    setDownloadInfos(prevDownloadInfos => {
      let nextDownloadInfos: Map<string, T.FS.DownloadInfo> | undefined
      prevDownloadInfos.forEach((_, downloadID) => {
        if (activeDownloadIDSet.has(downloadID) || !seenDownloadIDs.has(downloadID)) {
          return
        }
        nextDownloadInfos ??= new Map(prevDownloadInfos)
        nextDownloadInfos.delete(downloadID)
        seenDownloadIDs.delete(downloadID)
      })
      return nextDownloadInfos ?? prevDownloadInfos
    })
    activeDownloadIDs.forEach(downloadID => {
      seenDownloadIDs.add(downloadID)
    })
    activeDownloadIDs.forEach(loadMissingDownloadInfo)
  }, [activeDownloadIDs])

  const loadPathMetadata = (path: T.FS.Path) => {
    if (loadingPathMetadata.has(path)) {
      return
    }
    loadingPathMetadata.add(path)
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
        if (tlfPath) {
          setTlfSoftError(tlfPath)
        }
      } catch (error) {
        errorToActionOrThrow(error, path)
      } finally {
        loadingPathMetadata.delete(path)
      }
    }
    C.ignorePromise(f())
  }

  const loadFolderChildren = (rootPath: T.FS.Path, initialLoadRecursive: boolean) => {
    const loadKey = `${rootPath}:${initialLoadRecursive ? 'recursive' : 'shallow'}`
    if (loadingFolderChildren.has(loadKey)) {
      return
    }
    loadingFolderChildren.add(loadKey)
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
      } finally {
        loadingFolderChildren.delete(loadKey)
      }
    }
    C.ignorePromise(f())
  }

  const loadTlfs = () => {
    if (loadTlfsInProgress) {
      return
    }
    loadTlfsInProgress = true
    const f = async () => {
      try {
        const results = await T.RPCGen.SimpleFSSimpleFSListFavoritesRpcPromise()
        setTlfs(prevTlfs => {
          const nextTlfs = favoritesResultToTlfs(results, username, prevTlfs.additionalTlfs)
          return isEqual(nextTlfs, prevTlfs) ? prevTlfs : nextTlfs
        })
      } catch (error) {
        errorToActionOrThrow(error)
      } finally {
        loadTlfsInProgress = false
      }
    }
    C.ignorePromise(f())
  }

  const loadAdditionalTlf = (tlfPath: T.FS.Path) => {
    if (loadingAdditionalTlfs.has(tlfPath)) {
      return
    }
    loadingAdditionalTlfs.add(tlfPath)
    const f = async () => {
      if (T.FS.getPathLevel(tlfPath) !== 3) {
        logger.warn('loadAdditionalTlf called on non-TLF path')
        loadingAdditionalTlfs.delete(tlfPath)
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
      } finally {
        loadingAdditionalTlfs.delete(tlfPath)
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
        subscriptionManager,
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
  const lastLoadRef = React.useRef<{reloadKey?: unknown; time: number}>({time: 0})
  const loadOnMountAndFocus = React.useEffectEvent(() => {
    if (!connected || !enabled) {
      return
    }
    const now = Date.now()
    const lastLoad = lastLoadRef.current
    if (Object.is(lastLoad.reloadKey, reloadKey) && now - lastLoad.time < 250) {
      return
    }
    lastLoadRef.current = {reloadKey, time: now}
    load()
  })
  const [stableLoadOnMountAndFocus] = React.useState(() => () => {
    loadOnMountAndFocus()
  })
  React.useEffect(() => {
    if (connected && enabled) {
      loadOnMountAndFocus()
    }
  }, [connected, enabled, reloadKey])
  C.Router2.useSafeFocusEffect(stableLoadOnMountAndFocus)
}

const subscriptionUnsubscribeDelayMs = 1000

const cancelScheduledSubscriptionUnsubscribe = (subscription: FsSubscription) => {
  if (!subscription.unsubscribeTimer) {
    return
  }
  clearTimeout(subscription.unsubscribeTimer)
  delete subscription.unsubscribeTimer
}

const scheduleFsSubscriptionUnsubscribeIfUnused = (
  manager: FsSubscriptionManager,
  subscriptionKey: string,
  subscription: FsSubscription
) => {
  if (subscription.count > 0 || subscription.unsubscribeTimer) {
    return
  }
  if (!subscription.subscribed) {
    return
  }
  subscription.unsubscribeTimer = setTimeout(() => {
    const currentSubscription = manager.subscriptions.get(subscriptionKey)
    if (
      currentSubscription !== subscription ||
      currentSubscription.count > 0 ||
      !currentSubscription.subscribed
    ) {
      return
    }
    manager.subscriptions.delete(subscriptionKey)
    unsubscribeFsSubscription(subscription.subscriptionID)
  }, subscriptionUnsubscribeDelayMs)
}

const releaseFsSubscription = (
  manager: FsSubscriptionManager,
  subscriptionKey: string,
  subscription: FsSubscription
) => {
  subscription.count--
  scheduleFsSubscriptionUnsubscribeIfUnused(manager, subscriptionKey, subscription)
}

const useFsSubscriptionEffect = ({
  enabled = true,
  errorPath,
  subscribe,
  subscriptionKey,
}: {
  enabled?: boolean
  errorPath?: T.FS.Path
  subscribe: (subscriptionID: string) => Promise<unknown>
  subscriptionKey: string
}) => {
  const connected = useFSState(s => s.kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected)
  const routeData = React.useContext(FsDataContext)
  const username = useCurrentUserState(s => s.username)
  const subscriptionManager = routeData?.subscriptionManager
  const errorToActionOrThrow = useFsErrorActionOrThrow()
  const onError = React.useEffectEvent((error: unknown) => {
    errorToActionOrThrow(error, errorPath)
  })
  const subscribeEvent = React.useEffectEvent(subscribe)
  React.useEffect(() => {
    if (!connected || !enabled) {
      return
    }

    const manager = subscriptionManager
    if (manager) {
      const existingSubscription = manager.subscriptions.get(subscriptionKey)
      if (existingSubscription) {
        cancelScheduledSubscriptionUnsubscribe(existingSubscription)
        existingSubscription.count++
        return () => {
          const currentSubscription = manager.subscriptions.get(subscriptionKey)
          if (currentSubscription !== existingSubscription) {
            return
          }
          releaseFsSubscription(manager, subscriptionKey, currentSubscription)
        }
      }
    }

    const subscriptionID = FS.makeUUID()
    const subscription = {count: 1, subscribed: false, subscriptionID}
    manager?.subscriptions.set(subscriptionKey, subscription)
    const removeSubscription = () => {
      if (manager?.subscriptions.get(subscriptionKey) === subscription) {
        manager.subscriptions.delete(subscriptionKey)
      }
    }
    const f = async () => {
      try {
        const subscribed = await subscribeEvent(subscriptionID)
        if (subscribed === false) {
          removeSubscription()
          return
        }
        subscription.subscribed = true
        if (!manager) {
          if (subscription.count === 0) {
            unsubscribeFsSubscription(subscriptionID)
          }
          return
        }
        if (manager.subscriptions.get(subscriptionKey) !== subscription) {
          unsubscribeFsSubscription(subscriptionID)
          return
        }
        scheduleFsSubscriptionUnsubscribeIfUnused(manager, subscriptionKey, subscription)
      } catch (error) {
        removeSubscription()
        onError(error)
      }
    }
    C.ignorePromise(f())
    return () => {
      if (!manager) {
        subscription.count--
        if (subscription.subscribed) {
          unsubscribeFsSubscription(subscriptionID)
        }
        return
      }
      const currentSubscription = manager.subscriptions.get(subscriptionKey)
      if (currentSubscription !== subscription) {
        return
      }
      releaseFsSubscription(manager, subscriptionKey, currentSubscription)
    }
  }, [connected, enabled, errorPath, subscriptionKey, subscriptionManager, username])
}

const useFsPathSubscriptionEffect = (
  path: T.FS.Path,
  topic: T.RPCGen.PathSubscriptionTopic,
  enabled = true
) => {
  const pathString = T.FS.pathToString(path)
  useFsSubscriptionEffect({
    enabled: enabled && T.FS.getPathLevel(path) >= 3,
    errorPath: path,
    subscribe: async subscriptionID => {
      try {
        await T.RPCGen.SimpleFSSimpleFSSubscribePathRpcPromise({
          clientID: FS.clientID,
          deduplicateIntervalSecond: 1,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
          kbfsPath: pathString,
          subscriptionID,
          topic,
        })
        return true
      } catch (error) {
        if (!(error instanceof RPCError)) {
          throw error
        }
        if (error.code !== T.RPCGen.StatusCode.scteamcontactsettingsblock) {
          throw error
        }
        return false
      }
    },
    subscriptionKey: `path:${pathString}:${topic}`,
  })
}

type FsPathItemOptions = {
  loadOnMount?: boolean
  subscribe?: boolean
}

const useFsNonPathSubscriptionEffect = (topic: T.RPCGen.SubscriptionTopic, enabled = true) => {
  useFsSubscriptionEffect({
    enabled,
    subscribe: async subscriptionID => {
      await T.RPCGen.SimpleFSSimpleFSSubscribeNonPathRpcPromise({
        clientID: FS.clientID,
        deduplicateIntervalSecond: 1,
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
        subscriptionID,
        topic,
      })
    },
    subscriptionKey: `nonpath:${topic}`,
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

export const useFsPathItem = (path: T.FS.Path, options?: FsPathItemOptions) => {
  const routeData = React.useContext(FsDataContext)
  const pathItems = useLoadedPathItems()
  const shouldSubscribe = options?.subscribe ?? (options?.loadOnMount !== false)
  useFsPathSubscriptionEffect(path, T.RPCGen.PathSubscriptionTopic.stat, shouldSubscribe)
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

export const useFsPathMetadata = (path: T.FS.Path, options?: FsPathItemOptions) =>
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
  const loadTlfs = routeData?.loadTlfs
  useFsNonPathSubscriptionEffect(T.RPCGen.SubscriptionTopic.favorites, !!loadTlfs)
  const tlfs = useLoadedTlfs()
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
  const tlfPathToLoad =
    tlfPath &&
    tlfs.loaded &&
    FS.getTlfFromPathInFavoritesOnly(tlfs, tlfPath) === FS.unknownTlf &&
    options?.loadOnMount !== false
      ? tlfPath
      : undefined
  const active = !!loadAdditionalTlf && !!tlfPathToLoad
  const loadCurrentTlf = React.useEffectEvent(() => {
    if (loadAdditionalTlf && tlfPathToLoad) {
      loadAdditionalTlf(tlfPathToLoad)
    }
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
  }, [active, loadAdditionalTlf, tlfPathToLoad])
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
  const pathInfoVersionRef = React.useRef(0)
  const [pathInfoState, setPathInfoState] = React.useState<{
    path: T.FS.Path
    pathInfo: T.FS.PathInfo
  }>(() => ({path, pathInfo: alreadyKnown ? knownPathInfo : FS.emptyPathInfo}))
  React.useEffect(() => {
    if (alreadyKnown) {
      pathInfoVersionRef.current += 1
    }
  }, [alreadyKnown, knownPathInfo, path])
  useFsLoadOnMountAndFocus({
    enabled: !alreadyKnown,
    load: () => {
      const version = ++pathInfoVersionRef.current
      const requestPath = path
      const f = async () => {
        const nextPathInfo = await T.RPCGen.kbfsMountGetKBFSPathInfoRpcPromise({
          standardPath: T.FS.pathToString(requestPath),
        })
        if (pathInfoVersionRef.current !== version) {
          return
        }
        setPathInfoState({
          path: requestPath,
          pathInfo: {
            deeplinkPath: nextPathInfo.deeplinkPath,
            platformAfterMountPath: nextPathInfo.platformAfterMountPath,
          },
        })
      }
      C.ignorePromise(f())
    },
    reloadKey: path,
  })
  return alreadyKnown
    ? knownPathInfo
    : pathInfoState.path === path
      ? pathInfoState.pathInfo
      : FS.emptyPathInfo
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
  const fileContextVersionRef = React.useRef(0)
  const [urlError, setUrlError] = React.useState('')
  const reloadKey = `${path}:${pathItem.type}:${pathItem.lastModifiedTimestamp}:${urlError}`
  const [fileContextState, setFileContextState] = React.useState<{
    fileContext: T.FS.FileContext
    reloadKey: string
  }>(() => ({fileContext: FS.emptyFileContext, reloadKey}))
  const fileContext =
    fileContextState.reloadKey === reloadKey ? fileContextState.fileContext : FS.emptyFileContext
  React.useEffect(() => {
    if (pathItem.type !== T.FS.PathType.File) {
      fileContextVersionRef.current += 1
    }
  }, [pathItem.type, reloadKey])
  useFsLoadOnMountAndFocus({
    enabled: pathItem.type === T.FS.PathType.File,
    load: () => {
      const version = ++fileContextVersionRef.current
      const requestReloadKey = reloadKey
      const f = async () => {
        try {
          if (urlError) {
            logger.info(`urlError: ${urlError}`)
          }
          const res = await T.RPCGen.SimpleFSSimpleFSGetGUIFileContextRpcPromise({
            path: FS.pathToRPCPath(path).kbfs,
          })
          if (fileContextVersionRef.current !== version) {
            return
          }
          setFileContextState({
            fileContext: {
              contentType: res.contentType,
              url: res.url,
              viewType: res.viewType,
            },
            reloadKey: requestReloadKey,
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
    reloadKey,
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
