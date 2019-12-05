import * as React from 'react'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Kb from '../../common-adapters'
import {isMobile} from '../../constants/platform'
import logger from '../../logger'

const isPathItem = (path: Types.Path) => Types.getPathLevel(path) > 2 || Constants.hasSpecialFileElement(path)
const noop = () => {}

export const useDispatchWhenConnected = () => {
  const kbfsDaemonConnected =
    Container.useSelector(state => state.fs.kbfsDaemonStatus.rpcStatus) ===
    Types.KbfsDaemonRpcStatus.Connected
  const dispatch = Container.useDispatch()
  return kbfsDaemonConnected ? dispatch : noop
}

const useFsPathSubscriptionEffect = (path: Types.Path, topic: RPCTypes.PathSubscriptionTopic) => {
  const dispatch = useDispatchWhenConnected()
  React.useEffect(() => {
    if (Types.getPathLevel(path) < 3) {
      return () => {}
    }

    const subscriptionID = Constants.makeUUID()
    dispatch(FsGen.createSubscribePath({path, subscriptionID, topic}))
    return () => dispatch(FsGen.createUnsubscribe({subscriptionID}))
  }, [dispatch, path, topic])
}

const useFsNonPathSubscriptionEffect = (topic: RPCTypes.SubscriptionTopic) => {
  const dispatch = useDispatchWhenConnected()
  React.useEffect(() => {
    const subscriptionID = Constants.makeUUID()
    dispatch(FsGen.createSubscribeNonPath({subscriptionID, topic}))
    return () => dispatch(FsGen.createUnsubscribe({subscriptionID}))
  }, [dispatch, topic])
}

export const useFsPathMetadata = (path: Types.Path) => {
  useFsPathSubscriptionEffect(path, RPCTypes.PathSubscriptionTopic.stat)
  const dispatch = useDispatchWhenConnected()
  React.useEffect(() => {
    isPathItem(path) && dispatch(FsGen.createLoadPathMetadata({path}))
  }, [dispatch, path])
}

export const useFsChildren = (path: Types.Path, initialLoadRecursive?: boolean) => {
  useFsPathSubscriptionEffect(path, RPCTypes.PathSubscriptionTopic.children)
  const dispatch = useDispatchWhenConnected()
  React.useEffect(() => {
    isPathItem(path) && dispatch(FsGen.createFolderListLoad({path, recursive: initialLoadRecursive || false}))
  }, [dispatch, path, initialLoadRecursive])
}

export const useFsTlfs = () => {
  useFsNonPathSubscriptionEffect(RPCTypes.SubscriptionTopic.favorites)
  const dispatch = useDispatchWhenConnected()
  React.useEffect(() => {
    dispatch(FsGen.createFavoritesLoad())
  }, [dispatch])
}

export const useFsTlf = (path: Types.Path) => {
  const tlfPath = Constants.getTlfPath(path)
  const tlfs = Container.useSelector(state => state.fs.tlfs)
  const dispatch = useDispatchWhenConnected()
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
  Kb.useInterval(() => dispatch(FsGen.createLoadAdditionalTlf({tlfPath})), active ? 10000 : undefined)
  // useInterval doesn't trigger at beginning, so call in an effect here.
  React.useEffect(() => {
    active && dispatch(FsGen.createLoadAdditionalTlf({tlfPath}))
  }, [active, dispatch, tlfPath])
}

export const useFsJournalStatus = () => {
  useFsNonPathSubscriptionEffect(RPCTypes.SubscriptionTopic.journalStatus)
  const dispatch = useDispatchWhenConnected()
  React.useEffect(() => {
    dispatch(FsGen.createPollJournalStatus())
  }, [dispatch])
}

export const useFsOnlineStatus = () => {
  useFsNonPathSubscriptionEffect(RPCTypes.SubscriptionTopic.onlineStatus)
  const dispatch = useDispatchWhenConnected()
  React.useEffect(() => {
    dispatch(FsGen.createGetOnlineStatus())
  }, [dispatch])
}

export const useFsPathInfo = (path: Types.Path, knownPathInfo: Types.PathInfo): Types.PathInfo => {
  const pathInfo = Container.useSelector(state => state.fs.pathInfos.get(path) || Constants.emptyPathInfo)
  const dispatch = useDispatchWhenConnected()
  const alreadyKnown = knownPathInfo !== Constants.emptyPathInfo
  React.useEffect(() => {
    if (alreadyKnown) {
      dispatch(FsGen.createLoadedPathInfo({path, pathInfo: knownPathInfo}))
    } else if (pathInfo === Constants.emptyPathInfo) {
      // We only need to load if it's empty. This never changes once we have
      // it.
      dispatch(FsGen.createLoadPathInfo({path}))
    }
  }, [path, alreadyKnown, knownPathInfo, pathInfo, dispatch])
  return alreadyKnown ? knownPathInfo : pathInfo
}

export const useFsSoftError = (path: Types.Path): Types.SoftError | null => {
  const softErrors = Container.useSelector(state => state.fs.softErrors)
  return Constants.getSoftError(softErrors, path)
}

export const useFsDownloadInfo = (downloadID: string): Types.DownloadInfo => {
  const info = Container.useSelector(
    state => state.fs.downloads.info.get(downloadID) || Constants.emptyDownloadInfo
  )
  const dispatch = useDispatchWhenConnected()
  React.useEffect(() => {
    // This never changes, so simply just load it once.
    downloadID && dispatch(FsGen.createLoadDownloadInfo({downloadID}))
  }, [downloadID, dispatch])
  return info
}

export const useFsDownloadStatus = () => {
  useFsNonPathSubscriptionEffect(RPCTypes.SubscriptionTopic.downloadStatus)
  const dispatch = useDispatchWhenConnected()
  React.useEffect(() => {
    dispatch(FsGen.createLoadDownloadStatus())
  }, [dispatch])
}

export const useFsFileContext = (path: Types.Path) => {
  const dispatch = useDispatchWhenConnected()
  const pathItem = Container.useSelector(state => Constants.getPathItem(state.fs.pathItems, path))
  const [urlError, setUrlError] = React.useState<string>('')
  React.useEffect(() => {
    urlError && logger.info(`urlError: ${urlError}`)
    pathItem.type === Types.PathType.File && dispatch(FsGen.createLoadFileContext({path}))
  }, [
    dispatch,
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

export const useFsWatchDownloadForMobileReturnTrueIfJustDoneWithIntent = isMobile
  ? (downloadID: string, downloadIntent: Types.DownloadIntent | null): boolean => {
      const dlState = Container.useSelector(
        state => state.fs.downloads.state.get(downloadID) || Constants.emptyDownloadState
      )
      const finished = dlState !== Constants.emptyDownloadState && !Constants.downloadIsOngoing(dlState)

      const dlInfo = useFsDownloadInfo(downloadID)
      useFsFileContext(dlInfo.path)
      const mimeType = Container.useSelector(
        state => state.fs.fileContext.get(dlInfo.path) || Constants.emptyFileContext
      ).contentType

      const [justDoneWithIntent, setJustDoneWithIntent] = React.useState(false)

      const dispatch = useDispatchWhenConnected()
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

export const useFsBadge = (): RPCTypes.FilesTabBadge => {
  useFsNonPathSubscriptionEffect(RPCTypes.SubscriptionTopic.filesTabBadge)
  const dispatch = useDispatchWhenConnected()
  React.useEffect(() => {
    dispatch(FsGen.createLoadFilesTabBadge())
  }, [dispatch])
  return Container.useSelector(state => state.fs.badge)
}
