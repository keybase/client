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
import {FloatingMenuParentHOC} from '../../common-adapters/floating-menu'
import {copyToClipboard} from '../../util/clipboard'

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
  loadFolderList: () => dispatch(FsGen.createFolderListLoad({path, refreshTag: 'path-item-action-popup'})),
  loadMimeType: () => dispatch(FsGen.createMimeTypeLoad({path, refreshTag: 'path-item-action-popup'})),
  _ignoreFolder: () => dispatch(FsGen.createFavoriteIgnore({path})),
  copyPath: () => copyToClipboard(Types.pathToString(path)),
  ...(isMobile
    ? {
        _saveMedia: () => dispatch(FsGen.createSaveMedia({path})),
        _shareNative: () => dispatch(FsGen.createShareNative({path})),
      }
    : {
        _showInFileUI: () => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
      }),

  ...(!isIOS
    ? {
        _download: () => dispatch(FsGen.createDownload({path, intent: 'none'})),
      }
    : {}),
})

const getRootMenuItems = (stateProps, dispatchProps, path: Types.Path) => {
  const {_pathItems, fileUIEnabled, _username} = stateProps
  const {_showInFileUI, _saveMedia, _shareNative, _download, _ignoreFolder, copyPath} = dispatchProps
  const pathItem = _pathItems.get(path, Constants.unknownPathItem)
  let menuItems = []

  !isMobile &&
    fileUIEnabled &&
    menuItems.push({
      title: 'Show in ' + fileUIName,
      onClick: () => _showInFileUI(),
    })

  isMobile &&
    pathItem.type !== 'folder' &&
    Constants.isMedia(pathItem) &&
    menuItems.push({
      title: 'Save',
      onClick: () => _saveMedia(),
    })

  const shouldShowShareNative = isMobile && pathItem.type === 'file'
  shouldShowShareNative &&
    menuItems.push({
      title: 'Send to other app',
      onClick: () => _shareNative(),
    })

  const shouldDownload = (isAndroid && pathItem.type !== 'folder') || !isMobile
  shouldDownload &&
    menuItems.push({
      title: 'Download a copy',
      onClick: () => _download(),
    })

  Constants.showIgnoreFolder(path, pathItem, _username) &&
    menuItems.push({
      title: 'Ignore this folder',
      onClick: () => _ignoreFolder(),
      subTitle: 'The folder will no longer appear in your folders list.',
      danger: true,
    })

  menuItems.push({
    title: 'Copy path',
    onClick: copyPath,
  })
  return menuItems
}

const mergeProps = (stateProps, dispatchProps, {path, actionIconClassName, actionIconFontSize}) => {
  const {_pathItems, _username} = stateProps
  const {loadFolderList, loadMimeType} = dispatchProps
  const pathItem = _pathItems.get(path, Constants.unknownPathItem)
  const {childrenFolders, childrenFiles} =
    !pathItem || pathItem.type !== 'folder'
      ? {childrenFolders: 0, childrenFiles: 0}
      : pathItem.children.reduce(
          ({childrenFolders, childrenFiles}, p) => {
            const isFolder =
              _pathItems.get(Types.pathConcat(path, p), Constants.unknownPathItem).type === 'folder'
            return {
              childrenFolders: childrenFolders + (isFolder ? 1 : 0),
              childrenFiles: childrenFiles + (isFolder ? 0 : 1),
            }
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
    needFolderList: pathItem.type === 'folder',
    childrenFolders,
    childrenFiles,
    pathElements,
    itemStyles,
    menuItems,
    loadMimeType,
    loadFolderList,
    actionIconClassName,
    actionIconFontSize,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ConnectedPathItemAction'),
  FloatingMenuParentHOC,
  lifecycle({
    componentDidUpdate(prevProps) {
      if (!this.props.showingMenu || (prevProps.showingMenu && this.props.path === prevProps.path)) {
        return
      }
      // TODO: get rid of these when we have notifications in place.
      this.props.needFolderList && this.props.loadFolderList()
      this.props.needLoadMimeType && this.props.loadMimeType()
    },
  })
)(PathItemAction)
