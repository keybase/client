import {compose, namedConnect, lifecycle} from '../../util/container'
import * as I from 'immutable'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Header from './header'

type OwnProps = {
  path: Types.Path
  routePath: I.List<string>
}

const mapStateToProps = (state, {path}: OwnProps) => ({
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})

const mapDispatchToProps = dispatch => ({
  loadPathMetadata: (path: Types.Path) =>
    dispatch(FsGen.createLoadPathMetadata({path, refreshTag: Types.RefreshTag.Main})),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const mergeProps = (stateProps, dispatchProps, {path, routePath}: OwnProps) => ({
  loadPathMetadata: dispatchProps.loadPathMetadata,
  name: stateProps._pathItem.name,
  onBack: dispatchProps.onBack,
  path,
  routePath,
})

export default compose(
  namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'FilePreviewHeader'),
  lifecycle({
    componentDidMount() {
      this.props.loadPathMetadata(this.props.path)
    },
  } as any)
)(Header as any)
