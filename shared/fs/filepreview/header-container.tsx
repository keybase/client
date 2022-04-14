import * as Container from '../../util/container'
import * as Constants from '../../constants/fs'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import type * as Types from '../../constants/types/fs'
import Header from './header'

type OwnProps = {path: Types.Path}

export default Container.connect(
  (state, {path}: OwnProps) => ({
    _pathItem: Constants.getPathItem(state.fs.pathItems, path),
  }),
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (stateProps, dispatchProps, {path}: OwnProps) => ({
    name: stateProps._pathItem.name,
    onBack: dispatchProps.onBack,
    path,
  })
)(Header)
