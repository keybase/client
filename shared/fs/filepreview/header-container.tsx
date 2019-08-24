import {namedConnect} from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Header from './header'

type OwnProps = {
  path: Types.Path
}

const mapStateToProps = (state, {path}: OwnProps) => ({
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const mergeProps = (stateProps, dispatchProps, {path}: OwnProps) => ({
  name: stateProps._pathItem.name,
  onBack: dispatchProps.onBack,
  path,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'FilePreviewHeader')(Header)
