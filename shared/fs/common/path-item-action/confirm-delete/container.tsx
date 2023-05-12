import * as Constants from '../../../../constants/fs'
import * as React from 'react'
import * as Container from '../../../../util/container'
import * as FsGen from '../../../../actions/fs-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import ReallyDelete from '.'

type OwnProps = Container.RouteProps2<'confirmDelete'>

export default (ownProps: OwnProps) => {
  const {params} = ownProps.route
  const path = params.path
  const mode = params.mode
  const dispatch = Container.useDispatch()
  const onBack = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const onDelete = React.useCallback(() => {
    if (path !== Constants.defaultPath) {
      dispatch(FsGen.createDeleteFile({path}))
    }
    // If this is a screen menu, then we're deleting the folder we're in,
    // and we need to navigate up twice.
    if (mode === 'screen') {
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(RouteTreeGen.createNavigateUp())
    } else {
      dispatch(RouteTreeGen.createNavigateUp())
    }
  }, [dispatch, mode, path])
  const props = {
    onBack,
    onDelete,
    path,
    title: 'Confirmation',
  }
  return <ReallyDelete {...props} />
}
