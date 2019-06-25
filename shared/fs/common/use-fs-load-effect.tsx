// @flow
import * as React from 'react'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'

const useFsLoadEffect = ({
  path,
  refreshTag,
  wantChildren,
  wantPathMetadata,
  wantTlfs,
}: {
  path: Types.Path
  refreshTag?: Types.RefreshTag
  wantChildren?: boolean
  wantPathMetadata?: boolean
  wantTlfs?: boolean
}) => {
  const dispatch = Container.useDispatch()

  const isPathItem = Types.getPathLevel(path) > 2 || Constants.hasSpecialFileElement(path)

  const loadPathMetadata = React.useCallback(
    isPathItem ? refreshTag => dispatch(FsGen.createLoadPathMetadata({path, refreshTag})) : () => {},
    [dispatch, path, isPathItem]
  )
  const loadChildren = React.useCallback(
    isPathItem ? refreshTag => dispatch(FsGen.createFolderListLoad({path, refreshTag})) : () => {},
    [dispatch, path, isPathItem]
  )

  const tlfsLoaded = Container.useSelector(state => state.fs.tlfs.loaded)
  const loadTlfs = React.useCallback(() => !tlfsLoaded && dispatch(FsGen.createFavoritesLoad()), [
    dispatch,
    tlfsLoaded,
  ])

  const kbfsDaemonConnected =
    Container.useSelector(state => state.fs.kbfsDaemonStatus.rpcStatus) ===
    Types.KbfsDaemonRpcStatus.Connected
  const load = React.useCallback(
    (refreshTag?: Types.RefreshTag) => {
      kbfsDaemonConnected && wantPathMetadata && loadPathMetadata(refreshTag)
      kbfsDaemonConnected && wantChildren && loadChildren(refreshTag)
      kbfsDaemonConnected && wantTlfs && loadTlfs()
    },
    [kbfsDaemonConnected, wantChildren, wantPathMetadata, wantTlfs, loadPathMetadata, loadChildren, loadTlfs]
  )

  React.useEffect(() => load(refreshTag), [load, refreshTag])
}

export default useFsLoadEffect
