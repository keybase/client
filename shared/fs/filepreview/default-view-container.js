// @flow
import {compose, connect, setDisplayName, type Dispatch, type TypedState} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import DefaultView from './default-view'
import {navigateAppend} from '../../actions/route-tree'

const mapStateToProps = (state: TypedState, {path}) => {
  const pathItem = state.fs.pathItems.get(path) || Constants.makeUnknownPathItem()
  const _username = state.config.username || undefined
  return {
    _username,
    _path: path,
    fileUIEnabled: state.favorite.fuseStatus ? state.favorite.fuseStatus.kextStarted : false,
    pathItem,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routePath}) => ({
  _download: (path: Types.Path) => dispatch(FsGen.createDownload({path, intent: 'none'})),
  _openFinderPopup: (evt?: SyntheticEvent<>) =>
    dispatch(FsGen.createOpenFinderPopup({targetRect: Constants.syntheticEventToTargetRect(evt), routePath})),
  _save: (path: Types.Path) => dispatch(FsGen.createSave({path, routePath})),
  _share: (path: Types.Path) => dispatch(FsGen.createShare({path, routePath})),
  _openAsText: (path: Types.Path) =>
    dispatch(
      navigateAppend([
        {
          props: {path, fileViewType: 'text'},
          selected: 'preview',
        },
      ])
    ),
  _showInFileUI: (path: Types.Path) => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
})

const mergeProps = (stateProps, dispatchProps) => {
  const {fileUIEnabled, _path, pathItem, _username} = stateProps
  const {_download, _openFinderPopup, _save, _share, _showInFileUI, _openAsText} = dispatchProps
  const itemStyles = Constants.getItemStyles(Types.getPathElements(_path), pathItem.type, _username)
  return {
    fileUIEnabled,
    itemStyles,
    pathItem,

    onDownload: () => _download(_path),
    onSave: () => _save(_path),
    onShare: () => _share(_path),
    onOpenAsText: () => _openAsText(_path),
    onShowInFileUI: fileUIEnabled ? () => _showInFileUI(_path) : _openFinderPopup,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('FilePreviewDefaultView')
)(DefaultView)
