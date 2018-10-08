// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as ConfigGen from '../../actions/config-gen'
import * as FsGen from '../../actions/fs-gen'
import {compose, connect, lifecycle, setDisplayName, type TypedState} from '../../util/container'
import PathItemAction from './path-item-action'
import {isMobile, isIOS, isAndroid} from '../../constants/platform'
import {OverlayParentHOC} from '../../common-adapters'

type OwnProps = {
  path: Types.Path,
  actionIconClassName?: string,
  actionIconFontSize?: number,
  actionIconWhite?: boolean,
}

const mapStateToProps = (state: TypedState) => ({
  _pathItems: state.fs.pathItems,
  _tlfs: state.fs.tlfs,
  _username: state.config.username,
  _fileUIEnabled: state.fs.fuseStatus ? state.fs.fuseStatus.kextStarted : false,
  _downloads: state.fs.downloads,
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  loadFolderList: () => dispatch(FsGen.createFolderListLoad({path, refreshTag: 'path-item-action-popup'})),
  loadMimeType: () => dispatch(FsGen.createMimeTypeLoad({path, refreshTag: 'path-item-action-popup'})),
  ignoreFolder: () => dispatch(FsGen.createFavoriteIgnore({path})),
  copyPath: () => dispatch(ConfigGen.createCopyToClipboard({text: Types.pathToString(path)})),
  ...(isMobile
    ? {
        _saveMedia: () => dispatch(FsGen.createSaveMedia(Constants.makeDownloadPayload(path))),
        _shareNative: () => dispatch(FsGen.createShareNative(Constants.makeDownloadPayload(path))),
      }
    : {
        _showInSystemFileManager: () => dispatch(FsGen.createOpenPathInSystemFileManager({path})),
      }),

  ...(!isIOS
    ? {
        _download: () => dispatch(FsGen.createDownload(Constants.makeDownloadPayload(path))),
      }
    : {}),
})

type actions = {
  showInSystemFileManager?: () => void,
  ignoreFolder?: () => void,
  saveMedia?: (() => void) | 'disabled',
  shareNative?: (() => void) | 'disabled',
  download?: () => void,
  copyPath?: () => void,
}
type MenuItemAppender = (
  menuActions: actions,
  stateProps: $Call<typeof mapStateToProps, TypedState>,
  dispatchProps: $Call<typeof mapDispatchToProps, Dispatch, OwnProps>,
  path: Types.Path
) => void

const aShowIn: MenuItemAppender = (menuActions, stateProps, dispatchProps, path) => {
  if (!isMobile && stateProps._fileUIEnabled) {
    menuActions.showInSystemFileManager = dispatchProps._showInSystemFileManager
  }
}

const aCopyPath: MenuItemAppender = (menuActions, stateProps, dispatchProps, path) => {
  menuActions.copyPath = dispatchProps.copyPath
}

const aIgnore: MenuItemAppender = (menuActions, stateProps, dispatchProps, path) => {
  if (Constants.showIgnoreFolder(path, stateProps._username || '')) {
    menuActions.ignoreFolder = dispatchProps.ignoreFolder
  }
}

const aSave: MenuItemAppender = (menuActions, stateProps, dispatchProps, path) => {
  const pathItem = stateProps._pathItems.get(path, Constants.unknownPathItem)
  if (isMobile && pathItem.type !== 'folder' && Constants.isMedia(pathItem)) {
    if (stateProps._downloads.find(download => Constants.isPendingDownload(download, path, 'camera-roll'))) {
      menuActions.saveMedia = 'disabled'
    } else {
      menuActions.saveMedia = dispatchProps._saveMedia
    }
  }
}

const aShareNative: MenuItemAppender = (menuActions, stateProps, dispatchProps, path) => {
  if (isMobile && stateProps._pathItems.get(path, Constants.unknownPathItem).type === 'file') {
    if (stateProps._downloads.find(download => Constants.isPendingDownload(download, path, 'share'))) {
      menuActions.shareNative = 'disabled'
    } else {
      menuActions.shareNative = dispatchProps._shareNative
    }
  }
}

const aDownload: MenuItemAppender = (menuActions, stateProps, dispatchProps, path) => {
  if (
    !isMobile ||
    (isAndroid && stateProps._pathItems.get(path, Constants.unknownPathItem).type !== 'folder')
  ) {
    menuActions.download = dispatchProps._download
  }
}

const tlfListAppenders: Array<MenuItemAppender> = [aShowIn, aCopyPath]
const tlfAppenders: Array<MenuItemAppender> = [aShowIn, aIgnore, aCopyPath]
const inTlfAppenders: Array<MenuItemAppender> = [aShowIn, aSave, aShareNative, aDownload, aCopyPath]

const getRootMenuActionsByAppenders = (
  appenders: Array<MenuItemAppender>,
  stateProps,
  dispatchProps,
  path: Types.Path
) => {
  const menuActions: actions = {}
  appenders.forEach(
    (appender: MenuItemAppender) => appender(menuActions, stateProps, dispatchProps, path),
    ({}: actions)
  )
  return menuActions
}

const getRootMenuActionsByPathLevel = (pathLevel: number, stateProps, dispatchProps, path: Types.Path) => {
  switch (pathLevel) {
    case 0:
      // The action is for `/`. This shouldn't be possible.
      return {}
    case 1:
      // The action is for `/keybase`. This shouldn't be possible as we never
      // have a /keybase row, and we don't show ... menu for root view.
      return {}
    case 2:
      // The action is for a tlf list, i.e. /keybase/private, /keybase/public,
      // or /keybase/team.
      return getRootMenuActionsByAppenders(tlfListAppenders, stateProps, dispatchProps, path)
    case 3:
      // The action is for a tlf.
      return getRootMenuActionsByAppenders(tlfAppenders, stateProps, dispatchProps, path)
    default:
      // The action is for something inside a tlf
      return getRootMenuActionsByAppenders(inTlfAppenders, stateProps, dispatchProps, path)
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {_pathItems, _username} = stateProps
  const {loadFolderList, loadMimeType} = dispatchProps
  const {path, actionIconClassName, actionIconFontSize, actionIconWhite} = ownProps
  const pathElements = Types.getPathElements(path)
  const pathItem = _pathItems.get(path, Constants.unknownPathItem)
  const type = pathElements.length <= 3 ? 'folder' : pathItem.type
  const {childrenFolders, childrenFiles} =
    !pathItem || type !== 'folder' || !pathItem.children
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
  const itemStyles = Constants.getItemStyles(pathElements, type, _username)
  const {
    showInSystemFileManager,
    ignoreFolder,
    saveMedia,
    shareNative,
    download,
    copyPath,
  } = getRootMenuActionsByPathLevel(pathElements.length, stateProps, dispatchProps, path)
  return {
    type,
    lastModifiedTimestamp: pathItem.lastModifiedTimestamp,
    lastWriter: pathItem.lastWriter.username,
    name: pathElements[pathElements.length - 1],
    size: pathItem.size,
    // The file content could change, resulting in a mime type change. So just
    // request it regardless whether we have it or not. The FS saga takes care
    // of preventing the RPC if it's already subscribed.
    needLoadMimeType: type === 'file',
    needFolderList: type === 'folder' && pathElements.length >= 3,
    childrenFolders,
    childrenFiles,
    path,
    pathElements,
    itemStyles,
    loadMimeType,
    loadFolderList,
    actionIconClassName,
    actionIconFontSize,
    actionIconWhite,
    // menu actions
    showInSystemFileManager,
    ignoreFolder,
    saveMedia,
    shareNative,
    download,
    copyPath,
  }
}

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('ConnectedPathItemAction'),
  OverlayParentHOC,
  lifecycle({
    componentDidUpdate(prevProps) {
      if (!this.props.showingMenu || (prevProps.showingMenu && this.props.path === prevProps.path)) {
        return
      }
      this.props.needFolderList && this.props.loadFolderList()
      this.props.needLoadMimeType && this.props.loadMimeType()
    },
  })
)(PathItemAction)
