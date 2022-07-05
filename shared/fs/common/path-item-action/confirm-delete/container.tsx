import * as FsGen from '../../../../actions/fs-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Container from '../../../../util/container'
import ReallyDelete from '.'
import * as Types from '../../../../constants/types/fs'
import * as Constants from '../../../../constants/fs'

type OwnProps = Container.RouteProps<{path: Types.Path; mode: 'row' | 'screen'}>

export default Container.namedConnect(
  () => ({}),
  (dispatch, ownProps: OwnProps) => {
    const path = Container.getRouteProps(ownProps, 'path', null)
    const mode = Container.getRouteProps(ownProps, 'mode', 'row')
    return {
      onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
      onDelete: () => {
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
      },
    }
  },
  (_, dispatchProps, ownProps: OwnProps) => {
    const path = Container.getRouteProps(ownProps, 'path', null)
    return {
      onBack: dispatchProps.onBack,
      onDelete: dispatchProps.onDelete,
      path: path,
      title: 'Confirmation',
    }
  },
  'ReallyDelete'
)(ReallyDelete)
