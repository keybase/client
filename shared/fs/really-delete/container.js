// @flow
import * as FsGen from '../../actions/fs-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import ReallyDelete from '.'
import {anyWaiting} from '../../constants/waiting'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'

type OwnProps = Container.RouteProps<{path: Types.Path}, {}>

const mapStateToProps = state => ({
  _deleting: anyWaiting(state, Constants.deleteWaitingKey),
  title: 'Confirmation',
})

const mapDispatchToProps = (dispatch, ownProps) => {
  const path = Container.getRouteProps(ownProps, 'path')
  return {
    _onFinishDelete: () => dispatch(Constants.makeActionForOpenPathInFilesTab(Types.getPathParent(path))),
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
