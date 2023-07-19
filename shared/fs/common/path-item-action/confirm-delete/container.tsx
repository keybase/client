import * as Constants from '../../../../constants/fs'
import * as React from 'react'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import type * as Types from '../../../../constants/types/fs'
import ReallyDelete from '.'

type OwnProps = {
  path: Types.Path
  mode: 'row' | 'screen'
}

export default (ownProps: OwnProps) => {
  const {path, mode} = ownProps
  const dispatch = Container.useDispatch()
  const onBack = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const deleteFile = Constants.useState(s => s.dispatch.deleteFile)
  const onDelete = React.useCallback(() => {
    if (path !== Constants.defaultPath) {
      deleteFile(path)
    }
    // If this is a screen menu, then we're deleting the folder we're in,
    // and we need to navigate up twice.
    if (mode === 'screen') {
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(RouteTreeGen.createNavigateUp())
    } else {
      dispatch(RouteTreeGen.createNavigateUp())
    }
  }, [deleteFile, dispatch, mode, path])
  const props = {
    onBack,
    onDelete,
    path,
    title: 'Confirmation',
  }
  return <ReallyDelete {...props} />
}
