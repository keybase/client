// @flow
import {
  compose,
  connect,
  lifecycle,
  setDisplayName,
  type Dispatch,
  type TypedState,
} from '../../util/container'
import FilePreview from '.'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {navigateUp} from '../../actions/route-tree'
import * as DispatchMappers from '../utils/dispatch-mappers'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const path = Types.stringToPath(routeProps.get('path', Constants.defaultPath))
  const pathItem = state.fs.pathItems.get(path) || Constants.makeUnknownPathItem()
  const _username = state.config.username || undefined
  return {
    _username,
    path,
    pathItem,
    fileUIEnabled: state.favorite.fuseStatus ? state.favorite.fuseStatus.kextStarted : false,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  loadFilePreview: (path: Types.Path) => dispatch(FsGen.createFilePreviewLoad({path})),
  onBack: () => dispatch(navigateUp()),
  _download: (path: Types.Path) => dispatch(FsGen.createDownload({path, intent: 'none'})),
  _showInFileUI: DispatchMappers.mapDispatchToShowInFileUI(dispatch),
  _onAction: DispatchMappers.mapDispatchToOnAction(dispatch),
  _openFinderPopup: DispatchMappers.mapDispatchToOpenFinderPopup(dispatch),
  _share: DispatchMappers.mapDispatchToShare(dispatch),
  _save: DispatchMappers.mapDispatchToSave(dispatch),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {fileUIEnabled, path, pathItem, _username} = stateProps
  const {
    loadFilePreview,
    onBack,
    _onAction,
    _download,
    _openFinderPopup,
    _save,
    _share,
    _showInFileUI,
  } = dispatchProps
  const itemStyles = Constants.getItemStyles(Types.getPathElements(path), pathItem.type, _username)
  return {
    fileUIEnabled,
    itemStyles,
    loadFilePreview,
    path,
    pathItem,
    onAction: (event: SyntheticEvent<>) => _onAction(path, pathItem.type, event),
    onShare: () => _share(path),
    onDownload: () => _download(path),
    onShowInFileUI: fileUIEnabled ? () => _showInFileUI(path) : _openFinderPopup,
    onSave: () => _save(path),
    onBack,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('FilePreview'),
  lifecycle({
    componentDidMount() {
      this.props.loadFilePreview(this.props.path)
    },
  })
)(FilePreview)
