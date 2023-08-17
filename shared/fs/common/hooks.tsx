import * as C from '../../constants'
import * as Constants from '../../constants/fs'
import * as React from 'react'
import * as T from '../../constants/types'
import * as Kb from '../../common-adapters'
import {isMobile} from '../../constants/platform'
import logger from '../../logger'
import * as Platform from '../../constants/platform'
import type * as Styles from '../../styles'
import type {StylesTextCrossPlatform} from '../../common-adapters/text'

const isPathItem = (path: T.FS.Path) => T.FS.getPathLevel(path) > 2 || Constants.hasSpecialFileElement(path)

const useFsPathSubscriptionEffect = (path: T.FS.Path, topic: T.RPCGen.PathSubscriptionTopic) => {
  const subscribePath = C.useFSState(s => s.dispatch.subscribePath)
  const unsubscribe = C.useFSState(s => s.dispatch.unsubscribe)
  React.useEffect(() => {
    if (T.FS.getPathLevel(path) < 3) {
      return () => {}
    }

    const subscriptionID = Constants.makeUUID()
    subscribePath(subscriptionID, path, topic)
    return () => unsubscribe(subscriptionID)
  }, [subscribePath, unsubscribe, path, topic])
}

const useFsNonPathSubscriptionEffect = (topic: T.RPCGen.SubscriptionTopic) => {
  const subscribeNonPath = C.useFSState(s => s.dispatch.subscribeNonPath)
  const unsubscribe = C.useFSState(s => s.dispatch.unsubscribe)
  React.useEffect(() => {
    const subscriptionID = Constants.makeUUID()
    subscribeNonPath(subscriptionID, topic)
    return () => {
      unsubscribe(subscriptionID)
    }
  }, [subscribeNonPath, unsubscribe, topic])
}

export const useFsPathMetadata = (path: T.FS.Path) => {
  useFsPathSubscriptionEffect(path, T.RPCGen.PathSubscriptionTopic.stat)
  React.useEffect(() => {
    isPathItem(path) && C.useFSState.getState().dispatch.loadPathMetadata(path)
  }, [path])
}

export const useFsChildren = (path: T.FS.Path, initialLoadRecursive?: boolean) => {
  useFsPathSubscriptionEffect(path, T.RPCGen.PathSubscriptionTopic.children)
  const {folderListLoad} = C.useFSState.getState().dispatch
  React.useEffect(() => {
    isPathItem(path) && folderListLoad(path, initialLoadRecursive || false)
  }, [folderListLoad, path, initialLoadRecursive])
}

export const useFsTlfs = () => {
  useFsNonPathSubscriptionEffect(T.RPCGen.SubscriptionTopic.favorites)
  const favoritesLoad = C.useFSState(s => s.dispatch.favoritesLoad)
  React.useEffect(() => {
    favoritesLoad()
  }, [favoritesLoad])
}

export const useFsTlf = (path: T.FS.Path) => {
  const tlfPath = Constants.getTlfPath(path)
  const tlfs = C.useFSState(s => s.tlfs)
  const loadAdditionalTlf = C.useFSState(s => s.dispatch.loadAdditionalTlf)
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
    Constants.getTlfFromPathInFavoritesOnly(tlfs, tlfPath) === Constants.unknownTlf
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
  const getOnlineStatus = C.useFSState(s => s.dispatch.getOnlineStatus)
  React.useEffect(() => {
    getOnlineStatus()
  }, [getOnlineStatus])
}

export const useFsPathInfo = (path: T.FS.Path, knownPathInfo: T.FS.PathInfo): T.FS.PathInfo => {
  const pathInfo = C.useFSState(s => s.pathInfos.get(path) || Constants.emptyPathInfo)
  const alreadyKnown = knownPathInfo !== Constants.emptyPathInfo
  React.useEffect(() => {
    if (alreadyKnown) {
      C.useFSState.getState().dispatch.loadedPathInfo(path, knownPathInfo)
    } else if (pathInfo === Constants.emptyPathInfo) {
      // We only need to load if it's empty. This never changes once we have
      // it.
      C.useFSState.getState().dispatch.loadPathInfo(path)
    }
  }, [path, alreadyKnown, knownPathInfo, pathInfo])
  return alreadyKnown ? knownPathInfo : pathInfo
}

export const useFsSoftError = (path: T.FS.Path): T.FS.SoftError | undefined => {
  const softErrors = C.useFSState(s => s.softErrors)
  return Constants.getSoftError(softErrors, path)
}

export const useFsDownloadInfo = (downloadID: string): T.FS.DownloadInfo => {
  const info = C.useFSState(s => s.downloads.info.get(downloadID) || Constants.emptyDownloadInfo)
  const loadDownloadInfo = C.useFSState(s => s.dispatch.loadDownloadInfo)
  React.useEffect(() => {
    // This never changes, so simply just load it once.
    downloadID && loadDownloadInfo(downloadID)
  }, [downloadID, loadDownloadInfo])
  return info
}

export const useFsDownloadStatus = () => {
  useFsNonPathSubscriptionEffect(T.RPCGen.SubscriptionTopic.downloadStatus)
  const loadDownloadStatus = C.useFSState(s => s.dispatch.loadDownloadStatus)
  React.useEffect(() => {
    loadDownloadStatus()
  }, [loadDownloadStatus])
}

export const useFsFileContext = (path: T.FS.Path) => {
  const pathItem = C.useFSState(s => Constants.getPathItem(s.pathItems, path))
  const [urlError, setUrlError] = React.useState<string>('')
  const loadFileContext = C.useFSState(s => s.dispatch.loadFileContext)
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

export const useFsWatchDownloadForMobile = isMobile
  ? (downloadID: string, downloadIntent?: T.FS.DownloadIntent): boolean => {
      const dlState = C.useFSState(s => s.downloads.state.get(downloadID) || Constants.emptyDownloadState)
      const finished = dlState !== Constants.emptyDownloadState && !Constants.downloadIsOngoing(dlState)

      const dlInfo = useFsDownloadInfo(downloadID)
      useFsFileContext(dlInfo.path)

      const mimeType = C.useFSState(
        s => s.fileContext.get(dlInfo.path) || Constants.emptyFileContext
      ).contentType

      const [justDoneWithIntent, setJustDoneWithIntent] = React.useState(false)

      const finishedDownloadWithIntentMobile = C.useFSState(
        s => s.dispatch.dynamic.finishedDownloadWithIntentMobile
      )
      const finishedRegularDownloadMobile = C.useFSState(
        s => s.dispatch.dynamic.finishedRegularDownloadMobile
      )

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

export const useFuseClosedSourceConsent = (
  disabled: boolean,
  backgroundColor?: Styles.Color,
  textStyle?: StylesTextCrossPlatform
) => {
  const [agreed, setAgreed] = React.useState<boolean>(false)

  const component = React.useMemo(() => {
    return Platform.isDarwin ? (
      <Kb.Checkbox
        disabled={disabled}
        checked={agreed}
        boxBackgroundColor={backgroundColor}
        onCheck={(v: boolean) => setAgreed(v)}
        labelComponent={
          <Kb.Text type="BodySmall" style={textStyle} onClick={() => setAgreed(a => !a)}>
            {`I understand that a closed-source kernel extension (FUSE for macOS) will be installed.`}
          </Kb.Text>
        }
      />
    ) : undefined
  }, [disabled, agreed, backgroundColor, textStyle])

  return {
    canContinue: !Platform.isDarwin || agreed,
    component,
  }
}
