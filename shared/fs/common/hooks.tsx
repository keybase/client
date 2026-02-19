import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import logger from '@/logger'
import * as FS from '@/stores/fs'
import {useFSState} from '@/stores/fs'

const isPathItem = (path: T.FS.Path) => T.FS.getPathLevel(path) > 2 || FS.hasSpecialFileElement(path)

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

export const useFsPathMetadata = (path: T.FS.Path) => {
  useFsPathSubscriptionEffect(path, T.RPCGen.PathSubscriptionTopic.stat)
  React.useEffect(() => {
    isPathItem(path) && useFSState.getState().dispatch.loadPathMetadata(path)
  }, [path])
}

export const useFsChildren = (path: T.FS.Path, initialLoadRecursive?: boolean) => {
  useFsPathSubscriptionEffect(path, T.RPCGen.PathSubscriptionTopic.children)
  const folderListLoad = useFSState(s => s.dispatch.folderListLoad)
  React.useEffect(() => {
    isPathItem(path) && folderListLoad(path, initialLoadRecursive || false)
  }, [folderListLoad, path, initialLoadRecursive])
}

export const useFsTlfs = () => {
  useFsNonPathSubscriptionEffect(T.RPCGen.SubscriptionTopic.favorites)
  const favoritesLoad = useFSState(s => s.dispatch.favoritesLoad)
  React.useEffect(() => {
    favoritesLoad()
  }, [favoritesLoad])
}

export const useFsTlf = (path: T.FS.Path) => {
  const tlfPath = FS.getTlfPath(path)
  const {tlfs, loadAdditionalTlf} = useFSState(
    C.useShallow(s => ({
      loadAdditionalTlf: s.dispatch.loadAdditionalTlf,
      tlfs: s.tlfs,
    }))
  )
  const active =
    // If we don't have a TLF path, we are not inside a TLF yet. So no need
    // to load.
    !!tlfPath &&
    // If favorites are not loaded, don't load anything yet -- what we need
    // might be available from favorites.
    tlfs.loaded &&
    // If TLF is part of favorites list, we already have notifications to
    // cover the refresh, so no need to load here. (To be clear,
    // notifications don't cover syncConfig, but we already load when user
    // toggles change.)
    FS.getTlfFromPathInFavoritesOnly(tlfs, tlfPath) === FS.unknownTlf
  // We need to load TLFs. We don't have notifications for this rpc yet, so
  // just poll on a 10s interval.
  Kb.useInterval(
    () => {
      loadAdditionalTlf(tlfPath)
    },
    active ? 10000 : undefined
  )
  // useInterval doesn't trigger at beginning, so call in an effect here.
  React.useEffect(() => {
    active && loadAdditionalTlf(tlfPath)
  }, [active, loadAdditionalTlf, tlfPath])
}

export const useFsOnlineStatus = () => {
  useFsNonPathSubscriptionEffect(T.RPCGen.SubscriptionTopic.onlineStatus)
  const getOnlineStatus = useFSState(s => s.dispatch.getOnlineStatus)
  React.useEffect(() => {
    getOnlineStatus()
  }, [getOnlineStatus])
}

export const useFsPathInfo = (path: T.FS.Path, knownPathInfo: T.FS.PathInfo): T.FS.PathInfo => {
  const pathInfo = useFSState(s => s.pathInfos.get(path) || FS.emptyPathInfo)
  const alreadyKnown = knownPathInfo !== FS.emptyPathInfo
  React.useEffect(() => {
    if (alreadyKnown) {
      useFSState.getState().dispatch.loadedPathInfo(path, knownPathInfo)
    } else if (pathInfo === FS.emptyPathInfo) {
      // We only need to load if it's empty. This never changes once we have
      // it.
      useFSState.getState().dispatch.loadPathInfo(path)
    }
  }, [path, alreadyKnown, knownPathInfo, pathInfo])
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
  React.useEffect(() => {
    // This never changes, so simply just load it once.
    downloadID && loadDownloadInfo(downloadID)
  }, [downloadID, loadDownloadInfo])
  return info
}

export const useFsDownloadStatus = () => {
  useFsNonPathSubscriptionEffect(T.RPCGen.SubscriptionTopic.downloadStatus)
  const {loadDownloadStatus} = useFSState(
    C.useShallow(s => ({
      loadDownloadStatus: s.dispatch.loadDownloadStatus,
    }))
  )
  React.useEffect(() => {
    loadDownloadStatus()
  }, [loadDownloadStatus])
}

export const useFsFileContext = (path: T.FS.Path) => {
  const {pathItem, loadFileContext} = useFSState(
    C.useShallow(s => ({
      loadFileContext: s.dispatch.loadFileContext,
      pathItem: FS.getPathItem(s.pathItems, path),
    }))
  )
  const [urlError, setUrlError] = React.useState<string>('')
  React.useEffect(() => {
    urlError && logger.info(`urlError: ${urlError}`)
    pathItem.type === T.FS.PathType.File && loadFileContext(path)
  }, [
    loadFileContext,
    path,
    // Intentionally depend on pathItem instead of only pathItem.type so we
    // load when timestamp changes.
    pathItem,
    // When url error happens it's possible that the URL of the item has
    // changed due to HTTP server restarting. So reload in case of that.
    urlError,
  ])
  return setUrlError
}

export const useFsWatchDownloadForMobile = C.isMobile
  ? (downloadID: string, downloadIntent?: T.FS.DownloadIntent): boolean => {
      const dlInfo = useFsDownloadInfo(downloadID)
      useFsFileContext(dlInfo.path)

      const {dlState, finishedDownloadWithIntentMobile, finishedRegularDownloadMobile} = useFSState(
        C.useShallow(s => ({
          dlState: s.downloads.state.get(downloadID) || FS.emptyDownloadState,
          finishedDownloadWithIntentMobile: s.dispatch.defer.finishedDownloadWithIntentMobile,
          finishedRegularDownloadMobile: s.dispatch.defer.finishedRegularDownloadMobile,
        }))
      )
      const finished = dlState !== FS.emptyDownloadState && !FS.downloadIsOngoing(dlState)
      const {mimeType} = useFSState(
        C.useShallow(s => ({
          mimeType: (s.fileContext.get(dlInfo.path) || FS.emptyFileContext).contentType,
        }))
      )

      const [justDoneWithIntent, setJustDoneWithIntent] = React.useState(false)

      React.useEffect(() => {
        if (!downloadID || !downloadIntent || !finished || !mimeType) {
          setJustDoneWithIntent(false)
          return
        }
        if (downloadIntent === T.FS.DownloadIntent.None) {
          finishedRegularDownloadMobile?.(downloadID, mimeType)
          return
        }
        finishedDownloadWithIntentMobile?.(downloadID, downloadIntent, mimeType)
        setJustDoneWithIntent(true)
      }, [
        finishedRegularDownloadMobile,
        finishedDownloadWithIntentMobile,
        finished,
        mimeType,
        downloadID,
        downloadIntent,
      ])
      return justDoneWithIntent
    }
  : () => false

export const useFuseClosedSourceConsent = (disabled: boolean, invert = false) => {
  const [agreed, setAgreed] = React.useState<boolean>(false)

  const component = React.useMemo(() => {
    return C.isDarwin ? (
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
  }, [disabled, agreed, invert])

  return {
    canContinue: !C.isDarwin || agreed,
    component,
  }
}
