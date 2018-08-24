// @flow
import {
  compose,
  connect,
  lifecycle,
  setDisplayName,
  type TypedState,
} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {navigateUp} from '../../actions/route-tree'
import Header from './header'

const mapStateToProps = (state: TypedState, {path}) => {
  const pathItem = state.fs.pathItems.get(path, Constants.unknownPathItem)
  return {
    path,
    pathItem,
  }
}

const mapDispatchToProps = (dispatch, {routePath}) => ({
  loadFilePreview: (path: Types.Path) => dispatch(FsGen.createFilePreviewLoad({path})),
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {path, pathItem} = stateProps
  const {loadFilePreview, onBack} = dispatchProps
  return {
    pathItem,

    onBack,

    loadFilePreview,
    path,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('FilePreviewHeader'),
  lifecycle({
    componentDidMount() {
      this.props.loadFilePreview(this.props.path)
    },
  })
)(Header)
