import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import logger from '@/logger'
import * as FS from '@/stores/fs'
import {errorToActionOrThrow, useFSState} from '@/stores/fs'
import {
  finishedDownloadWithIntentMobile as finishedDownloadWithIntentInPlatform,
  finishedRegularDownloadMobile as finishedRegularDownloadInPlatform,
} from '@/stores/fs-platform'

const isPathItem = (path: T.FS.Path) => T.FS.getPathLevel(path) > 2 || FS.hasSpecialFileElement(path)

const useFsLoadOnMountAndFocus = ({
  enabled = true,
  load,
  reloadKey,
}: {
  enabled?: boolean
  load: () => void
  reloadKey?: unknown
}) => {
  const loadOnMountAndFocus = React.useEffectEvent(() => {
    enabled && load()
  })
  const [stableLoadOnMountAndFocus] = React.useState(() => () => {
    loadOnMountAndFocus()
  })
  React.useEffect(() => {
    enabled && loadOnMountAndFocus()
  }, [enabled, reloadKey])
  C.Router2.useSafeFocusEffect(stableLoadOnMountAndFocus)
}

const useFsPathSubscriptionEffect = (path: T.FS.Path, topic: T.RPCGen.PathSubscriptionTopic) => {
  const {subscribePath, unsubscribe} = useFSState(
    C.useShallow(s => ({
      subscribePath: s.dispatch.subscribePath,
      unsubscribe: s.dispatch.unsubscribe,
    }))
  )
  React.useEffect(() => {
    if (T.FS.getPathLevel(path) < 3) {
      return () => {}
    }

    const subscriptionID = FS.makeUUID()
    subscribePath(subscriptionID, path, topic)
    return () => unsubscribe(subscriptionID)
  }, [subscribePath, unsubscribe, path, topic])
}

const useFsNonPathSubscriptionEffect = (topic: T.RPCGen.SubscriptionTopic) => {
  const {subscribeNonPath, unsubscribe} = useFSState(
    C.useShallow(s => ({
      subscribeNonPath: s.dispatch.subscribeNonPath,
      unsubscribe: s.dispatch.unsubscribe,
    }))
  )
  React.useEffect(() => {
    const subscriptionID = FS.makeUUID()
    subscribeNonPath(subscriptionID, topic)
    return () => {
      unsubscribe(subscriptionID)
    }
  }, [subscribeNonPath, unsubscribe, topic])
}

export const useFsPathItem = (path: T.FS.Path) => {
  useFsPathSubscriptionEffect(path, T.RPCGen.PathSubscriptionTopic.stat)
  const pathItem = useFSState(s => FS.getPathItem(s.pathItems, path))
  const loadPathMetadata = useFSState(s => s.dispatch.loadPathMetadata)
  const shouldLoad = isPathItem(path)
  useFsLoadOnMountAndFocus({
    enabled: shouldLoad,
    load: () => loadPathMetadata(path),
    reloadKey: path,
  })
  return pathItem
}

export const useFsPathMetadata = (path: T.FS.Path) => useFsPathItem(path)

export const useFsFolderChildren = (
  path: T.FS.Path,
  options?: {
    initialLoadRecursive?: boolean
  }
) => {
  useFsPathSubscriptionEffect(path, T.RPCGen.PathSubscriptionTopic.children)
  const pathItem = useFSState(s => FS.getPathItem(s.pathItems, path))
  const folderListLoad = useFSState(s => s.dispatch.folderListLoad)
  const initialLoadRecursive = !!options?.initialLoadRecursive
  const shouldLoad = isPathItem(path)
  useFsLoadOnMountAndFocus({
    enabled: shouldLoad,
    load: () => folderListLoad(path, initialLoadRecursive),
    reloadKey: `${path}:${initialLoadRecursive ? 'recursive' : 'shallow'}`,
  })
  return pathItem
}

export const useFsChildren = (path: T.FS.Path, initialLoadRecursive?: boolean) =>
  useFsFolderChildren(path, {initialLoadRecursive})

export const useFsTlfs = () => {
  useFsNonPathSubscriptionEffect(T.RPCGen.SubscriptionTopic.favorites)
  const tlfs = useFSState(s => s.tlfs)
  const favoritesLoad = useFSState(s => s.dispatch.favoritesLoad)
  useFsLoadOnMountAndFocus({
    load: favoritesLoad,
  })
  return tlfs
}

export const useFsTlf = (path: T.FS.Path) => {
  const tlfPath = FS.getTlfPath(path)
  const tlfs = useFsTlfs()
  const tlf = useFSState(s => FS.getTlfFromPath(s.tlfs, path))
  const loadAdditionalTlf = useFSState(s => s.dispatch.loadAdditionalTlf)
  const active =
    !!tlfPath &&
    tlfs.loaded &&
    FS.getTlfFromPathInFavoritesOnly(tlfs, tlfPath) === FS.unknownTlf
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
  const getOnlineStatus = useFSState(s => s.dispatch.getOnlineStatus)
  useFsLoadOnMountAndFocus({
    load: getOnlineStatus,
  })
}

export const useFsPathInfo = (path: T.FS.Path, knownPathInfo = FS.emptyPathInfo): T.FS.PathInfo => {
  const pathInfo = useFSState(s => s.pathInfos.get(path) || FS.emptyPathInfo)
  const alreadyKnown = knownPathInfo !== FS.emptyPathInfo
  useFsLoadOnMountAndFocus({
    load: () => {
      if (alreadyKnown) {
        useFSState.getState().dispatch.loadedPathInfo(path, knownPathInfo)
      } else if (pathInfo === FS.emptyPathInfo) {
        // We only need to load if it's empty. This never changes once we have
        // it.
        useFSState.getState().dispatch.loadPathInfo(path)
      }
    },
    reloadKey: alreadyKnown ? knownPathInfo : `${path}:${pathInfo === FS.emptyPathInfo ? 'empty' : 'loaded'}`,
  })
  return alreadyKnown ? knownPathInfo : pathInfo
}

export const useFsSoftError = (path: T.FS.Path): T.FS.SoftError | undefined => {
  const softErrors = useFSState(s => s.softErrors)
  return FS.getSoftError(softErrors, path)
}

export const useFsDownloadInfo = (downloadID: string): T.FS.DownloadInfo => {
  const {info, loadDownloadInfo} = useFSState(
    C.useShallow(s => ({
      info: s.downloads.info.get(downloadID) || FS.emptyDownloadInfo,
      loadDownloadInfo: s.dispatch.loadDownloadInfo,
    }))
  )
  useFsLoadOnMountAndFocus({
    enabled: !!downloadID,
    load: () => loadDownloadInfo(downloadID),
    reloadKey: downloadID,
  })
  return info
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

export const useFsFileContext = (path: T.FS.Path) => {
  const pathItem = useFsPathItem(path)
  const {fileContext, loadFileContext} = useFSState(
    C.useShallow(s => ({
      fileContext: s.fileContext.get(path) || FS.emptyFileContext,
      loadFileContext: s.dispatch.loadFileContext,
    }))
  )
  const [urlError, setUrlError] = React.useState('')
  useFsLoadOnMountAndFocus({
    enabled: pathItem.type === T.FS.PathType.File,
    load: () => {
      urlError && logger.info(`urlError: ${urlError}`)
      loadFileContext(path)
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

      const {dismissDownload, dlState, redbar} = useFSState(
        C.useShallow(s => ({
          dismissDownload: s.dispatch.dismissDownload,
          dlState: s.downloads.state.get(downloadID) || FS.emptyDownloadState,
          redbar: s.dispatch.redbar,
        }))
      )
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
        redbar,
        finished,
        mimeType,
        downloadID,
        downloadIntent,
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
