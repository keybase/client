// @flow
import {compose, namedConnect, lifecycle} from '../../util/container'
import * as I from 'immutable'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Header from './header'

type OwnProps = {|
  path: Types.Path,
  routePath: I.List<string>,
|}

const mapStateToProps = (state, {path}: OwnProps) => ({
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})

const mapDispatchToProps = dispatch => ({
  loadFilePreview: (path: Types.Path) => dispatch(FsGen.createFilePreviewLoad({path})),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const mergeProps = (stateProps, dispatchProps, {path, routePath}) => ({
  loadFilePreview: dispatchProps.loadFilePreview,
  name: stateProps._pathItem.name,
  onBack: dispatchProps.onBack,
  path,
  routePath,
})

export default compose(
  namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'FilePreviewHeader'),
  lifecycle({
    componentDidMount() {
      this.props.loadFilePreview(this.props.path)
    },
  })
)(Header)
