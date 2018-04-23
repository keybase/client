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
import * as DispatchMappers from '../utils/dispatch-mappers'
import Header from './header'

const mapStateToProps = (state: TypedState, {path}) => {
  const pathItem = state.fs.pathItems.get(path) || Constants.makeUnknownPathItem()
  return {
    path,
    pathItem,
    _fileUIEnabled: state.favorite.fuseStatus ? state.favorite.fuseStatus.kextStarted : false,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  loadFilePreview: (path: Types.Path) => dispatch(FsGen.createFilePreviewLoad({path})),
  onBack: () => dispatch(navigateUp()),
  _showInFileUI: DispatchMappers.mapDispatchToShowInFileUI(dispatch),
  _onAction: DispatchMappers.mapDispatchToOnAction(dispatch),
  _openFinderPopup: DispatchMappers.mapDispatchToOpenFinderPopup(dispatch),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {_fileUIEnabled, path, pathItem} = stateProps
  const {loadFilePreview, onBack, _onAction, _openFinderPopup, _showInFileUI} = dispatchProps
  return {
    pathItem,

    onAction: (event: SyntheticEvent<>) => _onAction(path, pathItem.type, event),
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
