import * as React from 'react'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Kb from '../../common-adapters'
import {isMobile} from '../../constants/platform'
import logger from '../../logger'
import * as Platform from '../../constants/platform'
import type * as Styles from '../../styles'
import type {StylesTextCrossPlatform} from '../../common-adapters/text'

const isPathItem = (path: Types.Path) => Types.getPathLevel(path) > 2 || Constants.hasSpecialFileElement(path)

const useFsPathSubscriptionEffect = (path: Types.Path, topic: RPCTypes.PathSubscriptionTopic) => {
  const subscribePath = Constants.useState(s => s.dispatch.subscribePath)
  const unsubscribe = Constants.useState(s => s.dispatch.unsubscribe)
  React.useEffect(() => {
    if (Types.getPathLevel(path) < 3) {
      return () => {}
    }

    const subscriptionID = Constants.makeUUID()
    subscribePath(subscriptionID, path, topic)
    return () => unsubscribe(subscriptionID)
  }, [subscribePath, unsubscribe, path, topic])
}

const useFsNonPathSubscriptionEffect = (topic: RPCTypes.SubscriptionTopic) => {
  const subscribeNonPath = Constants.useState(s => s.dispatch.subscribeNonPath)
  const unsubscribe = Constants.useState(s => s.dispatch.unsubscribe)
  React.useEffect(() => {
    const subscriptionID = Constants.makeUUID()
    subscribeNonPath(subscriptionID, topic)
    return () => {
      unsubscribe(subscriptionID)
    }
  }, [subscribeNonPath, unsubscribe, topic])
}

export const useFsPathMetadata = (path: Types.Path) => {
  useFsPathSubscriptionEffect(path, RPCTypes.PathSubscriptionTopic.stat)
  React.useEffect(() => {
    isPathItem(path) && Constants.useState.getState().dispatch.loadPathMetadata(path)
  }, [path])
}

export const useFsChildren = (path: Types.Path, initialLoadRecursive?: boolean) => {
  useFsPathSubscriptionEffect(path, RPCTypes.PathSubscriptionTopic.children)
  const {folderListLoad} = Constants.useState.getState().dispatch
  React.useEffect(() => {
    isPathItem(path) && folderListLoad(path, initialLoadRecursive || false)
  }, [folderListLoad, path, initialLoadRecursive])
}

export const useFsTlfs = () => {
  useFsNonPathSubscriptionEffect(RPCTypes.SubscriptionTopic.favorites)
  const favoritesLoad = Constants.useState(s => s.dispatch.favoritesLoad)
  React.useEffect(() => {
    favoritesLoad()
  }, [favoritesLoad])
}

export const useFsTlf = (path: Types.Path) => {
  const tlfPath = Constants.getTlfPath(path)
  const tlfs = Constants.useState(s => s.tlfs)
  const loadAdditionalTlf = Constants.useState(s => s.dispatch.loadAdditionalTlf)
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
  useFsNonPathSubscriptionEffect(RPCTypes.SubscriptionTopic.onlineStatus)
  const getOnlineStatus = Constants.useState(s => s.dispatch.getOnlineStatus)
  React.useEffect(() => {
    getOnlineStatus()
  }, [getOnlineStatus])
}

export const useFsPathInfo = (path: Types.Path, knownPathInfo: Types.PathInfo): Types.PathInfo => {
  const pathInfo = Constants.useState(s => s.pathInfos.get(path) || Constants.emptyPathInfo)
  const alreadyKnown = knownPathInfo !== Constants.emptyPathInfo
  React.useEffect(() => {
    if (alreadyKnown) {
      Constants.useState.getState().dispatch.loadedPathInfo(path, knownPathInfo)
    } else if (pathInfo === Constants.emptyPathInfo) {
      // We only need to load if it's empty. This never changes once we have
      // it.
      Constants.useState.getState().dispatch.loadPathInfo(path)
    }
  }, [path, alreadyKnown, knownPathInfo, pathInfo])
  return alreadyKnown ? knownPathInfo : pathInfo
}

export const useFsSoftError = (path: Types.Path): Types.SoftError | undefined => {
  const softErrors = Constants.useState(s => s.softErrors)
  return Constants.getSoftError(softErrors, path)
}

export const useFsDownloadInfo = (downloadID: string): Types.DownloadInfo => {
  const info = Constants.useState(s => s.downloads.info.get(downloadID) || Constants.emptyDownloadInfo)
  const loadDownloadInfo = Constants.useState(s => s.dispatch.loadDownloadInfo)
  React.useEffect(() => {
    // This never changes, so simply just load it once.
    downloadID && loadDownloadInfo(downloadID)
  }, [downloadID, loadDownloadInfo])
  return info
}

export const useFsDownloadStatus = () => {
  useFsNonPathSubscriptionEffect(RPCTypes.SubscriptionTopic.downloadStatus)
  const loadDownloadStatus = Constants.useState(s => s.dispatch.loadDownloadStatus)
  React.useEffect(() => {
    loadDownloadStatus()
  }, [loadDownloadStatus])
}

export const useFsFileContext = (path: Types.Path) => {
  const pathItem = Constants.useState(s => Constants.getPathItem(s.pathItems, path))
  const [urlError, setUrlError] = React.useState<string>('')
  const loadFileContext = Constants.useState(s => s.dispatch.loadFileContext)
  React.useEffect(() => {
    urlError && logger.info(`urlError: ${urlError}`)
    pathItem.type === Types.PathType.File && loadFileContext(path)
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
  ? (downloadID: string, downloadIntent?: Types.DownloadIntent): boolean => {
      const dlState = Constants.useState(
        s => s.downloads.state.get(downloadID) || Constants.emptyDownloadState
      )
      const finished = dlState !== Constants.emptyDownloadState && !Constants.downloadIsOngoing(dlState)

      const dlInfo = useFsDownloadInfo(downloadID)
      useFsFileContext(dlInfo.path)

      const mimeType = Constants.useState(
        s => s.fileContext.get(dlInfo.path) || Constants.emptyFileContext
      ).contentType

      const [justDoneWithIntent, setJustDoneWithIntent] = React.useState(false)

      const dispatch = Container.useDispatch()
      React.useEffect(() => {
        if (!downloadID || !downloadIntent || !finished || !mimeType) {
          setJustDoneWithIntent(false)
          return
        }
        if (downloadIntent === Types.DownloadIntent.None) {
          dispatch(FsGen.createFinishedRegularDownload({downloadID, mimeType}))
          return
        }
        dispatch(FsGen.createFinishedDownloadWithIntent({downloadID, downloadIntent, mimeType}))
        setJustDoneWithIntent(true)
      }, [finished, mimeType, downloadID, downloadIntent, dispatch])
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
