// @flow
import {compose, namedConnect, lifecycle} from '../../util/container'
import * as I from 'immutable'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {navigateUp} from '../../actions/route-tree'
import Header from './header'

type OwnProps = {|
  path: Types.Path,
  routePath: I.List<string>,
|}

const mapStateToProps = (state, {path}: OwnProps) => {
  const pathItem = state.fs.pathItems.get(path, Constants.unknownPathItem)
  return {
    path,
    pathItem,
  }
}

const mapDispatchToProps = (dispatch) => ({
  loadFilePreview: (path: Types.Path) => dispatch(FsGen.createFilePreviewLoad({path})),
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => {
  const {path, pathItem} = stateProps
  const {loadFilePreview, onBack} = dispatchProps
  return {
    path,
    pathItem,
    loadFilePreview,
    onBack,
  }
}

export default compose(
  namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'FilePreviewHeader'),
  lifecycle({
    componentDidMount() {
      this.props.loadFilePreview(this.props.path)
    },
  })
)(Header)
