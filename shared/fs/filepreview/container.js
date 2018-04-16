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
import {navigateAppend, navigateUp} from '../../actions/route-tree'

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
  _showInFileUI: (path: Types.Path) => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
  _share: path => {
    dispatch(
      navigateAppend([
        {
          props: {path, isShare: true},
          selected: 'pathItemAction',
        },
      ])
    )
  },
  _save: (path: Types.Path) => {
    dispatch(FsGen.createDownload({path, intent: 'camera-roll'}))
    dispatch(
      navigateAppend([
        {
          props: {path, isShare: true},
          selected: 'transferPopup',
        },
      ])
    )
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {fileUIEnabled, path, pathItem, _username} = stateProps
  const {loadFilePreview, onBack, _download, _save, _share, _showInFileUI} = dispatchProps
  const itemStyles = Constants.getItemStyles(Types.getPathElements(path), pathItem.type, _username)
  return {
    fileUIEnabled,
    path,
    pathItem,
    loadFilePreview,
    itemStyles,
    onShare: () => _share(path),
    onDownload: () => _download(path),
    onShowInFileUI: () => _showInFileUI(path),
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
