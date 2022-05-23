import * as Constants from '../../../../constants/fs'
import * as Container from '../../../../util/container'
import * as FsGen from '../../../../actions/fs-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import ReallyDelete from '.'

type OwnProps = Container.RouteProps<'confirmDelete'>

export default Container.connect(
  () => ({}),
  (dispatch, ownProps: OwnProps) => {
    const {params} = ownProps.route
    const path = params?.path ?? null
    const mode = params?.mode ?? 'row'
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
    const path = ownProps.route.params?.path ?? null
    return {
      onBack: dispatchProps.onBack,
      onDelete: dispatchProps.onDelete,
      path: path,
      title: 'Confirmation',
    }
  }
)(ReallyDelete)
