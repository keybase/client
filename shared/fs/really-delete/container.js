// @flow
import * as FsGen from '../../actions/fs-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import ReallyDelete from '.'
import {anyWaiting} from '../../constants/waiting'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'

type OwnProps = Container.RouteProps<
  {
    path: Types.Path,
    mode: 'row' | 'screen',
  },
  {}
>

const mapStateToProps = state => ({
  _deleting: anyWaiting(state, Constants.deleteWaitingKey),
  title: 'Confirmation',
})

const mapDispatchToProps = (dispatch, ownProps) => {
  const path = Container.getRouteProps(ownProps, 'path')
  const mode = Container.getRouteProps(ownProps, 'mode')
  return {
    _onFinishDelete: () => {
      // If this is a screen menu, then we're deleting the folder we're in,
      // and we need to navigate up twice.
      if (mode === 'screen') {
        dispatch(RouteTreeGen.createNavigateUp())
        dispatch(RouteTreeGen.createNavigateUp())
      } else {
        dispatch(RouteTreeGen.createNavigateUp())
      }
    },
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onDelete: () => {
      if (path !== Constants.defaultPath) {
        dispatch(FsGen.createDeleteFile({path}))
      }
    },
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const path = Container.getRouteProps(ownProps, 'path')
  return {
    _deleting: stateProps._deleting,
    _onFinishDelete: dispatchProps._onFinishDelete,
    onBack: stateProps._deleting ? () => {} : dispatchProps.onBack,
    onDelete: dispatchProps.onDelete,
    path: path,
    title: stateProps.title,
  }
}

export default Container.compose(
  Container.connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  Container.safeSubmit(['onDelete'], ['_deleting'])
)(ReallyDelete)
