// @flow
import {
  compose,
  connect,
  lifecycle,
  setDisplayName,
  type Dispatch,
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
    _fileUIEnabled: state.favorite.fuseStatus ? state.favorite.fuseStatus.kextStarted : false,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routePath}) => ({
  loadFilePreview: (path: Types.Path) => dispatch(FsGen.createFilePreviewLoad({path})),
  onBack: () => dispatch(navigateUp()),
  _showInFileUI: (path: Types.Path) => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
  _openFinderPopup: (evt?: SyntheticEvent<>) =>
    dispatch(FsGen.createOpenFinderPopup({targetRect: Constants.syntheticEventToTargetRect(evt), routePath})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {_fileUIEnabled, path, pathItem} = stateProps
  const {loadFilePreview, onBack, _openFinderPopup, _showInFileUI} = dispatchProps
  return {
    pathItem,

    onBack,
    onShowInFileUI: _fileUIEnabled ? () => _showInFileUI(path) : _openFinderPopup,

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
