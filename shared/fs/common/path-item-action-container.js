// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import {
  compose,
  connect,
  lifecycle,
  setDisplayName,
  type TypedState,
  type Dispatch,
} from '../../util/container'
import PathItemAction from './path-item-action'
import {fileUIName, isMobile, isIOS, isAndroid} from '../../constants/platform'

type OwnProps = {
  path: Types.Path,
  actionIconClassName?: string,
  actionIconFontSize?: number,
}

const mapStateToProps = (state: TypedState) => {
  const _pathItems = state.fs.pathItems
  const _username = state.config.username || undefined

  return {
    _pathItems,
    _username,
    fileUIEnabled: state.favorite.fuseStatus ? state.favorite.fuseStatus.kextStarted : false,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {path}: OwnProps) => ({
  _loadMimeType: (path: Types.Path) => dispatch(FsGen.createMimeTypeLoad({path})),
  _ignoreFolder: (path: Types.Path) => {
    dispatch(FsGen.createFavoriteIgnore({path}))
  },

  ...(isMobile
    ? {
        _saveMedia: (path: Types.Path) => dispatch(FsGen.createSaveMedia({path})),
        _shareNative: (path: Types.Path) => dispatch(FsGen.createShareNative({path})),
      }
    : {
        _showInFileUI: (path: Types.Path) =>
          dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
      }),

  ...(!isIOS
    ? {
        _download: (path: Types.Path) => dispatch(FsGen.createDownload({path, intent: 'none'})),
      }
    : {}),
})

const getRootMenuItems = (stateProps, dispatchProps, path: Types.Path) => {
  const {_pathItems, fileUIEnabled, _username} = stateProps
  const {_showInFileUI, _saveMedia, _shareNative, _download, _ignoreFolder} = dispatchProps
  const pathItem = _pathItems.get(path, Constants.unknownPathItem)
  let menuItems = []

  !isMobile &&
    fileUIEnabled &&
    menuItems.push({
      title: 'Show in ' + fileUIName,
      onClick: () => _showInFileUI(path),
    })

  isMobile &&
    pathItem.type !== 'folder' &&
    Constants.isMedia(pathItem) &&
    menuItems.push({
      title: 'Save',
      onClick: () => _saveMedia(path),
    })

  const shouldShowShareNative = isMobile && pathItem.type === 'file'
  shouldShowShareNative &&
    menuItems.push({
      title: 'Send to other app',
      onClick: () => _shareNative(path),
    })

  const shouldDownload = (isAndroid && pathItem.type !== 'folder') || !isMobile
  shouldDownload &&
    menuItems.push({
      title: 'Download a copy',
      onClick: () => _download(path),
    })

  Constants.showIgnoreFolder(path, pathItem, _username) &&
    menuItems.push({
      title: 'Ignore this folder',
      onClick: () => _ignoreFolder(path),
      subTitle: 'The folder will no longer appear in your folders list.',
      danger: true,
    })
  return menuItems
}

const mergeProps = (stateProps, dispatchProps, {path, actionIconClassName, actionIconFontSize}) => {
  const {_pathItems, _username} = stateProps
  const {_loadMimeType} = dispatchProps
  const pathItem = _pathItems.get(path, Constants.unknownPathItem)
  const {childrenFolders, childrenFiles} =
    !pathItem || pathItem.type !== 'folder'
      ? {childrenFolders: 0, childrenFiles: 0}
      : pathItem.children.reduce(
          ({childrenFolders, childrenFiles}, p) => {
            const pi = _pathItems.get(Types.pathConcat(path, p))
            if (!pi) {
              return {childrenFolders, childrenFiles}
            }
            return pi.type === 'folder'
              ? {childrenFolders: childrenFolders + 1, childrenFiles}
              : {childrenFolders, childrenFiles: childrenFiles + 1}
          },
          {childrenFolders: 0, childrenFiles: 0}
        )
  const pathElements = Types.getPathElements(path)
  const itemStyles = Constants.getItemStyles(pathElements, pathItem.type, _username)
  const menuItems = getRootMenuItems(stateProps, dispatchProps, path)
  return {
    type: pathItem.type,
    lastModifiedTimestamp: pathItem.lastModifiedTimestamp,
    lastWriter: pathItem.lastWriter.username,
    name: pathItem.name,
    size: pathItem.size,
    needLoadMimeType: pathItem.type === 'file' && pathItem.mimeType === '',
    childrenFolders,
    childrenFiles,
    pathElements,
    itemStyles,
    menuItems,
    loadMimeType: () => _loadMimeType(path),
    actionIconClassName,
    actionIconFontSize,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ConnectedPathItemAction'),
  lifecycle({
    componentDidMount() {
      if (this.props.needLoadMimeType) {
        this.props.loadMimeType()
      }
    },
  })
)(PathItemAction)
