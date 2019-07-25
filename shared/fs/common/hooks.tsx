import * as React from 'react'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import uuidv1 from 'uuid/v1'

const isPathItem = (path: Types.Path) => Types.getPathLevel(path) > 2 || Constants.hasSpecialFileElement(path)

const useDispatchWhenConnected = () => {
  const kbfsDaemonConnected =
    Container.useSelector(state => state.fs.kbfsDaemonStatus.rpcStatus) ===
    Types.KbfsDaemonRpcStatus.Connected
  const dispatch = Container.useDispatch()
  return kbfsDaemonConnected ? dispatch : () => {}
}

const useFsPathSubscriptionEffect = (path: Types.Path, topic: RPCTypes.PathSubscriptionTopic) => {
  const dispatch = useDispatchWhenConnected()
  React.useEffect(() => {
    if (!isPathItem(path)) {
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
  const dispatch = useDispatchWhenConnected()
  React.useEffect(() => {
    isPathItem(path) && dispatch(FsGen.createLoadPathMetadata({path}))
  }, [dispatch, path])
}

export const useFsChildren = (path: Types.Path) => {
  useFsPathSubscriptionEffect(path, RPCTypes.PathSubscriptionTopic.children)
  const dispatch = useDispatchWhenConnected()
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

export const useFsJournalStatus = () =>
  useFsNonPathSubscriptionEffect(RPCTypes.SubscriptionTopic.journalStatus)
