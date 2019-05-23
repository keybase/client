// @flow
import * as React from 'react'
import {useSelector, useDispatch} from 'react-redux'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'

const useFsLoadEffect = ({
  wantChildren,
  path,
  wantPathMetadata,
  refreshTag,
}: {
  path: Types.Path,
  refreshTag: ?Types.RefreshTag,
  wantChildren?: boolean,
  wantPathMetadata?: boolean,
}) => {
  const syncingFoldersProgress = useSelector(state => state.fs.syncingFoldersProgress)
  const online = useSelector(state => state.fs.kbfsDaemonStatus.online)

  const dispatch = useDispatch()
  const loadPathMetadata = React.useCallback(
    refreshTag => dispatch(FsGen.createLoadPathMetadata({path, refreshTag})),
    [dispatch, path]
  )
  const loadChildren = React.useCallback(
    refreshTag => {
      Types.getPathLevel(path) > 2
        ? dispatch(FsGen.createFolderListLoad({path, refreshTag}))
        : dispatch(FsGen.createFavoritesLoad())
    },
    [dispatch, path]
  )

  React.useEffect(
    () => {
      online && wantPathMetadata && loadPathMetadata()
      online && wantChildren && loadChildren()
    },
    [wantChildren, loadChildren, loadPathMetadata, online, wantPathMetadata, syncingFoldersProgress]
  )
}

export default useFsLoadEffect
