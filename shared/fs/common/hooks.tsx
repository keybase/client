import * as React from 'react'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {isMobile} from '../../constants/platform'
import uuidv1 from 'uuid/v1'
import flags from '../../util/feature-flags'

const isPathItem = (path: Types.Path) => Types.getPathLevel(path) > 2 || Constants.hasSpecialFileElement(path)
const noop = () => {}

export const useDispatchWhenConnected = () => {
  const kbfsDaemonConnected =
    Container.useSelector(state => state.fs.kbfsDaemonStatus.rpcStatus) ===
    Types.KbfsDaemonRpcStatus.Connected
  const dispatch = Container.useDispatch()
  return kbfsDaemonConnected ? dispatch : noop
}

const useDispatchWhenConnectedAndOnline = flags.kbfsOfflineMode
  ? () => {
      const kbfsDaemonStatus = Container.useSelector(state => state.fs.kbfsDaemonStatus)
      const dispatch = Container.useDispatch()
      return kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected &&
        kbfsDaemonStatus.onlineStatus === Types.KbfsDaemonOnlineStatus.Online
        ? dispatch
        : noop
    }
  : useDispatchWhenConnected

const useFsPathSubscriptionEffect = (path: Types.Path, topic: RPCTypes.PathSubscriptionTopic) => {
  const dispatch = useDispatchWhenConnected()
  React.useEffect(() => {
    if (Types.getPathLevel(path) < 3) {
      return () => {}
    }

    const subscriptionID = uuidv1()
    dispatch(FsGen.createSubscribePath({path, subscriptionID, topic}))
    return () => dispatch(FsGen.createUnsubscribe({subscriptionID}))
  }, [dispatch, path, topic])
}

const useFsNonPathSubscriptionEffect = (topic: RPCTypes.SubscriptionTopic) => {
  const dispatch = useDispatchWhenConnected()
  React.useEffect(() => {
    const subscriptionID = uuidv1()
    dispatch(FsGen.createSubscribeNonPath({subscriptionID, topic}))
    return () => dispatch(FsGen.createUnsubscribe({subscriptionID}))
  }, [dispatch, topic])
}

export const useFsPathMetadata = (path: Types.Path) => {
  useFsPathSubscriptionEffect(path, RPCTypes.PathSubscriptionTopic.stat)
  const dispatch = useDispatchWhenConnectedAndOnline()
  React.useEffect(() => {
    isPathItem(path) && dispatch(FsGen.createLoadPathMetadata({path}))
  }, [dispatch, path])
}

export const useFsChildren = (path: Types.Path) => {
  useFsPathSubscriptionEffect(path, RPCTypes.PathSubscriptionTopic.children)
  const dispatch = useDispatchWhenConnectedAndOnline()
  React.useEffect(() => {
    isPathItem(path) && dispatch(FsGen.createFolderListLoad({path}))
  }, [dispatch, path])
}

export const useFsTlfs = () => {
  useFsNonPathSubscriptionEffect(RPCTypes.SubscriptionTopic.favorites)
  const dispatch = useDispatchWhenConnected()
  React.useEffect(() => {
    dispatch(FsGen.createFavoritesLoad())
  }, [dispatch])
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
  const pathInfo = Container.useSelector(state => state.fs.pathInfos.get(path, Constants.emptyPathInfo))
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
  const info = Container.useSelector(state =>
    state.fs.downloads.info.get(downloadID, Constants.emptyDownloadInfo)
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
  const pathItem = Container.useSelector(state => state.fs.pathItems.get(path, Constants.unknownPathItem))
  React.useEffect(() => {
    pathItem.type === Types.PathType.File && dispatch(FsGen.createLoadFileContext({path}))
  }, [
    dispatch,
    path,
    // Intentionally depend on pathItem instead of only pathItem.type so we
    // load when timestamp changes.
    pathItem,
  ])
}

export const useFsWatchDownloadForMobile = isMobile
  ? (downloadID: string, downloadIntent: Types.DownloadIntent | null) => {
      const dlState = Container.useSelector(state =>
        state.fs.downloads.state.get(downloadID, Constants.emptyDownloadState)
      )
      const finished = dlState !== Constants.emptyDownloadState && !Constants.downloadIsOngoing(dlState)

      const dlInfo = useFsDownloadInfo(downloadID)
      useFsFileContext(dlInfo.path)
      const mimeType = Container.useSelector(state =>
        state.fs.fileContext.get(dlInfo.path, Constants.emptyFileContext)
      ).contentType

      const dispatch = useDispatchWhenConnected()
      React.useEffect(() => {
        if (!downloadID || !downloadIntent || !finished || !mimeType) {
          return
        }
        downloadIntent === Types.DownloadIntent.None
          ? dispatch(FsGen.createFinishedRegularDownload({downloadID, mimeType}))
          : dispatch(FsGen.createFinishedDownloadWithIntent({downloadID, downloadIntent, mimeType}))
      }, [finished, mimeType, downloadID, downloadIntent, dispatch])
    }
  : () => {}
